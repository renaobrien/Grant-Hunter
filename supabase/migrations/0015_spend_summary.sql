-- 0015_spend_summary.sql
-- Rolled-up spend for the Runs page cost panel: today (matching the budget cap's
-- UTC day boundary), last 7 days, last 30 days, and all-time, plus a run count.
-- Same shape as spent_cents_today (language sql stable, pinned search_path), so
-- it runs under the caller's RLS - members read their own agent_runs, and the
-- no-login service_role reads all. Additive + idempotent (create or replace).

create or replace function spend_summary()
returns table (
  today_cents bigint,
  week_cents bigint,
  month_cents bigint,
  all_cents bigint,
  run_count bigint
)
language sql stable
set search_path = public as $$
  select
    coalesce(sum(cost_cents) filter (where started_at >= date_trunc('day', now())), 0),
    coalesce(sum(cost_cents) filter (where started_at >= now() - interval '7 days'), 0),
    coalesce(sum(cost_cents) filter (where started_at >= now() - interval '30 days'), 0),
    coalesce(sum(cost_cents), 0),
    count(*)
  from agent_runs;
$$;
