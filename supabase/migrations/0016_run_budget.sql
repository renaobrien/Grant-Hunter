-- Per-run spend ceiling for discovery, on top of the daily budget. One run
-- stops before any agent call whose worst case would cross this. Editable in
-- Settings -> Discovery & budget.
alter table settings
  add column if not exists run_budget_usd numeric not null default 2
  check (run_budget_usd >= 0);
