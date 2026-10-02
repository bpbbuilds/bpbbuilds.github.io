-- Security hardening for Discord login and Private-mode access.
-- Client sessions may change display fields only. Membership, ownership,
-- payment, currency, and entitlement fields are server-managed.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function public.profiles_protect_owner()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.id := auth.uid();
      new.is_owner := false;
      new.plan := 'free';
      new.founding_slot := null;
      new.premium_until := null;
      new.stripe_customer_id := null;
      new.cosmetic_grants := '[]'::jsonb;
      new.coins := 0;
      new.discord_guild_verified_at := null;
    else
      new.id := old.id;
      new.discord_id := old.discord_id;
      new.is_owner := old.is_owner;
      new.plan := old.plan;
      new.founding_slot := old.founding_slot;
      new.premium_until := old.premium_until;
      new.stripe_customer_id := old.stripe_customer_id;
      new.cosmetic_grants := old.cosmetic_grants;
      new.coins := old.coins;
      new.discord_guild_verified_at := old.discord_guild_verified_at;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_owner_trg on public.profiles;
create trigger profiles_protect_owner_trg
  before insert or update on public.profiles
  for each row
  execute function public.profiles_protect_owner();

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (
    auth.uid() = id
    and is_owner = false
    and plan = 'free'
    and founding_slot is null
    and premium_until is null
    and stripe_customer_id is null
    and cosmetic_grants = '[]'::jsonb
    and coins = 0
    and discord_guild_verified_at is null
  );

-- This helper stays outside the Data API's exposed `public` schema. Its
-- search path is empty and every relation is schema-qualified.
create or replace function private.site_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select value <> 'private' from public.site_settings where key = 'site_access_mode'),
    true
  )
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and discord_guild_verified_at > now() - interval '15 minutes'
  );
$$;

revoke all on function private.site_access_allowed() from public;
grant execute on function private.site_access_allowed() to anon, authenticated;

drop policy if exists "Private launch read items" on public.items;
create policy "Private launch read items" on public.items as restrictive for select to anon, authenticated using ((select private.site_access_allowed()));
drop policy if exists "Private launch read combinations" on public.combinations;
create policy "Private launch read combinations" on public.combinations as restrictive for select to anon, authenticated using ((select private.site_access_allowed()));
drop policy if exists "Private launch read combination ingredients" on public.combination_ingredients;
create policy "Private launch read combination ingredients" on public.combination_ingredients as restrictive for select to anon, authenticated using ((select private.site_access_allowed()));
drop policy if exists "Private launch read builds" on public.builds;
create policy "Private launch read builds" on public.builds as restrictive for select to anon, authenticated using ((select private.site_access_allowed()));
drop policy if exists "Private launch read placements" on public.build_placements;
create policy "Private launch read placements" on public.build_placements as restrictive for select to anon, authenticated using ((select private.site_access_allowed()));
drop policy if exists "Private launch read profiles" on public.profiles;
create policy "Private launch read profiles" on public.profiles as restrictive for select to anon, authenticated using ((select private.site_access_allowed()));

revoke all on function public.private_site_access_allowed() from public, anon, authenticated;
drop function if exists public.private_site_access_allowed();

notify pgrst, 'reload schema';
