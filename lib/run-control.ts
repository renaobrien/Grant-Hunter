// Server-only helpers for the in-process discovery run: pidfile + log paths,
// liveness checks, and a sweep that clears agent_runs rows stuck in 'running'
// after a crash (a stuck row would otherwise block the start button forever).
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

const STALE_MS = 30 * 60 * 1000;

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

// Mark rows stuck in 'running' for over 30 minutes as errored so the
// one-run-at-a-time guard can't wedge. Never throws.
export async function sweepStaleRuns(sb: SupabaseClient): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    await sb
      .from("agent_runs")
      .update({
        status: "error",
        error_message:
          "Marked stale: still 'running' after 30 minutes - the process likely crashed or was killed.",
        completed_at: new Date().toISOString(),
      })
      .eq("status", "running")
      .lt("started_at", cutoff);
  } catch {
    // The sweep must never break a page or action.
  }
}
