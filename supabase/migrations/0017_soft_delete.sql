-- Soft-delete for grants. A deleted grant disappears from the board and all
-- sweeps/digests, but the row stays so discovery still sees it in the index:
-- the finder is told not to re-propose it, re-proposals are dropped in code,
-- and upsertRuling refuses to revive it. Human deletes outlast profile edits
-- (unlike agent rejections, which expire when the profile changes).
alter table grants
  add column if not exists deleted_at timestamptz;
