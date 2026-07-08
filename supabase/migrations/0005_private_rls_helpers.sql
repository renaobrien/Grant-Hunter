-- Grant Hunter :: move the RLS helper functions out of the PostgREST-exposed
-- `public` schema into a `private` schema. They must stay SECURITY DEFINER (so a
-- policy can read `members` without recursing through members' own RLS) and stay
-- EXECUTE-able by anon/authenticated (RLS policy expressions are evaluated as the
-- querying role, so the role must be able to CALL the function). The only thing
-- that changes is reachability: PostgREST exposes `public`, not `private`, so
-- is_member()/is_owner() are no longer callable as /rest/v1/rpc endpoints.
-- Clears Supabase linter 0028/0029 (anon/authenticated can execute SECURITY DEFINER).

create schema if not exists private;

create or replace function private.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'owner'
  );
$$;

grant usage on schema private to anon, authenticated;
grant execute on function private.is_member() to anon, authenticated;
grant execute on function private.is_owner() to anon, authenticated;

-- members: allowlist-visible; only an owner may change it.
drop policy if exists members_select on members;
drop policy if exists members_insert on members;
drop policy if exists members_update on members;
drop policy if exists members_delete on members;
create policy members_select on members for select using (private.is_member());
create policy members_insert on members for insert with check (private.is_owner());
create policy members_update on members for update using (private.is_owner()) with check (private.is_owner());
create policy members_delete on members for delete using (private.is_owner());

-- all app data: any member may read/write; the service role bypasses RLS entirely.
drop policy if exists m_profile  on profile;
drop policy if exists m_settings on settings;
drop policy if exists m_grants   on grants;
drop policy if exists m_ratings  on grant_ratings;
drop policy if exists m_debate   on agent_debate;
drop policy if exists m_drafts   on drafts;
drop policy if exists m_drounds  on draft_rounds;
drop policy if exists m_jobs     on jobs;
drop policy if exists m_channels on notification_channels;
drop policy if exists m_runs     on agent_runs;
create policy m_profile  on profile               for all using (private.is_member()) with check (private.is_member());
create policy m_settings on settings              for all using (private.is_member()) with check (private.is_member());
create policy m_grants   on grants                for all using (private.is_member()) with check (private.is_member());
create policy m_ratings  on grant_ratings         for all using (private.is_member()) with check (private.is_member());
create policy m_debate   on agent_debate          for all using (private.is_member()) with check (private.is_member());
create policy m_drafts   on drafts                for all using (private.is_member()) with check (private.is_member());
create policy m_drounds  on draft_rounds          for all using (private.is_member()) with check (private.is_member());
create policy m_jobs     on jobs                  for all using (private.is_member()) with check (private.is_member());
create policy m_channels on notification_channels for all using (private.is_member()) with check (private.is_member());
create policy m_runs     on agent_runs            for all using (private.is_member()) with check (private.is_member());

-- Drop the now-unused public-schema helpers (nothing references them anymore).
drop function if exists public.is_member();
drop function if exists public.is_owner();
