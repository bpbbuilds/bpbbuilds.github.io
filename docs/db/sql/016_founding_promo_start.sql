-- Founding promo start gate.
-- Apply after 014_profiles_premium.sql (Supabase SQL editor).
-- Leave started_at null until the public URL is advertised; then flip (see below).

create table if not exists public.founding_promo (
  id boolean primary key default true check (id),
  started_at timestamptz
);

comment on table public.founding_promo is
  'Single-row gate: founding slots only grant when started_at is set and now() >= started_at.';

insert into public.founding_promo (id, started_at)
values (true, null)
on conflict (id) do nothing;

revoke all on table public.founding_promo from public;
-- No client writes; owner flips via SQL / service role.

create or replace function public.founding_promo_started()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.founding_promo
    where id = true
      and started_at is not null
      and now() >= started_at
  );
$$;

create or replace function public.get_founding_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  used int;
  total constant int := 50;
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
  total constant int := 50;
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

-- Flip when https://bpbbuilds.github.io is advertised publicly:
--   update public.founding_promo set started_at = now() where id = true;
-- Or schedule: set started_at to a future timestamptz.
