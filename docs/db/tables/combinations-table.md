# Combinations table setup (Supabase)

How to store item craft recipes so the site can answer:

- “What do I need to make this item?”
- “What can I craft with this item?”

Recipes are **catalog data** (like `items`), not user data. Do not store combination lists only as text on an item row.

## Principles

- One recipe = one result item + one or more ingredient items.
- Ingredients and results are always FKs into `items` — never duplicate names/stats here.
- Prefer a two-table design so you can query both directions cleanly.
- Create `items` first; combinations depend on it.

## Tables

```text
items
  ↑ result_item_id              ↑ item_id
combinations  ←──  combination_ingredients
```

| Table | Purpose |
|---|---|
| `combinations` | One row per recipe (points at the result item) |
| `combination_ingredients` | One row per input item in that recipe |

## 1. Create the tables

```sql
create table public.combinations (
  id bigint generated always as identity primary key,
  result_item_id text not null references public.items (id) on delete cascade,
  notes text,                                 -- optional human note / special rule
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index combinations_result_item_id_idx
  on public.combinations (result_item_id);

create table public.combination_ingredients (
  id bigint generated always as identity primary key,
  combination_id bigint not null
    references public.combinations (id) on delete cascade,
  item_id text not null references public.items (id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  sort_order integer not null default 0,      -- display order in UI
  unique (combination_id, item_id)
);

create index combination_ingredients_item_id_idx
  on public.combination_ingredients (item_id);

create index combination_ingredients_combination_id_idx
  on public.combination_ingredients (combination_id);
```

### Column notes

#### `combinations`

| Column | Purpose |
|---|---|
| `id` | Recipe primary key |
| `result_item_id` | The item this recipe produces (`items.id`) |
| `notes` | Optional free text for odd rules (adjacency, shop-only, etc.) |

One result item may have **multiple** recipes over time (patches / alternate crafts). Keep them as separate `combinations` rows.

#### `combination_ingredients`

| Column | Purpose |
|---|---|
| `combination_id` | Parent recipe |
| `item_id` | Ingredient (`items.id`) |
| `quantity` | How many of that item (usually `1`) |
| `sort_order` | Stable order when listing ingredients |

## 2. Example queries

**Ingredients for a result:**

```sql
select
  c.id as combination_id,
  result.id as result_id,
  result.name as result_name,
  ing.id as ingredient_id,
  ing.name as ingredient_name,
  ci.quantity
from public.combinations c
join public.items result on result.id = c.result_item_id
join public.combination_ingredients ci on ci.combination_id = c.id
join public.items ing on ing.id = ci.item_id
where c.result_item_id = 'blood_goobert'
order by c.id, ci.sort_order;
```

**What can this item craft into?**

```sql
select distinct
  result.id,
  result.name,
  result.rarity
from public.combination_ingredients ci
join public.combinations c on c.id = ci.combination_id
join public.items result on result.id = c.result_item_id
where ci.item_id = 'goobert';
```

## 3. Frontend usage

```js
const { data: recipes } = await supabase
  .from('combinations')
  .select(`
    id,
    notes,
    result:items!result_item_id ( id, name, rarity, image ),
    ingredients:combination_ingredients (
      quantity,
      sort_order,
      item:items ( id, name, rarity, image )
    )
  `)
  .eq('result_item_id', 'blood_goobert');
```

Map to UI cards / craft trees; do not store pre-built HTML for recipe lines.

## 4. Row Level Security (RLS)

Public catalog — read only for everyone:

```sql
alter table public.combinations enable row level security;
alter table public.combination_ingredients enable row level security;

create policy "Public read combinations"
  on public.combinations
  for select
  to anon, authenticated
  using (true);

create policy "Public read combination_ingredients"
  on public.combination_ingredients
  for select
  to anon, authenticated
  using (true);

-- Writes: dashboard / service role only
```

## 5. Seed example

Assumes `goobert`, `blood_amulet`, and `blood_goobert` already exist in `items` (replace with real ids):

```sql
insert into public.combinations (result_item_id, notes)
values ('blood_goobert', 'Example craft — replace with real recipe')
returning id;

-- use the returned id, e.g. 1
insert into public.combination_ingredients (combination_id, item_id, quantity, sort_order)
values
  (1, 'goobert', 1, 0),
  (1, 'blood_amulet', 1, 1);
```

## 6. Suggested workflow

1. Finish seeding core `items`.
2. Create these two tables + RLS.
3. Import recipes from your source data (CSV/JSON).
4. Build craft UI that joins both directions.
5. Do **not** put recipe ingredient lists on `items` rows.

## Checklist

- [ ] `items` table exists and is seeded
- [ ] `combinations` created
- [ ] `combination_ingredients` created
- [ ] RLS public `SELECT` on both; no public writes
- [ ] Sample recipe inserted and queryable both ways
