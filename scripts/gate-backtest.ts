// scripts/gate-backtest.ts - dry-run the discovery quality gate over historical
// agent_debate rows, so an operator can see how many past survivors the current
// (or a proposed) set of floors would cut BEFORE tightening them. Read-only:
// it writes nothing to the database.
//
//   npx tsx scripts/gate-backtest.ts                       # uses saved floors
//   DISCOVERY_MIN_FIT=4 npx tsx scripts/gate-backtest.ts   # preview a tighter bar
//   DISCOVERY_MIN_ALIGNMENT=4 npx tsx scripts/gate-backtest.ts

import "../engine/load-env";
import { getServiceClient, loadProfile, loadSettings } from "../engine/db";
import { passesQualityGate } from "../engine/quality-gate";
import type { JudgeRuling, SkepticVerdict } from "../engine/types";

async function main(): Promise<void> {
  const sb = getServiceClient();
  const [profile, settings] = await Promise.all([loadProfile(sb), loadSettings(sb)]);

  const minFit = Number(process.env.DISCOVERY_MIN_FIT ?? settings.discovery_min_fit);
  const minAlignment = Number(
    process.env.DISCOVERY_MIN_ALIGNMENT ?? settings.discovery_min_alignment,
  );

  const { data, error } = await sb
    .from("agent_debate")
    .select("judge_ruling, skeptic_verdict")
    .not("judge_ruling", "is", null);
  if (error) throw new Error(`could not load agent_debate: ${error.message}`);

  const rows = data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  let survivorsConsidered = 0;
  let pass = 0;
  const reasons = new Map<string, number>();

  for (const row of rows) {
    const ruling = row.judge_ruling as JudgeRuling | null;
    const verdict = (row.skeptic_verdict as SkepticVerdict | null) ?? undefined;
    // Only rulings the Judge let survive - that's the population the gate filters.
    if (!ruling || ruling.survives !== true) continue;
    survivorsConsidered++;

    const gate = passesQualityGate(
      ruling,
      verdict,
      profile,
      { discovery_min_fit: minFit, discovery_min_alignment: minAlignment },
      today,
    );
    if (gate.pass) {
      pass++;
    } else {
      // Bucket numeric reasons (e.g. "fit 3 < min 4") so counts aggregate.
      const key = (gate.reason ?? "unknown").replace(/\d+/g, "N");
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
  }

  const cut = survivorsConsidered - pass;
  const pct = survivorsConsidered ? Math.round((cut / survivorsConsidered) * 100) : 0;

  console.log(`\nGate backtest  (min_fit=${minFit}, min_alignment=${minAlignment})`);
  console.log(`Judge-survivors in agent_debate: ${survivorsConsidered}`);
  console.log(`  would PASS the gate: ${pass}`);
  console.log(`  would be CUT:        ${cut} (${pct}%)`);
  if (reasons.size) {
    console.log(`\nCut reasons:`);
    for (const [r, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${r}`);
    }
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`[gate-backtest] ${(e as Error).message}`);
    process.exit(1);
  });
