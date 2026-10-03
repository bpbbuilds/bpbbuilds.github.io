-- A SECURITY DEFINER claim still retains the caller's auth.uid(), so the
-- profile protection trigger previously reverted its plan/founding-slot write.
-- A transaction-local flag is set only by the trusted claim function below.

create or replace function public.profiles_protect_owner()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
    and coalesce(current_setting('bpb.founding_claim', true), '') <> 'on' then
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

-- One transaction-level lock prevents two new claimants from choosing the
-- same slot or passing the cap at the same time.
create unique index if not exists profiles_founding_slot_unique_idx
  on public.profiles (founding_slot)
  where founding_slot is not null;

create or replace function public.claim_founding_slot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.profiles;
  used int;
  total constant int := 10;
  next_slot int;
  started boolean;
  granted_slot int;
  granted_plan text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Serialize new claims across profiles before measuring capacity.
  perform pg_advisory_xact_lock(hashtext('bpb.founding_slots'));

  select * into row
  from public.profiles
  where id = uid
  for update;

  if not found then
    raise exception 'profile missing';
  end if;

  if row.plan in ('founding', 'premium') then
    used := public.founding_slots_used();
    return jsonb_build_object(
      'granted', false,
      'already_entitled', true,
      'slot', row.founding_slot,
      'used', used,
      'total', total,
      'plan', row.plan
    );
  end if;

  if not public.founding_slot_eligible(row) then
    used := public.founding_slots_used();
    return jsonb_build_object(
      'granted', false,
      'ineligible', true,
      'slot', null,
      'used', used,
      'total', total,
      'plan', row.plan
    );
  end if;

  started := public.founding_promo_started();
  if not started then
    used := public.founding_slots_used();
    return jsonb_build_object(
      'granted', false,
      'not_started', true,
      'slot', null,
      'used', used,
      'total', total,
      'plan', row.plan
    );
  end if;

  used := public.founding_slots_used();
  if used >= total then
    return jsonb_build_object(
      'granted', false,
      'full', true,
      'slot', null,
      'used', used,
      'total', total,
      'plan', row.plan
    );
  end if;

  select coalesce(max(founding_slot), 0) + 1 into next_slot
  from public.profiles
  where founding_slot is not null;

  -- The trigger accepts this marker only for the current RPC transaction.
  perform set_config('bpb.founding_claim', 'on', true);
  update public.profiles
  set
    plan = 'founding',
    founding_slot = next_slot,
    updated_at = now()
  where id = uid
  returning plan, founding_slot into granted_plan, granted_slot;

  if granted_plan <> 'founding' or granted_slot is distinct from next_slot then
    raise exception 'founding grant was not persisted';
  end if;

  used := public.founding_slots_used();
  return jsonb_build_object(
    'granted', true,
    'slot', granted_slot,
    'used', used,
    'total', total,
    'plan', granted_plan
  );
end;
$$;

revoke all on function public.claim_founding_slot() from public;
grant execute on function public.claim_founding_slot() to authenticated;

notify pgrst, 'reload schema';
