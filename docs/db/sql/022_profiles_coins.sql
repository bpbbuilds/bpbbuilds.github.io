-- Soft currency balance on profiles (future cosmetic buy/sell).
-- Apply after 021_profiles_cosmetic_grants.sql.
-- Clients cannot mint/spend coins directly (profiles_protect_owner freezes this column).
-- Future marketplace RPCs / service role will adjust balances.

alter table public.profiles
  add column if not exists coins integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_coins_nonnegative;

alter table public.profiles
  add constraint profiles_coins_nonnegative check (coins >= 0);

comment on column public.profiles.coins is
  'Soft currency (coins/gold) for future cosmetic marketplace. Public read; not client-writable.';

-- Freeze coins on authenticated client updates (same trigger as plan/Stripe/grants).
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
    new.cosmetic_grants := old.cosmetic_grants;
    new.coins := old.coins;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
