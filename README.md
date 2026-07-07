# grants-platform

**A white-label, self-hosted grant discovery + application assistant.** Clone it, run one setup command, fill in your org profile, and you get:

- A **dashboard** pipeline (Searched / Active / Pending / Applied / Closed).
- **Adversarial agents** that discover grants (Finder → Skeptic → Judge) and draft applications (Drafter ⇄ Critic) — agents that argue *against* each other so weak matches get killed before they reach you.
- A **teaching loop** — rate suggestions by number *and* freeform text; future runs learn from it.
- **Email + Telegram** digests, deadline reminders, and draft-ready alerts.
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

> This repo began as a single-org bot (Speech Without Borders). That original code is
> preserved on the [`legacy-swb-bot`](https://github.com/renaobrien/grants-platform/tree/legacy-swb-bot)
> branch; `main` is the white-label rewrite.

## Stack

- **Next.js** (App Router) + **Supabase** (Postgres + Auth) — Supabase is just your database and login; no Deno / Edge Functions to manage.
- The **agent engine is plain Node/TypeScript** (`engine/`, run via `tsx`), driven by a **GitHub Actions cron** — the zero-hosting pattern: discovery runs in GitHub on a schedule, no server to keep alive. An optional long-lived Node worker can run the on-demand drafting loop with lower latency.
- **Claude** (latest models) with web search. Email via **Resend**; **Telegram** via bot webhook (handled by a Next.js API route).

## Layout

```
engine/                  the agent engine (Node/TS)
  types.ts               shared types
  render-profile.ts      profile row -> system prompt (the white-label core) + agent role blocks
  anthropic.ts           Claude wrapper + cost estimation + JSON salvage
  preference-context.ts  the teaching loop (numeric + freeform -> prompt context)
  db.ts                  service-role Supabase access, budget cap, run logging, grant upsert
  agents/                finder.ts, skeptic.ts, judge.ts (the adversarial ensemble)
  discovery.ts           orchestrator: N rounds of Finder -> Skeptic -> Judge
  run-discovery.ts       entrypoint (GitHub Action / worker)
.github/workflows/
  discovery.yml          weekly cron that runs the engine (no server needed)
supabase/
  migrations/            SQL schema + RLS (single-org; applied by `setup`)
app/                     Next.js dashboard + API routes (Phase 1)
scripts/                 setup + onboarding scripts
examples/                sample org profiles (reference only — not applied)
```

## Auth & data model

Single organization per instance, so there's no multi-tenant machinery. The dashboard is gated by a small **members allowlist** (emails you authorize). Signed-in members read/write via RLS; anonymous visitors get nothing. Agents use the service-role key. Your org's identity lives in one `profile` row (filled during onboarding), which is rendered into every agent's prompt — that's what makes it white-label.

## Safety

A per-instance **daily budget cap** (`settings.daily_budget_usd`) is checked at the start of every agent run and skips + logs if exceeded. No auto-approve loops; every run is recorded in `agent_runs` with tokens + cost. Since you use your own API key, a runaway only ever touches your own bill — and the cap protects you anyway.

## Status

Phase 0 (engine, schema, setup/onboarding) complete and typechecked. Phase 1 (dashboard:
login, pipeline board, ratings, profile editor) is next; then notifications + the
Drafter ⇄ Critic loop. Nothing is deployed by this repo — you provision your own instance.
