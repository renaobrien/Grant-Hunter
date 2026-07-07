// Entrypoint for a discovery run. Used by the GitHub Actions cron and the optional
// worker. Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
//   npm run discover              (scheduled)
//   npx tsx engine/run-discovery.ts --manual

import { getServiceClient, requireAnthropicKey, spentCentsToday } from "./db";
import { runDiscovery } from "./discovery";
import { sendNotification } from "./notify";

const trigger = process.argv.includes("--manual") ? "manual" : "scheduled";

interface RecentGrant {
  funder: string | null;
  program_name: string | null;
  fit_score: number | null;
  deadline: string | null;
  amount: string | null;
}

async function main(): Promise<void> {
  const sb = getServiceClient();
  const apiKey = requireAnthropicKey();

  const summary = await runDiscovery(sb, { apiKey, trigger });

  // Only nudge the fleet when something actually changed in the pipeline.
  if (summary.created > 0 || summary.updated > 0) {
    try {
      const { data } = await sb
        .from("grants")
        .select("funder, program_name, fit_score, deadline, amount")
        .order("date_added", { ascending: false })
        .limit(5);
      const recent = (data ?? []) as RecentGrant[];
      const spentCents = await spentCentsToday(sb);

      const lines = recent.map((g) => {
        const name = g.program_name ? ` — ${g.program_name}` : "";
        return `• ${g.funder ?? "Unknown funder"}${name} (fit ${g.fit_score ?? "?"}, ${
          g.amount || "unknown"
        }, deadline ${g.deadline || "unknown"})`;
      });

      const text = [
        `Discovery run complete: ${summary.created} new, ${summary.updated} updated ` +
          `across ${summary.rounds} round(s).`,
        lines.length ? `\nMost recently added:\n${lines.join("\n")}` : "",
        `\nSpent today: $${(spentCents / 100).toFixed(2)}.`,
      ]
        .filter(Boolean)
        .join("\n");

      await sendNotification(sb, "weekly_digest", "Weekly grant discovery", text);
    } catch (e) {
      console.error("[discovery] digest notification failed:", (e as Error).message);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("[discovery] failed:", (err as Error).message);
  process.exit(1);
});
