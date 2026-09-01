-- Authenticity tags: theory | feasible | real (replaces theorycraft).
-- OP stays on is_op / op_requested.

alter table public.builds
  drop constraint if exists builds_build_tag_check;

-- Widen briefly so remap is legal
alter table public.builds
  add constraint builds_build_tag_check
  check (
    build_tag is null
    or build_tag in ('feasible', 'theorycraft', 'theory', 'real')
  );

update public.builds
set build_tag = 'theory'
where build_tag = 'theorycraft';

alter table public.builds
  drop constraint if exists builds_build_tag_check;

alter table public.builds
  add constraint builds_build_tag_check
  check (
    build_tag is null
    or build_tag in ('theory', 'feasible', 'real')
  );

comment on column public.builds.build_tag is
  'Authenticity: theory | feasible | real; OP uses is_op / op_requested';
