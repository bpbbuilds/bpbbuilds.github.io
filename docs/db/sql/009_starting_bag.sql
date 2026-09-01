-- Class starting bag loadout (may be sold off the final board).
alter table public.builds
  add column if not exists starting_bag_id text references public.items (id);

comment on column public.builds.starting_bag_id is
  'Class starter bag chosen at run start (loadout); not required to remain on the board.';
