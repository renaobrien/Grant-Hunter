// Compiles onboarding answers into a structured `profile` via Claude. Shared by
// the CLI (`npm run onboard`) and the web onboarding server action so both
// produce an identical, agent-ready profile.
import { callClaude, MODELS, parseJsonFromResponse } from "./anthropic";
import { ONBOARDING_QUESTIONS } from "./onboarding-questions";
import type { Profile } from "./types";

const COMPILE_SYSTEM = `
You convert an organization's onboarding answers into a structured grant-seeking profile that will drive an automated grant-discovery agent. Be faithful to what they said; infer only what is clearly implied.

Output ONLY a JSON object with exactly these keys:
{
  "org_name": string,
  "one_liner": string,                 // "a nonprofit building X" — completes "ORG is ___"
  "mission": string,
  "problem": string,                   // the core problem they solve
  "stage": string,                     // e.g. "pre-revenue", "early operating", "scaling"
  "entity_type": string,               // e.g. "501(c)(3) nonprofit", "for-profit LLC"
  "jurisdiction": string,              // e.g. "United States (Oregon)"
  "team_summary": string,
  "traction": string,                  // honest current traction, or "early / none yet"
  "revenue_model": string,             // or "" if not applicable
  "capabilities": string[],
  "ethos": string,                     // what they value in a funder / how to weigh alignment
  "eligibility_constraints": [{"label": string, "detail": string}],  // facts an agent must reason from (entity, affiliation, geography, IP posture...)
  "min_amount": number,                // smallest grant worth tracking, in USD
  "max_amount": number | null,
  "geographies": string[],
  "open_source_posture": string | null,
  "framing_angles": [{"name": string, "description": string}],       // 2-5 angles to pitch them under
  "target_grant_types": string[],
  "anti_patterns": string[],           // framings/types to NEVER pursue
  "calibration_notes": string          // capture the perfect-fit + false-positive EXAMPLES as guidance for scoring
}
Use null/empty where genuinely unknown. Do not invent facts. No prose outside the JSON.
`.trim();

/** Interview answers keyed by ONBOARDING_QUESTIONS keys → a full Profile. */
export async function compileProfile(
  answers: Record<string, string>,
  apiKey: string,
): Promise<Profile> {
  const url = answers.url?.trim();
  const userMessage = [
    "Compile these onboarding answers into the profile JSON:",
    ...ONBOARDING_QUESTIONS.map(
      ([key, prompt]) => `${prompt}\nANSWER: ${answers[key]?.trim() || "(skipped)"}`,
    ),
    url ? `If useful, consult the org's site (${url}) to fill gaps.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await callClaude({
    apiKey,
    system: COMPILE_SYSTEM,
    userMessage,
    model: MODELS.opus,
    maxTokens: 4000,
    webSearchMaxUses: url ? 3 : undefined,
  });

  const c = parseJsonFromResponse(res.text, res.stopReason) as Partial<Profile> & {
    org_name?: string;
  };

  return {
    org_name: c.org_name ?? null,
    one_liner: c.one_liner ?? null,
    mission: c.mission ?? null,
    problem: c.problem ?? null,
    stage: c.stage ?? null,
    entity_type: c.entity_type ?? null,
    jurisdiction: c.jurisdiction ?? null,
    team_summary: c.team_summary ?? null,
    traction: c.traction ?? null,
    revenue_model: c.revenue_model ?? null,
    capabilities: c.capabilities ?? [],
    ethos: c.ethos ?? null,
    eligibility_constraints: c.eligibility_constraints ?? [],
    min_amount: c.min_amount ?? null,
    max_amount: c.max_amount ?? null,
    geographies: c.geographies ?? [],
    open_source_posture: c.open_source_posture ?? null,
    framing_angles: c.framing_angles ?? [],
    target_grant_types: c.target_grant_types ?? [],
    anti_patterns: c.anti_patterns ?? [],
    calibration_notes: c.calibration_notes ?? null,
  };
}
