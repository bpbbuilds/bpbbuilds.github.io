# Create → Submit publish

Discord session required at Submit (drafting stays anonymous). The browser never inserts into `builds` / `build_placements` with the anon key. See [`docs/pages/auth.md`](auth.md).

## Flow

1. `/create/` validates the draft (title, playable class, **starting bag**, tag, rank, board with ≥1 item, R3, R10, YouTube).
2. If not signed in, Discord OAuth; then paint a catalog board still, upload to Storage bucket `board-stills`, and `POST` to Edge Function `submit-build` with `Authorization: Bearer <access JWT>` (optional `board_still_path` in the body).
3. Function inserts `builds` + `build_placements` with the **service role**, setting `author_id` / `author_name` from `profiles` (and `board_still_path` when valid).
4. Break-glass: `x-bpb-submit-secret` still accepted (owner tooling).
5. If the draft has attached `history` (from History Load), the function also stores `builds.history` and writes `build_placements` from the **last round** of that run.
6. Browser redirects to `/builds/view/?slug={slug}/`.

**Request OP:** the create tag is labeled **Request OP**; when on, Submit reads **Submit for OP review**. Payload still sends `is_op: true`; the Edge Function sets `op_requested` and keeps public `is_op` false until admin approve. The build page shows **OP pending** while waiting.

**OP review requirements (client + `submit-build`):** at least one board item in each essentials tier (**Needs** / **Wants** / **Good to have**), and a trimmed **Why it works** note of **≥ 30** characters. Request OP still cannot pair with Theory.

## Remix preload

Feed / build-page **Remix** links to `/create/?remix={slug}`. Create fetches that public build and replaces the local draft with board placements + meta (class, starting bag, rank, tag, R3/R10, gold, essentials). Title becomes `Remix of …`; OP and YouTube are cleared. If the local draft already has work, the user confirms before overwrite.

## Schema

Run these in the Supabase SQL editor (in order if not already applied):

- [`docs/db/sql/008_build_submit.sql`](../db/sql/008_build_submit.sql) — `build_tag`, `op_requested`
- [`docs/db/sql/009_starting_bag.sql`](../db/sql/009_starting_bag.sql) — `starting_bag_id` (class loadout; may be sold off-board)
- [`docs/db/sql/010_build_history.sql`](../db/sql/010_build_history.sql) — `history` jsonb (optional run rounds for scrubber)
- [`docs/db/sql/011_build_authenticity_tags.sql`](../db/sql/011_build_authenticity_tags.sql) — `build_tag`: `theory` | `feasible` | `real`
- [`docs/db/sql/013_profiles.sql`](../db/sql/013_profiles.sql) — Discord `profiles` + `builds.author_id` FK
- [`docs/db/sql/015_drop_route_amulet.sql`](../db/sql/015_drop_route_amulet.sql) — drops unused `route_amulet_item_id` (`node scripts/_apply-drop-route-amulet.mjs`)
- [`docs/db/sql/020_builds_board_still_path.sql`](../db/sql/020_builds_board_still_path.sql) — `board_still_path` + public Storage bucket `board-stills` (catalog thumbs)

Notes:

- `builds.build_tag` — exclusive authenticity: `theory` | `feasible` | `real` | null. Attached history forces `real` on submit; clearing history drops `real` → `feasible`. Request OP cannot pair with Theory.
- `builds.op_requested` — true when submit requests OP; public `is_op` stays **false** until you approve in the dashboard
- `builds.starting_bag_id` — required on new submits; FK to `items.id`
- `builds.history` — optional `{ runId, rounds: [{ round, result, placements }] }`; null when the draft has no attached History Load (or the board was edited after Load, which clears history)
- `builds.board_still_path` — Storage object in bucket `board-stills` (`{author_id}/{uuid}.webp`). Catalogs prefer this URL; null → client canvas. See [`docs/features/board-stills.md`](../features/board-stills.md).
- Catalog filter URL: `?tags=theory` (legacy `theorycraft` aliases to Theory)
- Class access (loose) — hard-reject wrong-class Class Uniques and skills; other-class shop items allowed (badge sold OK). See [`create-item-access.md`](create-item-access.md)

### History payload (optional)

```json
{
  "history": {
    "runId": 3709,
    "rounds": [
      {
        "round": 1,
        "result": "win",
        "placements": [{ "id": "leather_bag", "x": 7, "y": 4, "r": 0 }]
      }
    ]
  }
}
```

Caps: max 40 rounds; reject oversized JSON. Unknown catalog ids inside history rounds are soft-skipped; the final board (`placements` / last round) must still resolve.

## Deploy the function

```bash
# From repo root — CLI must be logged into the account that owns the BPB project
supabase login
supabase functions deploy submit-build --project-ref xklkysmakrmgtiztsqug --no-verify-jwt --use-api
supabase secrets set BPB_SUBMIT_SECRET="your-long-random-secret" --project-ref xklkysmakrmgtiztsqug
```

Redeploy after changes in `submit-build/index.ts` (authenticity tags; Request OP → `op_requested`).

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically in the function runtime.

## Local browser config

`node scripts/write-config.mjs` writes `js/shared/config.js` (gitignored) from `.env`:

| `.env` | `config.js` |
|---|---|
| `SUPABASE_PROJECT_URL` | `supabaseUrl` |
| `SUPABASE_PUBLISHABLE_KEY` | `supabasePublishableKey` |
| `BPB_SUBMIT_SECRET` | `submitSecret` (optional; required to publish) |
| _(derived)_ | `submitBuildUrl` = `{SUPABASE_PROJECT_URL}/functions/v1/submit-build` |

Never commit real secrets. `config.example.js` only has placeholders.

## Approve OP later

Use **`/admin/`** (owner unlock with `BPB_SUBMIT_SECRET`) to approve/deny `op_requested`, toggle `is_featured`, or soft-hide builds. See [`docs/pages/admin.md`](admin.md).

(Alternatively: Supabase Table Editor on `builds` — set `is_op = true` / `is_featured` by hand.)
