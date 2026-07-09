-- 0013_outcome.sql
-- The real result of an application, captured after you submit: did it win, lose,
-- or get withdrawn? The status enum records pipeline stage (submitted / awarded /
-- dead) but can't tell "submitted then lost" apart from "never pursued" - and
-- that difference is exactly the ground-truth signal the teaching loop needs to
-- get smarter. preference-context.ts + the distiller read this.
-- Additive so older instances still load.

alter table grants add column if not exists outcome text
  check (outcome in ('awarded', 'rejected', 'withdrawn'));
