-- Cosmetics the owner publishes from the admin catalog.
-- Upload does not insert a row. Publish does. The Discord bot posts rows
-- that do not yet have a message id.

create table if not exists public.cosmetic_drops (
  id text primary key,
  name text not null,
  slot text not null default '',
  rarity text not null default '',
  "grant" text not null default '',
  description text not null default '',
  image text not null default '',
  published_at timestamptz not null default now(),
  discord_message_id text
);

comment on table public.cosmetic_drops is
  'Owner-published blob cosmetics. The bot announces each row once in Cosmetic drops.';

alter table public.cosmetic_drops enable row level security;

drop policy if exists cosmetic_drops_owner_select on public.cosmetic_drops;
create policy cosmetic_drops_owner_select
  on public.cosmetic_drops
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_owner
    )
  );

drop policy if exists cosmetic_drops_owner_insert on public.cosmetic_drops;
create policy cosmetic_drops_owner_insert
  on public.cosmetic_drops
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_owner
    )
  );
