# Host your own instance online (~15 min)

`SETUP.md` runs the app on your laptop. This puts it on the internet so it's
always up, magic-link sign-in works from any device, and weekly discovery runs
on its own. The recommended host is **Vercel** (free Hobby tier is enough), but
any Next.js host works.

You never run `npm run setup` for an online install — instead of a `.env.local`
file, you paste the same values into the host's **Environment Variables** UI.

## What you need

- The repo on **GitHub** (fork it, or push your copy).
- A **Supabase** project — same as `SETUP.md` steps: create it, grab the
  **project ref**, the **anon** key, and the **service_role** key.
- A **Vercel** account (sign in with GitHub).
- *(added later, in the app)* an **Anthropic API key** — you no longer set this
  at deploy time; you paste it on the **Settings → API keys** page after first
  sign-in.

## 1. Apply the database schema (once)

The tables have to exist before the app can run. Easiest way, from a local
checkout of your repo:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

> No local checkout at all? Open your Supabase project → **SQL Editor** and run
> the files in `supabase/migrations/` in order (0001 → 0007), pasting each one.

## 2. Import the repo into Vercel

1. <https://vercel.com/new> → **Import** your GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave build settings default.
3. **Before clicking Deploy**, open **Environment Variables** and add these:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_URL` | same as above |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your **anon / public** key (`eyJ…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | your **service_role / secret** key (`eyJ…`) |
| `APP_BASE_URL` | your site URL, e.g. `https://your-app.vercel.app` |

> **Login stays ON for a public host.** Don't set `AUTH_DISABLED` here (locally it
> defaults to `true` for a no-login experience; on the internet that would make your
> instance open to anyone). Leaving it unset means magic-link sign-in is required, gated by
> your members allowlist.

> You may not know the final URL yet. Deploy once, copy the URL Vercel gives you,
> then set `APP_BASE_URL` to it and redeploy. It only matters so the magic-link
> email points at your live site instead of `localhost`.

4. Click **Deploy**.

## 3. Point Supabase auth at your site

So the magic-link email redirects back correctly:

1. Supabase → **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL.
3. Add `https://your-app.vercel.app/auth/callback` under **Redirect URLs**.

## 4. First sign-in + finish setup in the browser

1. Visit your site → **Sign in** → enter the email you want to be the **owner**.

   > The very first time, no one is in the members allowlist yet. Add yourself:
   > Supabase → **Table Editor → members → Insert row** → your email, role
   > `owner`. (Local installs do this for you via `npm run setup`; online, it's
   > one manual row.)

2. Open the magic link, and you're in.
3. Go to **Settings → API keys** and paste your **Anthropic key** (`sk-ant-…`).
   That's what the agents spend — no redeploy needed.
4. Finish **onboarding** (it interviews you and builds your org profile).
5. Turn on any notification channels under **Settings → Notifications**.

## 5. (Optional) Automatic weekly discovery

Discovery/jobs run via **GitHub Actions** (`.github/workflows/*.yml`), not
Vercel. In your GitHub repo → **Settings → Secrets and variables → Actions**,
add:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — required.
- `ANTHROPIC_API_KEY` — **only** if you did *not* set the key in the dashboard.
  The engine reads the dashboard key first and falls back to this secret.
- `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN` — only for those notification channels.

That's it — your instance is live, self-updating (push to GitHub → Vercel
redeploys), and runs discovery on schedule.

## Updating later

Because you deployed from GitHub, updates are just: pull upstream changes into
your repo (or click **Sync fork** on GitHub) → Vercel redeploys automatically.
If an update adds new migrations, run `npm run db:push` once more (step 1).
