"use server";

import { execFile } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  budgetRemainingCents,
  finishRun,
  loadSettings,
  resolveAnthropicKey,
  startRun,
} from "@/engine/db";
import { distillPreferences } from "@/engine/distill-preferences";
import { friendlyClaudeError } from "@/engine/anthropic";
import { readEnv, writeEnv } from "@/lib/env-file";
import type { AgentUsage } from "@/engine/types";
import type { LlmProvider, NotificationChannel } from "@/lib/types";

const run = promisify(execFile);

// Result shape returned to the client forms so they can render inline feedback.
export type ActionResult = { ok: true } | { ok: false; error: string };

const CHANNELS = ["slack", "discord", "telegram", "email"] as const satisfies readonly NotificationChannel[];

export interface SettingsValues {
  daily_budget_usd: number;
  run_budget_usd: number;
  discovery_rounds: number;
  discovery_target_survivors: number;
  discovery_min_fit: number;
  discovery_min_alignment: number;
  preference_summary: string | null;
  speed_mode: "thorough" | "fast";
}

// Upsert the settings singleton (id = 1). weekly_cron is intentionally NOT
// written here - the schedule is owned by .github/workflows/discovery.yml.
export async function saveSettings(vals: SettingsValues): Promise<ActionResult> {
  const budget = Number(vals.daily_budget_usd);
  const runBudget = Number(vals.run_budget_usd);
  const rounds = Number(vals.discovery_rounds);
  const survivors = Number(vals.discovery_target_survivors);
  const minFit = Number(vals.discovery_min_fit);
  const minAlignment = Number(vals.discovery_min_alignment);

  if (!Number.isFinite(budget) || budget < 0) {
    return { ok: false, error: "Daily budget must be a non-negative number." };
  }
  if (!Number.isFinite(runBudget) || runBudget < 0) {
    return { ok: false, error: "Per-run budget must be a non-negative number." };
  }
  if (!Number.isInteger(rounds) || rounds < 1) {
    return { ok: false, error: "Discovery rounds must be a whole number ≥ 1." };
  }
  if (!Number.isInteger(survivors) || survivors < 1) {
    return { ok: false, error: "Target survivors must be a whole number ≥ 1." };
  }
  if (!Number.isInteger(minFit) || minFit < 1 || minFit > 5) {
    return { ok: false, error: "Minimum fit must be a whole number 1-5." };
  }
  if (!Number.isInteger(minAlignment) || minAlignment < 1 || minAlignment > 5) {
    return { ok: false, error: "Minimum alignment must be a whole number 1-5." };
  }
  if (vals.speed_mode !== "thorough" && vals.speed_mode !== "fast") {
    return { ok: false, error: "Speed must be 'thorough' or 'fast'." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert(
    {
      id: 1,
      daily_budget_usd: budget,
      run_budget_usd: runBudget,
      discovery_rounds: rounds,
      discovery_target_survivors: survivors,
      discovery_min_fit: minFit,
      discovery_min_alignment: minAlignment,
      preference_summary: vals.preference_summary,
      speed_mode: vals.speed_mode,
    },
    { onConflict: "id" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Regenerate settings.preference_summary by distilling the org's ratings + board
 * activity (one budget-capped Haiku call). Returns the new summary so the form
 * can show it. Persists it too, so it's not lost if the user navigates away.
 */
export async function regeneratePreferenceSummary(): Promise<
  { ok: true; summary: string } | { ok: false; error: string }
> {
  const supabase = await createClient();

  let apiKey: string;
  try {
    apiKey = await resolveAnthropicKey(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { daily_budget_usd } = await loadSettings(supabase);
  if ((await budgetRemainingCents(supabase, daily_budget_usd)) <= 0) {
    return {
      ok: false,
      error: "Daily budget is spent. Try again tomorrow, or raise it above.",
    };
  }

  const run = await startRun(supabase, "distiller", "manual", {});
  try {
    const { summary, usage } = await distillPreferences(supabase, apiKey);
    await finishRun(supabase, run, { status: "success", usage });
    await supabase
      .from("settings")
      .upsert({ id: 1, preference_summary: summary || null }, { onConflict: "id" });
    revalidatePath("/settings");
    return { ok: true, summary };
  } catch (e) {
    const usage = (e as { usage?: AgentUsage }).usage;
    await finishRun(supabase, run, { status: "error", usage, error: (e as Error).message });
    return { ok: false, error: friendlyClaudeError(e) };
  }
}

// ---------------------------------------------------------------------------
// AI provider: Anthropic (default) or a local Ollama model. Local-only feature -
// Ollama runs on the operator's machine, so this writes to .env.local (and can't
// run on a read-only host). The engine reads LLM_PROVIDER / OLLAMA_* from the
// environment; spawned runs reload .env.local, and we also update this process's
// env so in-app calls pick up the change without a restart.
// ---------------------------------------------------------------------------
const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export async function saveLlmProvider(input: {
  provider: LlmProvider;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}): Promise<ActionResult> {
  if (process.env.VERCEL) {
    return {
      ok: false,
      error: "A local model only works on a self-hosted instance, not a hosted deploy.",
    };
  }
  if (input.provider !== "anthropic" && input.provider !== "ollama") {
    return { ok: false, error: "Unknown provider." };
  }

  const baseUrl = (input.ollamaBaseUrl?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
  const model = input.ollamaModel?.trim() ?? "";
  if (input.provider === "ollama" && !model) {
    return { ok: false, error: "Enter the Ollama model name (e.g. llama3.1)." };
  }

  try {
    const env = readEnv();
    if (input.provider === "ollama") {
      env.LLM_PROVIDER = "ollama";
      env.OLLAMA_BASE_URL = baseUrl;
      env.OLLAMA_MODEL = model;
    } else {
      // Back to Anthropic: clear the local-model vars (writeEnv drops empties).
      env.LLM_PROVIDER = "";
      env.OLLAMA_BASE_URL = "";
      env.OLLAMA_MODEL = "";
    }
    writeEnv(env);

    // Reflect the change in THIS process so in-app calls (distiller, requirements
    // extraction) switch immediately; spawned runs reload .env.local themselves.
    if (input.provider === "ollama") {
      process.env.LLM_PROVIDER = "ollama";
      process.env.OLLAMA_BASE_URL = baseUrl;
      process.env.OLLAMA_MODEL = model;
    } else {
      delete process.env.LLM_PROVIDER;
      delete process.env.OLLAMA_BASE_URL;
      delete process.env.OLLAMA_MODEL;
    }
  } catch {
    return {
      ok: false,
      error: "Couldn't write .env.local (read-only filesystem?). This feature needs a local install.",
    };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/** Ping an Ollama server and return its installed model names, so the operator
 *  can confirm it's running and pick a model. */
export async function testOllama(
  baseUrl: string,
): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  const base = (baseUrl.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `Ollama responded HTTP ${res.status} at ${base}.` };
    const data = (await res.json()) as { models?: { name?: string }[] };
    const models = (data.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === "string");
    return { ok: true, models };
  } catch (e) {
    return {
      ok: false,
      error: `Couldn't reach Ollama at ${base} (${(e as Error).message}). Run 'ollama serve' first.`,
    };
  }
}

// Save (or clear) the Anthropic API key on the settings singleton. Write-only:
// the value is never read back to the browser. An empty string clears it (the
// engine then falls back to the ANTHROPIC_API_KEY env var, if set).
export async function saveAnthropicKey(key: string): Promise<ActionResult> {
  const trimmed = key.trim();
  if (trimmed && !trimmed.startsWith("sk-ant-")) {
    return {
      ok: false,
      error: "That doesn't look like an Anthropic key - they start with 'sk-ant-'.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ id: 1, anthropic_api_key: trimmed || null }, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

// Upsert one notification channel row keyed on the unique `channel` column.
// Secret-bearing config fields are write-only in the UI: the client sends them
// ONLY when the user typed a replacement, so an empty/missing value here means
// "keep whatever is stored". Non-secret fields overwrite as sent.
const SECRET_CONFIG_KEYS = ["webhook_url", "bot_token", "api_key"] as const;

export async function upsertChannel(
  channel: NotificationChannel,
  enabled: boolean,
  config: Record<string, unknown>,
): Promise<ActionResult> {
  if (!CHANNELS.includes(channel)) {
    return { ok: false, error: `Unsupported channel: ${String(channel)}` };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("notification_channels")
    .select("config")
    .eq("channel", channel)
    .maybeSingle();
  const prev = (existing?.config ?? {}) as Record<string, unknown>;

  const merged: Record<string, unknown> = { ...config };
  for (const key of SECRET_CONFIG_KEYS) {
    const incoming = merged[key];
    if ((incoming === undefined || incoming === "") && prev[key]) {
      merged[key] = prev[key]; // blank = keep the stored secret
    }
    if (merged[key] === "") delete merged[key];
  }

  const { error } = await supabase
    .from("notification_channels")
    .upsert({ channel, enabled, config: merged }, { onConflict: "channel" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// In-app updates (local git checkouts only). "Update now" = git pull --ff-only,
// so a user never has to re-download the app to get fixes. Guarded off on
// hosted platforms (they redeploy from GitHub instead).
// ---------------------------------------------------------------------------

export interface UpdateCheck {
  ok: boolean;
  behind?: number;
  latest?: string;
  current?: string;
  error?: string;
}

export async function checkForUpdates(): Promise<UpdateCheck> {
  if (process.env.VERCEL) {
    return { ok: false, error: "Hosted instances update by redeploying from GitHub." };
  }
  try {
    const cwd = process.cwd();
    await run("git", ["fetch", "--quiet", "origin", "main"], { cwd });
    const [behindOut, latestOut, currentOut] = await Promise.all([
      run("git", ["rev-list", "--count", "HEAD..origin/main"], { cwd }),
      run("git", ["log", "-1", "--format=%s", "origin/main"], { cwd }),
      run("git", ["log", "-1", "--format=%s", "HEAD"], { cwd }),
    ]);
    return {
      ok: true,
      behind: parseInt(behindOut.stdout.trim(), 10) || 0,
      latest: latestOut.stdout.trim(),
      current: currentOut.stdout.trim(),
    };
  } catch (e) {
    return {
      ok: false,
      error: `Couldn't check for updates: ${(e as Error).message.split("\n")[0]}`,
    };
  }
}

export interface UpdateApply {
  ok: boolean;
  message: string;
  notes: string[];
  /**
   * One-time SQL to paste, ONLY when the auto-migrator isn't installed yet. After
   * this is pasted once, future updates apply their own SQL with no manual step.
   */
  bootstrapSql?: string;
}

const RUNNER_VERSION = "0014_migration_runner";

// A service-role Supabase client built straight from env (not the request/auth
// client), because auto-migration needs the service role regardless of login mode.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

// Read every migration file, in order, as { version, sql }.
function readMigrations(cwd: string): { version: string; sql: string }[] {
  try {
    const dir = join(cwd, "supabase", "migrations");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => ({
        version: f.replace(/\.sql$/, ""),
        sql: readFileSync(join(dir, f), "utf8"),
      }));
  } catch {
    return [];
  }
}

/**
 * Apply any migrations the database hasn't run yet, via the exec_sql runner
 * (migration 0014). Returns notes for the UI, plus one-time bootstrapSql when the
 * runner itself isn't installed yet (a fresh install gets it in the /connect
 * paste; an older install pastes it once, then updates are automatic).
 */
async function autoMigrate(cwd: string): Promise<{ notes: string[]; bootstrapSql?: string }> {
  const onDisk = readMigrations(cwd);
  const admin = adminClient();
  if (!admin || !onDisk.length) return { notes: [] };

  // Is the runner installed? exec_sql returns void, so a clean probe is a no-op.
  const probe = await admin.rpc("exec_sql", { sql: "select 1" });
  const runnerMissing =
    !!probe.error &&
    (probe.error.code === "PGRST202" ||
      /exec_sql|could not find|schema cache|does not exist/i.test(probe.error.message));

  if (runnerMissing) {
    const runner = onDisk.find((m) => m.version === RUNNER_VERSION);
    return {
      notes: [
        "One-time setup to turn on automatic database updates: paste the SQL below into your Supabase SQL editor and run it once. After that, every update applies its own database changes with no copy-paste. Give it a few seconds, then press Update again.",
      ],
      bootstrapSql: runner?.sql.trim(),
    };
  }

  const { data: appliedRows, error: readErr } = await admin
    .from("schema_migrations")
    .select("version");
  if (readErr) {
    // Runner function exists but the tracker table doesn't - treat as not set up.
    const runner = onDisk.find((m) => m.version === RUNNER_VERSION);
    return {
      notes: ["Finish enabling automatic updates: paste the SQL below once, then press Update again."],
      bootstrapSql: runner?.sql.trim(),
    };
  }

  const applied = new Set((appliedRows ?? []).map((r) => r.version as string));
  const pending = onDisk.filter((m) => !applied.has(m.version));
  if (!pending.length) return { notes: [] };

  const done: string[] = [];
  for (const m of pending) {
    const res = await admin.rpc("exec_sql", { sql: m.sql });
    if (res.error) {
      return {
        notes: [
          done.length ? `Applied: ${done.join(", ")}.` : "",
          `Database update ${m.version} failed: ${res.error.message}. Fix that, then press Update again.`,
        ].filter(Boolean),
      };
    }
    await admin.from("schema_migrations").insert({ version: m.version });
    done.push(m.version);
  }
  return {
    notes: [`Applied ${done.length} database update${done.length > 1 ? "s" : ""} automatically: ${done.join(", ")}.`],
  };
}

export async function applyUpdate(): Promise<UpdateApply> {
  if (process.env.VERCEL) {
    return { ok: false, message: "Hosted instances update by redeploying from GitHub.", notes: [] };
  }
  const cwd = process.cwd();
  try {
    await run("git", ["pull", "--ff-only", "origin", "main"], { cwd });
  } catch (e) {
    return {
      ok: false,
      message: `Update failed: ${(e as Error).message.split("\n").slice(0, 2).join(" ")}. If you edited files locally, commit or discard those changes first.`,
      notes: [],
    };
  }

  const notes: string[] = [];
  try {
    const diff = await run("git", ["diff", "--name-only", "ORIG_HEAD..HEAD"], { cwd });
    const changed = diff.stdout.split("\n").filter(Boolean);
    if (changed.includes("package-lock.json")) {
      notes.push("Installing updated dependencies (this can take a minute)…");
      await run("npm", ["install", "--no-audit", "--no-fund"], { cwd });
      notes.push("Dependencies installed.");
    }
  } catch {
    // Diff inspection is best-effort; the pull itself already succeeded.
  }

  // Apply any new database migrations automatically through the exec_sql runner.
  // Uses the on-disk migration set + the schema_migrations ledger, so it catches
  // anything unapplied - not just what arrived in this exact pull.
  let bootstrapSql: string | undefined;
  try {
    const mig = await autoMigrate(cwd);
    notes.push(...mig.notes);
    bootstrapSql = mig.bootstrapSql;
  } catch (e) {
    notes.push(`Couldn't auto-apply database updates: ${(e as Error).message}. The code still updated.`);
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Updated. The dev server hot-reloads most changes - restart npm run dev if anything looks off.",
    notes,
    bootstrapSql,
  };
}

// ---------------------------------------------------------------------------
// Weekly run schedule. Stored as a cron string (UTC) in settings.weekly_cron.
// The in-app scheduler (lib/scheduler.ts) honors it for run_mode = "local";
// GitHub-mode users also need the matching line in their workflow file.
// ---------------------------------------------------------------------------
export async function saveSchedule(input: {
  dow: string; // "0".."6" or "*"
  hour: number;
  minute: number;
}): Promise<ActionResult> {
  const { dow, hour, minute } = input;
  if (dow !== "*" && !/^[0-6]$/.test(dow)) {
    return { ok: false, error: "Pick a day of the week (or every day)." };
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { ok: false, error: "Hour must be 0-23." };
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { ok: false, error: "Minute must be 0-59." };
  }

  const cron = `${minute} ${hour} * * ${dow}`;
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ id: 1, weekly_cron: cron }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
