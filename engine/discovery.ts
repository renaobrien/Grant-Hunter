// discovery.ts - the adversarial discovery orchestrator.
// Runs N rounds of Finder -> Skeptic -> Judge, persists the full debate to
// agent_debate, upserts survivors into grants, logs cost per agent, and enforces
// the daily budget cap. Callable from the GitHub Action or the Node worker.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateCostCents } from "./anthropic";
import { finderWorstCaseCents, runFinder } from "./agents/finder";
import { runSkeptic, skepticWorstCaseCents } from "./agents/skeptic";
import { judgeWorstCaseCents, runJudge } from "./agents/judge";
import {
  budgetRemainingCents,
  finishRun,
  loadGrantsIndex,
  loadProfile,
  loadRejectedLabels,
  loadSettings,
  startRun,
  upsertRuling,
  writeDebate,
} from "./db";
import { getPreferenceContext } from "./preference-context";
import { passesQualityGate } from "./quality-gate";
import { isHttp, urlAlive } from "./url-check";
import type { AgentUsage, Candidate, JudgeRuling, SkepticVerdict } from "./types";

const eq = (a?: string | null, b?: string | null) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

// ---------------------------------------------------------------------------
// URL liveness. Before a survivor reaches the board, actually fetch its URLs
// (via ./url-check): a dead application_url/source_url is dropped, and a
// survivor with NO live URL at all is cut entirely - a grant you can't open is
// noise. The jobs sweep re-runs the same check periodically.
// ---------------------------------------------------------------------------

