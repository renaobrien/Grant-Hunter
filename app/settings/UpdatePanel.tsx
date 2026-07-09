"use client";

// One-click updates: check what's new on GitHub, pull it, done. No re-download.
import { useState, useTransition } from "react";
import { checkForUpdates, applyUpdate } from "./actions";

type Phase = "idle" | "checked" | "applied";

export default function UpdatePanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [behind, setBehind] = useState(0);
  const [latest, setLatest] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function check() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await checkForUpdates();
      if (!res.ok) {
        setError(res.error ?? "Couldn't check.");
        return;
      }
      setBehind(res.behind ?? 0);
      setLatest(res.latest ?? "");
      setPhase("checked");
    });
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await applyUpdate();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setMessage(res.message);
      setNotes(res.notes);
      setPhase("applied");
    });
  }

  return (
    <div className="stack" style={{ gap: "var(--s3)" }}>
      {phase === "idle" ? (
        <div>
          <button type="button" className="btn" onClick={check} disabled={pending}>
            {pending ? "Checking…" : "Check for updates"}
          </button>
        </div>
      ) : null}

      {phase === "checked" ? (
        behind > 0 ? (
          <>
            <p style={{ margin: 0 }}>
              <strong>
                {behind} update{behind === 1 ? "" : "s"} available.
              </strong>{" "}
              <span className="muted">Latest: {latest}</span>
            </p>
            <div className="row" style={{ gap: "var(--s2)" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={apply}
                disabled={pending}
              >
                {pending ? "Updating…" : "Update now"}
              </button>
              <button type="button" className="btn" onClick={check} disabled={pending}>
                Re-check
              </button>
            </div>
          </>
        ) : (
          <p className="form-msg form-msg-ok" style={{ margin: 0 }}>
            You&rsquo;re up to date.
          </p>
        )
      ) : null}

      {phase === "applied" && message ? (
        <div className="stack" style={{ gap: "var(--s2)" }}>
          <p className="form-msg form-msg-ok" style={{ margin: 0 }}>
            {message}
          </p>
          {notes.map((n) => (
            <p key={n} className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {n}
            </p>
          ))}
        </div>
      ) : null}

      {error ? <p className="form-msg form-msg-err">{error}</p> : null}
    </div>
  );
}
