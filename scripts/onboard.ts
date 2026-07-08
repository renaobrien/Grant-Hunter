// onboard.ts - AI-assisted onboarding. Interviews the org with a handful of
// questions, then has Claude compile the answers into a structured `profile` row
// (the white-label "voice"). Re-runnable; the profile is also editable in the
// dashboard, and the same questions + compile power the web onboarding flow.
//
//   npm run onboard
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.

import "../engine/load-env"; // load .env.local into process.env (must be first)
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getServiceClient, resolveAnthropicKey } from "../engine/db";
import { renderVoice } from "../engine/render-profile";
import { ONBOARDING_QUESTIONS } from "../engine/onboarding-questions";
import { compileProfile } from "../engine/compile-profile";

async function main() {
  const sb = getServiceClient();
  const apiKey = await resolveAnthropicKey(sb);

  const rl = createInterface({ input, output });
  console.log(
    "\n- Onboarding -\nAnswer a few questions; Claude will compile them into your org profile.\n",
  );
  const answers: Record<string, string> = {};
  for (const [key, prompt] of ONBOARDING_QUESTIONS) {
    answers[key] = (await rl.question(`${prompt}\n> `)).trim();
  }
  rl.close();

  console.log("\nCompiling profile with Claude…");
  const profile = await compileProfile(answers, apiKey);
  const compiled_voice = renderVoice(profile);

  // upsert, not update: update on a missing row affects 0 rows without erroring,
  // which would print "saved" while saving nothing.
  const { error } = await sb.from("profile").upsert(
    {
      id: 1,
      ...profile,
      compiled_voice,
      compiled_at: new Date().toISOString(),
      onboarding_complete: true,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Failed to save profile: ${error.message}`);

  console.log(`\n✓ Profile saved for "${profile.org_name ?? "your org"}".`);
  console.log("\n--- Preview of the prompt your agents will use ---\n");
  console.log(compiled_voice);
  console.log(
    "\nEdit any of this later in the dashboard (Profile tab), or re-run `npm run onboard`.\n",
  );
}

main().catch((e) => {
  console.error("\nOnboarding failed:", (e as Error).message);
  process.exit(1);
});
