# CLAUDE.md — grants-platform

## What this project IS

The **white-label, self-hosted grant discovery + application platform** — one
org per instance. Next.js 16 (App Router) / React 19, Supabase (Postgres + RLS
+ auth), Anthropic SDK. This is the project with the **web UI**: the pipeline
board (`app/page.tsx`), grant detail (`app/grants/[id]/page.tsx`), runs, profile,
settings. Adversarial agents live in `engine/` (Finder → Skeptic → Judge for
discovery; Drafter ⇄ Critic for drafts).

## White-label guardrail (non-negotiable)

This platform is **org-agnostic**. Never hardcode, brand, or reference any
specific organization (EOS, SWB, or otherwise) in product code, copy, or design.
All org identity comes from the `profile` row at runtime — org name, logo, and
brand colors (`--brand-primary` / `--brand-accent` / `--brand-bg`) are seeded
onto a wrapper in `app/layout.tsx`. Design and copy must stay neutral so any
org can drop in their profile and have it be theirs.

## Sibling project — do not confuse them

`../eos-grants` is a **separate, org-specific Slack bot** with **no web UI**. It
is a different git repo. Slack-message / digest / droplet work belongs there.
"The UI", "the dashboard", "the board", any React/CSS/page work belongs **here**.

## The UI / design system

- `app/globals.css` — the entire design system, one file, no Tailwind. CSS
  custom properties for brand + neutrals + status tones, 8px spacing scale.
- `components/ui.tsx` — server-safe primitives: `Card`, `Chip`, `StatusChip`,
  `ScorePips`, `EmptyState`, `FieldRow`. Styled purely via `className` hooks.
- `components/HealthHeader.tsx` — health strip (last run / spend vs budget /
  grants tracked) under the nav.
- `lib/types.ts` — row types mirroring the Supabase schema + `STATUS_COLUMNS`
  board layout + enum source-of-truth arrays.
- `docs/dashboard-preview.html` — committed static design reference.

Verify UI changes with `npm run build` (and `npm run dev`) from this repo.
