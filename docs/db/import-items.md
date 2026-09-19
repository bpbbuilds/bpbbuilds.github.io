# Importing items

## Preferred: game files

**Source of truth** for names (via translations), combat stats, gids, shapes, effects, recipes — see **[import-game-items.md](./import-game-items.md)**. After a game import, run `cleanup-catalog-from-game.mjs` to drop wiki alias duplicates.

```bash
python tools/keydot/dump_live_keys.py          # once per game update
# GDRE recover with live_key → tools/game-extract-full
node scripts/decrypt-itemdata.mjs
node scripts/extract-game-shapes.mjs
node scripts/extract-game-items.mjs
node scripts/import-game-items.mjs
```

## Fallback: wiki Cargo

- **Text:** [backpackbattles.wiki.gg Cargo `Items`](https://backpackbattles.wiki.gg/wiki/Items)
- **Sprites:** local zip → `assets/item-sprites/` (gitignored; ~531 PNGs)

```bash
node scripts/import-items.mjs
```

Requires `.env`: `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`.

Optional: `ITEMS_SPRITES_ZIP=path\to\Items.zip`

Creates/updates `public.items` (see `docs/db/sql/002_items.sql`) and writes match reports under `scripts/_cache/`.

Wiki-only shape fallback:

```bash
node scripts/import-item-shapes.mjs
```

## Frontend image URLs

`items.image` is a filename only (e.g. `Goobert.png`).  
Page builds: `{root}assets/item-sprites/{image}`.

The **Itemiary grid only** swaps in a footprint-sized WebP thumb —
`{root}assets/item-thumbs/{1x|2x}/{stem}.webp` (`npm run sprite-thumbs`). Those
thumbs **are committed** even though the source PNGs stay gitignored, so `/items/`
works on a fresh clone. Spotlight, build boards, drag, and Export PNG keep the
full-res PNG.

Storage migration can replace that later without changing row ids.
