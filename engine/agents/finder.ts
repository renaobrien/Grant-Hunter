// Finder - proposes grant candidates via multi-angle web search. Ports the search
// approach from eos-grants/agents/digest.js. Generous by design; the Skeptic culls.

import { callClaude, MODELS, parseJsonFromResponse } from "../anthropic";
import { renderVoice, FINDER_ROLE } from "../render-profile";
import type { AgentUsage, Candidate, Profile } from "../types";

const SCHEMA = `Return ONLY a JSON array. Each item exactly:
{"funder": string, "program_name": string, "amount": string ("$50K-$100K" or "unknown"),
 "deadline": string ("YYYY-MM-DD" | "rolling" | "unknown"), "fit_score": integer 1-5,
 "framing_angle": string, "eligibility_notes": string, "blockers": string,
 "notes": string (1-2 sentences on fit/timing), "source_url": string, "application_url": string}
No prose outside the array.`;

export async function runFinder(opts: {
  apiKey: string;
  profile: Profile;
  preferenceContext: string;
  today: string;
  priorNotes?: string;
  /** "Funder - Program" labels of grants already in the pipeline; don't re-propose. */
  exclusions?: string[];
  count?: number;
  /** 'fast' trims the web-search budget for quicker, cheaper runs. */
  fast?: boolean;
}): Promise<{ candidates: Candidate[]; usage: AgentUsage }> {
  const system = [renderVoice(opts.profile), FINDER_ROLE, opts.preferenceContext].join("\n\n");
  const count = opts.count ?? 12;
  const user = [
    `Today is ${opts.today}. Run grant discovery for this organization.`,
    opts.exclusions?.length
      ? `ALREADY TRACKED - these are in our pipeline; do NOT re-propose them, find NEW opportunities:\n${opts.exclusions
          .map((e) => `- ${e}`)
          .join("\n")}`
      : "",
    opts.priorNotes
      ? `PRIOR ROUND FEEDBACK - search DIFFERENTLY to address these; do not re-propose what was already refuted:\n${opts.priorNotes}`
      : "",
    `Find up to ${count} currently-open or upcoming opportunities that fit. Verify deadline, amount, and eligibility on each funder's own page.`,
    SCHEMA,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await callClaude({
    apiKey: opts.apiKey,
    system,
    userMessage: user,
    model: MODELS.sonnet,
    maxTokens: 16000,
    webSearchMaxUses: opts.fast ? 6 : 10,
  });

  const parsed = parseJsonFromResponse(res.text, res.stopReason);
  const candidates = Array.isArray(parsed) ? (parsed as Candidate[]) : [];
  return {
    candidates,
    usage: {
      model: MODELS.sonnet,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      stopReason: res.stopReason,
      webSearchRequests: res.webSearchRequests,
    },
  };
}
