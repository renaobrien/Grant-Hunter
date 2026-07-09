-- Discovery speed mode: 'thorough' keeps the strongest adversarial vetting
-- (Skeptic on the top model, deeper web search); 'fast' trades some vetting
-- depth for cheaper, quicker runs. Editable in Settings -> Discovery & budget.
alter table settings
  add column if not exists speed_mode text not null default 'thorough'
  check (speed_mode in ('thorough', 'fast'));
