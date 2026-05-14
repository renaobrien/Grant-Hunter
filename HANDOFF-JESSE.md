# Handoff to Jesse — paste-ready thread

Each section below is one standalone message. Paste into Telegram or email in order. Messages 1–2 go first; you collect his context and calibrate; once outputs look good, send 3–5.

---

## Message 1 — Kickoff (send first)

> Hey — I built you a weekly grants bot. Every Monday morning you'll get an email with 5–10 fresh opportunities scored 1–5 for SWB fit, with a framing angle, eligibility notes, and links. A Google Sheet behind it remembers what you've already seen so the same grant never resurfaces twice, and the bot learns from how you score column B.
>
> Before I hand it off and you fork it onto your own GitHub, I need ~15 min of your input so the scoring matches your taste, not my guess at your taste. Fill in the template I'll send next and reply with it. I'll plug it into the bot, run a test digest, eyeball the outputs with you, then send you the setup steps.
>
> Cost on your side: ~$1/week in Anthropic API calls, zero hosting (runs on GitHub Actions free tier).

---

## Message 2 — Context template (send right after #1)

> Copy this and reply with each section filled in. Don't overthink — bullets, fragments, vibes. The bot reads it as a system prompt so plain English works.
>
> ```
> --- SWB CONTEXT (Jesse) ---
>
> 1. One-line mission:
>    e.g. "SWB defends free expression and digital rights globally through research, coalitions, and policy."
>
> 2. Focus areas (what you'd say yes to — 5–10 bullets):
>    -
>    -
>    -
>
> 3. Anti-focus areas (sounds adjacent but isn't us — 3–5 bullets):
>    -
>    -
>
> 4. "Love to land a grant from" (3–5 funders, real examples):
>    -
>    -
>
> 5. "Not us, even if relevant on paper" (3–5 funders):
>    -
>    -
>
> 6. Scoring scenarios (give 4–6 short calibrators; the bot uses these as anchors):
>    - "If [funder] funds [topic], score it [1–5] because [reason]"
>    - e.g. "If Mozilla puts out a content moderation RFP → 5, direct match"
>    - e.g. "If Gates funds rural broadband → 1, infrastructure not expression"
>
> 7. Eligibility constraints (any hard nos that disqualify a grant fast):
>    - Legal entity: 501(c)(3)? fiscal sponsor? international NGO?
>    - Geography limits:
>    - PI / lead requirements (must be university? individual researcher?):
>    - Anything else:
>
> 8. Priority themes / "tags" — keywords the bot should weight in searches (5–15):
>    e.g. platform governance, content moderation policy, online speech, decentralized identity, AI bias and expression, coalition building, ...
>
> 9. Funders / programs to always check (besides obvious ones):
>    -
>
> 10. Sources to ignore / aggregators that produce noise:
>    -
>
> 11. Anything you want to flag I'm getting wrong about SWB's positioning:
>    -
>
> --- END ---
> ```

---

## Pause — Rena calibrates here (not a message to Jesse)

Once Jesse replies:

1. Replace the body of [lib/swbvoice.js](lib/swbvoice.js) with his content (keep the JS export wrapper). Mirror the sections he gave into the prompt — keep prose tight.
2. Make sure you've done all of [SETUP.md](SETUP.md) §§1–5 for **your own** test Sheet + your own Anthropic key. Don't use Jesse's anything yet.
3. Run `node index.js`. Watch the console — token usage, opportunities count, written rows.
4. Open the Sheet. Read every row. Ask:
   - Do fit scores feel right? (If everything is 4–5, the bar is too low; if everything is 2–3, too high)
   - Do framing angles read like Jesse would write them, or like marketing fluff?
   - Are blockers / eligibility calls real or hallucinated?
   - Are deadlines actually in the future? (Cross-check 2–3 against the live funder page)
   - Is the email itself scannable in 30 seconds?
5. Iterate. Most fixes are one-line edits to [lib/swbvoice.js](lib/swbvoice.js) (raise/lower scoring thresholds, sharpen anti-focus) or [agents/digest.js](agents/digest.js) (tune the open-ended search queries, adjust the "minimum bar" sentence).
6. When 2 consecutive runs feel useful, send Jesse messages 3–5.

Sign-off bar: would *Jesse* read this digest on a Monday and click into ≥1 opportunity within 30 seconds? If no, keep tuning.

---

## Message 3 — Set it up on your own GitHub (send after calibration passes)

