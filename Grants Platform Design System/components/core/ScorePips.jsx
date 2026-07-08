import React from "react";

/**
 * ScorePips — a 1..max row of filled/empty square pips for a score (Fit,
 * Alignment/Ethos, human rating). Renders an em-dash placeholder when the score
 * is null/0. Filled pips use --brand-primary; empty use --line.
 */
export function ScorePips({ score, max = 5 }) {
  const filled = Math.max(0, Math.min(max, Math.round(score ?? 0)));
  if (!score) {
    return <span className="pips pips-empty">—</span>;
  }
  return (
    <span className="pips" aria-label={`${filled} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={i < filled ? "pip pip-on" : "pip pip-off"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
