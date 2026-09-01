-- Items catalog table (wiki import target)
do $$ begin
  create type item_rarity as enum (
    'Common',
    'Rare',
    'Epic',
    'Legendary',
    'Godly',
    'Unique'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.items (
  id text primary key,
  gid integer unique,
  name text not null,
  rarity item_rarity not null,
  type text not null,
  class text not null default 'Neutral',
  extra_types text[] not null default '{}',
  cost integer not null check (cost >= 0),
  effect text not null,
  image text,
  shape jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_rarity_idx on public.items (rarity);
create index if not exists items_type_idx on public.items (type);
create index if not exists items_name_idx on public.items (name);

alter table public.items enable row level security;

drop policy if exists "Public read items" on public.items;
create policy "Public read items"
  on public.items
  for select
  to anon, authenticated
  using (true);
