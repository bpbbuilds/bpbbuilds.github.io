# Build placements table setup (Supabase)

How to store each item instance on a build’s backpack grid.

## Principles

- One row = one placed item on one build.
- Store **position + which item**, never copy name/rarity/effect from the catalog.
- Join to `items` for sprites, shapes, and tooltips.
- Depends on `builds` and `items`.

## 1. Create the table

```sql
create table public.build_placements (
  id bigint generated always as identity primary key,
  build_id bigint not null
    references public.builds (id) on delete cascade,
  item_id text not null
    references public.items (id) on delete restrict,
  gid integer,                                  -- optional game id mirror for imports
  x numeric not null,                           -- grid X (supports half-cells if needed)
  y numeric not null,                           -- grid Y
  r integer not null default 0,                 -- rotation (0, 90, 180, 270 — app convention)
  gems text[] not null default '{}',            -- socketed gem item ids (items.id)
  priority text check (priority is null or priority in ('needed', 'nice', 'optional')),
  created_at timestamptz not null default now()
);

create index build_placements_build_id_idx
  on public.build_placements (build_id);

create index build_placements_item_id_idx
  on public.build_placements (item_id);
```

### Column notes

| Column | Purpose |
|---|---|
| `build_id` | Parent build |
| `item_id` | Catalog item (`items.id`) — preferred join key |
| `gid` | Optional numeric game id when importing external build formats |
| `x` / `y` | Position on the backpack grid |
| `r` | Rotation |
| `gems` | Array of gem `items.id` values in sockets (empty if none) |
| `priority` | Essentials tier on the build page: `needed` / `nice` / `optional` (nullable) |
| `instance` | Optional JSON overrides for sim fidelity (`baseCooldown`, `speedScale`, `params`, …). Null = catalog only. See `docs/db/sql/011_placement_instance.sql`. |

### Does not store

- Item display name, rarity, cost, effect, or shape (all from `items`)
- Build title / author (from `builds`)

### Gems note

Gems should also be rows in `items` (e.g. `type = 'Gem'`). `gems` stores their `id`s so you can join for icons/tooltips the same way as the main item.

If you prefer numeric game ids in `gems` during early imports, keep a temporary `gem_gids integer[]` — but standardize on `items.id` for the live site.

## 2. Frontend usage

```js
const { data: placements } = await supabase
  .from('build_placements')
  .select(`
    id,
    x,
    y,
    r,
    gems,
    item:items (
      id,
      gid,
      name,
      rarity,
      type,
      class,
      extra_types,
      cost,
      effect,
      image,
      shape
    )
  `)
  .eq('build_id', buildId)
  .order('id');
```

Render each placement with `item.shape` + `x/y/r`, and pass `item` into `ItemTooltip` on hover.

Resolve gem tooltips:

```js
const { data: gemItems } = await supabase
  .from('items')
  .select('*')
  .in('id', placement.gems);
```

## 3. Row Level Security (RLS)

Placements are readable when their parent build is public:

```sql
alter table public.build_placements enable row level security;

create policy "Public read placements of public builds"
  on public.build_placements
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.builds b
      where b.id = build_id
        and b.is_public = true
    )
  );

-- Writes later: only build owners, via auth policies matching builds
```

## 4. Seed example

Assumes a build id `1` and item `blood_goobert` exist:

```sql
insert into public.build_placements (build_id, item_id, gid, x, y, r, gems)
values
  (1, 'blood_goobert', 257, 4.5, 3.5, 0, '{}');
```

## 5. Suggested workflow

1. Create `builds` (see [builds-table.md](./builds-table.md)).
2. Create `build_placements` + RLS.
3. Seed placements for the demo build.
4. Wire build canvas: placements → item sprites/shapes → tooltip on hover.

## Checklist

- [x] `builds` and `items` exist
- [x] `build_placements` created with FKs
- [x] RLS tied to parent `builds.is_public`
- [x] Demo placements inserted
- [x] Join query returns item data usable by the tooltip
