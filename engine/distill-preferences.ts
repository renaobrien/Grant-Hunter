// distill-preferences.ts - turn accumulated ratings + board activity into a
// short, durable guidance note stored in settings.preference_summary. That
// summary is prepended to every agent's preference context (see
// preference-context.ts), so it keeps long-tail signal that the raw last-12
// feedback window would otherwise drop. Cheap (Haiku), budget-gated by the
// caller. Never throws for the caller to swallow - it returns a summary.

import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, MODELS } from "./anthropic";
import type { AgentUsage } from "./types";

const SYSTEM = `
You distill an organization's grant preferences into a short guidance note for an automated grant-discovery agent. Output PLAIN TEXT, at most ~150 words, no preamble, no headers.
Capture, only from the data given: the kinds of grants / funders / framings they favor; what they reject and why (eligibility, size, misalignment, timing, invite-only); and any recurring theme in their written feedback. Be specific and concrete. Do NOT invent preferences the data does not show. If there is little signal, say so in one line.
`.trim();

type RelGrant = { funder: string | null; program_name: string | null };
interface RatingRow {
  score: number | null;
  feedback: string | null;
  grants: RelGrant | RelGrant[] | null;
}
interface GrantRow {
  funder: string | null;
  program_name: string | null;
  human_score: number | null;
  rejection_reason: string | null;
  status: string | null;
  framing_angle: string | null;
  outcome: string | null;
}

const label = (g: { funder: string | null; program_name: string | null }) =>
  `${g.funder ?? "Unknown"}${g.program_name ? ` - ${g.program_name}` : ""}`;

export async function distillPreferences(
  sb: SupabaseClient,
  apiKey: string,
): Promise<{ summary: string; usage: AgentUsage }> {
  const [{ data: ratings }, { data: grants }] = await Promise.all([
    sb
      .from("grant_ratings")
      .select("score, feedback, grants(funder, program_name)")
      .not("feedback", "is", null)
      .order("created_at", { ascending: false })
      .limit(40),
    sb
      .from("grants")
      .select(
        "funder, program_name, human_score, rejection_reason, status, framing_angle, outcome",
      ),
  ]);

  const list = (grants ?? []) as GrantRow[];
  const scored = list.filter((g) => g.human_score != null);
  const liked = scored
    .filter((g) => Number(g.human_score) >= 4)
    .map((g) => `${label(g)} (${g.human_score}/5; ${g.framing_angle ?? "no angle"})`);
  const disliked = scored
    .filter((g) => Number(g.human_score) <= 2)
    .map((g) => `${label(g)} (${g.rejection_reason ?? "unspecified"})`);
  const applied = list
    .filter((g) => ["submitted", "awarded"].includes(g.status ?? ""))
    .map((g) => `${label(g)} (${g.status})`);
  const won = list.filter((g) => g.outcome === "awarded").map((g) => `${label(g)} (${g.framing_angle ?? "no angle"})`);
  const lost = list.filter((g) => g.outcome === "rejected").map(label);
  const feedback = ((ratings ?? []) as RatingRow[])
    .filter((r) => r.feedback?.trim())
    .map((r) => {
      const gr: RelGrant | null = Array.isArray(r.grants) ? (r.grants[0] ?? null) : r.grants;
      return `- ${gr ? label(gr) : "a grant"} (${r.score ?? "?"}/5): "${r.feedback!.trim()}"`;
    });

  const parts = [
    won.length ? `WON (real outcome): ${won.join(" | ")}` : "",
    lost.length ? `Applied but lost (real outcome): ${lost.join(" | ")}` : "",
    applied.length ? `Applied to / in pipeline: ${applied.join(" | ")}` : "",
    liked.length ? `Rated highly: ${liked.join(" | ")}` : "",
    disliked.length ? `Rejected at triage: ${disliked.join(" | ")}` : "",
    feedback.length ? `Reviewer notes:\n${feedback.join("\n")}` : "",
  ].filter(Boolean);

  const userMessage = parts.length
    ? `Distill this organization's grant preferences into the guidance note:\n\n${parts.join("\n\n")}`
    : "There is no rating history yet. Produce a one-line note saying there is not enough signal to infer preferences.";

  const res = await callClaude({
    apiKey,
    system: SYSTEM,
    userMessage,
    model: MODELS.haiku,
    maxTokens: 800,
  });

  return {
    summary: res.text.trim(),
    usage: {
      model: MODELS.haiku,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      stopReason: res.stopReason,
      webSearchRequests: res.webSearchRequests,
    },
  };
}
