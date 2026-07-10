// Skeptic - the red-team adversary. Tries to REFUTE each candidate on eligibility,
// fit, and freshness. Adopts the contrarian framing from cultivator-map's critic-review.

import { callClaude, MODELS, parseJsonFromResponse, worstCaseCents } from "../anthropic";
import { renderVoice, SKEPTIC_ROLE } from "../render-profile";
import type { AgentUsage, Candidate, Profile, SkepticVerdict } from "../types";

const MAX_TOKENS = 8000;
const modelFor = (fast?: boolean) => (fast ? MODELS.sonnet : MODELS.opus);
const searchBudgetFor = (fast?: boolean) => (fast ? 3 : 4);

/** Worst-case cents for one skeptic call: pre-flight budget check + error floor. */
export const skepticWorstCaseCents = (fast?: boolean): number =>
  worstCaseCents({
    model: modelFor(fast),
    maxTokens: MAX_TOKENS,
    webSearchMaxUses: searchBudgetFor(fast),
  });

const SCHEMA = `Return ONLY a JSON array with EXACTLY one verdict per candidate, in the SAME ORDER as given. Each item exactly:
{"verdict": "refuted" | "needs-verification" | "survives", "kill_shot": string (one line: why it dies, or why it survives),
 "eligibility_ok": boolean, "deadline_ok": boolean}
No prose outside the array.`;

export async function runSkeptic(opts: {
  apiKey: string;
  profile: Profile;
  candidates: Candidate[];
  /** 'fast' drops to the search-tier model with a smaller web-search budget. */
  fast?: boolean;
  /** Abort in-flight API requests once the run's wall clock is up. */
  deadlineMs?: number;
}): Promise<{ verdicts: SkepticVerdict[]; usage: AgentUsage }> {
  const model = modelFor(opts.fast);
  const system = [renderVoice(opts.profile), SKEPTIC_ROLE].join("\n\n");
  const user = [
    "Here are the Finder's candidates as JSON. Try to REFUTE each one - assume it's wrong until the funder's own page proves otherwise.",
    JSON.stringify(opts.candidates, null, 2),
    SCHEMA,
  ].join("\n\n");

  const res = await callClaude({
    apiKey: opts.apiKey,
    system,
    userMessage: user,
    model,
    maxTokens: MAX_TOKENS,
    // Search results dominate this call's input cost (Opus rates in thorough
    // mode), so the budget stays small; spot-check the shakiest claims.
    webSearchMaxUses: searchBudgetFor(opts.fast),
    deadlineMs: opts.deadlineMs,
  });

  const usage: AgentUsage = {
    model,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    stopReason: res.stopReason,
    webSearchRequests: res.webSearchRequests,
  };

  // Carry usage on a parse failure so the spent tokens still hit the daily cap.
  let parsed: unknown;
  try {
    parsed = parseJsonFromResponse(res.text, res.stopReason);
  } catch (e) {
    throw Object.assign(e as Error, { usage });
  }

  const verdicts = Array.isArray(parsed) ? (parsed as SkepticVerdict[]) : [];
  return { verdicts, usage };
}
