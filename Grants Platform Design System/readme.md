# Grants Platform — Design System

A faithful, reusable capture of the design system behind **grants-platform**: a
white-label, self-hosted grant discovery + application assistant. This project
turns the product's one hand-written stylesheet and its server-safe UI primitives
into design tokens, foundation specimens, reusable components, and an interactive
UI kit — so designers and agents can build new grants-platform surfaces on-brand
without re-deriving the system.

## What the product is

grants-platform is an **internal operator tool**, not a marketing site: an org
clones the repo, stands up their own instance (Supabase + their own API keys),
fills in an org **profile**, and gets a pipeline dashboard driven by adversarial
AI agents (Finder → Skeptic → Judge for discovery; Drafter ⇄ Critic for
application drafts). The UI's job is to be **scannable and low-noise** — dense,
credible, calm.

- **Surfaces:** Pipeline board (`/`), Grant detail (`/grants/[id]`), Runs
  (`/runs`), Profile (`/profile`), Settings (`/settings`), plus login /
  no-access chrome.
- **Stack:** Next.js (App Router) + React, mostly Server Components; Supabase
  data at render time. Interactivity is isolated to small `"use client"`
  islands (e.g. the board's inline status `<select>`).

### White-label is a hard constraint
Nothing about any organization is baked in. Org name, logo, and **three brand
colors** (`--brand-primary`, `--brand-accent`, `--brand-bg`) come from the
profile row at runtime and are injected as inline CSS vars on a wrapper. The
`:root` values in this system are the *fallback before onboarding*. **Every
component, card, and screen here must look right when those three vars are
swapped to any values.** Do not hardcode an org, and do not treat the fallback
blue/green/paper as "the brand."

## Sources

- **Repo:** `github.com/renaobrien/grants-platform` (private; read via GitHub at
  commit `e65f7930`). The entire design system is one file: `app/globals.css`.
  Server-safe primitives live in `components/ui.tsx`. Design reference render at
  `docs/dashboard-preview.html`.
- Board IA (status → column) is defined in `lib/types.ts` (`STATUS_COLUMNS`).
- A sibling repo, **eos-grants** (a Slack bot with no web UI), is a *different*
  project — not the source for this system.

Assume the reader may not have repo access; everything needed is reproduced in
the token files and `app.css` here.

---

## CONTENT FUNDAMENTALS

How copy is written across the product.

- **Voice:** plain, operational, direct. Short declaratives. It explains *what a
  thing is and what to do*, not marketing benefits. e.g. "Discovery runs
  automatically on a weekly schedule." / "Grants land here as they move through
  the pipeline."
- **Person:** addresses the operator as **you** ("Enter your email and we'll send
  you a magic link", "The white-label voice your agents speak in"). First-person
  plural only for the system's own actions ("We sent a magic sign-in link…").
- **Casing:** **Sentence case everywhere** — headings, buttons, labels. Page
  titles are single words or short noun phrases: "Pipeline", "Runs", "Settings",
  "Organization profile". No Title Case, no ALL-CAPS prose. (Small uppercase is a
  *visual* eyebrow treatment — see labels below — not a copy convention.)
- **Labels are terse nouns:** "Fit", "Align", "Confidence", "Framing angle",
  "Recommendation", "Blockers". Field hints are one short sentence: "Hard cap on
  agent spend per day."
- **Status & recommendation vocabulary is fixed** (never invent new ones):
  - Statuses: Found, Researching, Drafting, Applied, Submitted, Awarded, Passed,
    Discarded, Dead.
  - Recommendations: Pursue / Maybe / Pass. Confidence: low / medium / high.
  - Skeptic verdicts: survives / refuted. Judge: survives / cut. Critic:
    approved / revise.
- **Empty states teach the next action**, they don't apologize: title + one-line
  hint, sometimes an action. "Nothing here yet" → "Run discovery to fill this
  board (GitHub → Actions → …)."
- **Numbers are honest and specific:** real dollar amounts, token counts,
  durations, `$1.20 / $5.00` spend-vs-budget. Tabular-nums for anything
  numeric. Em-dash (`—`) is the universal placeholder for "no value".
- **Emoji:** essentially none. The one exception in the source is a `✓` in
  "Saved ✓" micro-confirmations. Don't add decorative emoji.
- **Tone check:** if a line reads like a landing page, rewrite it. This is a tool
  for someone who runs it every week.

---

## VISUAL FOUNDATIONS

- **Character:** warm-paper neutral, calm, credible, low-chrome. The background
  is a warm off-white (`--brand-bg` #f7f5f0), surfaces are pure white with a
  warm-gray secondary (`--surface-2` #faf9f5). Lines are warm, not cool
  (`--line` #e4e2db). The palette reads like paper and ink, not a SaaS dashboard.
- **Color use:** neutrals carry the UI; color is reserved for *meaning*. Brand
  primary is used for links, primary buttons, focus rings, filled score pips, and
  the brand dot. The accent appears as the ethos-card left border. Everything
  else is a **status tone** (info / good / warn / bad / muted), each a
  fg+bg pair, surfaced almost exclusively through chips. No gradients anywhere.
- **Type:** **Space Grotesk** carries display + body (headings 700, -0.02em
  tracking; body 15px / 1.5); **JetBrains Mono** carries all labels, column
  titles, chips, table headers, amounts, code, cron strings, and debate JSON.
  Both load from Google Fonts. Eyebrow/column/label text is uppercase, tracked,
  `--ink-faint`. The mono-labelled, sans-headline pairing is what gives the
  system its confident, toolsy character.
- **Spacing:** strict **8px scale** (`--s1`..`--s6` = 4/8/16/24/32/48) — `--s1`
  is the only sub-8 step. Content maxes at 1200px, centered, with a 56px nav.
- **Corners:** `--radius` 10px for cards, table wraps, board columns;
  `--radius-sm` 6px for grant cards, buttons, inputs, control chips; chips are
  full pills (999px). Score pips are 2px.
- **Borders:** hairline 1px `--line` (or softer `--line-soft` #efeee9 for inner
  dividers) on nearly everything. Borders do the structural work that shadows do
  elsewhere — this is a bordered system first, shadowed second.
- **Elevation — "sticker" hard shadows.** Cards, grant cards, the table wrap and
  buttons sit on a **2px `--ink` border + hard offset shadow** (`3px 3px 0`).
  Interactive surfaces translate toward the light and deepen the shadow to the
  brand color on hover; buttons press *into* the page on `:active`. The two soft
  `--shadow` / `--shadow-lift` tokens remain for subtle surfaces (base `Card`
  keeps the soft shadow under its ink border).
- **Backgrounds:** flat color only. No images, patterns, textures, or gradients.
  Depth comes from the surface ramp (bg → surface-2 → surface) plus borders.
- **Animation:** functional, snappy, springy-but-brief. Grant cards, buttons and
  the table translate 1px toward the light on hover (0.1s) and shift their hard
  shadow to the brand color; buttons press in on `:active`. No entrances,
  bounces, or decorative motion.
- **Hover states:** grant card lifts 1px and deepens its shadow; secondary
  buttons fill with `--surface-2`; primary buttons darken via
  `color-mix(… 88%, black)`; nav links and links shift to brand primary; table
  rows tint `--surface-2`. Links underline on hover.
- **Press/active & selected:** the rating scale reuses `.btn-primary` to show the
  selected number — selection = brand fill. No shrink/scale on press.
- **Focus:** a real, visible 2px `--brand-primary` outline (offset 2px) on
  `:focus-visible`; inputs additionally get a 30%-opacity brand outline. Never
  remove focus rings.
- **Cards:** white, **2px `--ink` border**, 10px radius, soft `--shadow` (grant
  cards add the `3px 3px 0` hard offset shadow), `--s3` padding. The ethos/
  trust-anchor card adds an 8px `--brand-accent` **left border** (`.card-ethos`)
  — the one intentional accent-border case; don't spread it to other cards.
- **Density:** comfortable-but-tight. `--s2`/`--s3` gaps dominate; board cards
  are `--s2 --s3` padding. Tabular figures and `nowrap` keep tables scannable.
- **Imagery:** there is essentially none — the only image is the org's own
  uploaded logo in the nav (falls back to a 12px rounded brand-color dot). This
  is a text-and-data product.

---

## ICONOGRAPHY

grants-platform is **almost entirely icon-free** — a deliberate low-chrome
choice. The system communicates with type, color tones, chips, and score pips
rather than icons.

- **No icon library, icon font, or SVG icon set** is used anywhere in the repo.
  Do not introduce one; matching the product means restraint.
- **Score pips** are the one custom "glyph": tiny 8×8px rounded squares
  (`ScorePips`) standing in for a 1–5 score. Prefer these over star/number
  glyphs.
- **The brand dot** — a 12px rounded square in `--brand-primary` — is the logo
  fallback when an org hasn't uploaded a mark. It is *not* a general-purpose icon.
- **Unicode is used sparingly and purposefully:** `—` (em-dash) as the empty-value
  placeholder, `·` as a health-bar separator, `←` in the "← Board" back button,
  `✓` in "Saved ✓". `→` appears in prose (Finder → Skeptic → Judge). Use these,
  not icon equivalents.
- **No logo ships in the repo** (it's per-org, uploaded at runtime). This system
  therefore renders the brand name in plain type next to the fallback dot, and
  ships **no logo asset**. If you need a mark, ask the org for theirs — never
  invent one.
- **If a future surface genuinely needs icons**, pick a minimal, hairline (1.5px)
  outline set that matches the calm/low-chrome character and flag it as an
  addition — it is not part of the current system.

*(No `assets/` directory: the system has no logos, icon files, illustrations, or
imagery to copy in. This is accurate to the source, not an omission.)*

---

## Intentional additions

- **`Button`** — the source has no `<Button>` component; buttons are hand-written
  `<button className="btn btn-primary">` / `.btn` on `<Link>`. A `Button`
  primitive is added to standardize that exact markup (variants: primary /
  secondary; sizes: md / sm; `href` renders an identical `<a>`). Purely
  presentational — real interactivity still belongs in a client island.

Everything else maps 1:1 to `components/ui.tsx`.

---

## Index (manifest)

**Root**
- `styles.css` — the one entry point consumers link (@import list only).
- `app.css` — all component + utility className hooks (verbatim from
  `globals.css`).
- `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css` — design
  tokens (48 custom properties).
- `readme.md` (this file), `SKILL.md`.

**Components** — `components/core/` (React primitives; `window.GrantsPlatformDesignSystem_a27f23`)
- `Card` — base white surface (+ `card-ethos` accent variant).
- `Chip` — toned pill (neutral/muted/info/good/warn/bad/brand).
- `StatusChip` — Chip mapping a grant status → tone + label.
- `ScorePips` — 1–5 filled/empty pip meter.
- `EmptyState` — mandatory empty-list placeholder.
- `FieldRow` — label/value detail row.
- `Button` — button primitive (*intentional addition*).

**Foundations** — `foundations/` (Design System tab specimen cards)
- Colors: Brand (swappable), Neutrals, Status tones.
- Type: Headings, Body/meta/eyebrow, Monospace.
- Spacing: Spacing scale, Radius, Elevation.

**UI kits** — `ui_kits/grants-app/`
- Interactive recreation: Pipeline board → Grant detail → Runs (+ stubbed
  Profile/Settings). `index.html` + `screens.jsx`.

## Caveats
- **Webfonts:** the refreshed system loads **Space Grotesk** + **JetBrains
  Mono** from Google Fonts (the original product used the native system stack).
  These are open-source Google Fonts chosen for the "techy sticker" direction —
  not substitutes for a proprietary face. Consumers need network access at load;
  swap to self-hosted files if you need offline.
- No logo/imagery assets exist in the source (per-org, runtime-injected).
- The `warn` tone was shifted from brown (`#b7791f`) to a true orange
  (`#dd6b20`) per the refresh.
