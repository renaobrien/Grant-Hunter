"use client";

// Collapsible view of the discovery run's output. The run writes to a log file,
// not the dev-server terminal, so this is the only window into a live run. Stays
// collapsed until opened; polls only while open and a run is active.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { getRunLog } from "@/app/runs/actions";

const POLL_MS = 3000;

export default function RunLog({
  initialLog,
  initialRunning,
}: {
  initialLog: string | null;
  initialRunning: boolean;
}) {
  const router = useRouter();
  const [log, setLog] = useState<string | null>(initialLog);
  const [running, setRunning] = useState(initialRunning);
  const [open, setOpen] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const wasRunning = useRef(initialRunning);

  const refresh = useCallback(async () => {
    try {
      const res = await getRunLog();
      setLog(res.log);
      setRunning(res.running);
      setCheckedAt(new Date().toLocaleTimeString());
      // When a run finishes, pull the rest of the page so the table updates.
      if (wasRunning.current && !res.running) router.refresh();
      wasRunning.current = res.running;
    } catch {
      // Transient - keep the last log; the next tick tries again.
    }
  }, [router]);

  // The page auto-refreshes while a run is active; keep the "live" chip in sync
  // with the server's view even when the panel is closed (so it can't stick).
  useEffect(() => {
    setRunning(initialRunning);
    wasRunning.current = initialRunning;
  }, [initialRunning]);

  // Poll only while the panel is open and a run is active.
  useEffect(() => {
    if (!open || !running) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [open, running, refresh]);

  // Keep the newest line in view whenever the log grows while open.
  useEffect(() => {
    if (!open) return;
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, open]);

  return (
    <Card className="note-panel">
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary style={{ cursor: "pointer" }}>
          <span style={{ fontWeight: 600 }}>Run log</span>{" "}
          {running ? (
            <span className="chip chip-info" style={{ verticalAlign: "middle" }}>
              live
            </span>
          ) : (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              (last run)
            </span>
          )}
        </summary>
        <div className="stack" style={{ gap: "var(--s2)", marginTop: "var(--s3)" }}>
          <div className="row" style={{ gap: "var(--s2)", alignItems: "center" }}>
            <button type="button" className="btn btn-sm" onClick={refresh}>
              Refresh
            </button>
            {checkedAt ? (
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                checked {checkedAt}
              </span>
            ) : null}
          </div>
          {log ? (
            <div className="table-wrap">
              <pre
                ref={preRef}
                className="voice-preview"
                style={{ margin: 0, maxHeight: 340, overflow: "auto" }}
              >
                {log}
              </pre>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No run output yet.
            </p>
          )}
        </div>
      </details>
    </Card>
  );
}
