-- Build guide meta: gold cost + display rank (S / A / …).
alter table public.builds
  add column if not exists gold_count integer,
  add column if not exists rank text;

comment on column public.builds.gold_count is 'Typical gold spent to assemble this build (guide meta)';
comment on column public.builds.rank is 'Display tier / rank label for the guide (e.g. S, A, OP)';
