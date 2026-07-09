// Judge - reconciles the Finder's claims and the Skeptic's refutations into a final
// call per candidate, and scores ethos alignment (req #6). Owns fit + ethos; defers to
// the Skeptic on eligibility + freshness (asymmetric tie-breaks in JUDGE_ROLE).

import { callClaude, MODELS, parseJsonFromResponse } from "../anthropic";
import { renderVoice, JUDGE_ROLE } from "../render-profile";
import type { AgentUsage, Candidate, JudgeRuling, Profile, SkepticVerdict } from "../types";

const SCHEMA = `Return ONLY a JSON array of rulings - EXACTLY one per candidate, in the SAME ORDER as the candidates (INCLUDE non-survivors with survives=false so the debate is auditable). Each item exactly:
{"survives": boolean, "funder": string, "program_name": string, "amount": string, "deadline": string,
 "fit_score": integer 1-5, "recommendation": "pursue"|"maybe"|"pass", "confidence": "low"|"medium"|"high",
 "alignment_score": integer 1-5, "alignment_rationale": string (one sentence on ethos fit),
 "framing_angle": string, "eligibility_notes": string, "blockers": string, "notes": string,
 "source_url": string, "application_url": string}
No prose outside the array.`;

export async function runJudge(opts: {
  apiKey: string;
  profile: Profile;
  candidates: Candidate[];
  verdicts: SkepticVerdict[];
  preferenceContext: string;
}): Promise<{ rulings: JudgeRuling[]; usage: AgentUsage }> {
  const system = [renderVoice(opts.profile), JUDGE_ROLE, opts.preferenceContext].join("\n\n");
  const user = [
    "FINDER CANDIDATES (JSON):",
    JSON.stringify(opts.candidates, null, 2),
    "SKEPTIC VERDICTS (JSON, same order as candidates):",
    JSON.stringify(opts.verdicts, null, 2),
    "Reconcile each candidate per your tie-break rules and score ethos alignment.",
    SCHEMA,
  ].join("\n\n");

  const res = await callClaude({
    apiKey: opts.apiKey,
    system,
    userMessage: user,
    model: MODELS.opus,
    maxTokens: 12000,
    // no web search - the Judge reasons over what Finder/Skeptic already gathered
  });

  const usage: AgentUsage = {
    model: MODELS.opus,
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

  const rulings = Array.isArray(parsed) ? (parsed as JudgeRuling[]) : [];
  return { rulings, usage };
}
