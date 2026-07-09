"use client";

// Record what actually happened to a submitted application. This is the
// ground-truth the teaching loop learns from - won grants pull discovery toward
// more like them, lost ones flag framing to strengthen.
import { useState, useTransition } from "react";
import { GRANT_OUTCOMES, type GrantOutcome } from "@/lib/types";
import { setOutcome } from "./actions";

const LABEL: Record<GrantOutcome, string> = {
  awarded: "Awarded",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export default function OutcomeForm({
  grantId,
  initialOutcome,
}: {
  grantId: string;
  initialOutcome: GrantOutcome | null;
}) {
  const [outcome, setLocal] = useState<GrantOutcome | null>(initialOutcome);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(next: GrantOutcome | null) {
    if (pending) return;
    setError(null);
    const prev = outcome;
    setLocal(next);
    startTransition(async () => {
      const res = await setOutcome(grantId, next);
      if (!res.ok) {
        setLocal(prev);
        setError(res.error ?? "Could not save the outcome.");
      }
    });
  }

  return (
    <div className="stack">
      <p className="muted" style={{ marginTop: 0 }}>
        Once you hear back, record the result. Your agents learn from real
        outcomes, not just which grants you pursued.
      </p>
      <div className="row" style={{ gap: "var(--s2)", flexWrap: "wrap" }}>
        {GRANT_OUTCOMES.map((o) => (
          <button
            key={o}
            type="button"
            className={`btn btn-sm ${outcome === o ? "btn-primary" : ""}`}
            onClick={() => choose(outcome === o ? null : o)}
            disabled={pending}
          >
            {LABEL[o]}
          </button>
        ))}
        {outcome ? (
          <button type="button" className="btn btn-sm" onClick={() => choose(null)} disabled={pending}>
            Clear
          </button>
        ) : null}
        {error ? (
          <span className="saved-note" style={{ color: "var(--tone-bad)" }}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
