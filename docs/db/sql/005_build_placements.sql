-- build_placements: items on a build backpack (join to items — no duplicated stats).
-- Also adds optional route columns on builds for Phase A guide pages.
-- Safe to re-run.

alter table public.builds
  add column if not exists route_r3 text;

alter table public.builds
  add column if not exists route_r10 text;

create table if not exists public.build_placements (
  id bigint generated always as identity primary key,
  build_id bigint not null
    references public.builds (id) on delete cascade,
  item_id text not null
    references public.items (id) on delete restrict,
  gid integer,
  x numeric not null,
  y numeric not null,
  r integer not null default 0,
  gems text[] not null default '{}',
  -- essentials tier for build page (null = uncategorized)
  priority text check (priority is null or priority in ('needed', 'nice', 'optional')),
  created_at timestamptz not null default now()
);

create index if not exists build_placements_build_id_idx
  on public.build_placements (build_id);

create index if not exists build_placements_item_id_idx
  on public.build_placements (item_id);

alter table public.build_placements enable row level security;

drop policy if exists "Public read placements of public builds" on public.build_placements;
create policy "Public read placements of public builds"
  on public.build_placements
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.builds b
      where b.id = build_id
        and b.is_public = true
    )
  );
