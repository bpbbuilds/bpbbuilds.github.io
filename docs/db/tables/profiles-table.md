# Profiles table

Discord-linked site users (Supabase Auth). One row per `auth.users` id.

## Principles

- `id` = `auth.users.id` (cascade delete)
- Public profile URL uses **`discord_id`** (`/u/{discord_id}/`) — stable across display-name changes
- `is_owner` is **not** client-writable (trigger + service-role bootstrap). It is the site-admin flag (nav checkmark + `/admin/`).
- Votes bind via `voter_key` (same UUID family as anonymous `bpb-voter-id`)

## Schema

SQL: [`docs/db/sql/013_profiles.sql`](../sql/013_profiles.sql)  
Premium / founding: [`docs/db/sql/014_profiles_premium.sql`](../sql/014_profiles_premium.sql)  
Equipped look: [`docs/db/sql/017_profiles_equipped_avatar.sql`](../sql/017_profiles_equipped_avatar.sql)  
Cosmetic grants: [`docs/db/sql/021_profiles_cosmetic_grants.sql`](../sql/021_profiles_cosmetic_grants.sql)  
Coins: [`docs/db/sql/022_profiles_coins.sql`](../sql/022_profiles_coins.sql)

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  display_name text,
  avatar_url text,
  equipped_avatar text,                         -- public sim look; NULL/'discord' → avatar_url
  cosmetic_grants jsonb not null default '[]',  -- event / manual cosmetic ids
  coins integer not null default 0,             -- soft currency; not client-writable
  is_owner boolean not null default false,
  voter_key uuid unique,
  plan text not null default 'free',
  founding_slot smallint,
  premium_until timestamptz,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

| Column | Purpose |
|---|---|
| `id` | Auth user UUID |
| `discord_id` | Discord snowflake for `/u/{discord_id}/` |
| `display_name` | Synced from Discord persona |
| `avatar_url` | Synced Discord avatar URL |
| `equipped_avatar` | Public look (`NULL` / `discord` → `avatar_url`; JSON v1 loadout with `base`: `discord` \| `blob` + cosmetic slots). Not overwritten by Discord sync. |
| `cosmetic_grants` | JSON array of blob cosmetic ids (e.g. event winners). Public read; not client-writable. |
| `coins` | Soft currency balance for future cosmetic buy/sell. Public read; not client-writable (`≥ 0`). |
| `is_owner` | Site admin: `/admin/` + nav checkmark; also client Premium bypass. Self-only. |
| `voter_key` | Bound anon vote key (merge on first sign-in). Self-only. |
| `plan` | `free` \| `founding` \| `premium` |
| `founding_slot` | 1–10 when `plan = founding` |
| `premium_until` | Stripe subscription end. Self-only. |
| `stripe_customer_id` | Stripe Customer id (webhook). Server-only. |

## Triggers / RPC

| Name | Role |
|---|---|
| `handle_new_user` | After `auth.users` insert (Discord) → upsert profile from metadata |
| `profiles_protect_owner` | Before update → freeze identity + plan/founding/Stripe/`cosmetic_grants`/`coins` |
| `bind_my_voter_key(uuid)` | Authenticated: bind/merge local `bpb-voter-id` |
| `claim_founding_slot()` | Authenticated: auto-grant founding if promo started + slot open |
| `get_founding_status()` | Public: `{ used, total: 10, started, open }` |
| `founding_promo` | Single-row gate (`started_at`); SQL [`016_founding_promo_start.sql`](../sql/016_founding_promo_start.sql) |

## RLS

- **SELECT** — public
- **UPDATE** — own row only (`is_owner` protected by trigger)
- **INSERT / DELETE** — service role / trigger only

## Builds link

```sql
alter table public.builds
  add constraint builds_author_id_fkey
  foreign key (author_id) references public.profiles (id)
  on delete set null;
```

Submit sets `author_id` + snapshot `author_name` from profile at publish time.

## Owner bootstrap

After your first Discord login:

```sql
update public.profiles
set is_owner = true
where discord_id = 'YOUR_DISCORD_SNOWFLAKE';
```

Keep `BPB_SUBMIT_SECRET` as admin/submit break-glass.

### Manual coin grant (owner / SQL editor)

Clients cannot change `coins`. Service role / SQL only until marketplace RPCs exist:

```sql
update public.profiles
set coins = coins + 100
where discord_id = 'DISCORD_SNOWFLAKE';
```

Apply migration: `node scripts/_apply-profiles-coins.mjs` ([`022_profiles_coins.sql`](../sql/022_profiles_coins.sql)).

## Related

- [`docs/pages/auth.md`](../../pages/auth.md)
- [`docs/pages/votes.md`](../../pages/votes.md)
