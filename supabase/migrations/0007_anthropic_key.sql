-- 0007_anthropic_key.sql
-- Let the Anthropic API key be managed from the dashboard (Settings → API keys)
-- instead of only via .env.local / host env vars. Stored on the settings
-- singleton. The engine reads this first and falls back to the ANTHROPIC_API_KEY
-- environment variable, so existing env-based deploys keep working unchanged.
--
-- Access: the settings table is already members-only via RLS (m_settings), and
-- this instance is single-org, so only your own members can read it. The app
-- never sends the key value to the browser — the Settings page shows only
-- whether a key is set, and the input is write-only.

alter table settings add column if not exists anthropic_api_key text;
