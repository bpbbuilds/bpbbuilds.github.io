-- Attached Steam history.db run (per-round boards + W/L) for the build scrubber.
-- Shape: { "runId": number, "rounds": [{ "round", "result": "win"|"loss", "placements": [...] }] }
-- Null = no attached run (final board only in build_placements).
alter table public.builds
  add column if not exists history jsonb;

comment on column public.builds.history is
  'Optional run history for round scrubber: { runId, rounds: [{ round, result, placements }] }. Null when none.';
