// quality-gate.ts - the single deterministic choke point that decides whether a
// Judge ruling becomes a board grant. It enforces IN CODE what the agent prompts
// only request, so a sloppy, partial, or over-eager model response can't put a
// weak, expired, ineligible, or out-of-band grant in front of the operator.
//
// Pure and side-effect-free (so scripts/gate-backtest.ts can replay it over
// historical agent_debate rows). `today` is passed in as 'YYYY-MM-DD' (UTC) to
// keep it deterministic.

import { parseAmount } from "./db";
import type { JudgeRuling, Profile, SkepticVerdict } from "./types";

/** The subset of settings the gate reads. Floors are operator-tunable. */
export interface QualityGateSettings {
  discovery_min_fit: number;
  discovery_min_alignment: number;
}

export interface GateResult {
  pass: boolean;
  reason?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Decide whether a survivor ruling is allowed onto the board.
 *
 * @param verdict the Skeptic verdict bound to this ruling. May be undefined when
 *   the Skeptic returned a mismatched count; we fail safe (reject) in that case.
 */
export function passesQualityGate(
  ruling: JudgeRuling,
  verdict: SkepticVerdict | undefined,
  profile: Profile,
  settings: QualityGateSettings,
  today: string,
): GateResult {
  // 1) The Judge's own survival rule, now enforced in code. Number.isFinite also
  //    rejects salvaged/partial rulings whose scores came back missing (a
  //    truncated ruling must not pass on `undefined >= 3` quietly being false).
  if (ruling.survives !== true) return { pass: false, reason: "judge did not mark survives" };
  if (!Number.isFinite(ruling.fit_score) || ruling.fit_score < settings.discovery_min_fit) {
    return { pass: false, reason: `fit ${ruling.fit_score} < min ${settings.discovery_min_fit}` };
  }
  if (
    !Number.isFinite(ruling.alignment_score) ||
    ruling.alignment_score < settings.discovery_min_alignment
  ) {
    return {
      pass: false,
      reason: `alignment ${ruling.alignment_score} < min ${settings.discovery_min_alignment}`,
    };
  }
  if (ruling.confidence === "low") return { pass: false, reason: "confidence low" };
  if (ruling.recommendation === "pass") return { pass: false, reason: "recommendation pass" };

  // 2) The Skeptic wins ties on eligibility + freshness (JUDGE_ROLE in
  //    render-profile.ts), so enforce its verdict even when the Judge set
  //    survives=true over it. Fail safe when the verdict is missing.
  if (!verdict) return { pass: false, reason: "no skeptic verdict bound" };
  if (verdict.verdict === "refuted") return { pass: false, reason: "skeptic refuted" };
  if (verdict.eligibility_ok === false) return { pass: false, reason: "skeptic: ineligible" };
  if (verdict.deadline_ok === false) return { pass: false, reason: "skeptic: deadline not ok" };

  // 3) Expired deadline: a bare ISO date already in the past is dead on arrival.
  //    'rolling' / 'unknown' / free text are left alone (the sweep handles ISO
  //    deadlines that pass later). Same UTC convention as run-jobs.ts.
  const deadline = String(ruling.deadline ?? "").trim();
  if (ISO_DATE.test(deadline)) {
    const deadlineMs = Date.parse(`${deadline}T00:00:00Z`);
    const todayMs = Date.parse(`${today}T00:00:00Z`);
    if (!Number.isNaN(deadlineMs) && !Number.isNaN(todayMs) && deadlineMs < todayMs) {
      return { pass: false, reason: `deadline ${deadline} already passed` };
    }
  }

  // 4) Award-size bounds. Only cut when the amount actually parses to a number;
  //    unknown / unparseable amounts pass (never cut on missing data).
  const n = parseAmount(ruling.amount);
  if (n != null) {
    if (profile.min_amount && n < profile.min_amount) {
      return { pass: false, reason: `amount ${n} below min ${profile.min_amount}` };
    }
    if (profile.max_amount && n > profile.max_amount) {
      return { pass: false, reason: `amount ${n} above max ${profile.max_amount}` };
    }
  }

  return { pass: true };
}
