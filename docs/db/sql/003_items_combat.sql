-- Combat / catalog fields from game ItemData.csv
alter table public.items
  add column if not exists gid integer,
  add column if not exists sockets integer,
  add column if not exists accuracy real,
  add column if not exists cooldown real,
  add column if not exists stamina_cost real,
  add column if not exists damage_min integer,
  add column if not exists damage_max integer,
  add column if not exists block integer,
  add column if not exists chance real,
  add column if not exists chance_tag text,
  add column if not exists chance2 real,
  add column if not exists chance2_tag text,
  add column if not exists params jsonb not null default '{}'::jsonb,
  add column if not exists recipes_raw text,
  add column if not exists material text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists game_version text,
  add column if not exists release_state text;

-- gid unique when present
create unique index if not exists items_gid_uidx
  on public.items (gid)
  where gid is not null;

create index if not exists items_cooldown_idx on public.items (cooldown);
create index if not exists items_damage_min_idx on public.items (damage_min);
