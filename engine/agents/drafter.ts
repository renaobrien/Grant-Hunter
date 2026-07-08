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
  return lines.join("\n");
}

export async function runDrafter(opts: {
  apiKey: string;
  profile: Profile;
  grant: GrantForDraft;
  priorCritique?: string;
}): Promise<{ draft: string; usage: AgentUsage }> {
  const system = [renderVoice(opts.profile), DRAFTER_ROLE].join("\n\n");
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
