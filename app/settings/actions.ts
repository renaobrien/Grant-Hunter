"use server";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { NotificationChannel } from "@/lib/types";

const run = promisify(execFile);

// Result shape returned to the client forms so they can render inline feedback.
export type ActionResult = { ok: true } | { ok: false; error: string };

const CHANNELS = ["slack", "discord", "telegram", "email"] as const satisfies readonly NotificationChannel[];

export interface SettingsValues {
  daily_budget_usd: number;
  discovery_rounds: number;
  discovery_target_survivors: number;
  preference_summary: string | null;
}

// Upsert the settings singleton (id = 1). weekly_cron is intentionally NOT
// written here - the schedule is owned by .github/workflows/discovery.yml.
export async function saveSettings(vals: SettingsValues): Promise<ActionResult> {
  const budget = Number(vals.daily_budget_usd);
  const rounds = Number(vals.discovery_rounds);
  const survivors = Number(vals.discovery_target_survivors);

  if (!Number.isFinite(budget) || budget < 0) {
    return { ok: false, error: "Daily budget must be a non-negative number." };
  }
  if (!Number.isInteger(rounds) || rounds < 1) {
    return { ok: false, error: "Discovery rounds must be a whole number ≥ 1." };
  }
  if (!Number.isInteger(survivors) || survivors < 1) {
    return { ok: false, error: "Target survivors must be a whole number ≥ 1." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert(
    {
      id: 1,
      daily_budget_usd: budget,
      discovery_rounds: rounds,
      discovery_target_survivors: survivors,
      preference_summary: vals.preference_summary,
    },
    { onConflict: "id" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
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
    const migrations = changed.filter(
      (f) => f.startsWith("supabase/migrations/") && f.endsWith(".sql"),
    );
    if (migrations.length) {
      notes.push(
        `New database migration${migrations.length > 1 ? "s" : ""} arrived (${migrations
          .map((m) => m.split("/").pop())
          .join(", ")}). Run the SQL in your Supabase SQL editor - open /connect for the combined script - or run npm run db:push.`,
      );
    }
  } catch {
    // Diff inspection is best-effort; the pull itself already succeeded.
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Updated. The dev server hot-reloads most changes - restart npm run dev if anything looks off.",
    notes,
  };
}
