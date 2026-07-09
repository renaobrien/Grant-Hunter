"use client";

// Notification channel editor. SECURITY: this client component never receives
// secret values - the server passes presence booleans (see ChannelView in
// page.tsx). Secret inputs are write-only: blank keeps the stored value, typing
// replaces it (upsertChannel merges server-side).
import { useState, useTransition, type FormEvent } from "react";
import { upsertChannel } from "./actions";
import type { NotificationChannel } from "@/lib/types";

export interface ChannelView {
  channel: NotificationChannel;
  enabled: boolean;
  /** A secret (webhook / bot token / API key) is already stored or in env. */
  hasSecret: boolean;
  chat_id: string;
  recipients: string;
  from: string;
}

interface ChannelDef {
  channel: NotificationChannel;
  label: string;
  blurb: string;
  guideHref: string;
  guideLabel: string;
  secretLabel: string | null;
  secretPlaceholder: string;
}

const DEFS: ChannelDef[] = [
  {
    channel: "slack",
    label: "Slack",
    blurb: "Post alerts to an incoming webhook.",
    guideHref: "https://api.slack.com/messaging/webhooks",
    guideLabel: "Get a Slack webhook",
    secretLabel: "Webhook URL",
    secretPlaceholder: "https://hooks.slack.com/services/…",
  },
  {
    channel: "discord",
    label: "Discord",
    blurb: "Post alerts to a channel webhook.",
    guideHref: "https://support.discord.com/hc/en-us/articles/228383668",
    guideLabel: "Get a Discord webhook",
    secretLabel: "Webhook URL",
    secretPlaceholder: "https://discord.com/api/webhooks/…",
  },
  {
    channel: "telegram",
    label: "Telegram",
    blurb: "Send alerts to a bot chat.",
    guideHref: "https://core.telegram.org/bots/features#botfather",
    guideLabel: "Create a bot with @BotFather",
    secretLabel: "Bot token",
    secretPlaceholder: "123456:ABC…",
  },
  {
    channel: "email",
    label: "Email",
    blurb: "Send alerts to a recipient list (via Resend).",
    guideHref: "https://resend.com/docs/dashboard/api-keys/introduction",
    guideLabel: "Get a Resend API key",
    secretLabel: "Resend API key",
    secretPlaceholder: "re_…",
  },
];

export default function ChannelsEditor({ channels }: { channels: ChannelView[] }) {
  return (
    <div className="channel-list">
      {DEFS.map((def) => (
        <ChannelRow
          key={def.channel}
          def={def}
          view={
            channels.find((c) => c.channel === def.channel) ?? {
              channel: def.channel,
              enabled: false,
              hasSecret: false,
              chat_id: "",
              recipients: "",
              from: "",
            }
          }
        />
      ))}
    </div>
  );
}

function ChannelRow({ def, view }: { def: ChannelDef; view: ChannelView }) {
  const [enabled, setEnabled] = useState<boolean>(view.enabled);
  const [secret, setSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(view.hasSecret);
  const [chatId, setChatId] = useState(view.chat_id);
  const [recipients, setRecipients] = useState(view.recipients);
  const [from, setFrom] = useState(view.from);

  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function buildConfig(): Record<string, unknown> {
    // Secret keys are included ONLY when the user typed a replacement; the
    // server keeps the stored value otherwise.
    const s = secret.trim();
    switch (def.channel) {
      case "slack":
      case "discord":
        return s ? { webhook_url: s } : {};
      case "telegram":
        return { chat_id: chatId.trim(), ...(s ? { bot_token: s } : {}) };
      case "email":
        return {
          recipients: recipients
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
          from: from.trim(),
          ...(s ? { api_key: s } : {}),
        };
      default:
        return {};
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await upsertChannel(def.channel, enabled, buildConfig());
      if (res.ok) {
        if (secret.trim()) setHasSecret(true);
        setSecret("");
        setMsg({ ok: true, text: "Saved." });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <form className="channel-row" onSubmit={onSubmit}>
      <div className="channel-head">
        <span className="channel-title">
          <span className={`chip chip-${enabled ? "good" : "muted"}`}>
            {def.label}
          </span>
          <span className="muted channel-blurb">{def.blurb}</span>
        </span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {enabled ? "Enabled" : "Disabled"}
        </label>
      </div>

      <div className="channel-fields">
        {def.secretLabel ? (
          <div className="field">
            <label htmlFor={`${def.channel}-secret`}>
              {def.secretLabel}{" "}
              <span className="muted">
                {hasSecret ? "- configured ✓" : "- not set"}
              </span>
            </label>
            <input
              id={`${def.channel}-secret`}
              type="password"
              autoComplete="off"
              placeholder={
                hasSecret
                  ? "Paste a new one to replace (blank keeps current)"
                  : def.secretPlaceholder
              }
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <span className="field-hint">
              Don&rsquo;t have one?{" "}
              <a href={def.guideHref} target="_blank" rel="noreferrer">
                {def.guideLabel} ↗
              </a>
              . Stored on your own database; never shown again after saving.
            </span>
          </div>
        ) : null}

        {def.channel === "telegram" && (
          <div className="field">
            <label htmlFor="telegram-chat-id">Chat ID</label>
            <input
              id="telegram-chat-id"
              type="text"
              placeholder="e.g. -1001234567890"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
            <span className="field-hint">
              Message your bot once, then ask{" "}
              <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer">
                @userinfobot ↗
              </a>{" "}
              for your numeric chat id.
            </span>
          </div>
        )}

        {def.channel === "email" && (
          <>
            <div className="field">
              <label htmlFor="email-recipients">Recipients</label>
              <input
                id="email-recipients"
                type="text"
                placeholder="a@org.com, b@org.com"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
              <span className="field-hint">Comma-separated addresses.</span>
            </div>
            <div className="field">
              <label htmlFor="email-from">From</label>
              <input
                id="email-from"
                type="text"
                placeholder="Grants <alerts@org.com>"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <span className="field-hint">
                Must be a sender your Resend account has verified.
              </span>
            </div>
          </>
        )}
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {msg ? (
          <span
            className={`form-msg ${msg.ok ? "form-msg-ok" : "form-msg-err"}`}
            role="status"
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
