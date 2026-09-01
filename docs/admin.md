# Admin — OP / featured / hide

Owner-only curation UI at `/admin/` (not in public nav). Prefers Discord owner JWT (`profiles.is_owner`); `BPB_SUBMIT_SECRET` is break-glass. See [`docs/auth.md`](auth.md).

## Flow

1. Open `/admin/` signed in as owner (or unlock with the submit secret in `sessionStorage`).
2. **Pending OP** — review the board thumb (or **View build**), then approve (`is_op = true`, clear `op_requested`) or deny (clear `op_requested` only).
3. **Builds** tabs — All / Featured / Hidden:
   - Each row shows a compact board + **View build** (opens the guide)
   - Feature / Unfeature → homepage carousel (`is_featured`)
   - Hide → soft delete (`is_public = false`)
   - Restore → `is_public = true`

Writes go through Edge Function `admin-builds` (service role). Anon clients cannot update builds.

List responses include placements so admin can preview boards without relying on public RLS (hidden builds included).

## Deploy

```bash
# From repo root (CLI logged in + linked)
supabase functions deploy admin-builds
# BPB_SUBMIT_SECRET should already be set for submit-build
```

`verify_jwt = false` — function checks owner JWT or secret header — see `supabase/config.toml`.

## Local browser config

`node scripts/write-config.mjs` writes `js/shared/config.js`:

| Field | Source |
|---|---|
| `adminBuildsUrl` | `{SUPABASE_PROJECT_URL}/functions/v1/admin-builds` |
| `submitSecret` | `BPB_SUBMIT_SECRET` (break-glass unlock) |

Never commit real secrets.

## Related

- Create publish: [`docs/create-submit.md`](create-submit.md)
- Schema flags: [`docs/db/tables/builds-table.md`](db/tables/builds-table.md)
