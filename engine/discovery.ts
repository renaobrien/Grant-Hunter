// discovery.ts - the adversarial discovery orchestrator.
// Runs N rounds of Finder -> Skeptic -> Judge, persists the full debate to
// agent_debate, upserts survivors into grants, logs cost per agent, and enforces
// the daily budget cap. Callable from the GitHub Action or the Node worker.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runFinder } from "./agents/finder";
import { runSkeptic } from "./agents/skeptic";
import { runJudge } from "./agents/judge";
import {
  budgetRemainingCents,
  finishRun,
  loadGrantsIndex,
  loadProfile,
  loadSettings,
  startRun,
  upsertRuling,
  writeDebate,
} from "./db";
import { getPreferenceContext } from "./preference-context";
import type { AgentUsage, Candidate, JudgeRuling, SkepticVerdict } from "./types";

const isHttp = (u?: string | null) => !!u && /^https?:\/\//i.test(u);
const eq = (a?: string | null, b?: string | null) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

const candidateKey = (c: Candidate) =>
  [c.application_url, c.source_url].find(isHttp) || `${c.funder}::${c.program_name}`;

export interface DiscoverySummary {
  runId: string;
  rounds: number;
  survivors: number;
  created: number;
  updated: number;
  skipped: number;
  stopped?: string;
}

/** Log an agent call as an agent_runs row (cost feeds the budget cap). */
async function tracked<T extends { usage: AgentUsage }>(
  sb: SupabaseClient,
  agentType: string,
  trigger: "scheduled" | "manual",
  input: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const run = await startRun(sb, agentType, trigger, input);
  try {
    const r = await fn();
    await finishRun(sb, run, { status: "success", usage: r.usage });
    return r;
  } catch (e) {
    await finishRun(sb, run, { status: "error", error: (e as Error).message });
    throw e;
  }
}

export async function runDiscovery(
  sb: SupabaseClient,
  opts: { apiKey: string; trigger?: "scheduled" | "manual" },
): Promise<DiscoverySummary> {
  const trigger = opts.trigger ?? "scheduled";
  const [profile, settings] = await Promise.all([loadProfile(sb), loadSettings(sb)]);
  const preferenceContext = await getPreferenceContext(sb);
  const index = await loadGrantsIndex(sb);

  const runId = randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const summary: DiscoverySummary = {
    runId,
    rounds: 0,
    survivors: 0,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  if ((await budgetRemainingCents(sb, settings.daily_budget_usd)) <= 0) {
    summary.stopped = "daily budget already spent";
    console.warn(`[discovery] ${summary.stopped} - not running.`);
    return summary;
  }

  let priorNotes: string | undefined;

  for (let round = 1; round <= settings.discovery_rounds; round++) {
    if ((await budgetRemainingCents(sb, settings.daily_budget_usd)) <= 0) {
      summary.stopped = "hit daily budget mid-run";
      break;
    }
    summary.rounds = round;

    // Tell the Finder what's already in the pipeline (index grows as rounds
    // create grants, so rebuild each round). Prevents re-proposing tracked
    // grants and double-counting them toward the survivor target.
    const exclusions = index
      .map((g) => `${g.funder ?? ""}${g.program_name ? ` - ${g.program_name}` : ""}`.trim())
      .filter(Boolean)
      .slice(0, 60);

    // 1) Finder proposes
    const { candidates } = await tracked(sb, "finder", trigger, { round, runId }, () =>
      runFinder({ apiKey: opts.apiKey, profile, preferenceContext, today, priorNotes, exclusions }),
    );
    if (!candidates.length) {
      summary.stopped = summary.stopped ?? "finder returned no candidates";
      break;
    }

    // 2) Skeptic refutes
    const { verdicts } = await tracked(sb, "skeptic", trigger, { round, runId, n: candidates.length }, () =>
      runSkeptic({ apiKey: opts.apiKey, profile, candidates }),
    );
    if (verdicts.length !== candidates.length) {
      console.warn(
        `[discovery] skeptic returned ${verdicts.length} verdicts for ${candidates.length} candidates - order-based matching may be off.`,
      );
    }

    // 3) Judge reconciles
    const { rulings } = await tracked(sb, "judge", trigger, { round, runId, n: candidates.length }, () =>
      runJudge({ apiKey: opts.apiKey, profile, candidates, verdicts, preferenceContext }),
    );

    // Match rulings to candidates by exact name first, falling back to position
    // when the Judge returned one ruling per candidate (it's instructed to keep
    // order). Name-only matching silently dropped survivors whenever the Judge
    // rephrased a funder name.
    const rulingFor = (c: Candidate, i: number): JudgeRuling | undefined => {
      const byName = rulings.find(
        (r) => eq(r.funder, c.funder) && eq(r.program_name, c.program_name),
      );
      if (byName) return byName;
      return rulings.length === candidates.length ? rulings[i] : undefined;
    };
    const verdictFor = (i: number): SkepticVerdict | undefined => verdicts[i];

    // persist debate + upsert survivors
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const ruling = rulingFor(c, i) ?? null;
      await writeDebate(sb, {
        run_id: runId,
        round,
        candidate_key: candidateKey(c),
        finder_claim: c,
        skeptic_verdict: verdictFor(i) ?? null,
        judge_ruling: ruling,
      });

      // Code-level guard on the Judge's own survival rule (fit_score >= 3),
      // in case the model marks survives=true on a record that breaks it.
      if (ruling?.survives && ruling.fit_score >= 3) {
        const res = await upsertRuling(sb, ruling, index);
        if (res.action === "created") summary.created++;
        else if (res.action === "updated") summary.updated++;
        else summary.skipped++;
        if (res.action !== "skipped") summary.survivors++;
      }
    }

    // early stop if we have enough
    if (summary.survivors >= settings.discovery_target_survivors) {
      summary.stopped = "reached target survivors";
      break;
    }

    // feed the next Finder round what got refuted so it searches differently
    const refuted = candidates
      .map((c, i) => ({ c, v: verdictFor(i) }))
      .filter((x) => x.v && x.v.verdict === "refuted")
      .slice(0, 8)
      .map((x) => `- ${x.c.funder} - ${x.c.program_name}: ${x.v!.kill_shot}`);
    priorNotes = refuted.length
      ? `Already refuted (do not re-propose; search new funders/angles):\n${refuted.join("\n")}`
      : undefined;
  }

  console.log(
    `[discovery] run ${runId}: ${summary.rounds} round(s), ${summary.created} new, ` +
      `${summary.updated} updated, ${summary.skipped} skipped${summary.stopped ? ` (${summary.stopped})` : ""}.`,
  );
  return summary;
}
