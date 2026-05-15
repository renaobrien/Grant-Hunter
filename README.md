# Grants Bot

Personal grants-discovery bot. Every Monday morning it searches the web for funding opportunities aligned with your mission, scores each one 1–5 for fit, dedupes against a Google Sheet so nothing surfaces twice, and emails you a digest. You score what's actually relevant in column B of the Sheet — the bot reads your scoring history on the next run and tunes itself.

Fork it, fill in your context, run it on the GitHub Actions free tier. Cost is ~$1/week in Anthropic API calls. No hosting needed.

**Whitelabel** — there's no built-in org. You fill in [lib/voice.js](lib/voice.js) with your mission, focus areas, and calibration scenarios; the bot does the rest.

## What it does

- **Weekly cron** — runs every Monday 8am ET via GitHub Actions (free).
- **Search + score** — Anthropic Claude with web search. Scores each opportunity 1–5 against your custom voice doc and calibration scenarios.
- **Dedupe** — Google Sheet `Grants` tab is the source of truth. Already-tracked grants don't re-surface; rejected grants (score ≤2) are permanently dropped.
- **Auto-discard expired** — grants whose deadlines passed get marked `discarded` automatically at the top of each run.
- **Email digest** — Gmail SMTP. HTML + plaintext, 5–10 opportunities per week, sorted pursue → maybe.
- **Feedback loop** — type a 1–5 score in column B of the Sheet; future digests use it as positive/negative signal.
- **Ad-hoc runs with steering** — kick off a run from the GitHub Actions UI with a free-text directive ("focus on EU funders this week", "ignore blockchain") and the bot folds it into that run's search prompt.
- **Telegram demo** *(optional)* — a separate one-shot demo bot for non-technical people to try it from a DM. See [telegram/bot.js](telegram/bot.js).

## Stack

