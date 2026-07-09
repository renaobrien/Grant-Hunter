// Skeptic - the red-team adversary. Tries to REFUTE each candidate on eligibility,
// fit, and freshness. Adopts the contrarian framing from cultivator-map's critic-review.

import { callClaude, MODELS, parseJsonFromResponse } from "../anthropic";
import { renderVoice, SKEPTIC_ROLE } from "../render-profile";
import type { AgentUsage, Candidate, Profile, SkepticVerdict } from "../types";

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
}): Promise<{ verdicts: SkepticVerdict[]; usage: AgentUsage }> {
  const model = opts.fast ? MODELS.sonnet : MODELS.opus;
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
    maxTokens: 8000,
    webSearchMaxUses: opts.fast ? 4 : 8,
  });

  const parsed = parseJsonFromResponse(res.text, res.stopReason);
  const verdicts = Array.isArray(parsed) ? (parsed as SkepticVerdict[]) : [];
  return {
    verdicts,
    usage: {
      model,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      stopReason: res.stopReason,
      webSearchRequests: res.webSearchRequests,
    },
  };
}
