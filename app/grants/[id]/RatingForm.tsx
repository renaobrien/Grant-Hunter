"use client";

import { useState, useTransition } from "react";
import { REJECTION_REASONS } from "@/lib/types";
import type { RejectionReason } from "@/lib/types";
import { saveRating } from "./actions";

export default function RatingForm({
  grantId,
  initialScore,
  initialReason,
}: {
  grantId: string;
  initialScore: number | null;
  initialReason: RejectionReason | null;
}) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [reason, setReason] = useState<RejectionReason | "">(initialReason ?? "");
  const [feedback, setFeedback] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsReason = score != null && score <= 2;

  function pick(n: number) {
    setScore(n);
    setSaved(false);
    setError(null);
    if (n > 2) setReason("");
  }

  function submit() {
    if (score == null || pending) return;
    const currentScore = score;
    setError(null);
    startTransition(async () => {
      const res = await saveRating(
        grantId,
        currentScore,
        currentScore <= 2 ? reason || null : null,
        feedback,
      );
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Could not save your rating.");
    });
  }

  return (
    <div className="stack">
      <div className="field">
        <label>Score</label>
        <div className="row" role="group" aria-label="Rate this grant from 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`btn btn-sm${score === n ? " btn-primary" : ""}`}
              aria-pressed={score === n}
              onClick={() => pick(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {needsReason ? (
        <div className="field">
          <label htmlFor="rej-reason">Rejection reason</label>
          <select
            id="rej-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as RejectionReason | "");
              setSaved(false);
            }}
          >
            <option value="">Select a reason…</option>
            {REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="rating-why">Why? (optional)</label>
        <textarea
          id="rating-why"
          value={feedback}
          placeholder="What made this a strong or weak fit? This teaches the scoring."
          onChange={(e) => {
            setFeedback(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={score == null || pending}
        >
          {pending ? "Saving…" : "Save rating"}
        </button>
        {saved ? <span className="saved-note">Saved ✓</span> : null}
        {error ? (
          <span className="saved-note" style={{ color: "var(--tone-bad)" }}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
