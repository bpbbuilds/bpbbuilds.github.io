-- See supabase/migrations/20261002010000_private_access_data.sql.
-- Apply after 028_site_access.sql. This records a recent Discord server
-- membership verification and makes existing public-read policies restrictive
-- while site_access_mode is private.

alter table public.profiles
  add column if not exists discord_guild_verified_at timestamptz;

create or replace function public.private_site_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
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

revoke all on function public.private_site_access_allowed() from public;
grant execute on function public.private_site_access_allowed() to anon, authenticated;

drop policy if exists "Private launch read items" on public.items;
create policy "Private launch read items" on public.items as restrictive for select to anon, authenticated using (public.private_site_access_allowed());
drop policy if exists "Private launch read combinations" on public.combinations;
create policy "Private launch read combinations" on public.combinations as restrictive for select to anon, authenticated using (public.private_site_access_allowed());
drop policy if exists "Private launch read combination ingredients" on public.combination_ingredients;
create policy "Private launch read combination ingredients" on public.combination_ingredients as restrictive for select to anon, authenticated using (public.private_site_access_allowed());
drop policy if exists "Private launch read builds" on public.builds;
create policy "Private launch read builds" on public.builds as restrictive for select to anon, authenticated using (public.private_site_access_allowed());
drop policy if exists "Private launch read placements" on public.build_placements;
create policy "Private launch read placements" on public.build_placements as restrictive for select to anon, authenticated using (public.private_site_access_allowed());
drop policy if exists "Private launch read profiles" on public.profiles;
create policy "Private launch read profiles" on public.profiles as restrictive for select to anon, authenticated using (public.private_site_access_allowed());

notify pgrst, 'reload schema';
