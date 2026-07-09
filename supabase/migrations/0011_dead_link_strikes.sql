-- 0011_dead_link_strikes.sql
-- Consecutive-failure counter for the periodic URL re-validation sweep
-- (engine/run-jobs.ts sweepStaleLinks). A 'found' grant is only retired after
-- its links come back all-dead on TWO consecutive sweeps, so a transient 404 /
-- timeout self-heals instead of killing a real grant. Reset to 0 on any success.
-- Additive so older instances still load.

alter table grants add column if not exists dead_link_strikes int not null default 0;
