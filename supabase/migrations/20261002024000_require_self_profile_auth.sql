-- Require an authenticated caller even though get_my_profile returns no row for
-- anonymous callers. This keeps the RPC's contract explicitly self-only.
create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

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
  ) into result
  from public.profiles p
  where p.id = auth.uid();

  return result;
end;
$$;

notify pgrst, 'reload schema';
