// setup.ts — guided self-host setup.
// Collects your keys, writes .env.local, verifies the database, and makes you the
// owner. Then points you at `npm run onboard` and deploy. Safe to re-run.
//
//   npm run setup

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ENV_PATH = ".env.local";

function readEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync(ENV_PATH)) {
    for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function writeEnv(env: Record<string, string>) {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "APP_BASE_URL",
    "DAILY_BUDGET_USD",
  ];
  // Known keys first, then preserve anything else already in .env.local so a
  // re-run never silently drops a variable the user added by hand.
  const extras = Object.keys(env).filter((k) => !keys.includes(k));
  const lines = [...keys, ...extras]
    .filter((k) => env[k] !== undefined && env[k] !== "")
    .map((k) => `${k}=${env[k]}`);
  writeFileSync(ENV_PATH, lines.join("\n") + "\n");
}

async function main() {
  const env = readEnv();
  const rl = createInterface({ input, output });
  const ask = async (key: string, label: string, required = true) => {
    const cur = env[key];
    const shown = cur ? ` (current: ${cur.slice(0, 8)}…)` : "";
    let v = (await rl.question(`${label}${shown}\n> `)).trim();
    if (!v && cur) v = cur;
    if (required && !v) {
      console.log("  (required — try again)");
      return ask(key, label, required);
    }
    if (v) env[key] = v;
  };

  console.log("\n— grants-platform setup —\n");
  console.log("From your Supabase project (Project Settings → API):");
  await ask("NEXT_PUBLIC_SUPABASE_URL", "Supabase Project URL (https://xxx.supabase.co)");
  env.SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  await ask("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon/public key");
  await ask("SUPABASE_SERVICE_ROLE_KEY", "Supabase service_role key (secret)");
  await ask("ANTHROPIC_API_KEY", "Anthropic API key (sk-ant-…)");
  let owner = "";
  while (!owner.includes("@")) {
    owner = (await rl.question("\nYour email (the owner who can log into the dashboard)\n> ")).trim().toLowerCase();
    if (!owner.includes("@")) console.log("  (a valid email is required — it's how you'll sign in)");
  }
  env.APP_BASE_URL = env.APP_BASE_URL || "http://localhost:3000";
  env.DAILY_BUDGET_USD = env.DAILY_BUDGET_USD || "5";

  writeEnv(env);
  console.log(`\n✓ Wrote ${ENV_PATH}`);

  // Verify DB + schema
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { error: schemaErr } = await sb.from("profile").select("id").limit(1);
  if (schemaErr) {
    console.log(
      `\n⚠ Could not read the 'profile' table (${schemaErr.message}).\n` +
        "Apply the schema first, then re-run setup:\n" +
        "    npx supabase link --project-ref <your-ref>\n" +
        "    npm run db:push\n",
    );
    process.exit(1);
  }

  // Seed owner
  const { error: memErr } = await sb.from("members").upsert({ email: owner, role: "owner" }, { onConflict: "email" });
  if (memErr) console.log(`\n⚠ Could not add owner (${memErr.message}). Add yourself to 'members' manually.`);
  else console.log(`✓ Added ${owner} as owner`);

  // ── Notification channel wizard ─────────────────────────────────────────
  // Where should digests + alerts go? Pick any (comma-separated), or skip.
  // Each choice upserts a notification_channels row (unique on `channel`) so a
  // re-run updates in place instead of duplicating. Secrets that live in the
  // process environment (Telegram bot token, Resend API key) are added to `env`
  // and re-written to .env.local; per-channel config (webhook URLs, chat id,
  // recipients) is stored in the row's jsonb `config`.
  async function upsertChannel(channel: string, config: Record<string, unknown>) {
    const { error } = await sb
      .from("notification_channels")
      .upsert({ channel, config, enabled: true }, { onConflict: "channel" });
    if (error) console.log(`  ⚠ Could not save ${channel} channel (${error.message}). Skipping.`);
    else console.log(`  ✓ ${channel} notifications enabled`);
  }

  console.log(
    "\nNotifications — where should digests + alerts go?\n" +
      "  1 = Slack   2 = Email   3 = Telegram   4 = Discord",
  );
  const picks = new Set(
    (await rl.question("Enter any of the above (comma-separated), or press Enter to skip.\n> "))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  let envChanged = false;

  if (picks.has("1")) {
    const url = (await rl.question("\nSlack Incoming Webhook URL\n> ")).trim();
    if (url) await upsertChannel("slack", { webhook_url: url });
    else console.log("  (no URL entered — skipping Slack)");
  }
  if (picks.has("4")) {
    const url = (await rl.question("\nDiscord Webhook URL\n> ")).trim();
    if (url) await upsertChannel("discord", { webhook_url: url });
    else console.log("  (no URL entered — skipping Discord)");
  }
  if (picks.has("3")) {
    const token = (await rl.question("\nTelegram bot token (from @BotFather)\n> ")).trim();
    const chatId = (await rl.question("Telegram chat_id (e.g. message @userinfobot)\n> ")).trim();
    if (token) {
      env.TELEGRAM_BOT_TOKEN = token;
      envChanged = true;
    }
    if (chatId) await upsertChannel("telegram", { chat_id: chatId });
    else console.log("  (no chat_id entered — skipping Telegram)");
  }
  if (picks.has("2")) {
    const recipients = (await rl.question("\nEmail recipients (comma-separated)\n> "))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const from =
      (await rl.question(`From address${env.RESEND_FROM ? ` (current: ${env.RESEND_FROM})` : ""}\n> `)).trim() ||
      env.RESEND_FROM ||
      "";
    if (!env.RESEND_API_KEY) {
      const key = (await rl.question("Resend API key (re_…)\n> ")).trim();
      if (key) {
        env.RESEND_API_KEY = key;
        envChanged = true;
      }
    }
    if (from && from !== env.RESEND_FROM) {
      env.RESEND_FROM = from;
      envChanged = true;
    }
    if (recipients.length) await upsertChannel("email", { recipients, from });
    else console.log("  (no recipients entered — skipping Email)");
  }

  if (envChanged) {
    writeEnv(env);
    console.log(`  ✓ Updated ${ENV_PATH} with notification secrets`);
  }

  rl.close();

  console.log(
    "\nSetup complete. Next:\n" +
      "  1. npm run onboard           # interview → your org profile (needs ANTHROPIC_API_KEY)\n" +
      "  2. npm run discover:manual   # first discovery run — spends a few dollars of API credit\n" +
      "  3. Add GitHub repo secrets SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY\n" +
      "     so weekly discovery runs automatically (.github/workflows/discovery.yml).\n" +
      "  4. Dashboard (login, pipeline board, ratings) lands in Phase 1 — see SETUP.md.\n",
  );
}

main().catch((e) => {
  console.error("\nSetup failed:", (e as Error).message);
  process.exit(1);
});
