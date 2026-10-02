# Create — item access (loose class rules)

Create edits a **final board**, not a full shop / run history. Class badges and other unlockers can be **sold** while keeping items bought while they were held. We do **not** reconstruct unlocker ownership.

Shared helper: [`js/shared/item-access.js`](../../js/shared/item-access.js) (`accessVerdict`).

## Verdicts

| Verdict | When | Create behavior |
|---|---|---|
| `ok` | Neutral mask, or mask includes hero | Allow |
| `illegal-class-unique` | Unique rarity, not treasure, wrong class | Hard block (catalog drag / submit) |
| `illegal-skill` | `type === Skill`, wrong class | Hard block (route slots / submit) |
| `soft-cross-class` | Other-class non-unique (shop / crafted / etc.) | Allow; soft warn on Build tab |

Treasure Uniques use `item.isTreasure` / [`assets/data/item-origins.json`](../../assets/data/item-origins.json) `treasure` (includes class badges). Class affinity uses [`assets/data/item-class-masks.json`](../../assets/data/item-class-masks.json) when loaded.

## Examples

- Reaper + `bowl_of_treats` (Ranger Class Unique) → **illegal**
- Reaper + `acorn_collar` after selling `leaf_badge` → **allowed** (soft warn)
- Any hero + Neutral / own-class → **ok**

## Out of scope (v1)

- Tracking whether a badge / gated unlocker was ever held
- Requiring unlockers to remain on the board
- `storage_coffin` lockouts, temporary next-shop crafts, full `gateItem` graphs

## Wired surfaces

- Catalog → board: [`drag-pointers.js`](../../js/pages/create/drag-pointers.js) refuses hard-illegal picks
- Route skills: [`meta-drops.js`](../../js/pages/create/meta-drops.js)
- Local validate: [`submit-validate.js`](../../js/pages/create/submit-validate.js)
- Edge Function: [`supabase/functions/submit-build`](../supabase/functions/submit-build/index.ts) (hard checks only)
