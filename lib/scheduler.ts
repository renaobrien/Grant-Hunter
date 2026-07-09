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

  const cron = parseWeeklyCron(settings.weekly_cron ?? "");
  if (!cron) return;

  const now = new Date();
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
  const child = spawn("npx", ["tsx", "engine/run-discovery.ts"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();
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
