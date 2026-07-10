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
  fn: () => Promise<T>,
): Promise<T> {
  const run = await startRun(sb, agentType, trigger, input);
  try {
    const r = await fn();
    await finishRun(sb, run, { status: "success", usage: r.usage });
    return r;
  } catch (e) {
    // Bill any usage the agent spent before it failed (e.g. tokens spent, then
    // JSON parse threw) so a failing call can't slip under the daily cap.
    const usage = (e as { usage?: AgentUsage }).usage;
    await finishRun(sb, run, { status: "error", usage, error: (e as Error).message });
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

  for (let round = 1; round <= settings.discovery_rounds; round++) {
    if (outOfTime()) {
      summary.stopped = "hit the 40-minute run ceiling";
      break;
    }
    if ((await budgetRemainingCents(sb, settings.daily_budget_usd)) <= 0) {
      summary.stopped = "hit daily budget mid-run";
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
    const { candidates } = await tracked(sb, "finder", trigger, { round, runId }, () =>
      runFinder({ apiKey: opts.apiKey, profile, preferenceContext, today, priorNotes, exclusions, fast }),
    );
    if (!candidates.length) {
      summary.stopped = summary.stopped ?? "finder returned no candidates";
      break;
    }

    // Re-check the cap between agents: a single round runs Finder + Skeptic +
    // Judge, each of which can spend real money, so one check at round start
    // isn't enough to keep the daily cap honest.
    if ((await budgetRemainingCents(sb, settings.daily_budget_usd)) <= 0) {
      summary.stopped = "hit daily budget after finder";
      break;
    }
    if (outOfTime()) {
      summary.stopped = "hit the 40-minute run ceiling";
      break;
    }

    // 2) Skeptic refutes
    const { verdicts } = await tracked(sb, "skeptic", trigger, { round, runId, n: candidates.length }, () =>
      runSkeptic({ apiKey: opts.apiKey, profile, candidates, fast }),
    );

    if ((await budgetRemainingCents(sb, settings.daily_budget_usd)) <= 0) {
      summary.stopped = "hit daily budget after skeptic";
      break;
    }
    if (outOfTime()) {
      summary.stopped = "hit the 40-minute run ceiling";
      break;
    }
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
