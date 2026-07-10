// Server-only helpers for the in-process discovery run: pidfile + log paths,
// liveness checks, and a sweep that clears agent_runs rows stuck in 'running'
// after a crash (a stuck row would otherwise block the start button forever).
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

// A single agent call has its own 25-min timeout, so a row still 'running' past
// 30 min means that call wedged or the process died mid-call. Either way the
// background process is misbehaving and gets killed, not just the DB row.
const STALE_MS = 30 * 60 * 1000;
// Whole-run ceiling: a slow multi-round run keeps each row short (so the per-row
// rule never trips) while grinding for an hour. Cap total wall clock too.
const RUN_MAX_MS = 40 * 60 * 1000;

export function runDir(): string {
  return join(process.cwd(), ".grant-hunter");
}

export function pidFile(): string {
  return join(runDir(), "discovery.pid");
}

export function logFile(): string {
  return join(runDir(), "discovery.log");
}

export function ensureRunDir(): void {
  mkdirSync(runDir(), { recursive: true });
}

export function readPid(): number | null {
  try {
    const pid = Number.parseInt(readFileSync(pidFile(), "utf8").trim(), 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means the process exists but isn't ours - treat as alive.
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function clearPidFile(): void {
  try {
    rmSync(pidFile(), { force: true });
  } catch {
    // best effort
  }
}

// Kill the detached discovery process (whole group, so tsx's worker dies too)
// and drop the pidfile. Safe to call when nothing is running.
export function killRun(): void {
  const pid = readPid();
  if (pid && pidAlive(pid)) {
    try {
      // Spawned detached (its own process group), so the negative pid targets
      // the group, not just the launcher.
      process.kill(-pid, "SIGTERM");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ESRCH") {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // Already gone.
        }
      }
    }
  }
  clearPidFile();
}

// Last N lines of the run log, so the Runs page can show what the run is
// actually doing (its output goes to a file, not the dev-server terminal).
export function tailLog(maxLines = 40): string | null {
  try {
    const text = readFileSync(logFile(), "utf8").trimEnd();
    if (!text) return null;
    const lines = text.split("\n");
    return lines.slice(-maxLines).join("\n");
  } catch {
    return null;
  }
}

// Mark rows stuck in 'running' as errored so the one-run-at-a-time guard can't
// wedge, AND kill the misbehaving background process so it stops spending. Trips
// on either a single row past 30 min or the whole run past 40 min. Never throws.
export async function sweepStaleRuns(sb: SupabaseClient): Promise<void> {
  try {
    const { data } = await sb
      .from("agent_runs")
      .select("id, started_at, input_data")
      .eq("status", "running");
    const running = (data ?? []) as {
      id: string;
      started_at: string | null;
      input_data: { runId?: unknown } | null;
    }[];
    if (!running.length) return;

    const now = Date.now();
    const ageOf = (iso: string | null): number =>
      iso ? now - Date.parse(iso) : 0;

    // Per-row wedge: any running row older than 30 min.
    const wedged = running.some((r) => ageOf(r.started_at) > STALE_MS);

    // Run-level cap: how long has the whole run been going? Each agent call is
    // short, so use the earliest started_at across ALL rows of the active run
    // (finished ones included), not just the currently-running row.
    const runIds = [
      ...new Set(
        running
          .map((r) => r.input_data?.runId)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    ];
    let runTooOld = false;
    if (runIds.length) {
      const { data: firstRows } = await sb
        .from("agent_runs")
        .select("started_at")
        .filter("input_data->>runId", "in", `(${runIds.join(",")})`)
        .order("started_at", { ascending: true })
        .limit(1);
      const firstIso = (firstRows ?? [])[0]?.started_at as string | null;
      runTooOld = ageOf(firstIso) > RUN_MAX_MS;
    }

    if (!wedged && !runTooOld) return;

    await sb
      .from("agent_runs")
      .update({
        status: "error",
        error_message: runTooOld
          ? "Marked stale: the run passed the 40-minute ceiling and was stopped."
          : "Marked stale: still 'running' after 30 minutes - the process was killed.",
        completed_at: new Date().toISOString(),
      })
      .eq("status", "running");
    killRun();
  } catch {
    // The sweep must never break a page or action.
  }
}
