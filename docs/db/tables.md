# Database tables

Overview of every table in the BPB Website Supabase database: what it stores, why it exists, and how it connects to the others.

Detailed setup docs live under `docs/db/tables/`.

## Status legend

| Status | Meaning |
|---|---|
| Planned | Designed here; SQL not applied yet |
| Ready | Schema documented and ready to create |
| Live | Created in Supabase |

## Quick list

| Table | Purpose | Status | Detail doc |
|---|---|---|---|
| `items` | Game item catalog (stats, effect text, art refs) | Ready | [items-table.md](./tables/items-table.md) |
| `combinations` | Craft recipe → result item | Ready | [combinations-table.md](./tables/combinations-table.md) |
| `combination_ingredients` | Craft recipe inputs | Ready | [combinations-table.md](./tables/combinations-table.md) |
| `builds` | User-submitted backpack layouts (metadata) | Live | [builds-table.md](./tables/builds-table.md) |
| `build_placements` | Items placed on a build’s grid | Live | [build-placements-table.md](./tables/build-placements-table.md) |
| `build_votes` | Up/down votes per anonymous voter | Live | [build-votes-table.md](./tables/build-votes-table.md) |
| `profiles` | Discord Auth users / authors | Ready | [profiles-table.md](./tables/profiles-table.md) |

## How tables interact

```text
                    combinations
                         │
         result_item_id  │  combination_ingredients.item_id
                         ▼
profiles                items ◄──── build_placements.gems[]
    │ 1                   ▲
    │ authors             │ item_id
    ▼                     │
 builds                   │
    │ 1                   │
    │ has many            │
    ├──── build_votes
    ▼                     │
 build_placements ────────┘
```

### Read paths (site)

1. **Item database / tooltip**  
   `items` only → `ItemTooltip.render(item)`

2. **Combinations / craft browser**  
   `combinations` + `combination_ingredients` → join `items` for result and inputs

3. **Build page**  
   `builds` → `build_placements` → join `items` by `item_id`  
   Placements never copy name/rarity/effect; they only store position + which item (+ gems).

4. **Author page**  
   `profiles` by `discord_id` → `builds` where `author_id = profiles.id`

### Write rules (high level)

| Table | Public read | Public write |
|---|---|---|
| `items` | Yes | No (dashboard / service role) |
| `combinations` | Yes | No |
| `combination_ingredients` | Yes | No |
| `builds` | Yes (published) | Edge `submit-build` (JWT or break-glass secret); `vote_score` public read |
| `build_placements` | Yes (via parent build) | With parent build only |
| `build_votes` | No (service role) | Edge Function `vote-build` only |
| `profiles` | Yes | Own row update (not `is_owner`); insert via Auth trigger |

---

## `items`

**Purpose:** Canonical item definitions for the whole site. One row per item (including gems).

**Used by:** Tooltip renderer, item browser, craft UI, build viewer.

**Does not store:** Finished HTML, backpack coordinates, user builds, or recipe ingredient lists.

**Key fields:** `id`, `gid`, `name`, `rarity`, `type`, `class`, `extra_types`, `cost`, `effect`, `image`, `shape`

**Relationships:**

- Referenced by `build_placements.item_id` and gem ids in `gems`
- Referenced by `combinations.result_item_id` and `combination_ingredients.item_id`

See [items-table.md](./tables/items-table.md).

---

## `combinations` / `combination_ingredients`

**Purpose:** How items craft into other items.

**Used by:** Item detail craft section, combination browser, “used in” lists.

**Key idea:** `combinations` points at the result; `combination_ingredients` lists inputs. Both FKs go to `items`.

See [combinations-table.md](./tables/combinations-table.md).

---

## `builds`

**Purpose:** One row per shared backpack build (title, class, notes, visibility).

**Used by:** Builds list, build detail pages, construct/share flow.

**Key fields:** `id`, `slug`, `title`, `hero_class`, `notes`, `author_id`, `author_name`, `is_public`, `history` (optional jsonb run rounds), `vote_score`

**Relationships:**

- Optional `author_id` → `profiles.id`
- Parent of many `build_placements`
- Parent of many `build_votes`

**Does not store:** Item stats. Final grid cells live in `build_placements`; optional per-round boards live in `history`.

See [builds-table.md](./tables/builds-table.md).

---

## `build_votes`

**Purpose:** One upvote/downvote per anonymous `voter_key` per build.

**Used by:** Edge Function `vote-build`; net score denormalized to `builds.vote_score`.

See [build-votes-table.md](./tables/build-votes-table.md) and [votes.md](../votes.md).

---

## `build_placements`

**Purpose:** Each item instance on a build’s backpack grid.

**Used by:** Build canvas / share viewer.

**Key fields:** `build_id`, `item_id`, `gid`, `x`, `y`, `r`, `gems`

**Relationships:**

- Many rows → one `builds` row
- Each row → one `items` row (main piece)
- `gems[]` → more `items` rows

**Does not store:** Name, rarity, effect text (those live on `items`).

See [build-placements-table.md](./tables/build-placements-table.md).

---

## `profiles`

**Purpose:** Discord-linked site users (Supabase Auth).

**Used by:** Author credits, My builds, `/u/{discord_id}/`, admin owner JWT, vote bind.

**Key fields:** `id` (= `auth.users.id`), `discord_id`, `display_name`, `avatar_url`, `is_owner`, `voter_key`

See [profiles-table.md](./tables/profiles-table.md).

---

## Create order

1. `items`
2. `combinations` + `combination_ingredients`
3. `builds`
4. `build_placements`
5. `build_votes` (after builds)
6. `profiles` (`013_profiles.sql` — also FK `builds.author_id`)

## Design rules

1. **Catalog vs user data** — `items` / combinations are game data; `builds` / `build_placements` are user data.
2. **Join, don’t duplicate** — placements and recipes reference items; never copy effect text into builds or recipes.
3. **Stable ids** — prefer `items.id` (slug) for the site; keep `gid` for importing external build formats.
4. **Docs** — keep detail files under `docs/db/tables/` in sync with this overview.
