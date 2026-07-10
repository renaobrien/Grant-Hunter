"use client";

// Live elapsed time for a row that's still running (agent_runs.duration_ms is
// null until it finishes). Renders "…" on the server / first paint to avoid a
// hydration mismatch, then ticks each second.
import { useEffect, useState } from "react";

export default function Elapsed({ since }: { since: string | null }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!since) return;
    const start = Date.parse(since);
    if (Number.isNaN(start)) return;
    const tick = () => setMs(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);

  if (ms == null || ms < 0) return <span className="muted">…</span>;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const long = m >= 8;
  return (
    <span style={long ? { color: "var(--tone-warn)" } : undefined}>
      {m > 0 ? `${m}m ${s % 60}s` : `${s}s`}
    </span>
  );
}
