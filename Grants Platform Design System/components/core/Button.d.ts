import type { ReactNode, MouseEventHandler } from "react";

export interface ButtonProps {
  children: ReactNode;
  /** primary = brand-filled; secondary = bordered surface. @default "secondary" */
  variant?: "primary" | "secondary";
  /** sm = compact inline button. @default "md" */
  size?: "md" | "sm";
  /** When set, renders an <a> styled identically (matches .btn on Next <Link>). */
  href?: string;
  /** @default "button" */
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: MouseEventHandler;
  className?: string;
}

/**
 * The button primitive (`.btn` / `.btn-primary` / `.btn-sm`). Presentational —
 * wire behavior in a "use client" island.
 *
 * Intentional addition: the source has no Button component (buttons are inline
 * `<button className="btn">`); this standardizes the markup.
 *
 * @startingPoint section="Actions" subtitle="Primary / secondary / small button" viewport="700x150"
 */
export function Button(props: ButtonProps): JSX.Element;
