-- 0014_migration_runner.sql
-- Auto-applied database updates. After this runs once, the app's "Update" button
-- applies every future migration itself, with no copy-paste into the SQL editor.
--
-- How it works:
--   * schema_migrations records which migration files have been applied.
--   * exec_sql(text) runs a migration's SQL. It is SECURITY DEFINER and locked to
--     the service_role, which the app already holds server-side. That role already
--     bypasses RLS and can read/write every table, so this adds no new reach: the
--     only caller is code that could already touch the whole database. It is NOT
--     granted to anon or authenticated, so nothing browser-reachable can call it.
--
-- Fresh installs get this as part of the one-time /connect schema paste, so the
-- runner exists from day one. Existing installs paste this file once, then updates
-- are automatic. Every migration stays additive + idempotent, so re-running is a
-- no-op and no data is ever overwritten.

create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

-- No policies + RLS on = only the service_role (which bypasses RLS) can touch it.
alter table public.schema_migrations enable row level security;

create or replace function public.exec_sql(sql text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute sql;
end;
$$;

revoke all on function public.exec_sql(text) from public;
revoke all on function public.exec_sql(text) from anon, authenticated;
grant execute on function public.exec_sql(text) to service_role;

-- Mark the structurally-committed migrations (0001-0009) as applied so the runner
-- never tries to re-run them - 0001 creates tables without "if not exists" and is
-- the one file that is not safe to replay. The additive column migrations
-- (0010-0013) are left unrecorded on purpose: they are idempotent, so the first
-- automatic update re-runs them harmlessly and records them, which also repairs an
-- instance that never applied them. This file records itself.
insert into public.schema_migrations (version) values
  ('0001_init'),
  ('0002_channels'),
  ('0003_human_fields'),
  ('0004_harden_function_search_path'),
  ('0005_private_rls_helpers'),
  ('0006_run_mode'),
  ('0007_anthropic_key'),
  ('0008_speed_mode'),
  ('0009_simplify_status'),
  ('0014_migration_runner')
on conflict (version) do nothing;

-- Tell PostgREST to expose exec_sql immediately, so the app can call it right
-- after this paste without waiting for the periodic schema reload.
notify pgrst, 'reload schema';
