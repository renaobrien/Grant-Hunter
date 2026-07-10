// Finder - proposes grant candidates via multi-angle web search. Ports the search
// approach from eos-grants/agents/digest.js. Generous by design; the Skeptic culls.

import { callClaude, MODELS, parseJsonFromResponse, worstCaseCents } from "../anthropic";
import { renderVoice, FINDER_ROLE } from "../render-profile";
import type { AgentUsage, Candidate, Profile } from "../types";

const MAX_TOKENS = 6000;
const searchBudgetFor = (fast?: boolean) => (fast ? 3 : 4);

/** Worst-case cents for one finder call: pre-flight budget check + error floor. */
export const finderWorstCaseCents = (fast?: boolean): number =>
  worstCaseCents({
    model: MODELS.sonnet,
    maxTokens: MAX_TOKENS,
    webSearchMaxUses: searchBudgetFor(fast),
  });

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
  /** Abort in-flight API requests once the run's wall clock is up. */
  deadlineMs?: number;
}): Promise<{ candidates: Candidate[]; usage: AgentUsage }> {
  const system = [renderVoice(opts.profile), FINDER_ROLE, opts.preferenceContext].join("\n\n");
  const count = opts.count ?? 12;
  // Keep the search budget small and TELL the model what it is: an unbudgeted
  // prompt burns every allowed search and runs out of turns before emitting
  // JSON (max cost, zero candidates).
  const searchBudget = searchBudgetFor(opts.fast);
  const user = [
    `Today is ${opts.today}. Run grant discovery for this organization.`,
    `You have at most ${searchBudget} web searches. Plan them to cover different angles. After the last search, STOP searching and immediately output the JSON array from what you have.`,
    opts.exclusions?.length
      ? `ALREADY TRACKED - these are in our pipeline; do NOT re-propose them, find NEW opportunities:\n${opts.exclusions
          .map((e) => `- ${e}`)
          .join("\n")}`
      : "",
    opts.priorNotes
      ? `PRIOR ROUND FEEDBACK - search DIFFERENTLY to address these; do not re-propose what was already refuted:\n${opts.priorNotes}`
      : "",
    `Spend your searches on DISCOVERY BREADTH - a different angle each search (grant databases, funder directories, program announcements, ecosystem lists). Do NOT burn searches deep-verifying individual candidates; a dedicated fact-checking agent vets every proposal right after you.`,
    `Find up to ${count} currently-open or upcoming opportunities that fit. Only propose candidates you would score fit 3 or higher - fewer good candidates beat a padded list. Report deadline, amount, and eligibility from what your searches surfaced, and mark anything unverified as "unknown".`,
    SCHEMA,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await callClaude({
    apiKey: opts.apiKey,
    system,
    userMessage: user,
    model: MODELS.sonnet,
    maxTokens: MAX_TOKENS,
    webSearchMaxUses: searchBudget,
    deadlineMs: opts.deadlineMs,
  });

  const usage: AgentUsage = {
    model: MODELS.sonnet,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    stopReason: res.stopReason,
    webSearchRequests: res.webSearchRequests,
  };

  // A parse failure here still spent tokens (web search included). Carry the
  // usage on the error so tracked() bills it to the daily cap.
  let parsed: unknown;
  try {
    parsed = parseJsonFromResponse(res.text, res.stopReason);
  } catch (e) {
    throw Object.assign(e as Error, { usage });
  }

  const candidates = Array.isArray(parsed) ? (parsed as Candidate[]) : [];
  return { candidates, usage };
}