> Outputs are dialed. Your turn to take ownership. ~30–45 min of one-time setup. Step by step:
>
> **a) Fork the repo**
> Go to https://github.com/renaobrien/swb-grants-bot → Fork → into your account. You now own a copy.
>
> **b) Make your Google Sheet (5 min)**
> Create a new Google Sheet titled "SWB Grants Tracker". Add a tab named exactly `Grants`. Paste this in cell B1 (tab-separated, will spread across B–V):
> ```
> Scoring	Rejection Reason	ID	Date Added	Funder	Program Name	Amount	Deadline	Fit Score	Recommendation	Confidence	Status	Framing Angle	Eligibility Notes	Blockers	Notes	Contacts	Source URL	Application URL	Last Verified	Last Weekly Digest
> ```
> Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`). Save it.
>
> **c) Google Service Account (10 min)**
> https://console.cloud.google.com → create project `swb-grants-bot` → APIs & Services → Library → enable **Google Sheets API**. Then IAM & Admin → Service Accounts → Create → skip role grants → on the new account go to Keys → Add Key → JSON → download. Open the JSON, copy the `client_email` value, and share your Sheet with that email as **Editor**.
>
> **d) Anthropic API key (2 min)**
> https://console.anthropic.com → API Keys → Create. Save the `sk-ant-...` string.
>
> **e) Gmail app password (5 min)**
> Use whichever Gmail will send the digest. Enable 2-Step Verification at https://myaccount.google.com/security if you haven't. Then https://myaccount.google.com/apppasswords → create one named `swb-grants-bot` → save the 16-char value.
>
> **f) Set GitHub Actions secrets (5 min)**
> Your forked repo → Settings → Secrets and variables → Actions → New repository secret. Add each:
> - `ANTHROPIC_API_KEY` — from step (d)
> - `SHEET_ID` — from step (b)
> - `GOOGLE_SERVICE_ACCOUNT_JSON` — full contents of the JSON file from (c), paste the whole thing
> - `RECIPIENT_EMAIL` — your email (comma-separate if you want me cc'd: `jesse@…, rena@gitcoin.co`)
> - `SMTP_USER` — the Gmail address sending the digest
> - `SMTP_PASSWORD` — the 16-char app password from (e)
> - `FROM_EMAIL` — optional, defaults to `SMTP_USER`
>
> **g) Trigger a test run**
> Repo → Actions tab → Weekly Grants Digest → Run workflow → Run. Watch it. Should finish in ~30s and you should get the email. If not, the run log will show which step failed — send me a screenshot.
>
> After that test passes, you're live. Next automatic run is the upcoming Monday at 8am ET.

---

## Message 4 — How to use the Sheet (send with or after #3)

> Each Monday digest is also written to your Sheet. Your job is column B — scoring. It's how the bot learns.
>
> **Column B (Scoring) — 1–5**
> - **5** — pursue hard, find more like this
> - **4** — strong fit, worth real time
> - **3** — meh, neutral signal
> - **2** — bot got this wrong, **never resurface this grant**
> - **1** — bot got this very wrong, **never resurface this grant**
>
> Anything 1–2 is permanently dropped from future digests. Anything 4–5 nudges the bot toward similar grants. 3s are neutral.
>
> **Column C (Rejection Reason)** — optional, but powerful. One of:
> `stale` (deadline passed) / `eligibility` (we can't apply) / `misaligned` (not SWB) / `invite-only` / `size` (too small) / `timing` (bad week) — or free text.
>
> **Column M (Status)** — track what you're doing:
> `found` → `researching` → `drafting` → `applied` → `submitted` → `awarded` / `passed` / `discarded` / `dead`
>
> Everything else the bot maintains. Don't worry about it.
>
> Grants whose deadlines pass get auto-flipped to `discarded` at the top of each weekly run, so the Sheet stays clean.

---

## Message 5 — Ad-hoc runs with your own input

> When you want to push the bot at a specific angle between Mondays:
>
> Repo → Actions → Weekly Grants Digest → **Run workflow**. There's a free-text "directive" input box — type whatever you want and the bot folds it into this run's search prompt only (your standing context isn't touched).
>
> Examples:
> - "look extra hard at AI safety + free expression crossover funders this week"
> - "ignore blockchain, focus on traditional foundations"
> - "specifically check Open Society's new RFPs"
> - "find anything Europe-based with deadlines in Q3"
>
> Natural language. The model reads it as a steering note on top of your standing context.
>
> If you ever run it locally (`node index.js` from a clone), it'll either pick up `DIRECTIVE=...` from env, a `--input "..."` flag, or just prompt you interactively in the terminal. Same idea, three input paths.
>
> One thing to know: each run costs ~$0.10. So don't trigger 50 in a day. But triggering a handful per week is normal.

---

## Open questions to resolve before sending message 3

- [ ] Did calibration actually pass? (2 consecutive useful-looking runs)
- [x] ~~Wire `workflow_dispatch` input field~~ — done. `directive` input flows through `DIRECTIVE` env → `index.js` → `runDigest({ directive })` → folded into the system prompt for that run only.
- [ ] Do you want the daily quick-scan workflow before handoff, or after Jesse's used it for 2–3 weeks?
- [ ] Commit `package-lock.json` before he forks (currently untracked)
