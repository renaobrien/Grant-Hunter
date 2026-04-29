# SWB Grants Bot — Setup Checklist

One-time setup. Plan ~30 minutes if you have an Anthropic key already; ~45 if not.

---

## 1. Google Sheet

Create a new Google Sheet titled `SWB Grants Tracker`. Add a single tab named `Grants`.

**Header row** — paste into B1 (leave A1 blank for visual padding):

```
Scoring	Rejection Reason	ID	Date Added	Funder	Program Name	Amount	Deadline	Fit Score	Recommendation	Confidence	Status	Framing Angle	Eligibility Notes	Blockers	Notes	Contacts	Source URL	Application URL	Last Verified	Last Weekly Digest
```

(Tab-separated — paste into B1 and Sheets will spread it across B–V.)

Copy the Sheet ID from the URL — the long string between `/d/` and `/edit`. That's your `SHEET_ID`.

---

## 2. Google Service Account

In [Google Cloud Console](https://console.cloud.google.com):

1. Create a project (or reuse one) — e.g. `swb-grants-bot`
2. APIs & Services → Library → enable **Google Sheets API**
3. IAM & Admin → Service Accounts → Create Service Account
4. Skip the optional role grants
5. On the new service account → Keys → Add Key → JSON → download
6. Save the downloaded file as `google-service-account.json` in this repo (it's gitignored)
7. **Open the JSON, copy the `client_email` value**, and share the Google Sheet with that email as **Editor**

---

## 3. Anthropic API key

[console.anthropic.com](https://console.anthropic.com) → API Keys → Create. That's your `ANTHROPIC_API_KEY`.

Defaults to `claude-haiku-4-5` (cheapest). Override via `ANTHROPIC_MODEL=claude-sonnet-4-6` if matching quality is too rough.

---

## 4. Gmail app password (for SMTP)

You can't use your Gmail password directly. You need an app password:

1. Sign in to the Gmail account that will send the digest
2. Enable 2-Step Verification at [myaccount.google.com/security](https://myaccount.google.com/security) (required for app passwords)
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Create a new app password named `swb-grants-bot` → copy the 16-character value
5. That's your `SMTP_PASSWORD`. Your Gmail address is `SMTP_USER`.

---

## 5. Local `.env`

```bash
cp .env.example .env
```

Fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5
SHEET_ID=...
GOOGLE_KEY_FILE=./google-service-account.json
RECIPIENT_EMAIL=jesse@example.com,rena@gitcoin.co
SMTP_USER=you@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
FROM_EMAIL=SWB Grants Bot <you@gmail.com>
```

`RECIPIENT_EMAIL` accepts comma-separated addresses if you want both Jesse and rena on the digest.

---

## 6. Test locally

```bash
npm install
node index.js
```

Expected: digest writes new rows to the Grants tab in the Sheet, then sends an email. Check the inbox.

If something fails, the script logs which step broke (`[swb-grants] FATAL: ...`).

---

## 7. GitHub Actions secrets

Repo on GitHub → Settings → Secrets and variables → Actions → New repository secret. Add:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | from step 3 |
| `SHEET_ID` | from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | full contents of `google-service-account.json` (paste the whole JSON) |
| `RECIPIENT_EMAIL` | comma-separated emails |
| `SMTP_USER` | gmail address |
| `SMTP_PASSWORD` | gmail app password from step 4 |
| `FROM_EMAIL` | optional — defaults to `SMTP_USER` |

(Optional repo **variable**, not secret: `ANTHROPIC_MODEL` to override the default.)

---

## 8. Trigger a test run on Actions

Repo → Actions → **Weekly Grants Digest** → Run workflow → Run.

Watch the run. If it succeeds, the next automatic run is the upcoming Monday at 8am ET (13:00 UTC).

---

## Troubleshooting

- **`No text in API response`** → web search likely returned no results that fit; re-run, or temporarily widen the search prompt in `agents/digest.js`.
- **`Failed to parse digest JSON`** → model output got cut off; the parser tries to salvage. If it keeps failing, lower the prompt's grant ceiling from 5–10 to 3–5.
- **Sheet permission errors** → double-check you shared the Sheet with the service account's `client_email` as Editor.
- **Gmail auth errors** → confirm 2-Step Verification is on and you're using the 16-char app password, not your regular Gmail password.
- **No grants in digest** → not a bug; some weeks the search returns nothing meaningful. The digest still sends with an "no new opportunities" note.
