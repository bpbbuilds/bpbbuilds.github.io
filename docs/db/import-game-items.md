# Import items from the game (authoritative stats)

**Game files are the source of truth** for combat stats, gids, shapes, sockets, descriptions, craft recipes, and **display titles**. Wiki Cargo was an early bootstrap and should not win over ItemData + translations when they disagree.

Display titles come from PHash `Name_NAME` (e.g. ItemData key `Greatsword` → UI name “Impractically Large Greatsword”). ItemData `name` stays the internal key for recipes/DESCR.

## Prerequisites

- Steam install of **Backpack Battles**
- [GDRE Tools](https://github.com/GDRETools/gdsdecomp) in `tools/gdre/` (gitignored)
- Python deps for key dump: `pip install frida pycryptodome`
- `.env`: `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`

## Encryption notes

Godot script encryption is AES-256-ECB (`GDEC`). Backpack Battles **mutates two bytes** of the baked-in key at runtime (indexes **5** and **12**). Static extractors (KeyDot) find the wrong key; dump the live key instead:

```bash
python tools/keydot/dump_live_keys.py
```

Writes (gitignored):

- `tools/keydot/live_key.txt` — script / `.gde` key
- `tools/keydot/sheet_key.txt` — `ItemData_e.csv` key (mutated `0..31`)

Never commit these files.

## Full recover

```bash
# after live_key.txt exists:
tools/gdre/gdre_tools.exe --headless --key=<LIVE_KEY_HEX> --recover="C:/Program Files (x86)/Steam/steamapps/common/Backpack Battles/BackpackBattles.pck" --output="tools/game-extract-full"
```

Expect ~815 decompiled scripts, including `Items/*.gd` and `Sheets/ItemBook.gd`.

## Import pipeline

```bash
node scripts/decrypt-itemdata.mjs      # ItemData_e.csv → scripts/_cache/ItemData.csv
node scripts/extract-game-shapes.mjs   # .tscn CollisionMap → game-shapes.json
node scripts/extract-game-sprites.mjs  # potions: BPB CDN stills; other items: composite-bake → assets/item-sprites
node scripts/extract-game-items.mjs    # ItemData + shapes + display names + sprites → game-items.json
node scripts/extract-game-recipes.mjs  # craft recipes → game-recipes.json
node scripts/compute-library-layout.mjs # Item Library order+placements → assets/data/library-layout.json
npm run sprite-display                 # Icon.scale × texture → assets/data/sprite-display.json
npm run sprite-thumbs                  # catalog WebP thumbs (needs sprite-display) → assets/item-thumbs/{1x,2x}
node scripts/import-game-items.mjs     # upsert Supabase items (+ 003_items_combat.sql)
node scripts/cleanup-catalog-from-game.mjs  # apply display names/images; delete wiki alias rows

# Descriptions (PHash translations → items.effect)
# Convert binary .translation → text once (output must be a directory):
tools/gdre/gdre_tools.exe --headless --bin-to-txt="tools/game-extract-full/Sheets/CSV/Items.en.translation" --output="scripts/_cache/transl_tmp/Items"
tools/gdre/gdre_tools.exe --headless --bin-to-txt="tools/game-extract-full/Sheets/CSV/Full.en.translation" --output="scripts/_cache/transl_tmp/Full"
tools/gdre/gdre_tools.exe --headless --bin-to-txt="tools/game-extract-full/Sheets/CSV/ExclusiveItems.en.translation" --output="scripts/_cache/transl_tmp/ExclusiveItems"

node scripts/extract-game-descr.mjs    # → game-descr.json (513+ effects typical)
node scripts/import-game-descr.mjs     # upsert items.effect (game DESCR wins)

# Craft recipes → combinations
node scripts/extract-game-recipes.mjs  # → game-recipes.json (owner + left → result)
node scripts/import-game-combinations.mjs  # wipe+reimport (+ 004_combinations.sql)
```

Schema additions:

- `docs/db/sql/003_items_combat.sql` — combat columns on `items`
- `docs/db/sql/004_combinations.sql` — `combinations` + `combination_ingredients`

## What maps where

| Game (`ItemData`) | DB column |
|---|---|
| `id` | `gid` |
| `name` | `name` (+ slug `id`) |
| `price` | `cost` |
| `minDam` / `maxDam` | `damage_min` / `damage_max` |
| `cd` | `cooldown` |
| `staminaCost` | `stamina_cost` |
| `accuracy` | `accuracy` |
| `extraTypes` | `extra_types` |
| `shop` | `class` (parsed) |
| `p1`…`p10` (`25:poisont`) | `params` jsonb |
| `chance` (`65:crit`) | `chance` + `chance_tag` |
| CollisionMap / gem sockets | `shape` / `sockets` (inherits parent `.tscn` when omitted; bags use tile `BagSpace`) |
| `Name_DESCR` (PHash) | `effect` (via `gameTemplateToPlain`) |
| `recipes` (`A>Result`) | `combinations` / `combination_ingredients` |

### Recipe grammar

Row owner = **base ingredient**. `A[+B]>Result` → ingredients `[owner, A, B…]`, result = right of `>`.

Example: Death Scythe row `Whetstone>War Scythe` → **Death Scythe + Whetstone → War Scythe**.

### Gem DESCR

`Chipped Ruby`…`Perfect Ruby` share `Ruby_DESCR` (same for Sapphire / Emerald / Topaz / Amethyst), resolved with that tier’s `params`.

### Tooltip combat UI

Catalog maps combat fields; `js/shared/tooltip.js` renders a stats block (damage, cooldown, stamina, accuracy, chance, block) after the title and before the effect.

## Display names vs internal keys

| Layer | Example |
|---|---|
| ItemData `name` (internal) | `Greatsword`, `Vampiric Scythe`, `Long Spear` |
| Translation `Name_NAME` (UI) | Impractically Large Greatsword, Blood Harvester, Very Long Spear |
| Site `items.id` | slug of **internal** name (`greatsword`) — stable |
| Site `items.name` | **display** name from translations |

## Still open

- A few items with empty / missing DESCR keys (often placeholder ItemData rows)
- Type-token recipes (e.g. ingredient `Food`) need special handling — skipped until modeled
- Remaining wiki-only rows (generic gem pages, etc.) after `cleanup-catalog-from-game.mjs`
- Catalog thumbs: `build-sprite-thumbs.mjs` downscales each sprite to its real Itemiary footprint (`sprite-display.json` `w`/`h` cells × 68px for 1x, × 136px for 2x) and writes WebP + `assets/data/sprite-thumbs.json`. Re-run after new sprites land; `--force` rebuilds, `--quality=N` overrides q90. Live-art items stay on PNG at runtime (glow/liquid plates measure `naturalWidth` against Godot-space offsets).
- Item sprites: `extract-game-sprites.mjs` writes `{SceneStem}.png`. **Potions** (BottleOfBooze / `potionColor`) pull finished stills from the BPB CDN (`awerc.github.io/bpb-cdn/i/*.webp`), cache under `scripts/_cache/bpb-cdn/`, and convert to PNG — same idea as BPB Builds. Other layered items (Ruby Chonk, Con-Trap-Tron, …) are still **composite-baked** from the Icon tree. Set `BPB_CDN_SPRITES=0` for offline (cache / local wiki only). Requires `@napi-rs/canvas`.
- DESCR converter: `$bl` = block number, `$block` = Block icon; `$cd1s`…`$cd5s` from multi-cooldown lists; script `const params` (Laboratory) merges into `params` jsonb.

## Local folders (gitignored)

```text
tools/gdre/
tools/keydot/           # keys + dump_live_keys.py
tools/game-extract-full/
scripts/_cache/ItemData.csv
scripts/_cache/game-items.json
scripts/_cache/game-descr.json
scripts/_cache/game-recipes.json
scripts/_cache/transl_tmp/
```
