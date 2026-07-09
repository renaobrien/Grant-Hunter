"use server";

// Server Actions for the grant detail surface. All writes go through the
// request-scoped authed client, so RLS enforces the members allowlist.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  budgetRemainingCents,
  finishRun,
  loadSettings,
  resolveAnthropicKey,
  startRun,
} from "@/engine/db";
import { extractRequirements } from "@/engine/agents/requirements";
import { friendlyClaudeError } from "@/engine/anthropic";
import { isHttp } from "@/engine/url-check";
import type { AgentUsage } from "@/engine/types";
import type { GrantOutcome, RejectionReason } from "@/lib/types";

type ActionResult = { ok: boolean; error?: string };

/**
 * Record a human rating (append-only) AND fold it back onto the grant row:
 * a low score (<=2) also captures the rejection reason on the grant itself.
 */
export async function saveRating(
  grantId: string,
  score: number,
  rejection_reason: RejectionReason | null,
  feedback: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  const reason = score <= 2 ? rejection_reason : null;

  const { error: ratingErr } = await supabase.from("grant_ratings").insert({
    grant_id: grantId,
    rated_by: email,
    score,
    rejection_reason: reason,
    feedback: feedback.trim() || null,
  });
  if (ratingErr) return { ok: false, error: ratingErr.message };

  const { error: grantErr } = await supabase
    .from("grants")
    .update({ human_score: score, rejection_reason: reason })
    .eq("id", grantId);
  if (grantErr) return { ok: false, error: grantErr.message };

  revalidatePath(`/grants/${grantId}`);
  return { ok: true };
}

/** Save the funder's application requirements (pasted, or edited after extract). */
export async function saveApplicationSpec(
  grantId: string,
  spec: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("grants")
    .update({ application_spec: spec.trim() || null })
    .eq("id", grantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/grants/${grantId}`);
  return { ok: true };
}

/**
 * Opt-in: fetch the grant's application/source URL and extract the real
 * requirements with one budget-capped Sonnet call. Returns the extracted spec so
 * the UI can show it for review before it's relied on. Fails soft on unreadable
 * (JS/auth-walled) pages - the operator pastes instead.
 */
export async function extractApplicationSpec(
  grantId: string,
): Promise<{ ok: true; spec: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: grant } = await supabase
    .from("grants")
    .select("application_url, source_url")
    .eq("id", grantId)
    .maybeSingle();
  const url = isHttp(grant?.application_url)
    ? grant!.application_url
    : isHttp(grant?.source_url)
      ? grant!.source_url
      : null;
  if (!url) {
    return { ok: false, error: "This grant has no application or source URL to read." };
  }

  let apiKey: string;
  try {
    apiKey = await resolveAnthropicKey(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { daily_budget_usd } = await loadSettings(supabase);
  if ((await budgetRemainingCents(supabase, daily_budget_usd)) <= 0) {
    return {
      ok: false,
      error: "Daily budget is spent. Try again tomorrow, or raise it in Settings.",
    };
  }

  const run = await startRun(supabase, "requirements", "manual", { grantId });
  try {
    const { spec, usage } = await extractRequirements(url, apiKey);
    await finishRun(supabase, run, { status: "success", usage });
    await supabase.from("grants").update({ application_spec: spec }).eq("id", grantId);
    revalidatePath(`/grants/${grantId}`);
    return { ok: true, spec };
  } catch (e) {
    const usage = (e as { usage?: AgentUsage }).usage;
    await finishRun(supabase, run, { status: "error", usage, error: (e as Error).message });
    return { ok: false, error: friendlyClaudeError(e) };
  }
}

/**
 * Record the real result of a submitted application. This is the ground-truth
 * signal the teaching loop learns from (won vs lost, not just "pursued or not").
 * Also reflects the result in the pipeline status.
 */
export async function setOutcome(
  grantId: string,
  outcome: GrantOutcome | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { outcome };
  if (outcome === "awarded") update.status = "awarded";
  else if (outcome === "rejected" || outcome === "withdrawn") update.status = "dead";
  const { error } = await supabase.from("grants").update(update).eq("id", grantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/grants/${grantId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Save the operator's free-text notes (human-owned; the engine never writes here). */
export async function saveHumanNotes(
  grantId: string,
  notes: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("grants")
    .update({ human_notes: notes })
    .eq("id", grantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/grants/${grantId}`);
  return { ok: true };
}

/**
 * Start a narrative draft. Always inserts a `drafts` row (status=queued) so the
 * UI shows progress. On a local/self-host box it runs the draft NOW in a
 * detached process (no ~30-min wait); on a hosted (Vercel) instance it enqueues
 * a `jobs` row for the GitHub Actions worker to drain instead.
 */
export async function startDraft(grantId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: draftRow, error: draftErr } = await supabase
    .from("drafts")
    .insert({ grant_id: grantId, status: "queued" })
    .select("id")
    .single();
  if (draftErr || !draftRow) {
    return { ok: false, error: draftErr?.message ?? "Could not create a draft." };
  }

  // Hosted: the worker (GitHub Actions */30) drains the queue - we can't spawn.
  if (process.env.VERCEL) {
    const { error: jobErr } = await supabase.from("jobs").insert({
      type: "narrative_draft",
      payload: { grant_id: grantId },
      status: "queued",
    });
    if (jobErr) return { ok: false, error: jobErr.message };
    revalidatePath(`/grants/${grantId}`);
    return { ok: true };
  }

  // Local/self-host: fail fast on a missing key rather than a silent dead run.
  try {
    await resolveAnthropicKey(supabase);
  } catch (e) {
    await supabase
      .from("drafts")
      .update({ status: "error", error: (e as Error).message })
      .eq("id", draftRow.id);
    return { ok: false, error: (e as Error).message };
  }

  const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(tsxCli)) {
    return {
      ok: false,
      error:
        "Can't find the tsx runtime (node_modules/tsx). Run `npm install` in the project folder, then try again.",
    };
  }
  try {
    const child = spawn(process.execPath, [tsxCli, "engine/run-draft.ts", grantId], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (e) {
    return { ok: false, error: `Couldn't start drafting: ${(e as Error).message}` };
  }

  revalidatePath(`/grants/${grantId}`);
  return { ok: true };
}

/** Save operator edits to a draft. The engine only writes queued/running rows,
 *  so a 'ready' draft the human edited is never overwritten by a later run. */
export async function saveDraftContent(
  draftId: string,
  content: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("drafts").update({ content }).eq("id", draftId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
