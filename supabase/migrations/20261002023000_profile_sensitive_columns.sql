-- Keep public profile cards public without exposing payment, vote, ownership,
-- or private-access fields through the Data API.
create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'discord_id', p.discord_id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'equipped_avatar', p.equipped_avatar,
    'is_owner', p.is_owner,
    'voter_key', p.voter_key,
    'plan', p.plan,
    'founding_slot', p.founding_slot,
    'premium_until', p.premium_until,
    'cosmetic_grants', p.cosmetic_grants,
    'coins', p.coins
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

revoke select on table public.profiles from anon, authenticated;
grant select (
  id, discord_id, display_name, avatar_url, equipped_avatar, plan,
  founding_slot, cosmetic_grants, coins, created_at, updated_at
) on table public.profiles to anon, authenticated;

notify pgrst, 'reload schema';
