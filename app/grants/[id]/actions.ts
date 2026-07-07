"use server";

// Server Actions for the grant detail surface. All writes go through the
// request-scoped authed client, so RLS enforces the members allowlist.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RejectionReason } from "@/lib/types";

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
 * Queue a narrative draft: a `drafts` row (status=queued) plus a `jobs` row the
 * Node worker polls. The worker fills in content + draft_rounds asynchronously.
 */
export async function requestDraft(grantId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: draftErr } = await supabase
    .from("drafts")
    .insert({ grant_id: grantId, status: "queued" });
  if (draftErr) return { ok: false, error: draftErr.message };

  const { error: jobErr } = await supabase.from("jobs").insert({
    type: "narrative_draft",
    payload: { grant_id: grantId },
    status: "queued",
  });
  if (jobErr) return { ok: false, error: jobErr.message };

  revalidatePath(`/grants/${grantId}`);
  return { ok: true };
}