- Node.js (single-shot script, no server)
- [Anthropic Claude](https://anthropic.com) with web search (defaults to `claude-haiku-4-5` for cost; bump to `claude-sonnet-4-6` via `ANTHROPIC_MODEL` if matching quality is rough)
- Google Sheets API (service account auth)
- Nodemailer + Gmail SMTP
- GitHub Actions for the weekly cron

## Cost

Estimated **<$1/week** at Haiku pricing — one digest call per week with ~8K input + ~4K output tokens. GitHub Actions free tier easily covers the workflow. Gmail SMTP is free.

---

# Walkthrough — new user onboarding

End-to-end setup, ~30–45 minutes.

## Step 1 — Fill in your context

Open [lib/voice.js](lib/voice.js). It ships as a template — the bot won't run until you replace the placeholders. Fill in each section:

```
MISSION:
[Replace this with a one-line description of your mission]

FOCUS AREAS (what you'd say yes to — 5-10 bullets):
- [focus area 1]
- [focus area 2]

ANTI-FOCUS AREAS (de-prioritize even if keywords match — 3-5 bullets):
- [anti-focus area 1]

CALIBRATION SCENARIOS (4-6 anchors):
- "If [funder] funds [topic], score it [1-5] because [reason]"
- e.g. "If Mozilla puts out a content moderation RFP → 5, direct match"

ELIGIBILITY CONSTRAINTS:
- Legal entity: [501(c)(3) / fiscal sponsor / NGO / individual]
- Geographic restrictions:
- PI / lead requirements:

PRIORITY THEMES (keywords the bot should weight in searches — 5-15):
- [theme 1]

FUNDERS TO ALWAYS CHECK:
- [funder 1]

SOURCES TO IGNORE:
- [aggregator name]
```

Bullets, fragments, plain English. The bot reads it as a system prompt — no special syntax needed. Keep the JS export wrapper (`const VOICE = \`...\`; module.exports = ...`) intact; only the content between the backticks changes.

## Step 2 — Create your Google Sheet (5 min)

Create a new Google Sheet titled e.g. `Grants Tracker`. Add a single tab named exactly `Grants`.

Paste this into cell **B1** (tab-separated — Sheets will spread it across B–V):

```
Scoring	Rejection Reason	ID	Date Added	Funder	Program Name	Amount	Deadline	Fit Score	Recommendation	Confidence	Status	Framing Angle	Eligibility Notes	Blockers	Notes	Contacts	Source URL	Application URL	Last Verified	Last Weekly Digest
```

Copy the Sheet ID from the URL — the long string between `/d/` and `/edit`. You'll need it for `SHEET_ID`.

## Step 3 — Google Service Account (10 min)

In [Google Cloud Console](https://console.cloud.google.com):

1. Create a new project (any name, e.g. `grants-bot`)
2. APIs & Services → Library → enable **Google Sheets API**
3. IAM & Admin → Service Accounts → Create Service Account → skip the optional role grants
4. On the new service account → Keys → Add Key → JSON → download
5. Save the downloaded file as `google-service-account.json` in this repo (it's gitignored)
6. **Open the JSON, copy the `client_email` value**, and share your Google Sheet with that email as **Editor**

## Step 4 — Anthropic API key (2 min)

[console.anthropic.com](https://console.anthropic.com) → API Keys → Create. Save the `sk-ant-...` string for `ANTHROPIC_API_KEY`.

Defaults to `claude-haiku-4-5` (cheapest). Override via `ANTHROPIC_MODEL=claude-sonnet-4-6` if matching quality is too rough.

## Step 5 — Gmail app password (5 min)

You can't use your Gmail password directly — you need an app password:

1. Sign in to the Gmail account that will send the digest
2. Enable 2-Step Verification at [myaccount.google.com/security](https://myaccount.google.com/security) (required for app passwords)
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Create a new app password named `grants-bot` → copy the 16-character value
5. That's your `SMTP_PASSWORD`. Your Gmail address is `SMTP_USER`.

## Step 6 — Local `.env` (test locally before going live)

```bash
cp .env.example .env
```

Fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
SHEET_ID=...
GOOGLE_KEY_FILE=./google-service-account.json
RECIPIENT_EMAIL=you@example.com
SMTP_USER=you@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
FROM_EMAIL=Grants Bot <you@gmail.com>
BRAND_NAME=Your Org Name   # optional — shows up in the email subject + header
```

Then:

```bash
npm install
node index.js
```

Expected: new rows appear in the Sheet's `Grants` tab, then you get the email. Re-read the rows — do fit scores feel right? Are framing angles useful? Are eligibility blockers real? Iterate on [lib/voice.js](lib/voice.js) until 2 consecutive runs produce a digest you'd actually act on.

If something fails, the script logs which step broke (`[grants-bot] FATAL: ...`).

## Step 7 — GitHub Actions secrets

Once local runs feel good, push to your fork and wire up the cron.

Repo on GitHub → Settings → Secrets and variables → Actions → New repository secret. Add:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | from step 4 |
| `SHEET_ID` | from step 2 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | full contents of `google-service-account.json` (paste the whole JSON) |
| `RECIPIENT_EMAIL` | comma-separated emails |
| `SMTP_USER` | gmail address |
| `SMTP_PASSWORD` | gmail app password from step 5 |
| `FROM_EMAIL` | optional — defaults to `SMTP_USER` |

(Optional repo **variables** for non-secret config: `ANTHROPIC_MODEL`, `BRAND_NAME`.)

## Step 8 — Trigger a test run on Actions

Repo → Actions → **Weekly Grants Digest** → Run workflow → leave directive empty → Run.

Watch the run. If it succeeds, the next automatic run is the upcoming Monday at 8am ET (13:00 UTC).

---

# How to use the Sheet weekly

Each Monday digest is also written to your Sheet. Your job is column B — scoring. It's how the bot learns.

**Column B (Scoring) — 1–5**

- **5** — pursue hard, find more like this
- **4** — strong fit, worth real time
- **3** — neutral
- **2** — bot got this wrong, **never resurface this grant**
- **1** — bot got this very wrong, **never resurface this grant**

Anything 1–2 is permanently dropped from future digests. Anything 4–5 nudges the bot toward similar grants on subsequent runs.

**Column C (Rejection Reason)** — optional, but powerful. One of: `stale` / `eligibility` / `misaligned` / `invite-only` / `size` / `timing` — or free text.

**Column L (Status)** — track what you're doing with each opportunity:
`found` → `researching` → `drafting` → `applied` → `submitted` → `awarded` / `passed` / `discarded` / `dead`

Everything else the bot maintains. Don't worry about it. Grants whose deadlines pass get auto-flipped to `discarded` at the top of each weekly run, so the Sheet stays clean.

---

# Ad-hoc runs with your own directive

Between Mondays, when you want to push the bot at a specific angle:

**On GitHub Actions:** Repo → Actions → Weekly Grants Digest → **Run workflow**. There's a free-text "directive" input box — type whatever you want and the bot folds it into this run's search prompt only (your standing context isn't touched).

Examples:
- "look extra hard at AI safety + free expression crossover funders this week"
- "ignore blockchain, focus on traditional foundations"
- "specifically check Open Society's new RFPs"
- "find anything Europe-based with deadlines in Q3"

Natural language. The model reads it as a steering note on top of your standing voice doc.

**Locally:** the bot picks up a directive from (in order) the `--input "..."` CLI flag, the `DIRECTIVE` env var, or an interactive terminal prompt:

```bash
node index.js --input "focus on Europe-based platform-policy funders this week"
# or
DIRECTIVE="..." node index.js
# or just
node index.js   # prompts you in the terminal
```

Each run costs ~$0.10. Triggering a handful per week is normal.

---

# Telemetry — what's shared and why

By default, each digest run sends an anonymized record to a shared dataset so the project can improve scoring quality for everyone. This is opt-out, not opt-in. Here's exactly what we send and what we don't.

**What's sent:**
- Timestamp of the run
- Bot version (git SHA from the workflow, or "local")
- Model used
- The directive text (if any) you typed for that run
- One-line summary the model produced
- For each grant the bot surfaced: funder, program, amount, deadline, fit score, recommendation, framing angle, source URL

**What's NOT sent:**
- Your `lib/voice.js` content (your mission, focus areas, calibration scenarios)
- Your scoring in column B of the Sheet
- Your email, name, recipient list, or any other identifying field
- Your Google Sheet contents
- Your API keys or credentials

**Why we collect this:** the goal is a shared funder/program graph so the model can learn cross-user patterns — "if N orgs working on adjacent missions all scored funder X at 4+, that's a useful prior for someone new in a similar space." Single-user calibration plateaus fast; a shared dataset compounds.

**How to opt out:**
```
TELEMETRY=off
```
in your `.env` (locally) or as a GitHub Actions repo variable. Bot runs normally; nothing is sent.

**How to run your own collector instead:**
Set `TELEMETRY_ENDPOINT` (POST URL) and `TELEMETRY_KEY` (auth header value) and the bot will send to your endpoint instead. The expected payload shape is documented in [lib/telemetry.js](lib/telemetry.js).

**Server-side schema:** [scripts/setup-telemetry.sql](scripts/setup-telemetry.sql) — single Postgres/Supabase table with RLS that allows insert-only via the anon key. Run it once if you're standing up your own collector.

---

# Telegram demo *(optional, non-technical onramp)*

[telegram/bot.js](telegram/bot.js) is a separate one-shot demo bot. Non-technical users DM it, type their mission in one sentence, and get a sample digest back. Useful as a "try before you fork" funnel.

Run it on a small VPS or any always-on host:

```bash
TELEGRAM_BOT_TOKEN=<from-@BotFather>
ANTHROPIC_API_KEY=<sk-ant-...>
REPO_URL=https://github.com/your/grants-bot   # optional, defaults to upstream
DEMO_MAX_TRIES=3                              # optional, per-user daily limit
npm run telegram
```

State is in-memory; restarting drops it (fine for a demo). Rate-limit defaults to 3 tries per chat per day to control cost.

---

# Feedback / issues

If something breaks, the digest is weird, or you have an idea — open an issue: https://github.com/renaobrien/swb-grants-bot/issues

PRs welcome. Especially for: better search query generation, prompt tuning, additional delivery channels (Slack, Discord, Notion), and a hosted onboarding flow.

---

# Tracker schema

Single tab `Grants`, header in row 1 (column A intentionally blank for formatting). Bot writes from column B onward. Header:

`Scoring | Rejection Reason | ID | Date Added | Funder | Program Name | Amount | Deadline | Fit Score | Recommendation | Confidence | Status | Framing Angle | Eligibility Notes | Blockers | Notes | Contacts | Source URL | Application URL | Last Verified | Last Weekly Digest`

| Column | Owner | Notes |
|---|---|---|
| `Scoring` (B) | You | 1–5. Drives the bot's preference learning. ≤2 = never re-surface. ≥4 = find more like it. |
| `Rejection Reason` (C) | You | Optional free-text or one of `stale` / `eligibility` / `misaligned` / `invite-only` / `size` / `timing` |
| Everything else | Bot | Bot writes on first surface, updates on re-verification |

`Status` values: `found` / `researching` / `drafting` / `applied` / `submitted` / `awarded` / `passed` / `discarded` / `dead`

---

# Troubleshooting

- **`lib/voice.js still contains the placeholder template`** — you didn't fill in Step 1. Replace the `[brackets]` with your actual mission, focus areas, and calibration.
- **`No text in API response`** — web search likely returned no results that fit; re-run, or temporarily widen the search prompt in [agents/digest.js](agents/digest.js).
- **`Failed to parse digest JSON`** — model output got cut off; the parser tries to salvage. If it keeps failing, lower the prompt's grant ceiling from 5–10 to 3–5.
- **Sheet permission errors** — double-check you shared the Sheet with the service account's `client_email` as Editor.
- **Gmail auth errors** — confirm 2-Step Verification is on and you're using the 16-char app password, not your regular Gmail password.
- **No grants in digest** — not a bug; some weeks the search returns nothing meaningful. The digest still sends with a "no new opportunities" note.
