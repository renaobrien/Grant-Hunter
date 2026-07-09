// scheduler.ts - in-app scheduler for "On my computer" (run_mode = local)
// instances. While the app is running, it checks once a minute whether
// settings.weekly_cron matches the current UTC time and, if so, spawns the
// same detached discovery process the Run button uses. GitHub-mode instances
// are scheduled by the workflow instead; manual mode never auto-runs.
//
// Started once per server boot from instrumentation.ts (Node runtime only).
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

let started = false;
let lastFiredKey = "";
let lastJobsKey = "";

// How often the local scheduler drains the jobs queue + sweeps deadlines/links.
// Matches the GitHub Action cadence (*/30). Without this, auto-expire and link
// re-validation never fire on a self-hosted box unless the operator runs
// `npm run jobs` by hand.
const JOBS_INTERVAL_MIN = 30;

interface CronParts {
  minute: number;
  hour: number;
  dow: number | null; // null = every day
}

/** Parse "m h dom mon dow" (dom/mon must be *). Returns null when unsupported. */
export function parseWeeklyCron(cron: string): CronParts | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, mon, dow] = parts;
  if (dom !== "*" || mon !== "*") return null;
  const minute = Number(m);
  const hour = Number(h);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (dow === "*") return { minute, hour, dow: null };
  const d = Number(dow);
  if (!Number.isInteger(d) || d < 0 || d > 6) return null;
  return { minute, hour, dow: d };
}

function matchesNow(cron: CronParts, now: Date): boolean {
  return (
    now.getUTCMinutes() === cron.minute &&
    now.getUTCHours() === cron.hour &&
    (cron.dow === null || now.getUTCDay() === cron.dow)
  );
}

/** Spawn a detached engine entrypoint (same mechanism the Run button uses). */
function spawnEngine(script: string): void {
  const child = spawn("npx", ["tsx", script], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

/** Run the jobs worker every JOBS_INTERVAL_MIN minutes (drafts + deadline
 *  expiry + link re-validation). Fires at most once per matching minute. */
function maybeRunJobs(now: Date): void {
  if (now.getUTCMinutes() % JOBS_INTERVAL_MIN !== 0) return;
  const fireKey = now.toISOString().slice(0, 16);
  if (lastJobsKey === fireKey) return;
  lastJobsKey = fireKey;
  console.log("[scheduler] running jobs worker (queue drain + deadline/link sweep)");
  spawnEngine("engine/run-jobs.ts");
}

async function tick(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return; // not connected yet (fresh instance)

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: settings } = await sb
    .from("settings")
    .select("weekly_cron, run_mode")
    .eq("id", 1)
    .maybeSingle();
  if (settings?.run_mode !== "local") return;

  const now = new Date();

  // Jobs sweep runs on its own cadence, independent of the weekly discovery cron.
  maybeRunJobs(now);

  const cron = parseWeeklyCron(settings.weekly_cron ?? "");
  if (!cron) return;
  if (!matchesNow(cron, now)) return;

  // Fire at most once per matching minute, even if ticks jitter.
  const fireKey = now.toISOString().slice(0, 16);
  if (lastFiredKey === fireKey) return;
  lastFiredKey = fireKey;

  // Never overlap a run already in progress.
  const { data: running } = await sb
    .from("agent_runs")
    .select("id")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  if (running) {
    console.warn("[scheduler] skipping scheduled discovery - a run is already in progress");
    return;
  }

  console.log(`[scheduler] weekly_cron matched (${settings.weekly_cron}) - starting discovery`);
  spawnEngine("engine/run-discovery.ts");
}

/** Idempotent: safe to call on every server boot. */
export function startLocalScheduler(): void {
  if (started || process.env.VERCEL) return;
  started = true;
  setInterval(() => {
    tick().catch((e) => console.error("[scheduler] tick failed:", (e as Error).message));
  }, 60_000).unref();
  console.log("[scheduler] local run scheduler active (checks settings.weekly_cron every minute)");
}
