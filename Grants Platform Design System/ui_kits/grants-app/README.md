# Grants App — UI kit

Interactive recreation of the three primary product surfaces from
`grants-platform` (Next.js). Org-neutral sample data; nothing here is tied to any
organization.

## Screens
- **Pipeline board** (`app/page.tsx`) — 4 columns (Searched / Active / Pending /
  Closed) of grant cards with funder, program, amount, deadline, Fit + Align
  `ScorePips`, a recommendation `Chip`, and an inline status `<select>` (the one
  optimistic-update client island in the real app). Click a card → detail.
- **Grant detail** (`app/grants/[id]/page.tsx`) — Ethos-alignment card first (the
  trust anchor, `card-ethos` accent border), then Assessment `FieldRow`s, the
  Finder → Skeptic → Judge debate in a `<details>`, a 1–5 rating form, and notes.
- **Runs** (`app/runs/page.tsx`) — read-only `data-table` of `agent_runs`
  (agent, trigger, status `Chip`, started, duration, tokens, cost, error).

Profile and Settings are stubbed with a placeholder — they reuse the same
form primitives (`.field`, `.form-grid`, `.channel-row`, `.btn`) shown elsewhere.

## Files
- `index.html` — mounts the interactive app (React + the DS bundle).
- `screens.jsx` — all screens + chrome (nav, health bar) in one file.

## How it's built
Screens compose the design-system primitives (`Card`, `Chip`, `StatusChip`,
`ScorePips`, `EmptyState`, `FieldRow`, `Button`) read from
`window.GrantsPlatformDesignSystem_a27f23`, plus the `globals.css` className hooks
(`.board`, `.grant-card`, `.data-table`, `.debate-round`, …). Interactions
(status change, open detail, rate, nav) are faked in local React state.
