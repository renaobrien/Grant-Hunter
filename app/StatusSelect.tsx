"use client";

import { useState, useTransition, type ChangeEvent, type MouseEvent } from "react";
import { GRANT_STATUSES, type GrantStatus } from "@/lib/types";
import { updateGrantStatus } from "./actions";

// One label per real state; the select is how a grant moves between board
// columns (Searched -> Working on -> Submitted -> Closed).
const STATUS_LABELS: Record<GrantStatus, string> = {
  found: "Found",
  drafting: "Working on it",
  submitted: "Submitted",
  awarded: "Awarded",
  dead: "Dead (not pursuing)",
};

export default function StatusSelect({
  id,
  status,
}: {
  id: string;
  status: GrantStatus;
}) {
  const [value, setValue] = useState<GrantStatus>(status);
  const [isPending, startTransition] = useTransition();

  // Keep clicks on the control from bubbling up to the wrapping <Link>.
  function stop(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
  }

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as GrantStatus;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await updateGrantStatus(id, next);
      } catch {
        setValue(prev); // revert on failure
      }
    });
  }

  return (
    <select
      className="status-select"
      value={value}
      onChange={onChange}
      onClick={stop}
      disabled={isPending}
      aria-label="Grant status"
    >
      {GRANT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
