"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { NotificationChannel } from "@/lib/types";

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
// written here — the schedule is owned by .github/workflows/discovery.yml.
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

// Upsert one notification channel row keyed on the unique `channel` column.
export async function upsertChannel(
  channel: NotificationChannel,
  enabled: boolean,
  config: Record<string, unknown>,
): Promise<ActionResult> {
  if (!CHANNELS.includes(channel)) {
    return { ok: false, error: `Unsupported channel: ${String(channel)}` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_channels")
    .upsert({ channel, enabled, config }, { onConflict: "channel" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
