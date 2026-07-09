"use client";

// Stops the in-progress discovery run (kills the process, marks its rows).
// Also the manual unblock when a run is stuck.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { stopDiscovery } from "@/app/runs/actions";

export default function StopDiscoveryButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go() {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await stopDiscovery();
      if (res.ok) {
        if (res.note) setNote(res.note);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="stack" style={{ gap: "var(--s2)" }}>
      <div>
        <button type="button" className="btn" onClick={go} disabled={pending}>
          {pending ? "Stopping…" : "Stop run"}
        </button>
      </div>
      {note ? <p className="form-msg form-msg-ok">{note}</p> : null}
      {error ? <p className="form-msg form-msg-err">{error}</p> : null}
    </div>
  );
}
