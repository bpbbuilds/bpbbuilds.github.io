# Profiles table

Discord-linked site users (Supabase Auth). One row per `auth.users` id.

## Principles

- `id` = `auth.users.id` (cascade delete)
- Public profile URL uses **`discord_id`** (`/u/{discord_id}/`) — stable across display-name changes
- `is_owner` is **not** client-writable (trigger + service-role bootstrap)
- Votes bind via `voter_key` (same UUID family as anonymous `bpb-voter-id`)

## Schema

SQL: [`docs/db/sql/013_profiles.sql`](../sql/013_profiles.sql)  
Premium / founding: [`docs/db/sql/014_profiles_premium.sql`](../sql/014_profiles_premium.sql)

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  display_name text,
  avatar_url text,
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
| `is_owner` | Admin + client Premium bypass |
| `voter_key` | Bound anon vote key (merge on first sign-in) |
| `plan` | `free` \| `founding` \| `premium` |
| `founding_slot` | 1–50 when `plan = founding` |
| `premium_until` | Stripe subscription end |
| `stripe_customer_id` | Stripe Customer id (webhook) |

## Triggers / RPC

| Name | Role |
|---|---|
| `handle_new_user` | After `auth.users` insert (Discord) → upsert profile from metadata |
| `profiles_protect_owner` | Before update → freeze identity + plan/founding/Stripe fields |
| `bind_my_voter_key(uuid)` | Authenticated: bind/merge local `bpb-voter-id` |
| `claim_founding_slot()` | Authenticated: auto-grant founding if slot open |
| `get_founding_status()` | Public: `{ used, total: 50, open }` |

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

## Related

- [`docs/auth.md`](../../auth.md)
- [`docs/votes.md`](../../votes.md)
