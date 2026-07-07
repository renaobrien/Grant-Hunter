# Setup — stand up your own instance (~15 min)

You'll run your own private copy: your Supabase database, your Anthropic key, your deploy. Nothing is shared with anyone else.

## Prerequisites

- **Node 20+** and **npm**
- A free **Supabase** account → create one project (note the project ref)
- An **Anthropic API key** (`sk-ant-…`)
- *(optional)* a **Resend** API key for email, and a **Telegram bot token** for Telegram

## 1. Clone + install

```bash
git clone <your fork of this repo> grants
cd grants
npm install
```

## 2. Create the database

Link the repo to your Supabase project and push the schema:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push        # applies supabase/migrations/0001_init.sql
```

> No Edge Functions to deploy — Supabase is just Postgres + Auth here.

## 3. Run setup

```bash
npm run setup
```

It asks for your Supabase URL + keys, your Anthropic key, and your email (you become the
**owner**). It writes `.env.local`, verifies the database, and adds you to the `members`
allowlist. Safe to re-run.

## Notifications — pick your channel(s)

Weekly digests + alerts (new grant, deadline, draft ready) fan out to whichever channels
you turn on. `npm run setup` walks you through this — you can pick **more than one**, and
re-running setup updates them in place.

- **Slack** — create an [Incoming Webhook](https://api.slack.com/messaging/webhooks) for a
  channel, then paste the webhook URL during setup. No env var needed.
- **Discord** — **Server Settings → Integrations → Webhooks → New Webhook**, copy the URL,
  and paste it during setup. No env var needed.
- **Telegram** — create a bot via [@BotFather](https://t.me/BotFather) (gives you a token),
  get your `chat_id` (message [@userinfobot](https://t.me/userinfobot)), then enter both
  during setup. The token is saved to `.env.local` as `TELEGRAM_BOT_TOKEN`.
- **Email** — add a [Resend](https://resend.com) API key and a verified **From** address,
  plus the recipient list. The key is saved to `.env.local` as `RESEND_API_KEY`.

Prefer to skip it for now? Just press Enter at the channel prompt — you can re-run
`npm run setup` any time to add channels later.

## 4. Onboard your org

```bash
npm run onboard
```

Answer ~6 questions about your org (mission, entity/stage, what to fund, what to avoid,
example grants). Claude compiles them into your **profile** — the "voice" every agent uses.
It prints a preview of the exact prompt the agents will read. Re-run anytime, or edit it
later in the dashboard.

## 5. Turn on weekly discovery (no server needed)

Discovery runs as a **GitHub Action** (`.github/workflows/discovery.yml`) every Monday.
In your repo → **Settings → Secrets and variables → Actions**, add:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

You can also trigger it by hand from the **Actions** tab (or locally: `npm run discover:manual`).

> Heads-up: GitHub disables scheduled workflows after 60 days of no repo activity — a
> commit re-enables them. This is also a healthy "are you still using it?" signal.

## 6. Deploy the dashboard

The dashboard is a standard Next.js app — deploy to **Vercel** (or Netlify / your own host):

1. Import the repo in Vercel.
2. Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (+ `RESEND_*` / `TELEGRAM_*` if used).
3. Deploy, then log in with your owner email (magic link).

*(The dashboard, notifications, and the on-demand drafting loop land in Phase 1 — the
engine and setup above are Phase 0.)*

## Costs & safety

You pay only your own Anthropic usage (a weekly run is typically a few dollars/month).
A hard **daily budget cap** (`settings.daily_budget_usd`, default $5) is checked at the
start of every discovery run and again before each round — if it's spent, the run stops
and logs why, so a misconfiguration can't drain your account. Every agent call is
recorded in `agent_runs` with tokens, web searches, and estimated cost (rounded up).

## Local run of the engine

```bash
# export the three engine vars into your shell, then:
npm run discover           # or: npm run discover:manual
```
