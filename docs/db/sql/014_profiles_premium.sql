-- Premium / founding membership on profiles.
-- Apply after 013_profiles.sql.

alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists founding_slot smallint,
  add column if not exists premium_until timestamptz,
  add column if not exists stripe_customer_id text;

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'founding', 'premium'));

comment on column public.profiles.plan is
  'Membership: free | founding (lifetime) | premium (Stripe).';

comment on column public.profiles.founding_slot is
  '1–50 when plan = founding; null otherwise.';

comment on column public.profiles.premium_until is
  'Stripe subscription active until; null for free/founding.';

comment on column public.profiles.stripe_customer_id is
  'Stripe Customer id; set by webhook (service role).';

create index if not exists profiles_plan_idx on public.profiles (plan);
create index if not exists profiles_founding_slot_idx
  on public.profiles (founding_slot)
  where founding_slot is not null;

-- Block client self-grants of plan / founding / Stripe fields.
create or replace function public.profiles_protect_owner()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.is_owner := old.is_owner;
    new.id := old.id;
    new.discord_id := old.discord_id;
    new.plan := old.plan;
    new.founding_slot := old.founding_slot;
    new.premium_until := old.premium_until;
    new.stripe_customer_id := old.stripe_customer_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Discord snowflakes excluded from consuming founding slots (extend via is_owner or SQL edit).
create or replace function public.founding_slot_eligible(p_row public.profiles)
returns boolean
language sql
stable
as $$
  select not coalesce(p_row.is_owner, false);
$$;

create or replace function public.founding_slots_used()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles
  where founding_slot is not null
    and plan = 'founding';
$$;

-- Public counter for nav (no PII).
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
begin
  used := public.founding_slots_used();
  return jsonb_build_object(
    'used', used,
    'total', total,
    'open', used < total
  );
end;
$$;

revoke all on function public.get_founding_status() from public;
grant execute on function public.get_founding_status() to anon, authenticated;

-- Auto-grant founding on first eligible sign-in (atomic).
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
