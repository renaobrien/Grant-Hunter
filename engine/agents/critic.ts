// Critic - red-teams a Drafter narrative for invented claims, poor funder-fit,
// missing stated requirements, and generic pitch-deck language. Returns a strict
// approved/issues/suggestions verdict. Mirrors skeptic.ts.

import { callClaude, MODELS, parseJsonFromResponse } from "../anthropic";
import { renderVoice, CRITIC_ROLE } from "../render-profile";
import { renderGrantDetails, type GrantForDraft } from "./drafter";
import type { AgentUsage, Profile } from "../types";

export interface CriticVerdict {
  approved: boolean;
  issues: string[];
  suggestions: string[];
}

const SCHEMA = `Return ONLY JSON, no prose outside it: {"approved": boolean, "issues": string[], "suggestions": string[]}.
Set "approved" true ONLY if the draft has no unsupported/invented claims, fits the funder's priorities, meets the grant's stated requirements, and avoids generic pitch-deck language. Otherwise list concrete problems in "issues" and concrete fixes in "suggestions".`;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export async function runCritic(opts: {
  apiKey: string;
  profile: Profile;
  grant: GrantForDraft;
  draft: string;
}): Promise<{ verdict: CriticVerdict; usage: AgentUsage }> {
  const system = [renderVoice(opts.profile), CRITIC_ROLE].join("\n\n");
  const user = [
    "Red-team this grant-application draft against the opportunity below. Assume it overclaims until the profile proves otherwise.",
    `GRANT DETAILS:\n${renderGrantDetails(opts.grant)}`,
    `DRAFT TO REVIEW:\n${opts.draft}`,
    SCHEMA,
  ].join("\n\n");

  const res = await callClaude({
    apiKey: opts.apiKey,
    system,
    userMessage: user,
    model: MODELS.opus,
    maxTokens: 4000,
    // no web search - the critic reasons over the profile + grant brief + draft
  });

  // Safe defaults: a malformed / non-object response must NOT read as approved.
  let verdict: CriticVerdict = { approved: false, issues: [], suggestions: [] };
  try {
    const parsed = parseJsonFromResponse(res.text, res.stopReason);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const v = parsed as Record<string, unknown>;
      verdict = {
        approved: v.approved === true,
        issues: strings(v.issues),
        suggestions: strings(v.suggestions),
      };
    }
  } catch {
    // keep safe defaults (approved:false) - the loop will run another round
  }

  return {
    verdict,
    usage: {
      model: MODELS.opus,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      stopReason: res.stopReason,
      webSearchRequests: res.webSearchRequests,
    },
  };
}
