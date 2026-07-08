import React from "react";

const STATUS_TONE = {
  found: "neutral",
  researching: "info",
  drafting: "info",
  applied: "warn",
  submitted: "warn",
  awarded: "good",
  passed: "muted",
  discarded: "muted",
  dead: "bad",
};

const STATUS_LABEL = {
  found: "Found",
  researching: "Researching",
  drafting: "Drafting",
  applied: "Applied",
  submitted: "Submitted",
  awarded: "Awarded",
  passed: "Passed",
  discarded: "Discarded",
  dead: "Dead",
};

/**
 * StatusChip — a Chip whose tone + label are derived from one of the nine grant
 * statuses. This is the single source of truth for how a status looks anywhere
 * in the app (board cards, detail header, pipeline).
 */
export function StatusChip({ status }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <span className={`chip chip-${tone}`}>{STATUS_LABEL[status] ?? status}</span>;
}
