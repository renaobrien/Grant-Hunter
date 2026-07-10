"use client";

// Live view of the discovery run's output. The run writes to a log file, not the
// dev-server terminal, so without this the dashboard has no window into what a
// run is actually doing. Polls getRunLog() every few seconds while a run is
// active, auto-scrolls to the newest line, and refreshes the rest of the page
// once the run finishes so the results table updates.
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
  const [stamp, setStamp] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const wasRunning = useRef(initialRunning);

  const refresh = useCallback(async () => {
    try {
      const res = await getRunLog();
      setLog(res.log);
      setRunning(res.running);
      // When a run finishes, pull the rest of the page so the table shows results.
      if (wasRunning.current && !res.running) router.refresh();
      wasRunning.current = res.running;
    } catch {
      // Transient - keep the last log; the next tick tries again.
    }
  }, [router]);

  // Poll only while a run is active.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [running, refresh]);

  // Stamp the "updated" time on the client to avoid a hydration mismatch.
  useEffect(() => {
    setStamp(new Date().toLocaleTimeString());
  }, [log]);

  // Keep the newest line in view.
  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <Card className="note-panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>
          Live run log{" "}
          {running ? (
            <span className="chip chip-info" style={{ verticalAlign: "middle" }}>
              live
            </span>
          ) : null}
        </h3>
        <button type="button" className="btn btn-sm" onClick={refresh}>
          Refresh
        </button>
      </div>
      <p className="muted" style={{ margin: "var(--s1) 0 var(--s3)" }}>
        {running
          ? "What the run is doing right now, straight from its output."
          : log
            ? "Output from the most recent run."
            : "No run output yet - start a run above."}
        {stamp ? ` · updated ${stamp}` : ""}
      </p>
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
      ) : null}
    </Card>
  );
}
