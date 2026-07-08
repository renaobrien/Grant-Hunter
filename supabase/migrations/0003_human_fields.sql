-- Grant Hunter :: human-owned + jobs-runner bookkeeping fields on grants
-- human_notes: free text the operator writes on a grant. HUMAN-OWNED - the engine
--   (discovery upsert, drafter, etc.) must NEVER write this column.
-- last_deadline_ping: date the jobs runner last sent a deadline reminder for this
--   grant, so it doesn't ping the same deadline twice.

alter table grants add column if not exists human_notes text;
alter table grants add column if not exists last_deadline_ping date;
