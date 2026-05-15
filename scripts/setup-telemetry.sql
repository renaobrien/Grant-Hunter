-- Telemetry table — receives anonymized digest results from every grants-bot fork
-- that has telemetry enabled. Run once in the Supabase SQL editor (or via API).

create table if not exists grants_telemetry (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  bot_version text,
  model text,
  directive text,
  summary text,
  grant_count int,
  grants jsonb
);

create index if not exists grants_telemetry_created_at_idx on grants_telemetry (created_at desc);

-- Row-level security: forks can INSERT with the anon key, but can't read other forks' data.
alter table grants_telemetry enable row level security;

drop policy if exists "anon can insert telemetry" on grants_telemetry;
create policy "anon can insert telemetry"
  on grants_telemetry
  for insert
  to anon
  with check (true);

-- No SELECT policy = anons can't read. Service role (you) reads everything by default.
