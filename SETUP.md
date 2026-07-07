# Setup — stand up your own instance (~15 min)

You'll run your own private copy: your Supabase database, your Anthropic key, your deploy. Nothing is shared with anyone else.

## Prerequisites

- **Node 20+** and **npm** (Node 22 recommended — supabase-js warns on 20)
- A **Supabase** account → create one project, note the project ref. The **free tier** is
  fine to start (2 free projects per org); a dedicated project is **~$10/mo** beyond that.
- An **Anthropic API key** (`sk-ant-…`) — this is what the agents spend; see [costs](#costs--safety) below.
- *(optional)* a channel to receive digests: a **Slack**/**Discord** webhook URL, a **Telegram**
  bot token, or a **Resend** API key for email. You can pick more than one, or skip and add later.

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
npm run db:push        # applies everything in supabase/migrations/
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

Weekly digests + alerts (new grant, deadline, draft ready) go to whichever channels you turn
on. `npm run setup` prompts you for these — you can pick **more than one**, and re-running
setup updates them in place. Grab the credential you want *before* running setup so you can
paste it when asked. Full step-by-step for each:

### Slack (webhook — 2 min)
1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**; name it, pick your workspace.
2. In the app, open **Incoming Webhooks** → toggle **Activate Incoming Webhooks** on.
3. Click **Add New Webhook to Workspace**, choose the channel, **Allow**.
4. Copy the webhook URL (`https://hooks.slack.com/services/…`) and paste it when setup asks. No env var needed.

### Discord (webhook — 1 min)
1. In your server, open **Server Settings → Integrations → Webhooks → New Webhook**.
2. Pick the channel, click **Copy Webhook URL**.
3. Paste it when setup asks. No env var needed.

### Telegram (bot — 3 min)
1. In Telegram, message [@BotFather](https://t.me/BotFather) → `/newbot`, follow the prompts. It gives you a **bot token** (`123456:ABC…`).
2. Send your new bot any message (so it can reply to you), then message [@userinfobot](https://t.me/userinfobot) to get your numeric **chat_id**.
3. Enter the token and chat_id when setup asks. The token is saved to `.env.local` as `TELEGRAM_BOT_TOKEN`.

### Email (Resend — 3 min)
1. Sign up at [resend.com](https://resend.com) (free tier = 100 emails/day).
2. **Domains** → add and verify a sending domain (or use their test/onboarding sender to start).
3. **API Keys** → **Create API Key**, copy it (`re_…`).
4. Enter the API key, a verified **From** address, and your recipient list when setup asks. The key is saved to `.env.local` as `RESEND_API_KEY`.

Prefer to skip for now? Press Enter at the channel prompt — you can re-run `npm run setup`
any time to add or change channels. (You can also toggle channels later on the dashboard's
**Settings** page.)

## 4. Onboard your org

```bash
npm run onboard
```

Answer ~6 questions about your org (mission, entity/stage, what to fund, what to avoid,
example grants). Claude compiles them into your **profile** — the "voice" every agent uses.
It prints a preview of the exact prompt the agents will read. Re-run anytime, or edit it
later in the dashboard.

**The "what to avoid" answer matters as much as "what to fund."** Whatever you list here
becomes the agents' do-not-surface list (stored as `anti_patterns` + `eligibility_constraints`
in your profile), so be concrete. Examples of what to rule out:

- **Framings** you're not: e.g. "consumer app", "surveillance tech", "for-profit data broker".
- **Grant types** that waste your time: e.g. "requires a university PI", "corporate-only /
  no nonprofit track", "invite-only", "requires exclusive/proprietary IP".
- **Geographies** you can't serve, and **sizes** below your minimum (e.g. "nothing under $10k").
- **Any funder or theme** that keeps showing up wrongly — name it so the Skeptic kills it early.

The more specific your avoid-list, the less noise every future run produces. You can keep
refining it by rating grants 1–2 with a reason in the dashboard — that feeds back into the
same list automatically.

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
3. In Supabase → **Auth → URL Configuration**, set **Site URL** to your Vercel URL so
   magic links point back to your deployment.
4. Deploy, then log in with your owner email (magic link).

## Costs & safety

Full breakdown is in the [README cost table](./README.md#what-it-costs-to-run). In short:
Supabase (free tier, or ~$10/mo dedicated), Vercel + GitHub Actions (free), optional
Resend/Slack/Discord/Telegram (free) — plus your **Anthropic usage**, typically a few
dollars/month for a weekly run.

You pay only your own Anthropic bill. A hard **daily budget cap** (`settings.daily_budget_usd`,
default $5) is checked at the start of every discovery run and again before each round — if
it's spent, the run stops and logs why, so a misconfiguration can't drain your account. Every
agent call is recorded in `agent_runs` with tokens, web searches, and estimated cost (rounded
up), visible on the dashboard's Runs page. Tip: for your very first run, set
`daily_budget_usd = 2` and `discovery_rounds = 1` in the `settings` table.

## Local run of the engine

```bash
# export the three engine vars into your shell, then:
npm run discover           # or: npm run discover:manual
```
