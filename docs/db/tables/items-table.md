# Items table setup (Supabase)

How to create and fill the `items` table so the site can load item data into `ItemTooltip.render(item)`.

This is the **core catalog table**. Combinations, builds, and placements all reference it.

## Principles

- Store **data**, not finished HTML. The tooltip module formats `effect` text (icons, gold numbers, glossary).
- One row per item. Builds store placements only (`item_id` / `gid` + grid position); they join back here.
- Do **not** store craft recipes on this table — use `combinations` / `combination_ingredients`.
- Keep column names close to what the frontend already expects (`name`, `rarity`, `type`, `class`, `extraTypes`, `cost`, `effect`).

## Relationships

```text
items
  ◄── build_placements.item_id
  ◄── combinations.result_item_id
  ◄── combination_ingredients.item_id
  ◄── build_placements.gems[]  (gem item ids)
```

| Related table | How it uses `items` |
|---|---|
| `build_placements` | Which item is on the grid (+ socketed gems) |
| `combinations` | Recipe result |
| `combination_ingredients` | Recipe inputs |

## 1. Env values

From `.env` (Project Settings → API):

```env
SUPABASE_PROJECT_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

## 2. Create the `items` table

In the SQL editor, run:

```sql
create type item_rarity as enum (
  'Common',
  'Rare',
  'Epic',
  'Legendary',
  'Godly',
  'Unique'
);

