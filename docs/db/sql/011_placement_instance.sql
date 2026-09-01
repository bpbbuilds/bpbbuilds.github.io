-- Optional per-placement instance stats (shop upgrades, captured tooltip CD, etc.).
-- Null = use catalog join only. Safe to re-run.

alter table public.build_placements
  add column if not exists instance jsonb;

comment on column public.build_placements.instance is
  'Optional Item instance overrides for sim fidelity: baseCooldown, speedScale, params, paramMult, paramAdd, persistent, …';
