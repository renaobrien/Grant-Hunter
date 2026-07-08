import type { ReactNode } from "react";

export type ChipTone =
  | "neutral"
  | "muted"
  | "info"
  | "good"
  | "warn"
  | "bad"
  | "brand";

export interface ChipProps {
  /** Chip text (or node). */
  label: ReactNode;
  /**
   * Color tone. good=pursue/approved/success, warn=maybe/revise, bad=pass/error,
   * info=running/in-progress, muted=closed/inactive, neutral=bordered default,
   * brand=brand-tinted.
   * @default "neutral"
   */
  tone?: ChipTone;
}

/**
 * Small pill label carrying a status tone.
 *
 * @startingPoint section="Data display" subtitle="Toned status pill" viewport="700x140"
 */
export function Chip(props: ChipProps): JSX.Element;
