-- grants-platform :: pin search_path on the two functions that lacked it, per the
-- Supabase security linter (0011_function_search_path_mutable). is_member/is_owner
-- already set it in 0001. `create or replace` is idempotent, so this is safe on a
-- fresh install (runs right after 0001) and on an already-provisioned instance.

create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function spent_cents_today()
returns integer language sql stable
set search_path = public as $$
  select coalesce(sum(cost_cents), 0)::int
  from agent_runs
  where started_at >= date_trunc('day', now());
$$;
