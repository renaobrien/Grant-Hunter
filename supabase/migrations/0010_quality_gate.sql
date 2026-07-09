-- 0010_quality_gate.sql
-- Operator-tunable discovery quality floors, read by the deterministic quality
-- gate (engine/quality-gate.ts). A survivor must clear BOTH floors (plus the
-- gate's coded eligibility/freshness/amount checks) to reach the board.
-- Additive (add column if not exists) so instances on an older schema still load.

alter table settings add column if not exists discovery_min_fit int not null default 3;
alter table settings add column if not exists discovery_min_alignment int not null default 3;
