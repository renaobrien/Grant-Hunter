# Speech Without Borders — Grants Bot

Weekly grants discovery for Speech Without Borders (SWB). Searches the web for funding opportunities aligned with SWB's work on free expression, digital rights, platform policy, and adjacent blockchain/AI governance. Dedupes against a Google Sheet so nothing surfaces twice. Emails Jesse a digest each Monday morning.

## What it does

- **Weekly cron** — runs every Monday 8am ET via GitHub Actions (free).
- **Search + score** — Anthropic Claude with web search. Scores fit 1–5 against the SWB voice and Jesse's calibration scenarios.
- **Dedupe** — Google Sheet `Grants` tab is the source of truth. Already-tracked grants don't re-surface; rejected grants (score ≤2) are permanently dropped.
- **Auto-discard expired** — grants whose deadlines passed get marked `discarded` automatically.
- **Email digest** — Gmail SMTP. HTML + plaintext, 5–10 opportunities per week, sorted pursue → maybe.
- **Feedback loop** — Jesse types a 1–5 score in column B of the sheet; future digests use it as positive/negative signal.

## Stack

- Node.js (single-shot script, no server)
- [Anthropic Claude](https://anthropic.com) with web search (defaults to `claude-haiku-4-5` for cost; bump to `claude-sonnet-4-6` if matching quality is poor)
- Google Sheets API (service account auth)
- Nodemailer + Gmail SMTP
- GitHub Actions for the weekly cron

## Cost

Estimated **<$1/week** at Haiku pricing — one digest call per week with ~8K input + ~4K output tokens. GitHub Actions free tier easily covers the workflow. Gmail SMTP is free.

## Run it locally

```bash
npm install
cp .env.example .env  # then fill in values per SETUP.md
node index.js
```

## See [SETUP.md](./SETUP.md) for first-time setup

Google service account, Sheet creation, Gmail app password, and GitHub Actions secrets.

## Tracker schema

Single tab `Grants`, header in row 1 (column A intentionally blank for formatting). Bot writes from column B onward. Header:

`Scoring | Rejection Reason | ID | Date Added | Funder | Program Name | Amount | Deadline | Fit Score | Recommendation | Confidence | Status | Framing Angle | Eligibility Notes | Blockers | Notes | Contacts | Source URL | Application URL | Last Verified | Last Weekly Digest`

| Column | Owner | Notes |
|---|---|---|
| `Scoring` (B) | Jesse | 1–5. Drives the bot's preference learning. ≤2 = never re-surface this grant. ≥4 = find more like it. |
| `Rejection Reason` (C) | Jesse | Optional free-text or one of `stale` / `eligibility` / `misaligned` / `invite-only` / `size` / `timing` |
| Everything else | Bot | Bot writes on first surface, updates on re-verification |

`Status` values: `found` / `researching` / `drafting` / `applied` / `submitted` / `awarded` / `passed` / `discarded` / `dead`

## Forcing a run

- **Locally:** `node index.js`
- **GitHub Actions:** Actions tab → Weekly Grants Digest → "Run workflow"

## Why no Slack / no slash commands

This is a v1 favor-build for Jesse. Email + Sheet covers the core loop (surface → review → score) with zero hosting cost. If Jesse wants on-demand commands later, the obvious upgrade is a Telegram bot using the same lib/ modules — index.js is the only file that would need a sibling.
