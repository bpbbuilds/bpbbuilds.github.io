-- Preserve per-placement game state such as configured Magic Ring effects.
alter table public.build_placements
  add column if not exists instance jsonb;

comment on column public.build_placements.instance is
  'Optional per-placement simulator state; ring persistent payloads are validated by submit-build.';
