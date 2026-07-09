"use server";

// Start/stop a discovery run from the dashboard. Local self-host only: we
// spawn the CLI entrypoint (engine/run-discovery.ts) as a detached process so
// it outlives this request; progress lands in `agent_runs`, which the Runs
// page and HealthHeader render. Output goes to .grant-hunter/discovery.log
// and the pid to .grant-hunter/discovery.pid so the run can be stopped.
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, writeSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { resolveAnthropicKey } from "@/engine/db";
import {
  clearPidFile,
  ensureRunDir,
  logFile,
  pidAlive,
  pidFile,
  readPid,
  sweepStaleRuns,
} from "@/lib/run-control";

export type StartDiscoveryResult = { ok: true } | { ok: false; error: string };
export type StopDiscoveryResult =
  | { ok: true; note?: string }
  | { ok: false; error: string };

const HOSTED_RUN_HINT =
  "This hosted instance starts runs from GitHub: open your repo's Actions tab, pick \"Weekly grant discovery\", and press \"Run workflow\".";

export async function startDiscovery(): Promise<StartDiscoveryResult> {
  if (process.env.VERCEL) {
    return { ok: false, error: HOSTED_RUN_HINT };
  }

  const supabase = await createClient();

  // Fail fast with a clear message instead of a background run that dies
  // silently before writing an agent_runs row.
  try {
    await resolveAnthropicKey(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Clear rows stuck in 'running' from a crashed process before checking the
  // one-at-a-time guard, so a dead run can't block the button forever.
  await sweepStaleRuns(supabase);

  // One at a time. Discovery runs minutes and spends real credit.
  const { data: running } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  if (running) {
    return {
      ok: false,
      error: "A run is already in progress - one at a time. Stop it first if it's stuck.",
    };
  }

  const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(tsxCli)) {
    return {
      ok: false,
      error:
        "Can't find the tsx runtime (node_modules/tsx). Run `npm install` in the project folder, then try again.",
    };
  }

  try {
    // process.execPath (the Node binary running this server) + the local tsx
    // CLI avoids any dependence on PATH or npx network fetches.
    let stdio: ("ignore" | number)[] = ["ignore", "ignore", "ignore"];
    let log: number | null = null;
    try {
      ensureRunDir();
      log = openSync(logFile(), "a");
      writeSync(log, `\n--- discovery started ${new Date().toISOString()} ---\n`);
      stdio = ["ignore", log, log];
    } catch {
      // Log file unwritable - run anyway without capture.
    }
    const child = spawn(
      process.execPath,
      [tsxCli, "engine/run-discovery.ts", "--manual"],
      { cwd: process.cwd(), detached: true, stdio },
    );
    if (log != null) closeSync(log);
    if (child.pid) {
      try {
        ensureRunDir();
        writeFileSync(pidFile(), String(child.pid), "utf8");
      } catch {
        // Without a pidfile the run still works; stop falls back to row cleanup.
      }
    }
    child.unref();
  } catch (e) {
    return { ok: false, error: `Couldn't start the run: ${(e as Error).message}` };
  }

  return { ok: true };
}

export async function stopDiscovery(): Promise<StopDiscoveryResult> {
  if (process.env.VERCEL) {
    return {
      ok: false,
      error: "Runs on this hosted instance are managed by GitHub Actions - cancel them from the Actions tab.",
    };
  }

  const supabase = await createClient();

  const pid = readPid();
  if (pid && pidAlive(pid)) {
    try {
      // The child was spawned detached (its own process group), so a negative
      // pid kills the whole group including tsx's forked worker.
      process.kill(-pid, "SIGTERM");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ESRCH") {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // Process already gone.
        }
      }
    }
  }
  clearPidFile();

  // Mark every running row regardless of pid state - this also serves as the
  // manual unblock when the pidfile is missing or the process already died.
  const { data: stopped, error } = await supabase
    .from("agent_runs")
    .update({
      status: "error",
      error_message: "Stopped by user",
      completed_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .select("id");

  if (error) {
    return { ok: false, error: `Couldn't update run records: ${error.message}` };
  }
  if (!pid && (stopped?.length ?? 0) === 0) {
    return { ok: true, note: "Nothing was running." };
  }
  return { ok: true };
}
