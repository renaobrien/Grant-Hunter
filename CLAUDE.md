# CLAUDE.md - Grant Hunter

## What this project IS

The **white-label, self-hosted grant discovery + application platform** - one
org per instance. Next.js 16 (App Router) / React 19, Supabase (Postgres + RLS
+ auth), Anthropic SDK. This is the project with the **web UI**: the pipeline
board (`app/page.tsx`), grant detail (`app/grants/[id]/page.tsx`), runs, profile,
settings. Adversarial agents live in `engine/` (Finder → Skeptic → Judge for
discovery; Drafter ⇄ Critic for drafts).

## White-label guardrail (non-negotiable)

This platform is **org-agnostic**. Never hardcode, brand, or reference any
specific organization (EOS, SWB, or otherwise) in product code, copy, or design.
All org identity comes from the `profile` row at runtime - org name, logo, and
brand colors (`--brand-primary` / `--brand-accent` / `--brand-bg`) are seeded
onto a wrapper in `app/layout.tsx`. Design and copy must stay neutral so any
org can drop in their profile and have it be theirs.

## Sibling project - do not confuse them

`../eos-grants` is a **separate, org-specific Slack bot** with **no web UI**. It
is a different git repo. Slack-message / digest / droplet work belongs there.
"The UI", "the dashboard", "the board", any React/CSS/page work belongs **here**.

## The UI / design system

- `app/globals.css` - the entire design system, one file, no Tailwind. CSS
  custom properties for brand + neutrals + status tones, 8px spacing scale.
- `components/ui.tsx` - server-safe primitives: `Card`, `Chip`, `StatusChip`,
  `ScorePips`, `EmptyState`, `FieldRow`. Styled purely via `className` hooks.
- `components/HealthHeader.tsx` - health strip (last run / spend vs budget /
  grants tracked) under the nav.
- `lib/types.ts` - row types mirroring the Supabase schema + `STATUS_COLUMNS`
  board layout + enum source-of-truth arrays.
- `docs/dashboard-preview.html` - committed static design reference.

Verify UI changes with `npm run build` (and `npm run dev`) from this repo.

## First-run + in-app operations (browser-first, added 2026-07-09)

The product is browser-first; the CLI is an alternative, not a prerequisite.

- `app/connect/` - first-run wizard. Middleware redirects EVERYTHING here when
  Supabase env is missing (see the env check at the top of `middleware.ts`;
  `connect` is matcher-excluded). Verifies submitted creds, writes `.env.local`
  via `lib/env-file.ts`, and serves the combined `supabase/migrations/*.sql`
  for a paste-into-SQL-editor schema step. Never renders on configured or
  REQUIRE_LOGIN instances; on Vercel with env missing it shows host-env
  instructions instead of a form.
- `lib/env-file.ts` - shared `.env.local` IO + `deriveProjectUrl()` (bare ref /
  URL / dashboard URL). Used by `scripts/setup.ts` (relative import) and the
  /connect action. Node-only.
- `app/runs/actions.ts` `startDiscovery()` - spawns
  `npx tsx engine/run-discovery.ts --manual` detached; guarded on Vercel, on a
  missing Anthropic key, while a run is already `running`, and when the daily
  budget lacks headroom for a worst-case finder call (returns a plain-language
  message instead of spawning a doomed run).
  `components/RunDiscoveryButton.tsx` mounts on the board (searched column
  empty state) and the Runs page.
- Settings: Anthropic key + channel secrets (webhook URLs, Telegram bot token,
  Resend key) are WRITE-ONLY - the client only ever receives presence booleans
  (`ChannelView` in `app/settings/page.tsx`). `upsertChannel` merges: blank
  secret = keep stored. `engine/notify.ts` reads channel secrets config-first,
  env fallback. Settings -> Updates card (`UpdatePanel.tsx`) runs
  `git pull --ff-only` via `checkForUpdates`/`applyUpdate` (local git checkouts
  only).
- Header brand is `{org_name} Grant Hunter` once a profile exists
  (`app/layout.tsx`).

## Cost control (reworked 2026-07-10 - read before touching engine spend paths)

Three ceilings: per-run (`settings.run_budget_usd`, default $2, gates NEW
rounds only - a started round always finishes so its spend becomes judged
results), per-day (`settings.daily_budget_usd` - worst-case pre-flight via
`worstCaseCents()` in `engine/anthropic.ts` before each Finder/Skeptic call),
and the monthly key limit users set in the Anthropic console. The `agent_runs`
ledger must OVER-count on failure, never skip: a call that dies without usage
data is billed a worst-case floor (`finishRun` `floorCents` in `engine/db.ts`),
because null-cost errors are how $16.50 once slipped past a $5 cap. Calls are
bounded (maxRetries 1, 6-min timeout, 2 continuations, small search budgets,
AbortSignal run deadline). The Finder self-scores fit and `discovery.ts` culls
below-floor candidates in code before the Opus Skeptic sees them. Per-agent
models/costs table: `docs/AGENTS.md` + `lib/agent-info.ts` (keep both in sync).
Roadmap: `docs/ROADMAP.md`.
