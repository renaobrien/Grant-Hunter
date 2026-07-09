// Drafter - writes the grant-application narrative for THIS org, in the funder's
// frame, anchored on the grant's framing angle. Uses the rendered profile as the
// only source of truth (never invents facts). Prose out, no JSON. Mirrors finder.ts.

import { callClaude, MODELS } from "../anthropic";
import { renderVoice, DRAFTER_ROLE } from "../render-profile";
import type { AgentUsage, Profile } from "../types";

/** The subset of a grants row the drafting loop needs. `funder` is required; the
 * rest may be null (grants only guarantees funder). Owned here; critic imports it. */
export interface GrantForDraft {
  funder: string;
  program_name: string | null;
  amount: string | null;
  deadline: string | null;
  framing_angle: string | null;
  eligibility_notes: string | null;
  notes: string | null;
  recommendation: string | null;
  alignment_rationale: string | null;
  source_url: string | null;
  application_url: string | null;
  /** The funder's actual application requirements (pasted or extracted), or null. */
  application_spec: string | null;
}

/** Render the grant as readable text for the model. Shared by drafter + critic so
 * both agents reason over the exact same brief. */
export function renderGrantDetails(g: GrantForDraft): string {
  const lines = [
    `Funder: ${g.funder}`,
    g.program_name ? `Program: ${g.program_name}` : "",
    g.amount ? `Amount: ${g.amount}` : "",
    g.deadline ? `Deadline: ${g.deadline}` : "",
    g.framing_angle ? `Framing angle to anchor on: ${g.framing_angle}` : "",
    g.eligibility_notes ? `Eligibility notes: ${g.eligibility_notes}` : "",
    g.recommendation ? `Recommendation: ${g.recommendation}` : "",
    g.alignment_rationale ? `Alignment rationale: ${g.alignment_rationale}` : "",
    g.notes ? `Notes: ${g.notes}` : "",
    g.application_url ? `Application URL: ${g.application_url}` : "",
    g.source_url ? `Source URL: ${g.source_url}` : "",
  ].filter(Boolean);
  const base = lines.join("\n");

  // When the funder's real application is on hand, make it the anchor: the
  // Drafter answers these questions/limits directly instead of an essay, and
  // the Critic checks coverage against them.
  if (g.application_spec && g.application_spec.trim()) {
    return `${base}\n\nAPPLICATION REQUIREMENTS (the funder's actual questions, limits, and criteria - answer these directly, one labeled section per question, within any stated word/character limits):\n${g.application_spec.trim()}`;
  }
  return base;
}

export async function runDrafter(opts: {
  apiKey: string;
  profile: Profile;
  grant: GrantForDraft;
  priorCritique?: string;
  /** The teaching loop (getPreferenceContext) - what the org rated well/poorly. */
  preferenceContext?: string;
}): Promise<{ draft: string; usage: AgentUsage }> {
  const system = [renderVoice(opts.profile), DRAFTER_ROLE, opts.preferenceContext]
    .filter(Boolean)
    .join("\n\n");
  const user = [
    "Write the grant-application narrative for the opportunity below. Anchor it on the framing angle and translate this org's real work into the funder's priorities and vocabulary.",
    `GRANT DETAILS:\n${renderGrantDetails(opts.grant)}`,
    opts.priorCritique
      ? `REVISE - address this critique of your previous draft. Fix each issue without inventing new facts:\n${opts.priorCritique}`
      : "",
    "Return the application narrative as prose. No preamble, no JSON, no meta-commentary.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await callClaude({
    apiKey: opts.apiKey,
    system,
    userMessage: user,
    model: MODELS.opus,
    maxTokens: 8000,
    // no web search - the draft is grounded in the profile + grant brief, not the live web
  });

  return {
    draft: res.text,
    usage: {
      model: MODELS.opus,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      stopReason: res.stopReason,
      webSearchRequests: res.webSearchRequests,
    },
  };
}