create table public.items (
  id text primary key,                    -- stable slug, e.g. blood_goobert
  gid integer unique,                     -- optional game id for build imports
  name text not null,
  rarity item_rarity not null,
  type text not null,                     -- Pet, Weapon, Gem, etc.
  class text not null default 'Neutral',  -- Neutral, Pyromancer, etc.
  extra_types text[] not null default '{}', -- e.g. {Vampiric}
  cost integer not null check (cost >= 0),
  effect text not null,                   -- tagged plain text (see below)
  image text,                             -- filename or storage path
  shape jsonb,                            -- backpack footprint when needed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_rarity_idx on public.items (rarity);
create index items_type_idx on public.items (type);
create index items_name_idx on public.items (name);
```

### Column notes

| Column | Purpose |
|---|---|
| `id` | Primary key used by the site (`blood_goobert`). |
| `gid` | Optional numeric id if you import builds that use game ids. |
| `type` | Includes things like Pet, Weapon, **Gem** — gems are items too. |
| `extra_types` | Postgres array → maps to frontend `extraTypes`. |
| `effect` | Plain text with tags like `<Vampirism>`, `<Star>`, `<Effect>`. Use blank lines between ability blocks. |
| `image` | Sprite filename in Storage/CDN, not a full HTML snippet. |
| `shape` | Optional grid matrix for backpack placement UI (see below). |
| `sockets` | Optional gem socket count (from game `.tscn`). Pixel positions for catalog hover live in `assets/data/socket-offsets.json` (regenerate via `extract-game-shapes.mjs`). |
| `gid` | Numeric game id from `ItemData.csv` (`id` column). |
| `accuracy` / `cooldown` / `stamina_cost` | Combat stats from game ItemData. |
| `damage_min` / `damage_max` | Weapon (and similar) damage range. |
| `chance` / `chance_tag` | e.g. `65` + `crit` from `65:crit`. |
| `params` | Named numeric params (`25:poisont` → `{"poisont":25}`). |

Combat columns: `docs/db/sql/003_items_combat.sql`. Import: `docs/db/import-game-items.md`.

### Shape matrix format

`shape` is a 2D jsonb array of integers (game CollisionMap / wiki Cargo / BPB Builds):

| Value | Meaning |
|---|---|
| `0` | Empty (padding) |
| `1` | Body cell (occupies backpack space; used for packing collision) |
| `2` | Star / Affected adjacency (ignored by catalog packer) |
| `3` | Diamond / Affected2 adjacency (ignored by catalog packer) |
| `4` | Extension affect tile (ignored by catalog packer) |
| `5` | Tertiary affect tile (ignored by catalog packer) |
| `6` | Lightning affect tile (ignored by catalog packer) |

**Preferred source:** game `.tscn` CollisionMap via `scripts/extract-game-shapes.mjs`. Catalog also loads `assets/data/item-shapes.json` as authoritative hover shapes.

Example — Death Scythe (from game):

```json
[[1,1,1],[1,2,2],[1,2,2],[1,2,2]]
```

Import: `node scripts/import-game-shapes.mjs` (or wiki fallback `import-item-shapes.mjs`)

### Effect text format

Same format the tooltip already uses:

```text
Start of battle: Gain 5 <Vampirism>.

6 <Star> item activations: Deal 10 <Effect> with 100% lifesteal. Deal +1 for each <Vampirism>.
```

- `<IconName>` → icon image
- Numbers / `+n` / `n%` → gold styling
- Leading `Label:` on a line → cream label color
- Keywords like `Vampirism` can drive the glossary footer in the tooltip

Do **not** store pre-built HTML in `effect`.

## 3. Frontend field mapping

Supabase returns `snake_case` columns. Map them before calling the tooltip:

```js
function mapItem(row) {
  return {
    id: row.id,
    gid: row.gid,
    name: row.name,
    rarity: row.rarity,
    type: row.type,
    class: row.class,
    extraTypes: row.extra_types ?? [],
    cost: row.cost,
    effect: row.effect,
    image: row.image,
    shape: row.shape,
    sockets: row.sockets,
    accuracy: row.accuracy,
    cooldown: row.cooldown,
    staminaCost: row.stamina_cost,
    damageMin: row.damage_min,
    damageMax: row.damage_max,
    chance: row.chance,
    chanceTag: row.chance_tag,
    params: row.params ?? {},
  };
}

const { data, error } = await supabase
  .from('items')
  .select('*')
  .eq('id', 'blood_goobert')
  .single();

if (!error) ItemTooltip.mount('#tooltip-root', mapItem(data));
```

## 4. Row Level Security (RLS)

For a public read-only catalog:

```sql
alter table public.items enable row level security;

create policy "Public read items"
  on public.items
  for select
  to anon, authenticated
  using (true);

-- Writes stay in the dashboard / service role only.
-- Do not grant insert/update/delete to the anon key.
```

## 5. Seed an example row

```sql
insert into public.items (
  id, gid, name, rarity, type, class, extra_types, cost, effect, image
) values (
  'blood_goobert',
  257,
  'Blood Goobert',
  'Legendary',
  'Pet',
  'Neutral',
  array['Vampiric'],
  14,
  E'Start of battle: Gain 5 <Vampirism>.\n\n6 <Star> item activations: Deal 10 <Effect> with 100% lifesteal. Deal +1 for each <Vampirism>.',
  'BloodGoobert.webp'
);
```

## 6. Optional: images in Supabase Storage

1. Create a public bucket, e.g. `item-sprites`.
2. Upload files like `BloodGoobert.webp`.
3. Store only the filename (or relative path) in `items.image`.
4. Build the full URL in code from `SUPABASE_PROJECT_URL`.

Tooltip frame/icon art can stay on a CDN for now; item sprites can move to Storage when ready.

## 7. Suggested workflow

1. Create `items` + RLS.
2. Seed a few items and confirm they render with `ItemTooltip`.
3. Add [combinations](./combinations-table.md) for crafts.
4. Add [builds](./builds-table.md) + [build placements](./build-placements-table.md).
5. Bulk-import the rest of the catalog from JSON/CSV.

## Checklist

- [ ] Supabase project created
- [ ] `.env` has `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY`
- [ ] `items` table created
- [ ] RLS public `SELECT` enabled; no public writes
- [ ] Sample item inserted and loads in the tooltip demo
- [ ] (Optional) Storage bucket for sprites
