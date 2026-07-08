# grants-platform

**A white-label, self-hosted grant discovery + application assistant.** Clone it, run one setup command, fill in your org profile, and you get:

- A **dashboard** pipeline board (Searched / Active / Pending / Closed) with the full agent debate transcript on every grant.
- **Adversarial agents** that discover grants (Finder → Skeptic → Judge) and draft applications (Drafter ⇄ Critic) — agents that argue *against* each other so weak matches get killed before they reach you.
- A **teaching loop** — rate suggestions by number *and* freeform text; future runs learn from it.
- Digests, deadline reminders, and draft-ready alerts to the **channel of your choice** — Slack, Discord, Telegram, or email (pick any, or several).
- An **org profile** (mission, capabilities, ethos, eligibility) that drives everything. Nothing about any organization is hardcoded — you fill it in during onboarding.

This is the open-source, productized successor to a single-org grant bot. It reuses a grant-research engine already proven in production and strips out everything org-specific so **any** org can run their own instance.

## How you run it

Each organization runs its own private copy — one org per instance. You clone the
repo, plug in your own accounts (Supabase for the database, an Anthropic key for the
AI, plus any notification channels you want), and run it. Nobody else hosts it and
nobody else can see your data.

You can run the whole thing from your own computer — no GitHub account needed:

Run these one line at a time (don't paste the whole block at once):

```bash
git clone https://github.com/renaobrien/grants-platform grants
cd grants
npm install
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF   # a short ID, NOT a URL — see note below
npm run db:push    # create the database tables
npm run setup      # your keys + who can log in + notifications → .env.local
npm run onboard    # a short AI interview that builds your org profile
```

**`YOUR_PROJECT_REF`** is your Supabase project's short ID (like `aussykjrxblarjllmdor`),
under **Project Settings → General → Reference ID**. Paste just the ID — not a URL.

New to this, or don't use Git? **[SETUP.md](SETUP.md)** has the full walkthrough,
including a no-Git download option.

Then use it:

```bash
npm run dev        # open the dashboard at http://localhost:3000
npm run discover   # find new grants now
npm run jobs       # process drafts + send deadline reminders
```

Once it's running, sign in with your owner email and add your **Anthropic key** in the app
under **Settings → API keys** — no config files to edit.

Want it always online instead of on your laptop — so sign-in works from your phone and
grants get found even when your computer is off? Host it in ~15 minutes on Vercel (free
tier): **[DEPLOY.md](DEPLOY.md)**. You paste the Supabase values into the host's UI, so
there's no `npm run setup` and no `.env.local` at all.

## What it costs to run

You bring your own accounts and pay your own usage — there's no vendor in the middle. For a
typical low-volume org (one weekly discovery run), realistic monthly cost is **≈ $0–15 plus
your Anthropic usage**:

| Service | What it's for | Cost |
|---|---|---|
| **Anthropic API** | The agents' Claude calls (the actual work) — Opus for the adversaries/drafter, Sonnet for search, plus web search | Pay-as-you-go. A weekly discovery run is typically **a few dollars/month**. A hard **daily budget cap** (`settings.daily_budget_usd`, default $5) stops runs before they overspend. |
| **Supabase** | Postgres database + magic-link auth | **Free tier** covers this comfortably (2 free projects per org). A dedicated **paid project is ~$10/mo** if you're past the free tier or want it isolated. |
| **Vercel** | *(optional)* hosts the dashboard so it's reachable beyond `localhost` | **Free** (Hobby tier). |
| **GitHub Actions** | *(optional)* runs discovery + the jobs worker on a schedule — no server to keep alive | **Free** tier minutes cover it easily. |
| **Resend** (optional, email) | Email digests | **Free** tier = 100 emails/day. |
| **Slack / Discord / Telegram** (optional) | Digests + alerts | **Free** (just a webhook or bot token). |

Every agent call is logged to `agent_runs` with tokens, web-search count, and estimated cost,
so you can see exactly what you're spending on the dashboard's Runs page.

## Stack

- **Next.js** (App Router) + **Supabase** (Postgres + Auth) — Supabase is just your database and login; no Deno / Edge Functions to manage.
- The **agent engine is plain Node/TypeScript** (`engine/`, run via `tsx`) — run it yourself with `npm run discover` / `npm run jobs`, or, optionally, let a **GitHub Actions cron** run it on a schedule for you (off by default; turn it on in SETUP.md). No server to keep alive either way.
- **Claude** (latest models) with web search. Notifications fan out to Slack / Discord / Telegram (bot API) / email (**Resend**) via one dispatcher.

## Layout

```
engine/                  the agent engine (Node/TS)
  types.ts               shared types
  render-profile.ts      profile row -> system prompt (the white-label core) + agent role blocks
  anthropic.ts           Claude wrapper (@anthropic-ai/sdk) + cost estimation + JSON salvage
  preference-context.ts  the teaching loop (numeric + freeform -> prompt context)
  db.ts                  service-role Supabase access, budget cap, run logging, grant upsert
  notify.ts              one dispatcher -> Slack / Discord / Telegram / email
  agents/                finder.ts, skeptic.ts, judge.ts, drafter.ts, critic.ts
  discovery.ts           orchestrator: N rounds of Finder -> Skeptic -> Judge
  draft.ts               Drafter <-> Critic narrative loop
  run-discovery.ts       entrypoint: weekly discovery + digest
  run-jobs.ts            entrypoint: drain draft jobs + sweep deadlines (every 30 min)
.github/workflows/
  discovery.yml          weekly cron (Mondays) — discovery
  jobs.yml               */30 cron — drafting jobs + deadline reminders
supabase/migrations/     SQL schema + RLS (single-org; applied by `npm run db:push`)
app/                     Next.js dashboard (board, grant detail, profile, settings, runs)
lib/ components/         dashboard supabase clients, types, shared UI
scripts/                 setup + onboarding (guided, interactive)
examples/                sample org profiles (reference only — not applied)
```

## Who can access it

This is a private tool for one organization — there's no sign-up, no other tenants.

- **People** log into the dashboard with a magic link, but only if their email is on your **members allowlist** (you choose who's on it). Everyone else — and anyone not signed in — sees nothing. That's enforced in the database itself (Row-Level Security), not just hidden in the UI.
- **The agents** (discovery, drafting, deadline sweeps) run in the background with a privileged server key, so they keep working regardless of who's logged in.

Everything the agents know about your org lives in one **profile** record you fill in during onboarding — mission, what you do, what you're eligible for, what to avoid. Every agent reads that record before it acts. Swap the profile and the exact same code runs for a completely different organization — that's what makes it white-label.

## Safety

A per-instance **daily budget cap** (`settings.daily_budget_usd`) is checked at the start of every agent run and skips + logs if exceeded. No auto-approve loops; every run is recorded in `agent_runs` with tokens + cost. Since you use your own API key, a runaway only ever touches your own bill — and the cap protects you anyway.

## Status

Feature-complete and typechecked (`tsc` clean, `next build` passes): the adversarial
discovery engine, the Drafter ⇄ Critic drafting loop, the jobs worker, channel-of-choice
notifications, and the full dashboard are all built. Nothing is deployed *by this repo* —
each user provisions their own instance (see [SETUP.md](./SETUP.md)).
