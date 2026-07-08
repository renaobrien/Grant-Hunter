import { createClient } from "@/lib/supabase/server";
import { Card, FieldRow, Chip } from "@/components/ui";
import type { SettingsRow, NotificationChannelRow } from "@/lib/types";
import SettingsForm from "./SettingsForm";
import ChannelsEditor from "./ChannelsEditor";
import ApiKeysForm from "./ApiKeysForm";

export const dynamic = "force-dynamic";

const DEFAULT_CRON = "0 12 * * 1";

// Best-effort human-readable summary of a "min hour dom mon dow" cron string.
// Returns null when the shape isn't one of the simple daily/weekly patterns.
function describeCron(cron: string): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;
  if (dom !== "*" || mon !== "*") return null;
  const h = Number(hour);
  const m = Number(min);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} UTC`;
  if (dow === "*") return `Daily at ${time}`;
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const d = Number(dow);
  if (Number.isInteger(d) && d >= 0 && d <= 6) return `${days[d]}s at ${time}`;
  return null;
}

export default async function SettingsPage() {
  const supabase = await createClient();

  const [settingsRes, channelsRes] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("notification_channels")
      .select("*")
      .order("channel", { ascending: true }),
  ]);

  const settings = (settingsRes.data as SettingsRow | null) ?? null;
  const channels = (channelsRes.data as NotificationChannelRow[] | null) ?? [];

  // Presence only — the key value itself is never passed to the client.
  const hasAnthropicKey = Boolean(settings?.anthropic_api_key);

  const cron = settings?.weekly_cron ?? DEFAULT_CRON;
  const cronHuman = describeCron(cron);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted" style={{ marginBottom: 0 }}>
            API keys, discovery cadence, spend guardrails, and where alerts go.
          </p>
        </div>
      </div>

      <Card>
        <h2>API keys</h2>
        <p className="muted">
          The Anthropic key the agents spend. Set it here and you never need to
          touch <code>.env.local</code> — it&rsquo;s stored on your own database.
        </p>
        <ApiKeysForm hasKey={hasAnthropicKey} />
      </Card>

      <Card>
        <h2>Discovery &amp; budget</h2>
        <SettingsForm
          initial={{
            daily_budget_usd: settings?.daily_budget_usd ?? 5,
            discovery_rounds: settings?.discovery_rounds ?? 2,
            discovery_target_survivors:
              settings?.discovery_target_survivors ?? 5,
            preference_summary: settings?.preference_summary ?? "",
          }}
        />
      </Card>

      <Card>
        <h2>Weekly run schedule</h2>
        <FieldRow label="Cron (UTC)">
          <span className="row">
            <code>{cron}</code>
            {cronHuman ? <Chip label={cronHuman} tone="neutral" /> : null}
          </span>
        </FieldRow>
        <p className="muted" style={{ marginTop: "var(--s3)", marginBottom: 0 }}>
          Schedule lives in <code>.github/workflows/discovery.yml</code> — edit
          it there to change the cadence.
        </p>
      </Card>

      <Card>
        <h2>Notifications</h2>
        <p className="muted">
          Enable a channel and save its delivery details. Disabled channels keep
          their config but receive nothing.
        </p>
        <ChannelsEditor channels={channels} />
      </Card>
    </div>
  );
}
