"use client";

import { useState, useTransition, type ChangeEvent, type MouseEvent } from "react";
import { GRANT_STATUSES, type GrantStatus } from "@/lib/types";
import { updateGrantStatus } from "./actions";

const STATUS_LABELS: Record<GrantStatus, string> = {
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
