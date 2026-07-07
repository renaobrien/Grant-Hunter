// notify.ts — the single notification dispatcher for the whole platform.
// One entrypoint: sendNotification(sb, event, subject, text). It loads every
// enabled notification_channels row whose `events` array includes this event and
// fans the message out to each channel (Slack/Discord webhooks, Telegram bot,
// Resend email) under Promise.allSettled. Best-effort by design: any single
// channel failure is console.error'd and swallowed; this function NEVER throws.
//
// Channel config shapes (notification_channels.config jsonb):
//   slack:    { webhook_url: string }
//   discord:  { webhook_url: string }
//   telegram: { chat_id: string }            // bot token from env TELEGRAM_BOT_TOKEN
//   email:    { recipients: string[], from: string }  // api key from env RESEND_API_KEY

import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export type NotifyEvent = "weekly_digest" | "new_grant" | "deadline" | "draft_ready";

interface ChannelRow {
  channel: string;
  config: Record<string, unknown> | null;
  events: string[] | null;
}

// Slack/Discord/Telegram message ceiling (leave headroom under the 2000 hard cap).
const MSG_MAX = 1990;
const clip = (s: string) => (s.length > MSG_MAX ? s.slice(0, MSG_MAX) : s);

async function postWebhook(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`webhook ${res.status} ${res.statusText}`);
}

async function dispatchSlack(cfg: Record<string, unknown>, text: string): Promise<void> {
  const url = cfg.webhook_url;
  if (typeof url !== "string" || !url) throw new Error("slack channel missing webhook_url");
  await postWebhook(url, { text: clip(text) });
}

async function dispatchDiscord(cfg: Record<string, unknown>, text: string): Promise<void> {
  const url = cfg.webhook_url;
  if (typeof url !== "string" || !url) throw new Error("discord channel missing webhook_url");
  await postWebhook(url, { content: clip(text) });
}

async function dispatchTelegram(cfg: Record<string, unknown>, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[notify] telegram channel enabled but TELEGRAM_BOT_TOKEN is unset — skipping");
    return;
  }
  const chatId = cfg.chat_id;
  if (typeof chatId !== "string" || !chatId) throw new Error("telegram channel missing chat_id");
  await postWebhook(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text: clip(text),
  });
}

async function dispatchEmail(
  cfg: Record<string, unknown>,
  subject: string,
  text: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[notify] email channel enabled but RESEND_API_KEY is unset — skipping");
    return;
  }
  const recipients = cfg.recipients;
  const from = cfg.from;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("email channel missing recipients");
  }
  if (typeof from !== "string" || !from) throw new Error("email channel missing from");

  const to = recipients.filter((r): r is string => typeof r === "string" && !!r);
  if (to.length === 0) throw new Error("email channel has no valid recipients");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) throw new Error(`resend error: ${error.message ?? String(error)}`);
}

async function dispatchOne(row: ChannelRow, subject: string, text: string): Promise<void> {
  const cfg = row.config ?? {};
  switch (row.channel) {
    case "slack":
      return dispatchSlack(cfg, `${subject}\n\n${text}`);
    case "discord":
      return dispatchDiscord(cfg, `${subject}\n\n${text}`);
    case "telegram":
      return dispatchTelegram(cfg, `${subject}\n\n${text}`);
    case "email":
      return dispatchEmail(cfg, subject, text);
    default:
      throw new Error(`unknown channel: ${row.channel}`);
  }
}

/** Fan `event` out to every enabled channel subscribed to it. Best-effort, never throws. */
export async function sendNotification(
  sb: SupabaseClient,
  event: NotifyEvent,
  subject: string,
  text: string,
): Promise<void> {
  const { data, error } = await sb
    .from("notification_channels")
    .select("channel, config, events")
    .eq("enabled", true);

  if (error) {
    console.error(`[notify] could not load channels: ${error.message}`);
    return;
  }

  const rows = (data ?? []) as ChannelRow[];
  const targets = rows.filter((r) => Array.isArray(r.events) && r.events.includes(event));
  if (targets.length === 0) return;

  await Promise.allSettled(
    targets.map(async (row) => {
      try {
        await dispatchOne(row, subject, text);
      } catch (e) {
        console.error(`[notify] ${row.channel} dispatch failed: ${(e as Error).message}`);
      }
    }),
  );
}
