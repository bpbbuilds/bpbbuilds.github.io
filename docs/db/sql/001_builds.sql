-- Creates public.builds + RLS (no demo seed rows — publish real builds via submit-build).
-- Safe to re-run: create if not exists + replace read policy.

create table if not exists public.builds (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  hero_class text,
  blurb text,
  notes text,
  youtube_url text,
  thumbnail_path text,
  author_id uuid,
  author_name text,
  is_op boolean not null default false,
  is_featured boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists builds_hero_class_idx on public.builds (hero_class);
create index if not exists builds_is_public_idx on public.builds (is_public);
create index if not exists builds_is_op_idx on public.builds (is_op) where is_op = true;
create index if not exists builds_is_featured_idx on public.builds (is_featured) where is_featured = true;
create index if not exists builds_created_at_idx on public.builds (created_at desc);

alter table public.builds enable row level security;

drop policy if exists "Public read published builds" on public.builds;
create policy "Public read published builds"
  on public.builds
  for select
  to anon, authenticated
  using (is_public = true);
