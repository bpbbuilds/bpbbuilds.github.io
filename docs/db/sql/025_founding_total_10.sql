-- Founding cap is 10, not 50.
-- Apply in the Supabase SQL editor after 016_founding_promo_start.sql.
-- Replaces get_founding_status and claim_founding_slot only.

comment on column public.profiles.founding_slot is
  '1–10 when plan = founding; null otherwise.';

create or replace function public.get_founding_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  used int;
  total constant int := 10;
  started boolean;
begin
  used := public.founding_slots_used();
  started := public.founding_promo_started();
  return jsonb_build_object(
    'used', used,
    'total', total,
    'started', started,
    'open', started and used < total
  );
end;
$$;

revoke all on function public.get_founding_status() from public;
grant execute on function public.get_founding_status() to anon, authenticated;

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
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

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

  update public.profiles
  set
    plan = 'founding',
    founding_slot = next_slot,
    updated_at = now()
  where id = uid;

  used := public.founding_slots_used();

  return jsonb_build_object(
    'granted', true,
    'slot', next_slot,
    'used', used,
    'total', total,
    'plan', 'founding'
  );
end;
$$;

revoke all on function public.claim_founding_slot() from public;
grant execute on function public.claim_founding_slot() to authenticated;
