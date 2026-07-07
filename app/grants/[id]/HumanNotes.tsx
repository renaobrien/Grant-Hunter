"use client";

import { useState, useTransition } from "react";
import { saveHumanNotes } from "./actions";

export default function HumanNotes({
  grantId,
  initialNotes,
}: {
  grantId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await saveHumanNotes(grantId, notes);
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Could not save your notes.");
    });
  }

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="human-notes">Operator notes</label>
        <textarea
          id="human-notes"
          value={notes}
          placeholder="Context, contacts, next steps — human-owned, never touched by the engine."
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
        />
      </div>
      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save notes"}
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
