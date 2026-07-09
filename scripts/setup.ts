// setup.ts - guided self-host setup.
// Collects your keys, writes .env.local, verifies the database, and makes you the
// owner. Then points you at `npm run onboard` and deploy. Safe to re-run.
//
//   npm run setup

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
// Relative import on purpose: tsx path-alias support is version-dependent.
import { ENV_PATH, readEnv, writeEnv, deriveProjectUrl } from "../lib/env-file";

async function main() {
  const env = readEnv();
  const rl = createInterface({ input, output });
  const ask = async (key: string, label: string, required = true) => {
    const cur = env[key];
    const shown = cur ? ` (current: ${cur.slice(0, 8)}…)` : "";
    let v = (await rl.question(`${label}${shown}\n> `)).trim();
    if (!v && cur) v = cur;
    if (required && !v) {
      console.log("  (required - try again)");
      return ask(key, label, required);
    }
    if (v) env[key] = v;
  };

  console.log("\nGrant Hunter setup\n");
  {
    // If `supabase link` already ran (step 2), reuse that project ref instead of
    // making you type it a second time.
    let linkedRef = "";
    try {
      linkedRef = readFileSync("supabase/.temp/project-ref", "utf8").trim();
    } catch {
      // not linked yet; we'll ask below
    }

    let url: string | undefined;
    if (/^[a-z0-9]{20}$/.test(linkedRef)) {
      url = `https://${linkedRef}.supabase.co`;
      console.log(`Supabase project: ${url}  (from your 'supabase link')`);
    } else {
      const cur = env.NEXT_PUBLIC_SUPABASE_URL;
      const shown = cur ? ` (current: ${cur})` : "";
      while (!url) {
        const raw =
          (
            await rl.question(
              `Supabase project ref, the 20-char ID from 'supabase link' (a full URL works too)${shown}\n> `,
            )
          ).trim() ||
          cur ||
          "";
        const r = deriveProjectUrl(raw);
        if (!r.url) {
          console.log(`  x ${r.error ?? "Try again."}`);
          continue;
        }
        url = r.url;
        console.log(`  Using ${url}`);
      }
    }
    env.NEXT_PUBLIC_SUPABASE_URL = url;
    env.SUPABASE_URL = url;
  }
  await ask("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon/public key");
  await ask("SUPABASE_SERVICE_ROLE_KEY", "Supabase service_role key (secret)");
  // Optional here - you can add it later in the dashboard (Settings → API keys).
  console.log(
    "\nAnthropic API key - the agents' AI. Optional now; you can add it in the\n" +
      "dashboard later (Settings → API keys). Press Enter to skip.",
  );
  await ask("ANTHROPIC_API_KEY", "Anthropic API key (sk-ant-…, or Enter to skip)", false);
  let owner = "";
  while (!owner.includes("@")) {
    owner = (await rl.question("\nYour email (the owner - used to tag your ratings, and to log in if you ever turn login on)\n> ")).trim().toLowerCase();
    if (!owner.includes("@")) console.log("  (a valid email is required)");
  }
  env.APP_BASE_URL = env.APP_BASE_URL || "http://localhost:3000";
  env.DAILY_BUDGET_USD = env.DAILY_BUDGET_USD || "5";
  // No login flag to set: login is OFF by default for local self-host. Public
  // hosts turn it on with REQUIRE_LOGIN=true (see DEPLOY.md).

  writeEnv(env);
  console.log(`\n✓ Wrote ${ENV_PATH}`);

  // Verify DB + schema
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { error: schemaErr } = await sb.from("profile").select("id").limit(1);
  if (schemaErr) {
    // We know the ref (it's the subdomain of the URL we just saved), so print
    // the exact commands to run - no <placeholders> to fill in.
    const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
    console.log(
      `\n⚠ The database schema isn't applied yet (couldn't read the 'profile' table).\n` +
        "  Your keys ARE saved - just apply the schema, then re-run setup (it'll\n" +
        "  remember everything; press Enter through the prompts):\n\n" +
        `      npx supabase link --project-ref ${ref}\n` +
        "      npm run db:push\n" +
        "      npm run setup\n",
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
    "\nNotifications - where should digests + alerts go?\n" +
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
    else console.log("  (no URL entered - skipping Slack)");
  }
  if (picks.has("4")) {
    const url = (await rl.question("\nDiscord Webhook URL\n> ")).trim();
    if (url) await upsertChannel("discord", { webhook_url: url });
    else console.log("  (no URL entered - skipping Discord)");
  }
  if (picks.has("3")) {
    const token = (await rl.question("\nTelegram bot token (from @BotFather)\n> ")).trim();
    const chatId = (await rl.question("Telegram chat_id (e.g. message @userinfobot)\n> ")).trim();
    if (token) {
      env.TELEGRAM_BOT_TOKEN = token;
      envChanged = true;
    }
    if (chatId) await upsertChannel("telegram", { chat_id: chatId });
    else console.log("  (no chat_id entered - skipping Telegram)");
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
    else console.log("  (no recipients entered - skipping Email)");
  }

  if (envChanged) {
    writeEnv(env);
    console.log(`  ✓ Updated ${ENV_PATH} with notification secrets`);
  }

  rl.close();

  const hasAnthropic = Boolean((env.ANTHROPIC_API_KEY ?? "").trim());
  console.log(
    "\nSetup complete. Next:\n" +
      "  1. npm run dev               # opens the app at http://localhost:3000 - no login needed\n" +
      (hasAnthropic
        ? ""
        : "     ↳ In the app: Settings → API keys → paste your Anthropic key (sk-ant-…).\n") +
      "  2. Finish onboarding in the browser (it builds your org profile), or run\n" +
      "     npm run onboard from the CLI.\n" +
      "  3. npm run discover:manual   # first discovery run - spends a few dollars of API credit\n" +
      "  4. To run discovery automatically each week, add GitHub repo secrets\n" +
      "     SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and ANTHROPIC_API_KEY if you\n" +
      "     didn't set it in the dashboard) - see .github/workflows/discovery.yml.\n" +
      "\nHosting this online instead of your laptop? See DEPLOY.md.\n",
  );
}

main().catch((e) => {
  console.error("\nSetup failed:", (e as Error).message);
  process.exit(1);
});
