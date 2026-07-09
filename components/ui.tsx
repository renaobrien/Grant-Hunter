// Server-safe presentational primitives. No "use client" - these render on the
// server and are styled entirely via className hooks defined in app/globals.css.
import type { ReactNode, CSSProperties } from "react";
import type { GrantStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className ? `card ${className}` : "card"} style={style}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusChip - colored chip whose tone is derived from a grant status
// ---------------------------------------------------------------------------
const STATUS_TONE: Record<GrantStatus, string> = {
  found: "neutral",
  drafting: "info",
  submitted: "warn",
  awarded: "good",
  dead: "bad",
};

const STATUS_LABEL: Record<GrantStatus, string> = {
  found: "Found",
  drafting: "Working on it",
  submitted: "Submitted",
  awarded: "Awarded",
  dead: "Dead",
};

export function StatusChip({ status }: { status: GrantStatus }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span className={`chip chip-${tone}`}>{STATUS_LABEL[status] ?? status}</span>
  );
}

// ---------------------------------------------------------------------------
// Chip - generic labeled chip with an optional tone
// ---------------------------------------------------------------------------
export type ChipTone =
  | "neutral"
  | "muted"
  | "info"
  | "good"
  | "warn"
  | "bad"
  | "brand";

export function Chip({
  label,
  tone = "neutral",
}: {
  label: ReactNode;
  tone?: ChipTone;
}) {
  return <span className={`chip chip-${tone}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// EmptyState - every empty list must render one of these
// ---------------------------------------------------------------------------
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint ? <p className="empty-hint">{hint}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldRow - labeled row for detail views
// ---------------------------------------------------------------------------
export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value">{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScorePips - 1..max filled/empty pips (fit, alignment, human score)
// ---------------------------------------------------------------------------
export function ScorePips({
  score,
  max = 5,
}: {
  score: number | null | undefined;
  max?: number;
}) {
  const filled = Math.max(0, Math.min(max, Math.round(score ?? 0)));
  if (!score) {
    return <span className="pips pips-empty">-</span>;
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
