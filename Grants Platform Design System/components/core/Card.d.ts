import type { ReactNode, CSSProperties } from "react";

export interface CardProps {
  /** Card contents. */
  children: ReactNode;
  /** Extra class(es) appended after "card" — e.g. "card-ethos" for the accent left-border. */
  className?: string;
  style?: CSSProperties;
}

/**
 * The base surface primitive: white panel, --line border, --radius corners,
 * soft --shadow, --s3 padding.
 *
 * @startingPoint section="Surfaces" subtitle="Base white panel with soft shadow" viewport="700x220"
 */
export function Card(props: CardProps): JSX.Element;
