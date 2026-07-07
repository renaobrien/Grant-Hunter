# grants-platform

**A white-label, self-hosted grant discovery + application assistant.** Clone it, run one setup command, fill in your org profile, and you get:

- A **dashboard** pipeline board (Searched / Active / Pending / Closed) with the full agent debate transcript on every grant.
- **Adversarial agents** that discover grants (Finder → Skeptic → Judge) and draft applications (Drafter ⇄ Critic) — agents that argue *against* each other so weak matches get killed before they reach you.
- A **teaching loop** — rate suggestions by number *and* freeform text; future runs learn from it.
- Digests, deadline reminders, and draft-ready alerts to the **channel of your choice** — Slack, Discord, Telegram, or email (pick any, or several).
- An **org profile** (mission, capabilities, ethos, eligibility) that drives everything. Nothing about any organization is hardcoded — you fill it in during onboarding.

This is the open-source, productized successor to a single-org grant bot. It reuses a grant-research engine already proven in production and strips out everything org-specific so **any** org can run their own instance.

## How you run it

**One org per instance — you own it end to end.** Each user clones this repo and stands up their own copy: their own Supabase project, their own Anthropic / email / Telegram keys, their own deploy. There is no shared server and no vendor holding your data.

Use this repo as a template (GitHub → **Use this template**) or fork it, then:

```bash
git clone https://github.com/renaobrien/grants-platform && cd grants-platform
npm install
npx supabase link --project-ref <your-ref> && npm run db:push   # create the schema
npm run setup     # your keys + owner allowlist + notification channel → .env.local
npm run onboard   # AI interview → your org profile (the agents' "voice")
```

Then add three GitHub repo secrets and weekly discovery runs on its own — no server.
See **[SETUP.md](./SETUP.md)** for the full walkthrough (~15 minutes), including deploying
the dashboard to Vercel.

## What it costs to run

You bring your own accounts and pay your own usage — there's no vendor in the middle. For a
typical low-volume org (one weekly discovery run), realistic monthly cost is **≈ $0–15 plus
your Anthropic usage**:

| Service | What it's for | Cost |
|---|---|---|
| **Anthropic API** | The agents' Claude calls (the actual work) — Opus for the adversaries/drafter, Sonnet for search, plus web search | Pay-as-you-go. A weekly discovery run is typically **a few dollars/month**. A hard **daily budget cap** (`settings.daily_budget_usd`, default $5) stops runs before they overspend. |
| **Supabase** | Postgres database + magic-link auth | **Free tier** covers this comfortably (2 free projects per org). A dedicated **paid project is ~$10/mo** if you're past the free tier or want it isolated. |
| **Vercel** | Hosts the dashboard | **Free** (Hobby tier). |
| **GitHub Actions** | Runs weekly discovery + the 30-min jobs worker — no server to keep alive | **Free** tier minutes cover it easily. |
| **Resend** (optional, email) | Email digests | **Free** tier = 100 emails/day. |
| **Slack / Discord / Telegram** (optional) | Digests + alerts | **Free** (just a webhook or bot token). |

Every agent call is logged to `agent_runs` with tokens, web-search count, and estimated cost,
so you can see exactly what you're spending on the dashboard's Runs page.

## Stack

- **Next.js** (App Router) + **Supabase** (Postgres + Auth) — Supabase is just your database and login; no Deno / Edge Functions to manage.
- The **agent engine is plain Node/TypeScript** (`engine/`, run via `tsx`), driven by a **GitHub Actions cron** — the zero-hosting pattern: discovery runs in GitHub on a schedule, no server to keep alive. An optional long-lived Node worker can run the on-demand drafting loop with lower latency.
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
