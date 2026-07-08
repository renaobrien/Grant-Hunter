-- Grant Hunter :: initial schema
-- SINGLE ORGANIZATION per instance. No org_id, no multi-tenancy.
-- Each deployment is one org's private instance. Agents use the service role
-- (bypass RLS); the browser is gated to emails in the `members` allowlist.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- members : who may sign into this instance's dashboard
-- ---------------------------------------------------------------------------
create table members (
  email      text primary key,          -- stored lowercased by convention
  role       text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz default now()
);

-- SECURITY DEFINER so the policies below can read `members` without recursing
-- through `members`' own RLS.
create or replace function is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- profile : the white-label org identity + the structured "voice"
-- (generalizes eos-grants/lib/grantvoice.js). Singleton (id = 1).
-- ---------------------------------------------------------------------------
create table profile (
  id                       int primary key default 1 check (id = 1),
  -- identity / mission
  org_name                 text,
  one_liner                text,
  mission                  text,
  problem                  text,
  -- current state
  stage                    text,
  entity_type              text,
  jurisdiction             text,
  team_summary             text,
  traction                 text,
  revenue_model            text,
  -- what the org can credibly claim / cares about
  capabilities             text[]  default '{}',
  ethos                    text,
  -- eligibility reasoning
  eligibility_constraints  jsonb   default '[]'::jsonb,   -- [{label, detail}]
  min_amount               integer,
  max_amount               integer,
  geographies              text[]  default '{}',
  open_source_posture      text,
  -- positioning
  framing_angles           jsonb   default '[]'::jsonb,   -- [{name, description}]
  target_grant_types       text[]  default '{}',
  anti_patterns            text[]  default '{}',
  -- calibration (evolves via the teaching loop)
  calibration_notes        text,
  -- rendered system prompt cache (regenerated whenever the profile is saved)
  compiled_voice           text,
  compiled_at              timestamptz,
  -- branding (white-label)
  logo_url                 text,
  brand_primary            text default '#3B5BDB',
  brand_accent             text default '#1D9E75',
  brand_bg                 text default '#F7F5F0',
  onboarding_complete      boolean default false,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- settings : run + safety config. Singleton (id = 1).
-- ---------------------------------------------------------------------------
create table settings (
  id                          int primary key default 1 check (id = 1),
  discovery_rounds            int not null default 2,
  discovery_target_survivors  int not null default 5,
  daily_budget_usd            numeric not null default 5,   -- hard cap on agent spend/day
  preference_summary          text,                          -- distilled freeform feedback
  weekly_cron                 text not null default '0 12 * * 1',
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- grants : canonical record. Maps every eos-grants Sheet column (GRANTS_HEADERS)
-- plus ethos-alignment fields set by the Judge agent.
-- ---------------------------------------------------------------------------
create table grants (
  id                  uuid primary key default gen_random_uuid(),
  legacy_sheet_id     text unique,                 -- preserves old 'G-...' ids on import
  human_score         integer check (human_score between 1 and 5),
  rejection_reason    text check (rejection_reason in
                        ('stale','eligibility','misaligned','invite-only','size','timing')),
  date_added          timestamptz default now(),
  funder              text not null,
  program_name        text,
  amount              text,                         -- free text: "$50K-$100K" / "unknown"
  amount_numeric      integer,                      -- parsed for sorting/sums
  deadline            text,                         -- 'YYYY-MM-DD' | 'rolling' | 'unknown'
  fit_score           integer check (fit_score between 1 and 5),
  recommendation      text check (recommendation in ('pursue','maybe','pass')),
  confidence          text check (confidence in ('low','medium','high')),
  status              text not null default 'found' check (status in
                        ('found','researching','drafting','applied',
                         'submitted','awarded','passed','discarded','dead')),
  framing_angle       text,
  eligibility_notes   text,
  blockers            text,
  notes               text,
  contacts            text,
  source_url          text,
  application_url     text,
  alignment_score     integer check (alignment_score between 1 and 5),  -- ethos alignment
  alignment_rationale text,
  last_verified       timestamptz,
  last_weekly_digest  timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index idx_grants_status   on grants(status);
create index idx_grants_fit       on grants(fit_score desc);
create index idx_grants_deadline  on grants(deadline);

-- ---------------------------------------------------------------------------
-- grant_ratings : append-only teaching loop (number + freeform text)
-- ---------------------------------------------------------------------------
create table grant_ratings (
  id                uuid primary key default gen_random_uuid(),
  grant_id          uuid not null references grants(id) on delete cascade,
  rated_by          text,                           -- member email
  score             integer check (score between 1 and 5),
  rejection_reason  text check (rejection_reason in
                      ('stale','eligibility','misaligned','invite-only','size','timing')),
  feedback          text,                           -- freeform "why"
  created_at        timestamptz default now()
);
create index idx_ratings_grant on grant_ratings(grant_id);

-- ---------------------------------------------------------------------------
-- agent_debate : Finder -> Skeptic -> Judge transcript (audit + resumability)
-- ---------------------------------------------------------------------------
create table agent_debate (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null,
  round           int not null,
  candidate_key   text,                             -- funder|program or url
  finder_claim    jsonb,
  skeptic_verdict jsonb,
  judge_ruling    jsonb,
  created_at      timestamptz default now()
);
create index idx_debate_run on agent_debate(run_id);

-- ---------------------------------------------------------------------------
-- drafts + draft_rounds : narrative output + Drafter/Critic transcript
-- ---------------------------------------------------------------------------
create table drafts (
  id          uuid primary key default gen_random_uuid(),
  grant_id    uuid references grants(id) on delete cascade,
  status      text not null default 'queued' check (status in ('queued','running','ready','error')),
  content     text,
  rounds      int default 0,
  error       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table draft_rounds (
  id             uuid primary key default gen_random_uuid(),
  draft_id       uuid not null references drafts(id) on delete cascade,
  round          int not null,
  draft_text     text,
  critic_verdict jsonb,
  created_at     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- jobs : work queue the Node worker polls (long narrative loop, deep research)
-- ---------------------------------------------------------------------------
create table jobs (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('narrative_draft','research','brief','refresh')),
  payload       jsonb default '{}'::jsonb,
  status        text not null default 'queued' check (status in ('queued','running','done','error')),
  result        jsonb,
  error         text,
  created_at    timestamptz default now(),
  started_at    timestamptz,
  completed_at  timestamptz
);
create index idx_jobs_status on jobs(status, created_at);

-- ---------------------------------------------------------------------------
-- notification_channels : per-instance email + telegram config
-- ---------------------------------------------------------------------------
create table notification_channels (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null check (channel in ('email','telegram')),
  config      jsonb not null default '{}'::jsonb,   -- email:{recipients[],from} telegram:{chat_id}
  enabled     boolean default true,
  events      text[] default '{weekly_digest,new_grant,deadline,draft_ready}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (channel)
);

-- ---------------------------------------------------------------------------
-- agent_runs : cost + audit for every agent invocation (drives the budget cap)
-- ---------------------------------------------------------------------------
create table agent_runs (
  id            uuid primary key default gen_random_uuid(),
  agent_type    text not null,
  trigger_type  text not null default 'scheduled' check (trigger_type in ('scheduled','manual','webhook')),
  status        text not null default 'running' check (status in ('running','success','error')),
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  duration_ms   integer,
  input_data    jsonb,
  output_data   jsonb,
  error_message text,
  tokens_used   integer,
  cost_cents    integer
);
create index idx_runs_started on agent_runs(started_at desc);

-- total agent spend so far today (used by the budget cap at run start)
create or replace function spent_cents_today()
returns integer language sql stable as $$
  select coalesce(sum(cost_cents), 0)::int
  from agent_runs
  where started_at >= date_trunc('day', now());
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger trg_profile_updated  before update on profile               for each row execute function set_updated_at();
create trigger trg_settings_updated before update on settings              for each row execute function set_updated_at();
create trigger trg_grants_updated   before update on grants                for each row execute function set_updated_at();
create trigger trg_drafts_updated   before update on drafts                for each row execute function set_updated_at();
create trigger trg_channels_updated before update on notification_channels for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- singleton rows (so the app can always upsert id = 1)
-- ---------------------------------------------------------------------------
insert into settings (id) values (1) on conflict (id) do nothing;
insert into profile  (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row-Level Security
--   anon           -> denied (no policies)
--   authenticated  -> allowed only if their email is in `members`
--   service_role   -> bypasses RLS (agents + worker + setup)
-- ---------------------------------------------------------------------------
alter table members               enable row level security;
alter table profile               enable row level security;
alter table settings              enable row level security;
alter table grants                enable row level security;
alter table grant_ratings         enable row level security;
alter table agent_debate          enable row level security;
alter table drafts                enable row level security;
alter table draft_rounds          enable row level security;
alter table jobs                  enable row level security;
alter table notification_channels enable row level security;
alter table agent_runs            enable row level security;

-- members: everyone in the allowlist can see it; only an owner can change it.
-- (First owner is inserted by `setup` via the service role, which bypasses RLS.)
create policy members_select on members for select using (is_member());
create policy members_insert on members for insert with check (is_owner());
create policy members_update on members for update using (is_owner()) with check (is_owner());
create policy members_delete on members for delete using (is_owner());

-- all app data: any member may read/write; the service role bypasses this.
create policy m_profile  on profile               for all using (is_member()) with check (is_member());
create policy m_settings on settings              for all using (is_member()) with check (is_member());
create policy m_grants   on grants                for all using (is_member()) with check (is_member());
create policy m_ratings  on grant_ratings         for all using (is_member()) with check (is_member());
create policy m_debate   on agent_debate          for all using (is_member()) with check (is_member());
create policy m_drafts   on drafts                for all using (is_member()) with check (is_member());
create policy m_drounds  on draft_rounds          for all using (is_member()) with check (is_member());
create policy m_jobs     on jobs                  for all using (is_member()) with check (is_member());
create policy m_channels on notification_channels for all using (is_member()) with check (is_member());
create policy m_runs     on agent_runs            for all using (is_member()) with check (is_member());
