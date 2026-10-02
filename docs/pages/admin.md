# Admin portal

Owner-only area. Signed-in owners (`profiles.is_owner`) get a gold checkmark in the public nav that opens **`/admin/`**. The portal is a **single hub** (like `/u/`): left rail swaps Overview / Analytics / Members / Sim reports / Builds / Events / Cosmetics / Blob cast / Marketplace without a full page reload (`?tab=`). `BPB_SUBMIT_SECRET` is break-glass. See [`docs/pages/auth.md`](auth.md).

The checkmark is a door into the portal, not a flyout — admin work stays on `/admin/` so the public site nav stays clean.

## Who is an admin

Reuse **`profiles.is_owner`** — not a second role column. It is frozen on client updates (trigger). Bootstrap after your Discord login:

```sql
update public.profiles
set is_owner = true
where discord_id = 'YOUR_DISCORD_SNOWFLAKE';
```

Grant another trusted Discord the same way if you ever need a second admin. The nav checkmark only appears for those rows.

## Pages

| URL | Job |
|---|---|
| `/admin/` | Hub — Overview tab (default). Counts (open reports, pending OP, featured, hidden, founding). Premium member count opens the Members tab (owner sign-in). |
| `/admin/?tab=analytics` | Page visits for the last 30 days (today, 7 days, 30 days). Owner Discord sign-in only. |
| `/admin/?tab=members` | Accounts, paid Premium, founding, and monthly revenue ($3 × paid Premium) for the last 30 days. Owner Discord sign-in only. |
| `/admin/?tab=reports` | Sim issue queue — KPI counts, compact expandable rows, Patch3 filter rail (search / date / class / opponent) |
| `/admin/?tab=builds` | Pending OP + Builds list with right **filter rail** (search / All·Featured·Hidden / character) |
| `/admin/?tab=events` | Create / edit community contests in one shared form (DPS Stone knobs). A row opens the event desk: submitted builds and a history.db of those runs for judging in the game. That file adds a high-health bomb dummy as the top run. A save applies on `/events/` in that browser tab. The catalog file is still the default after the tab closes. |
| `/admin/?tab=cosmetics` | Review player cosmetic submissions + upload official blob art. The right rail filters the live catalog by search, slot, rarity, and grant. |
| `/admin/?tab=overlay` | Blob cast studio. Middle is a preview of `/overlay/blobs/` plus the browser-source link. The right panel switches Row, Low, Pop, Walk, Grid, and Float. The copied link omits the preview flag so OBS stays transparent. |
| `/admin/?tab=marketplace` | Cosmetics marketplace moderation — coming soon stub |

Legacy `/admin/reports/` and `/admin/builds/` redirect into the hub tabs.

Build writes go through Edge Function `admin-builds`. Report list / stats / status go through `admin-reports` (`action: stats` returns total, open, fixed, wontfix, today UTC, last 30d, oldest open). Anon clients cannot read `sim_reports` (RLS on, no public policies).

Report KPIs: Open, Total, and Resolved tiles also filter the list. Today / Last 30 days / Oldest open are counts only. Won’t-fix stays in the tabs.

The queue is a line list under the KPIs, with a **builds-style filter rail** on the right (search, status, date, character, opponent, reporter). Click a row to expand. Resolved rows are muted with a struck snippet. List payloads include `reporter_avatar_url` and `you_hero_class` (from the report session or the linked build).

List responses for builds include placements so admin can preview boards without relying on public RLS (hidden builds included).

### Build search (shared)

Admin Builds, `/builds/`, and the sim public-build picker share the same filter search (`js/shared/build-search.js`):

| Token | Matches |
|---|---|
| Free text | Title, slug, author, hero class, item names on the board |
| `@user` | Author display name (case-insensitive) |
| `[Item]` | Build must contain that item (chip + autocomplete; also `[[item_id]]` from chips) |

Tokens AND together. Admin **List** (All / Featured / Hidden) still hits `admin-builds`; search and character filter client-side on the returned rows. Reports search is separate (status / reporter text).

## Deploy

```bash
# From repo root (CLI logged in + linked)
supabase functions deploy admin-builds
supabase functions deploy admin-reports
# BPB_SUBMIT_SECRET should already be set for submit-build
```

`verify_jwt = false` — functions check owner JWT or secret header — see `supabase/config.toml`.

## Local browser config

`node scripts/write-config.mjs` writes `js/shared/config.js`:

| Field | Source |
|---|---|
| `adminBuildsUrl` | `{SUPABASE_PROJECT_URL}/functions/v1/admin-builds` |
| `adminReportsUrl` | `{SUPABASE_PROJECT_URL}/functions/v1/admin-reports` |
| `submitSecret` | `BPB_SUBMIT_SECRET` (break-glass unlock) |

Never commit real secrets.

## Related

- Create publish: [`docs/pages/create-submit.md`](create-submit.md)
- Schema flags: [`docs/db/tables/builds-table.md`](../db/tables/builds-table.md)
- Reports table: [`docs/db/tables/sim-reports-table.md`](../db/tables/sim-reports-table.md)
