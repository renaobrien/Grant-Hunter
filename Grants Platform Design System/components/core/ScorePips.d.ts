export interface ScorePipsProps {
  /** The score to render (rounded, clamped to 0..max). null/0/undefined → em-dash. */
  score: number | null | undefined;
  /** Total pips. @default 5 */
  max?: number;
}

/**
 * A compact filled/empty square-pip meter for the two 1–5 grant scores (Fit and
 * Alignment/Ethos) and human ratings. Prefer this over a number for scannability
 * in dense board cards.
 *
 * @startingPoint section="Data display" subtitle="1–5 filled/empty pip meter" viewport="700x140"
 */
export function ScorePips(props: ScorePipsProps): JSX.Element;
