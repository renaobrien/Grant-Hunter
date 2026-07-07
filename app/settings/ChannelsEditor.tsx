"use client";

import { useState, useTransition, type FormEvent } from "react";
import { upsertChannel } from "./actions";
import type {
  NotificationChannel,
  NotificationChannelRow,
} from "@/lib/types";

interface ChannelDef {
  channel: NotificationChannel;
  label: string;
  blurb: string;
}

const DEFS: ChannelDef[] = [
  { channel: "slack", label: "Slack", blurb: "Post alerts to an incoming webhook." },
  { channel: "discord", label: "Discord", blurb: "Post alerts to a channel webhook." },
  { channel: "telegram", label: "Telegram", blurb: "Send alerts to a bot chat." },
  { channel: "email", label: "Email", blurb: "Send alerts to a recipient list." },
];

export default function ChannelsEditor({
  channels,
}: {
  channels: NotificationChannelRow[];
}) {
  return (
    <div className="channel-list">
      {DEFS.map((def) => (
        <ChannelRow
          key={def.channel}
          def={def}
          existing={channels.find((c) => c.channel === def.channel) ?? null}
        />
      ))}
    </div>
  );
}

function ChannelRow({
  def,
  existing,
}: {
  def: ChannelDef;
  existing: NotificationChannelRow | null;
}) {
  const cfg = (existing?.config ?? {}) as Record<string, unknown>;

  const [enabled, setEnabled] = useState<boolean>(existing?.enabled ?? false);
  const [webhookUrl, setWebhookUrl] = useState<string>(
    typeof cfg.webhook_url === "string" ? cfg.webhook_url : "",
  );
  const [chatId, setChatId] = useState<string>(
    typeof cfg.chat_id === "string" ? cfg.chat_id : "",
  );
  const [recipients, setRecipients] = useState<string>(
    Array.isArray(cfg.recipients) ? (cfg.recipients as string[]).join(", ") : "",
  );
  const [from, setFrom] = useState<string>(
    typeof cfg.from === "string" ? cfg.from : "",
  );

  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function buildConfig(): Record<string, unknown> {
    switch (def.channel) {
      case "slack":
      case "discord":
        return { webhook_url: webhookUrl.trim() };
      case "telegram":
        return { chat_id: chatId.trim() };
      case "email":
        return {
          recipients: recipients
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
          from: from.trim(),
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
      setMsg(
        res.ok
          ? { ok: true, text: "Saved." }
          : { ok: false, text: res.error },
      );
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
        {(def.channel === "slack" || def.channel === "discord") && (
          <div className="field">
            <label htmlFor={`${def.channel}-webhook`}>Webhook URL</label>
            <input
              id={`${def.channel}-webhook`}
              type="url"
              placeholder="https://hooks…"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
        )}

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
