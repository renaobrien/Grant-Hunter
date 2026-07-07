// onboard.ts — AI-assisted onboarding. Interviews the org with a handful of
// questions, then has Claude compile the answers into a structured `profile` row
// (the white-label "voice"). Re-runnable; the profile is also editable in the dashboard.
//
//   npm run onboard
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getServiceClient, requireAnthropicKey } from "../engine/db";
import { callClaude, MODELS, parseJsonFromResponse } from "../engine/anthropic";
import { renderVoice } from "../engine/render-profile";
import type { Profile } from "../engine/types";

const QUESTIONS: [key: string, prompt: string][] = [
  ["mission", "1) In 1-2 sentences, what does your org do and why?"],
  ["entity", "2) Legal entity, country, and stage? (e.g. '501(c)(3) nonprofit, US, early operating' or 'for-profit LLC, Wyoming US, pre-revenue')"],
  ["capabilities", "3) List 5-10 things/capabilities you'd want funding for:"],
  ["never", "4) What grants should we NEVER show you? (geographies, types, sizes, framings to avoid)"],
  ["examples", "5) Name 2-3 grants/funders that would be a PERFECT fit, and 1-2 that look relevant but aren't:"],
  ["constraints", "6) Smallest grant worth your time? Can you partner with a fiscal sponsor or university if a funder requires it?"],
  ["url", "7) (optional) Your website or a one-pager URL — press Enter to skip:"],
];

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

async function main() {
  const sb = getServiceClient();
  const apiKey = requireAnthropicKey();

  const rl = createInterface({ input, output });
  console.log("\n— Onboarding —\nAnswer a few questions; Claude will compile them into your org profile.\n");
  const answers: Record<string, string> = {};
  for (const [key, prompt] of QUESTIONS) {
    answers[key] = (await rl.question(`${prompt}\n> `)).trim();
  }
  rl.close();

  const url = answers.url?.trim();
  const userMessage = [
    "Compile these onboarding answers into the profile JSON:",
    ...QUESTIONS.map(([key, prompt]) => `${prompt}\nANSWER: ${answers[key] || "(skipped)"}`),
    url ? `If useful, consult the org's site (${url}) to fill gaps.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  console.log("\nCompiling profile with Claude…");
  const res = await callClaude({
    apiKey,
    system: COMPILE_SYSTEM,
    userMessage,
    model: MODELS.opus,
    maxTokens: 4000,
    webSearchMaxUses: url ? 3 : undefined,
  });

  const compiled = parseJsonFromResponse(res.text, res.stopReason) as Partial<Profile> & {
    org_name?: string;
  };

  const profile: Profile = {
    org_name: compiled.org_name ?? null,
    one_liner: compiled.one_liner ?? null,
    mission: compiled.mission ?? null,
    problem: compiled.problem ?? null,
    stage: compiled.stage ?? null,
    entity_type: compiled.entity_type ?? null,
    jurisdiction: compiled.jurisdiction ?? null,
    team_summary: compiled.team_summary ?? null,
    traction: compiled.traction ?? null,
    revenue_model: compiled.revenue_model ?? null,
    capabilities: compiled.capabilities ?? [],
    ethos: compiled.ethos ?? null,
    eligibility_constraints: compiled.eligibility_constraints ?? [],
    min_amount: compiled.min_amount ?? null,
    max_amount: compiled.max_amount ?? null,
    geographies: compiled.geographies ?? [],
    open_source_posture: compiled.open_source_posture ?? null,
    framing_angles: compiled.framing_angles ?? [],
    target_grant_types: compiled.target_grant_types ?? [],
    anti_patterns: compiled.anti_patterns ?? [],
    calibration_notes: compiled.calibration_notes ?? null,
  };

  const compiled_voice = renderVoice(profile);

  // upsert, not update: update on a missing row affects 0 rows without erroring,
  // which would print "saved" while saving nothing.
  const { error } = await sb
    .from("profile")
    .upsert(
      { id: 1, ...profile, compiled_voice, compiled_at: new Date().toISOString(), onboarding_complete: true },
      { onConflict: "id" },
    );
  if (error) throw new Error(`Failed to save profile: ${error.message}`);

  console.log(`\n✓ Profile saved for "${profile.org_name ?? "your org"}".`);
  console.log("\n--- Preview of the prompt your agents will use ---\n");
  console.log(compiled_voice);
  console.log("\nEdit any of this later in the dashboard (Profile tab), or re-run `npm run onboard`.\n");
}

main().catch((e) => {
  console.error("\nOnboarding failed:", (e as Error).message);
  process.exit(1);
});
