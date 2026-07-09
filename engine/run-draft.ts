// Entrypoint for a single narrative draft (grant id from argv). Lets the in-app
// "Draft now" button run a draft immediately on a local/self-host instance,
// instead of waiting up to ~30 min for the jobs worker to drain the queue.
//   npx tsx engine/run-draft.ts <grantId>
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.

import "./load-env"; // load .env.local into process.env (must be first)
import { getServiceClient, resolveAnthropicKey } from "./db";
import { runDraft } from "./draft";

async function main(): Promise<void> {
  const grantId = process.argv[2];
  if (!grantId) {
    console.error("[draft] missing grantId argument");
    process.exit(1);
  }
  const sb = getServiceClient();
  const apiKey = await resolveAnthropicKey(sb);
  const summary = await runDraft(sb, { apiKey, grantId, trigger: "manual" });
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.status === "ready" ? 0 : 1);
}

main().catch((err) => {
  console.error("[draft] failed:", (err as Error).message);
  process.exit(1);
});
