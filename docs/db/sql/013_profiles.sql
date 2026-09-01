-- Discord Auth v1: profiles + builds.author_id FK + voter bind RPC.
-- Apply after build_votes (012). Enable Discord OAuth in Supabase Auth dashboard first.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  display_name text,
  avatar_url text,
  is_owner boolean not null default false,
  voter_key uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Site users linked to Supabase Auth (Discord). Public read; users update own row (not is_owner).';

comment on column public.profiles.discord_id is
  'Stable Discord snowflake — used in /u/{discord_id}/ URLs.';

comment on column public.profiles.is_owner is
  'Site owner flag for admin Edge Functions. Bootstrap manually after first login.';

comment on column public.profiles.voter_key is
  'Bound anonymous vote UUID (localStorage bpb-voter-id). One key per profile.';

create index if not exists profiles_discord_id_idx on public.profiles (discord_id);

-- Protect is_owner / identity from authenticated client updates.
-- SQL editor / service role (no auth.uid()) can still bootstrap is_owner.
create or replace function public.profiles_protect_owner()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.is_owner := old.is_owner;
    new.id := old.id;
    new.discord_id := old.discord_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_owner_trg on public.profiles;
create trigger profiles_protect_owner_trg
  before update on public.profiles
  for each row
  execute function public.profiles_protect_owner();

-- Upsert profile on Discord Auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  did text;
  dname text;
  av text;
  providers jsonb;
begin
  providers := coalesce(new.raw_app_meta_data->'providers', '[]'::jsonb);
  if coalesce(new.raw_app_meta_data->>'provider', '') <> 'discord'
     and not (providers ? 'discord') then
    return new;
  end if;

  did := nullif(trim(coalesce(
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'sub',
    ''
  )), '');

  if did is null then
    return new;
  end if;

  dname := nullif(trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'preferred_username',
    ''
  )), '');

  av := nullif(trim(coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  )), '');

  insert into public.profiles (id, discord_id, display_name, avatar_url)
  values (new.id, did, dname, av)
  on conflict (id) do update set
    discord_id = excluded.discord_id,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- builds.author_id → profiles
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'builds_author_id_fkey'
  ) then
    alter table public.builds
      add constraint builds_author_id_fkey
      foreign key (author_id) references public.profiles (id)
      on delete set null;
  end if;
end $$;

create index if not exists builds_author_id_idx on public.builds (author_id);

-- Merge anon votes into a canonical voter_key (same build → keep newer / prefer keep_key)
create or replace function public.merge_voter_keys(from_key uuid, keep_key uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if from_key is null or keep_key is null or from_key = keep_key then
    return;
  end if;

  -- Prefer keep_key row when both exist for the same build
  delete from public.build_votes bv
  using public.build_votes kept
  where bv.voter_key = from_key
    and kept.voter_key = keep_key
    and kept.build_id = bv.build_id;

  update public.build_votes
  set voter_key = keep_key, updated_at = now()
  where voter_key = from_key;
end;
$$;

revoke all on function public.merge_voter_keys(uuid, uuid) from public, anon, authenticated;

-- Bind localStorage bpb-voter-id → profiles.voter_key (callable by signed-in user)
create or replace function public.bind_my_voter_key(p_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mine uuid;
  owner_of_key uuid;
  out_key uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_key is null then
    raise exception 'voter_key required';
  end if;

  select voter_key into mine
  from public.profiles
  where id = uid
  for update;

  if not found then
    raise exception 'profile missing';
  end if;

  select id into owner_of_key
  from public.profiles
  where voter_key = p_key
    and id <> uid;

  if mine is not null then
    if p_key is distinct from mine and owner_of_key is null then
      perform public.merge_voter_keys(p_key, mine);
    end if;
    return jsonb_build_object('voter_key', mine, 'reissued', false);
  end if;

  if owner_of_key is not null then
    out_key := gen_random_uuid();
    update public.profiles
    set voter_key = out_key, updated_at = now()
    where id = uid;
    return jsonb_build_object('voter_key', out_key, 'reissued', true);
  end if;

  update public.profiles
  set voter_key = p_key, updated_at = now()
  where id = uid;

  return jsonb_build_object('voter_key', p_key, 'reissued', false);
end;
$$;

revoke all on function public.bind_my_voter_key(uuid) from public;
grant execute on function public.bind_my_voter_key(uuid) to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
  on public.profiles
  for select
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Safety net if Auth trigger lags (is_owner always false on insert)
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  with check (auth.uid() = id and is_owner = false);

-- No delete for anon/authenticated — service role only.

-- ---------------------------------------------------------------------------
-- Owner bootstrap (run once in SQL editor after your first Discord login):
--
--   update public.profiles
--   set is_owner = true
--   where discord_id = 'YOUR_DISCORD_SNOWFLAKE';
--
-- Or by auth user id:
--
--   update public.profiles set is_owner = true where id = 'YOUR_AUTH_USER_UUID';
-- ---------------------------------------------------------------------------
