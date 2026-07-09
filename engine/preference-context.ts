// preference-context.ts - the teaching loop (req #3), single-org.
// Generalizes eos-grants/lib/grants.js buildPreferenceContext():
//   1) numeric buckets from human scores (proven), PLUS
//   2) freeform rationale text appended verbatim so the agents learn *why*, PLUS
//   3) an optional distilled summary (settings.preference_summary) prepended.
// The returned string is injected AFTER renderVoice() in each agent's prompt.

import type { SupabaseClient } from "@supabase/supabase-js";

interface ScoredGrant {
  funder: string;
  program_name: string | null;
  human_score: number | null;
  rejection_reason: string | null;
  fit_score: number | null;
  framing_angle: string | null;
  blockers: string | null;
  status: string | null;
  outcome: string | null;
}

type RatingGrant = { funder: string | null; program_name: string | null };
interface RatingRow {
  score: number | null;
  feedback: string | null;
  // supabase-js types embedded relations as arrays; at runtime a to-one is an object.
  grants: RatingGrant | RatingGrant[] | null;
}

const NO_FEEDBACK =
  "No human scoring feedback yet. Prefer honest recommendations over overfitting.";

export async function getPreferenceContext(sb: SupabaseClient): Promise<string> {
  const [{ data: grants }, { data: ratings }, { data: settings }] = await Promise.all([
    sb
      .from("grants")
      .select(
        "funder, program_name, human_score, rejection_reason, fit_score, framing_angle, blockers, status, outcome",
      ),
    sb
      .from("grant_ratings")
      .select("score, feedback, grants(funder, program_name)")
      .not("feedback", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
    sb.from("settings").select("preference_summary").eq("id", 1).single(),
  ]);

  const label = (g: { funder: string | null; program_name: string | null }) =>
    `${g.funder ?? "Unknown"}${g.program_name ? ` - ${g.program_name}` : ""}`;

  const sections: string[] = [];

  const summary = (settings as { preference_summary?: string | null } | null)?.preference_summary
    ?.trim();
  if (summary) sections.push(`What we've learned about this org's preferences:\n${summary}`);

  const list = (grants ?? []) as ScoredGrant[];

  const applied = list
    .filter((g) => ["submitted", "awarded"].includes(g.status ?? ""))
    .slice(0, 5)
    .map((g) => `${label(g)} (${g.framing_angle ?? "no angle"}; fit ${g.fit_score ?? "?"}/5)`);

  // Real outcomes - the strongest signal we have (ground truth, not a pre-rating).
  const won = list
    .filter((g) => g.outcome === "awarded")
    .slice(0, 6)
    .map((g) => `${label(g)} (${g.framing_angle ?? "no angle"})`);
  const lostApplied = list
    .filter((g) => g.outcome === "rejected")
    .slice(0, 6)
    .map((g) => `${label(g)} (${g.framing_angle ?? "no angle"})`);

  const scored = list.filter(
    (g) => g.human_score !== null && !Number.isNaN(Number(g.human_score)),
  );

  const liked = scored
    .filter((g) => Number(g.human_score) >= 4)
    .sort((a, b) => Number(b.human_score) - Number(a.human_score))
    .slice(0, 3)
    .map((g) => `${label(g)} (${g.human_score}/5; ${g.framing_angle ?? "no angle"})`);

  const low = scored.filter((g) => Number(g.human_score) <= 2);
  const byReason = (r: string) => low.filter((g) => g.rejection_reason === r);

  const stale = byReason("stale").slice(0, 4).map(label);
  const hardIneligible = byReason("eligibility")
    .slice(0, 4)
    .map((g) => `${label(g)} (${g.blockers ?? "unspecified"})`);
  const misaligned = byReason("misaligned").slice(0, 4).map(label);
  const other = low
    .filter(
      (g) => !g.rejection_reason || ["invite-only", "size", "timing"].includes(g.rejection_reason),
    )
    .slice(0, 4)
    .map((g) => `${label(g)} (${g.rejection_reason ?? "unspecified"})`);

  // Board-only rejections: moved to passed/discarded/dead without a written
  // rating. Weaker signal than a scored rejection, but still a signal.
  const boardPassed = list
    .filter(
      (g) =>
        ["dead"].includes(g.status ?? "") &&
        g.human_score == null,
    )
    .slice(0, 6)
    .map((g) => `${label(g)} (moved to ${g.status})`);

  if (won.length)
    sections.push(
      `WON these (strongest positive signal - prioritize funders and framings like these): ${won.join(" | ")}`,
    );
  if (lostApplied.length)
    sections.push(
      `Applied but did NOT win - still plausibly fundable; strengthen the framing or find better-fit funders rather than dropping the type: ${lostApplied.join(" | ")}`,
    );
  if (applied.length)
    sections.push(`Grants we actually applied to - find more like these: ${applied.join(" | ")}`);
  if (liked.length) sections.push(`Strong fits we want more of: ${liked.join(" | ")}`);
  if (stale.length)
    sections.push(
      `Stale listings - funder may still be worth pursuing if a new cycle opens: ${stale.join(" | ")}`,
    );
  if (hardIneligible.length)
    sections.push(
      `Hard eligibility disqualifiers - do not re-surface these programs: ${hardIneligible.join(" | ")}`,
    );
  if (misaligned.length)
    sections.push(`Poor mission fit - avoid similar program types: ${misaligned.join(" | ")}`);
  if (other.length) sections.push(`Deprioritised for other reasons: ${other.join(" | ")}`);
  if (boardPassed.length)
    sections.push(
      `Moved off the board without a written reason - treat as a mild negative signal and deprioritise similar programs: ${boardPassed.join(" | ")}`,
    );

  const freeform = ((ratings ?? []) as unknown as RatingRow[])
    .filter((r) => r.feedback?.trim())
    .map((r) => {
      const gr: RatingGrant | null = Array.isArray(r.grants) ? r.grants[0] ?? null : r.grants;
      const g = gr ? label(gr) : "a grant";
      return `- ${g} (${r.score ?? "?"}/5): "${r.feedback!.trim()}"`;
    });
  if (freeform.length)
    sections.push(`Reviewer rationale in their own words - weight this heavily:\n${freeform.join("\n")}`);

  return sections.length ? sections.join("\n\n") : NO_FEEDBACK;
}