/** Null out dead URLs on a ruling; return false when nothing usable is left. */
async function verifyRulingUrls(r: JudgeRuling): Promise<boolean> {
  const checks: Array<Promise<void>> = [];
  if (isHttp(r.application_url)) {
    checks.push(
      urlAlive(r.application_url as string).then((ok) => {
        if (!ok) r.application_url = null as unknown as string;
      }),
    );
  }
  if (isHttp(r.source_url)) {
    checks.push(
      urlAlive(r.source_url as string).then((ok) => {
        if (!ok) r.source_url = null as unknown as string;
      }),
    );
  }
  await Promise.all(checks);
  return isHttp(r.application_url) || isHttp(r.source_url);
}

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
  floorCents: number,
  fn: () => Promise<T>,
): Promise<T> {
  const run = await startRun(sb, agentType, trigger, input);
  try {
    const r = await fn();
    await finishRun(sb, run, { status: "success", usage: r.usage });
    return r;
  } catch (e) {
    // Bill any usage the agent spent before it failed (e.g. tokens spent, then
    // JSON parse threw) so a failing call can't slip under the daily cap. A
    // call that died with NO usage (SDK timeout / network / 5xx) still ran its
    // searches and generated tokens: record the worst-case floor, never null.
    // This is why the ledger recorded $6 while Anthropic billed $16.50.
    const usage = (e as { usage?: AgentUsage }).usage;
    await finishRun(sb, run, { status: "error", usage, floorCents, error: (e as Error).message });
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
  // Candidates already tried and killed in past runs - don't let the Finder
  // re-propose them (they never became grants, so the index alone won't exclude them).
  const rejectedLabels = await loadRejectedLabels(sb);

  const runId = randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  // Hard ceiling on the whole run's wall clock. Each agent call has its own
  // 25-min timeout, but a slow multi-round run (or an API stuck retrying) can
  // still grind far too long. Bail between agents once we cross this.
  const runStartedMs = Date.now();
  const RUN_MAX_MS = 40 * 60 * 1000;
  const outOfTime = () => Date.now() - runStartedMs > RUN_MAX_MS;
  // Passed into every agent call so an in-flight API request is aborted when
  // the run is out of time, instead of grinding to the SDK timeout.
  const deadlineMs = runStartedMs + RUN_MAX_MS;
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
  const fast = settings.speed_mode === "fast";

  // Per-run spend ceiling (user-tunable, Settings -> Discovery). Bills each
  // call's ACTUAL usage as it completes and stops the run once the ceiling is
  // reached; the daily check refuses to start a call whose WORST case doesn't
  // fit in what's left of the day. One run can no longer blow through the day's
  // budget on unrecorded spend.
  const runBudgetCents = Math.round(settings.run_budget_usd * 100);
  let runSpentCents = 0;
  const bill = (usage: AgentUsage) => {
    runSpentCents += estimateCostCents(
      usage.inputTokens,
      usage.outputTokens,
      usage.model,
      usage.webSearchRequests ?? 0,
    );
  };
  /** Reason to stop before starting a NEW round, or null to proceed. The run
   * budget only gates new rounds: once a round has started, its Finder/Skeptic
   * spend is sunk and the Judge that turns it into board results is the
   * cheapest of the three calls - stopping mid-round pays for the work and
   * then discards it (a $2 run with zero output). */
  const stopBeforeRound = async (): Promise<string | null> => {
    if (outOfTime()) return "hit the 40-minute run ceiling";
    if (runSpentCents >= runBudgetCents) {
      return `hit the $${settings.run_budget_usd}/run budget ($${(runSpentCents / 100).toFixed(2)} spent)`;
    }
    if ((await budgetRemainingCents(sb, settings.daily_budget_usd)) < finderWorstCaseCents(fast)) {
      return "daily budget: not enough left for a worst-case finder call";
    }
    return null;
  };
  /** The daily cap is a hard promise, so it can still stop a round before the
   * expensive Skeptic. The run budget cannot (see stopBeforeRound). */
  const stopBeforeSkeptic = async (): Promise<string | null> => {
    if (outOfTime()) return "hit the 40-minute run ceiling";
    if ((await budgetRemainingCents(sb, settings.daily_budget_usd)) < skepticWorstCaseCents(fast)) {
      return "daily budget: not enough left for a worst-case skeptic call";
    }
    return null;
  };

  console.log(
    `[discovery] starting: up to ${settings.discovery_rounds} round(s), ` +
      `target ${settings.discovery_target_survivors} survivor(s), ${fast ? "fast" : "thorough"} mode, ` +
      `run budget $${settings.run_budget_usd}.`,
  );

  for (let round = 1; round <= settings.discovery_rounds; round++) {
    const stopRound = await stopBeforeRound();
    if (stopRound) {
      summary.stopped = stopRound;
      break;
    }
    summary.rounds = round;

    // Tell the Finder what's already in the pipeline (index grows as rounds
    // create grants, so rebuild each round). Prevents re-proposing tracked
    // grants and double-counting them toward the survivor target.
    const trackedLabels = index
      .map((g) => `${g.funder ?? ""}${g.program_name ? ` - ${g.program_name}` : ""}`.trim())
      .filter(Boolean);
    // Tracked survivors + previously-killed candidates, deduped and capped.
    const exclusions = [...new Set([...trackedLabels, ...rejectedLabels])].slice(0, 80);

    // 1) Finder proposes
    console.log(`[discovery] round ${round}: finder searching the live web (can take a few minutes)…`);
    const { candidates: proposed, usage: finderUsage } = await tracked(
      sb,
      "finder",
      trigger,
      { round, runId },
      finderWorstCaseCents(fast),
      () =>
        runFinder({
          apiKey: opts.apiKey,
          profile,
          preferenceContext,
          today,
          priorNotes,
          exclusions,
          fast,
          deadlineMs,
        }),
    );
    bill(finderUsage);
    if (!proposed.length) {
      summary.stopped = summary.stopped ?? "finder returned no candidates";
      console.log(`[discovery] round ${round}: finder found no new candidates.`);
      break;
    }

    // Cheap deterministic cull: the Finder self-scores fit, and anything below
    // the operator's floor is dead on arrival at the quality gate anyway. Drop
    // it here, in code, instead of paying the Opus Skeptic to confirm it.
    const minFit = settings.discovery_min_fit;
    const isWeak = (c: Candidate) => Number.isFinite(c.fit_score) && c.fit_score < minFit;
    const candidates = proposed.filter((c) => !isWeak(c));
    const weakNotes = proposed
      .filter(isWeak)
      .map((c) => `- ${c.funder} - ${c.program_name}: self-scored fit ${c.fit_score}, below the floor of ${minFit}`);
    if (weakNotes.length) {
      summary.skipped += weakNotes.length;
      console.log(
        `[discovery] round ${round}: dropped ${weakNotes.length} candidate(s) below fit ${minFit} before vetting (no Skeptic cost).`,
      );
    }
    if (!candidates.length) {
      priorNotes = `Every candidate self-scored below the fit floor (${minFit}). Search materially different funders and angles:\n${weakNotes
        .slice(0, 8)
        .join("\n")}`;
      console.log(`[discovery] round ${round}: nothing above the fit floor - trying a different angle.`);
      continue;
    }
    console.log(
      `[discovery] round ${round}: finder proposed ${proposed.length} candidate(s), ${candidates.length} worth vetting.`,
    );

    // The daily cap (a hard promise) can still stop the round before the
    // expensive Skeptic; the run budget only gates new rounds.
    const stopSkeptic = await stopBeforeSkeptic();
    if (stopSkeptic) {
      summary.stopped = stopSkeptic;
      break;
    }

    // 2) Skeptic refutes
    console.log(`[discovery] round ${round}: skeptic vetting ${candidates.length} candidate(s)…`);
    const { verdicts, usage: skepticUsage } = await tracked(
      sb,
      "skeptic",
      trigger,
      { round, runId, n: candidates.length },
      skepticWorstCaseCents(fast),
      () => runSkeptic({ apiKey: opts.apiKey, profile, candidates, fast, deadlineMs }),
    );
    bill(skepticUsage);

    // No stop before the Judge, ever: it is the cheapest call of the round and
    // the one that converts the Finder/Skeptic spend into board results.
    // Stopping here is how a $2 run ends with zero candidates.
    if (verdicts.length !== candidates.length) {
      console.warn(
        `[discovery] skeptic returned ${verdicts.length} verdicts for ${candidates.length} candidates - order-based matching may be off.`,
      );
    }

    // 3) Judge reconciles
    console.log(`[discovery] round ${round}: judge scoring what survived…`);
    const { rulings, usage: judgeUsage } = await tracked(
      sb,
      "judge",
      trigger,
      { round, runId, n: candidates.length },
      judgeWorstCaseCents(),
      () => runJudge({ apiKey: opts.apiKey, profile, candidates, verdicts, preferenceContext, deadlineMs }),
    );
    bill(judgeUsage);

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

    // persist debate (concurrently - independent rows) + upsert survivors
    await Promise.all(
      candidates.map((c, i) =>
        writeDebate(sb, {
          run_id: runId,
          round,
          candidate_key: candidateKey(c),
          finder_claim: c,
          skeptic_verdict: verdictFor(i) ?? null,
          judge_ruling: rulingFor(c, i) ?? null,
        }),
      ),
    );

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const ruling = rulingFor(c, i);
      if (!ruling) continue;

      // Deterministic quality gate: the Judge's survival rule + the Skeptic's
      // eligibility/freshness verdict + expired-deadline + amount bounds, all
      // enforced in code. Runs BEFORE verifyRulingUrls so cheap local checks
      // reject junk before we pay for a network fetch.
      const gate = passesQualityGate(ruling, verdictFor(i), profile, settings, today);
      if (!gate.pass) {
        summary.skipped++;
        console.warn(`[discovery] cut "${ruling.funder} - ${ruling.program_name}": ${gate.reason}`);
        continue;
      }

      // Dead-link guard: fetch the cited URLs; drop dead ones, and cut the
      // survivor entirely when no live URL remains.
      if (!(await verifyRulingUrls(ruling))) {
        summary.skipped++;
        console.warn(
          `[discovery] cut "${ruling.funder} - ${ruling.program_name}": no live URL (404/unreachable)`,
        );
        continue;
      }
      const res = await upsertRuling(sb, ruling, index);
      if (res.action === "created") summary.created++;
      else if (res.action === "updated") summary.updated++;
      else summary.skipped++;
      if (res.action !== "skipped") summary.survivors++;
    }

    // early stop if we have enough
    if (summary.survivors >= settings.discovery_target_survivors) {
      summary.stopped = "reached target survivors";
      break;
    }

    // Feed the next Finder round everything that died - skeptic refutations,
    // judge cuts, and fit-floor culls - so it searches differently instead of
    // re-proposing near-misses of the same shape.
    const refuted = candidates
      .map((c, i) => ({ c, v: verdictFor(i) }))
      .filter((x) => x.v && x.v.verdict === "refuted")
      .map((x) => `- ${x.c.funder} - ${x.c.program_name}: ${x.v!.kill_shot}`);
    const judgeCuts = candidates
      .map((c, i) => ({ c, r: rulingFor(c, i), v: verdictFor(i) }))
      .filter((x) => x.r?.survives === false && x.v?.verdict !== "refuted")
      .map(
        (x) =>
          `- ${x.c.funder} - ${x.c.program_name}: judge cut (${String(
            x.r!.blockers || x.r!.notes || "poor fit",
          ).slice(0, 140)})`,
      );
    const lessons = [...refuted, ...judgeCuts, ...weakNotes].slice(0, 8);
    priorNotes = lessons.length
      ? `Already refuted or cut (do not re-propose; search new funders/angles):\n${lessons.join("\n")}`
      : undefined;
  }

  console.log(
    `[discovery] run ${runId}: ${summary.rounds} round(s), ${summary.created} new, ` +
      `${summary.updated} updated, ${summary.skipped} skipped, ` +
      `~$${(runSpentCents / 100).toFixed(2)} spent${summary.stopped ? ` (${summary.stopped})` : ""}.`,
  );
  return summary;
}
