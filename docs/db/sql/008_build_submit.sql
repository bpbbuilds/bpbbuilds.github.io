-- Create submit: feasible/theorycraft tag + OP request flag (public is_op stays curated).
-- No anon INSERT — publish goes through Edge Function (service role).

alter table public.builds
  add column if not exists build_tag text;

alter table public.builds
  drop constraint if exists builds_build_tag_check;

alter table public.builds
  add constraint builds_build_tag_check
  check (build_tag is null or build_tag in ('feasible', 'theorycraft'));

alter table public.builds
  add column if not exists op_requested boolean not null default false;

comment on column public.builds.build_tag is 'Feasible or theorycraft (exclusive); OP uses is_op / op_requested';
comment on column public.builds.op_requested is 'Submit requested OP badge; is_op stays false until owner approval';
