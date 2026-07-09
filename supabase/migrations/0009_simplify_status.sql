-- 0009_simplify_status.sql
-- Collapse the 9 grant statuses into 5, one per real-world state:
--   found      (was: found, researching)
--   drafting   (working the application)
--   submitted  (was: applied, submitted)
--   awarded
--   dead       (was: passed, discarded, dead - not pursuing / lost / expired)
-- The old set had near-duplicates (applied vs submitted, found vs researching)
-- that made the board dropdown confusing.

update grants set status = 'found'     where status = 'researching';
update grants set status = 'submitted' where status = 'applied';
update grants set status = 'dead'      where status in ('passed', 'discarded');

-- Replace the check constraint (name-agnostic: find whichever check mentions
-- status on grants, drop it, add the new one).
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'grants'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';
  if c is not null then
    execute format('alter table grants drop constraint %I', c);
  end if;
end $$;

alter table grants add constraint grants_status_check
  check (status in ('found', 'drafting', 'submitted', 'awarded', 'dead'));
