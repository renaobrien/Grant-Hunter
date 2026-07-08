-- grants-platform :: how the org chose to run its grant engine, captured during
-- the web onboarding flow. Informational — it drives the copy/instructions the
-- app shows (Runs page, onboarding); the actual scheduling lives in GitHub
-- Actions, a local cron, or manual runs depending on this value.
--   github = cloud cron (GitHub Actions)   local = run on their machine   manual = on demand

alter table settings
  add column if not exists run_mode text not null default 'manual'
  check (run_mode in ('github', 'local', 'manual'));
