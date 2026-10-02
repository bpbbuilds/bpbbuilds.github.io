# Discord Auth (v1)

Supabase Auth with **Discord only**. No email/password website register. Steam may **link while signed in** later (not a second signup).

## What unlocks

| Surface | Rule |
|---|---|
| `/create/` draft | Anonymous OK |
| **Submit** | Requires Discord session (OAuth if missing) |
| **Create Play → sim** | Premium (`founding` / `premium` / `is_owner`); sign-in → auto founding if slot open |
| Votes | Anon `bpb-voter-id`; bound to `profiles.voter_key` on first sign-in |
| My builds | Catalog filter when signed in (`author_id = me`) |
| Profile | `/u/{discord_id}/` — live `display_name` / `avatar_url` |
| Admin | Prefer `profiles.is_owner` JWT; `BPB_SUBMIT_SECRET` break-glass |

## Profile URL

- Canonical (static hosts): `/u/?d={discord_id}` — works on Live Server + GitHub Pages
- Pretty path `/u/{discord_id}/` still works on Pages via `404.html` → `?d=` (Live Server does not)
- Bylines snapshot `author_name` at submit; profile page shows live persona
- Helper: [`js/shared/profile-href.js`](../../js/shared/profile-href.js)

## Schema

- SQL: [`docs/db/sql/013_profiles.sql`](../db/sql/013_profiles.sql)
- Premium / founding: [`docs/db/sql/014_profiles_premium.sql`](../db/sql/014_profiles_premium.sql) — apply after 013
- Detail: [`docs/db/tables/profiles-table.md`](../db/tables/profiles-table.md)
- RPC `bind_my_voter_key(uuid)` merges/binds anon votes
- RPC `claim_founding_slot()` — first eligible sign-ins get `plan = founding` (slots 1–50)
- RPC `get_founding_status()` — public `{ used, total, open }` for nav

## Premium (client)

- [`js/shared/entitlements.js`](../../js/shared/entitlements.js) — `hasPremiumAccess`, `getFoundingStatus`
- [`js/shared/premium-offer.js`](../../js/shared/premium-offer.js) — reusable offer panel
- [`js/shared/premium-gate.js`](../../js/shared/premium-gate.js) — `requirePremium`, OAuth resume intent
- Founding auto-grant runs in [`js/shared/auth.js`](../../js/shared/auth.js) after sign-in

### Owner bootstrap

After your first Discord login:

```sql
update public.profiles
set is_owner = true
where discord_id = 'YOUR_DISCORD_SNOWFLAKE';
```

## Dashboard (manual)

1. Authentication → Providers → enable **Discord** (Client ID / Secret from Discord Developer Portal)
2. URL Configuration: set **Site URL** to `https://bpbbuilds.github.io/`. Allow these redirect URLs:
   `https://bpbbuilds.github.io/**`, `http://127.0.0.1:5500/**`, and
   `http://localhost:5500/**`. The live site returns to the page where sign-in began; the local
   entries are only for Live Server development.
3. Apply `013_profiles.sql`
4. Deploy Edge Functions: `submit-build`, `vote-build`, `admin-builds`, `admin-reports`, `site-access` (`verify_jwt = false`; functions validate JWT themselves)

## Private launch access

- The site defaults to **Live** (public). An owner can switch Live / Private from the Admin Overview;
  that server-managed setting takes effect for visitors when they next load a page. The generated
  `siteAccessMode` is only the fallback for a local setup without the `site-access` endpoint.
- Apply `028_site_access.sql` and deploy `site-access` before using the Overview switch.
- The shared access gate calls `discord-guild` with the signed-in user JWT. It blocks the app with a
  sign-in panel, then a member-only panel with the Discord invite and a recheck button. A failed
  membership check is denied rather than treated as access.
- GitHub Pages is static public hosting: this is an application/UI access gate, not a way to make
  files or already-public URLs secret. Protect non-public data with Supabase RLS or private Storage.

## Client

- [`js/shared/auth.js`](../../js/shared/auth.js) — `signInWithDiscord`, `signOut`, `getSession`, `getProfile`, `refreshProfile`, `onAuthChange`, voter bind
- Nav: Sign in / avatar → profile + Sign out (community Discord invite stays separate)
- Create publish: Bearer user JWT ([`js/pages/create/publish.js`](../../js/pages/create/publish.js))

## Edge

| Function | Auth |
|---|---|
| `submit-build` | Bearer JWT → set `author_id` + `author_name` from profile; or `x-bpb-submit-secret` break-glass |
| `vote-build` | Optional Bearer → `profiles.voter_key`; else body `voter_key` |
| `admin-builds` | Owner JWT (`is_owner`) or submit secret |
| `admin-reports` | Same as `admin-builds` — list / stats / update `sim_reports` |

`site-access` exposes a public GET for the current mode and accepts a Live / Private update only from an owner JWT.

## Out of scope (v1)

Steam link UI, email/password, comments, Stripe checkout UI, Discord bot, client RLS writes for publish.  
Premium **offer panel + founding RPC + create Play gate** ship first; Stripe + sim hard gate follow [`launch-phase-1.md`](../product/launch-phase-1.md).
