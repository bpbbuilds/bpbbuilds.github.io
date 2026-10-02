-- Event / manual cosmetic grants on profiles.
-- Apply after 017_profiles_equipped_avatar.sql (and after 020 if applying in order).
-- Clients cannot self-grant (profiles_protect_owner freezes this column).

alter table public.profiles
  add column if not exists cosmetic_grants jsonb not null default '[]'::jsonb;

comment on column public.profiles.cosmetic_grants is
  'JSON array of blob cosmetic ids granted outside plan (e.g. event winners). Public read; not client-writable.';

-- Freeze cosmetic_grants on authenticated client updates (same trigger as plan/Stripe).
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
  end if;
  new.updated_at := now();
  return new;
end;
$$;
