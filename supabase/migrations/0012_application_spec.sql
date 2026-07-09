-- 0012_application_spec.sql
-- The funder's actual application requirements (questions, word/char limits,
-- required sections, scored criteria) for a grant. Paste-first: the operator
-- pastes the real form on the grant page; an opt-in "pull from the application
-- URL" action can also fill it. The Drafter answers THIS instead of writing a
-- generic essay, and the Critic checks the draft against it.
-- Additive so older instances still load.

alter table grants add column if not exists application_spec text;
