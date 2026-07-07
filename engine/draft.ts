// draft.ts — the Drafter <-> Critic drafting orchestrator.
// Loads the org profile + one grant, then loops up to 3 rounds of Drafter -> Critic,
// persisting each round to draft_rounds, feeding the critique back into the next draft,
// and stopping early when the Critic approves. Every agent call is logged to agent_runs
// (feeding the daily budget cap); the budget is checked before each round. On success the
// drafts row is finalized to 'ready' and a draft_ready notification fires. Never throws.

import type { SupabaseClient } from "@supabase/supabase-js";
import { runDrafter, type GrantForDraft } from "./agents/drafter";
import { runCritic, type CriticVerdict } from "./agents/critic";
import {
  budgetRemainingCents,
  finishRun,
  loadProfile,
  loadSettings,
  startRun,
} from "./db";
import { sendNotification } from "./notify";
import type { AgentUsage } from "./types";

export interface DraftSummary {
  draftId: string;
  status: "ready" | "error";
  rounds: number;
  error?: string;
}

const MAX_ROUNDS = 3;

/** Log an agent call as an agent_runs row (cost feeds the budget cap). Copied from
 * discovery.ts so the drafting loop tracks + bills identically. */
async function tracked<T extends { usage: AgentUsage }>(
  sb: SupabaseClient,
  agentType: string,
  trigger: "scheduled" | "manual",
  input: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const run = await startRun(sb, agentType, trigger, input);
  try {
    const r = await fn();
    await finishRun(sb, run, { status: "success", usage: r.usage });
    return r;
  } catch (e) {
    await finishRun(sb, run, { status: "error", error: (e as Error).message });
    throw e;
  }
}

const GRANT_FIELDS =
  "funder, program_name, amount, deadline, framing_angle, eligibility_notes, notes, recommendation, alignment_rationale, source_url, application_url";

/** Find the most recent queued/running drafts row for this grant and mark it running;
 * insert one if none exists. Returns the drafts row id we'll write into. */
async function resolveDraftRow(sb: SupabaseClient, grantId: string): Promise<string> {
  const { data } = await sb
    .from("drafts")
    .select("id")
    .eq("grant_id", grantId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.id) {
    await sb.from("drafts").update({ status: "running" }).eq("id", data.id);
    return data.id as string;
  }

  const { data: inserted, error } = await sb
    .from("drafts")
    .insert({ grant_id: grantId, status: "running" })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(`could not create draft row: ${error?.message ?? "no row"}`);
  return inserted.id as string;
}

async function loadGrant(sb: SupabaseClient, grantId: string): Promise<GrantForDraft | null> {
  const { data } = await sb.from("grants").select(GRANT_FIELDS).eq("id", grantId).maybeSingle();
  return data ? (data as unknown as GrantForDraft) : null;
}

/** Turn a Critic verdict into the next Drafter's revision brief. Empty when the
 * critic gave neither issues nor suggestions. */
function critiqueBrief(v: CriticVerdict): string | undefined {
  const parts = [
    v.issues.length ? `Issues:\n${v.issues.map((i) => `- ${i}`).join("\n")}` : "",
    v.suggestions.length ? `Suggestions:\n${v.suggestions.map((s) => `- ${s}`).join("\n")}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : undefined;
}

async function markError(sb: SupabaseClient, draftId: string, message: string): Promise<void> {
  if (!draftId) return;
  try {
    await sb.from("drafts").update({ status: "error", error: message }).eq("id", draftId);
  } catch (e) {
    console.error(`[draft] failed to mark draft ${draftId} error: ${(e as Error).message}`);
  }
}

export async function runDraft(
  sb: SupabaseClient,
  opts: { apiKey: string; grantId: string; trigger?: "scheduled" | "manual" },
): Promise<DraftSummary> {
  const trigger = opts.trigger ?? "scheduled";
  let draftId = "";
  let rounds = 0;

  try {
    // Resolve the target drafts row first so we always have an id to report/finalize.
    draftId = await resolveDraftRow(sb, opts.grantId);

    const [profile, grant] = await Promise.all([loadProfile(sb), loadGrant(sb, opts.grantId)]);
    if (!grant) {
      const msg = `grant ${opts.grantId} not found`;
      await markError(sb, draftId, msg);
      return { draftId, status: "error", rounds, error: msg };
    }

    const { daily_budget_usd } = await loadSettings(sb);

    let priorCritique: string | undefined;
    let latestDraft = "";

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      // Enforce the daily cap BEFORE spending on the round.
      if ((await budgetRemainingCents(sb, daily_budget_usd)) <= 0) break;

      const { draft } = await tracked(sb, "drafter", trigger, { grantId: opts.grantId, round }, () =>
        runDrafter({ apiKey: opts.apiKey, profile, grant, priorCritique }),
      );
      latestDraft = draft;

      const { verdict } = await tracked(sb, "critic", trigger, { grantId: opts.grantId, round }, () =>
        runCritic({ apiKey: opts.apiKey, profile, grant, draft }),
      );

      rounds = round;
      await sb
        .from("draft_rounds")
        .insert({ draft_id: draftId, round, draft_text: draft, critic_verdict: verdict });

      if (verdict.approved) break;
      priorCritique = critiqueBrief(verdict);
    }

    // Finalize with whatever draft exists. No draft at all => the budget was spent
    // before a single round could run; that's an error, not a shippable draft.
    if (!latestDraft) {
      const msg = "daily budget exhausted before any draft could be produced";
      await markError(sb, draftId, msg);
      return { draftId, status: "error", rounds, error: msg };
    }

    await sb
      .from("drafts")
      .update({ content: latestDraft, status: "ready", rounds })
      .eq("id", draftId);

    // Notify best-effort: a notification failure must NOT flip a ready draft to error.
    try {
      await sendNotification(
        sb,
        "draft_ready",
        `Draft ready: ${grant.funder}`,
        latestDraft.slice(0, 400),
      );
    } catch (e) {
      console.error(`[draft] draft_ready notification failed: ${(e as Error).message}`);
    }

    return { draftId, status: "ready", rounds };
  } catch (e) {
    const msg = (e as Error).message;
    await markError(sb, draftId, msg);
    return { draftId, status: "error", rounds, error: msg };
  }
}
