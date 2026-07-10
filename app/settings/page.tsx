import { cookies } from "next/headers";
import { authDisabled, createClient } from "@/lib/supabase/server";
import { getPreferenceContext } from "@/engine/preference-context";
import { Card } from "@/components/ui";
import SignInNotice from "@/components/SignInNotice";
import type {
  NotificationChannel,
  SettingsRow,
  NotificationChannelRow,
} from "@/lib/types";
import { existsSync } from "node:fs";
import { join } from "node:path";
import SettingsForm from "./SettingsForm";
import ChannelsEditor, { type ChannelView } from "./ChannelsEditor";
import ApiKeysForm from "./ApiKeysForm";
import LlmProviderForm from "./LlmProviderForm";
import UpdatePanel from "./UpdatePanel";
import ScheduleForm from "./ScheduleForm";
import type { LlmProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_CRON = "0 12 * * 1";

export default async function SettingsPage() {
  const supabase = await createClient();
  const signInDismissed =
    (await cookies()).get("signin_notice_dismissed")?.value === "1";

  const [settingsRes, channelsRes] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("notification_channels")
      .select("*")
      .order("channel", { ascending: true }),
  ]);

  const settings = (settingsRes.data as SettingsRow | null) ?? null;
  const channelRows =
    (channelsRes.data as NotificationChannelRow[] | null) ?? [];

  // Strip secrets BEFORE anything reaches the client: webhook URLs, bot tokens
  // and API keys become presence booleans. Env fallbacks count as configured.
  const channels: ChannelView[] = channelRows.map((row) => {
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const has = (k: string) => typeof cfg[k] === "string" && !!cfg[k];
    const hasSecret =
      row.channel === "telegram"
        ? has("bot_token") || Boolean(process.env.TELEGRAM_BOT_TOKEN)
        : row.channel === "email"
        ? has("api_key") || Boolean(process.env.RESEND_API_KEY)
        : has("webhook_url");
    return {
      channel: row.channel as NotificationChannel,
      enabled: row.enabled,
      hasSecret,
      chat_id: typeof cfg.chat_id === "string" ? cfg.chat_id : "",
      recipients: Array.isArray(cfg.recipients)
        ? (cfg.recipients as string[]).join(", ")
        : "",
      from: typeof cfg.from === "string" ? cfg.from : "",
    };
  });

  // Presence only - key VALUES never reach the client. Mirror the engine's
  // resolveAnthropicKey(): dashboard (DB) first, .env.local fallback.
  const keySource = settings?.anthropic_api_key
    ? ("dashboard" as const)
    : process.env.ANTHROPIC_API_KEY?.trim()
    ? ("env" as const)
    : null;
  const hasAnthropicKey = keySource !== null;

  const cron = settings?.weekly_cron ?? DEFAULT_CRON;

  // Exactly what the agents read on every run - shown read-only so the operator
  // can see what's been learned (and knows what to correct via ratings / the
  // preference summary above).
  const agentContext = await getPreferenceContext(supabase);

  // In-app updates only make sense on a local git checkout.
  const canSelfUpdate =
    !process.env.VERCEL && existsSync(join(process.cwd(), ".git"));

  // Local-model provider (Ollama) is a self-hosted-only feature (writes .env.local).
  const canUseLocalModel = !process.env.VERCEL;
  const llmProvider: LlmProvider =
    (process.env.LLM_PROVIDER ?? "").trim().toLowerCase() === "ollama" ? "ollama" : "anthropic";

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

      {authDisabled() && !signInDismissed ? <SignInNotice /> : null}

      <Card>
        <h2>API keys</h2>
        <p className="muted">
          The Anthropic key the agents spend. Stored in your own database,
          never shown back to the browser.
        </p>
        <ApiKeysForm hasKey={hasAnthropicKey} source={keySource} />
      </Card>

      {canUseLocalModel ? (
        <Card>
          <h2>AI provider</h2>
          <p className="muted">
            Run the agents on Anthropic (cloud) or a local Ollama model (free and
            private). Only Anthropic can search the live web, so finding new
            grants needs Anthropic mode; a local model still handles drafting,
            judging, and profile compile. The Anthropic key above is used in
            Anthropic mode only.
          </p>
          <LlmProviderForm
            initialProvider={llmProvider}
            initialBaseUrl={process.env.OLLAMA_BASE_URL ?? ""}
            initialModel={process.env.OLLAMA_MODEL ?? ""}
          />
        </Card>
      ) : null}

      <Card>
        <h2>Discovery &amp; budget</h2>
        <SettingsForm
          initial={{
            daily_budget_usd: settings?.daily_budget_usd ?? 5,
            run_budget_usd: settings?.run_budget_usd ?? 2,
            discovery_rounds: settings?.discovery_rounds ?? 2,
            discovery_target_survivors:
              settings?.discovery_target_survivors ?? 5,
            discovery_min_fit: settings?.discovery_min_fit ?? 3,
            discovery_min_alignment: settings?.discovery_min_alignment ?? 3,
            preference_summary: settings?.preference_summary ?? "",
            speed_mode: settings?.speed_mode ?? "thorough",
          }}
        />
      </Card>

      <Card>
        <h2>Your agents</h2>
        <p className="muted">
          Discovery runs three agents in a loop: a <strong>Finder</strong>{" "}
          searches the web for grants, a <strong>Skeptic</strong> tries to
          disprove each one (dead link, wrong fit, closed program), and a{" "}
          <strong>Judge</strong> scores what survives and keeps only the strong
          matches. Drafting works the same way with a Drafter and a Critic. They
          all read the guidance you set above, plus what they learn from the
          grants you rate.
        </p>
        <details>
          <summary style={{ cursor: "pointer" }}>
            See the exact guidance they read
          </summary>
          <pre className="voice-preview" style={{ marginTop: "var(--s3)" }}>
            {agentContext}
          </pre>
        </details>
      </Card>

      <Card>
        <h2>Weekly run schedule</h2>
        <p className="muted">
          Pick when automatic runs happen, in your local time. The Run button
          works anytime regardless.
        </p>
        <ScheduleForm
          initialCron={cron}
          runMode={settings?.run_mode ?? "manual"}
        />
      </Card>

      <Card>
        <h2>Notifications</h2>
        <p className="muted">
          Enable a channel and save its delivery details. Disabled channels keep
          their config but receive nothing.
        </p>
        <ChannelsEditor channels={channels} />
      </Card>

      {canSelfUpdate ? (
        <Card>
          <h2>Updates</h2>
          <p className="muted">Updates the app from GitHub.</p>
          <UpdatePanel />
        </Card>
      ) : null}
    </div>
  );
}
