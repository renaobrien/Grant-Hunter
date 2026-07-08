import type { ReactNode } from "react";

export interface FieldRowProps {
  /** Left-column label (--ink-faint, 0.82rem). */
  label: string;
  /** Right-column value — text, Chip, ScorePips, link, etc. */
  children: ReactNode;
}

/**
 * Labeled label/value row for detail and settings views. 160px label column +
 * value column with a hairline divider; stacks under 900px. Render nothing for
 * empty values (the product hides empty rows rather than showing blanks).
 *
 * @startingPoint section="Data display" subtitle="Label / value detail row" viewport="700x180"
 */
export function FieldRow(props: FieldRowProps): JSX.Element;
