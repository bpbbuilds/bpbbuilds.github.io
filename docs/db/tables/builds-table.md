# Builds table setup (Supabase)

How to store shared backpack builds (metadata only). Grid contents live in `build_placements`.

## Principles

- One row per build: title, class, visibility, author — **not** item stats.
- Placements reference this table; items are joined through `build_placements` → `items`.
- Create `items` before placements; `builds` can be created before placements exist.
- `author_id` FK → `profiles` (nullable for legacy / break-glass submits).
- **OP** and **featured** are curated booleans (owner toggles later) — not a freeform tags array.
- Community “how good” later = ratings/votes, separate from `is_op`.

## 1. Create the table

```sql
create table public.builds (
  id bigint generated always as identity primary key,
  slug text not null unique,                    -- public URL id, e.g. bpbb321879
  title text not null,
  hero_class text,                              -- Berserker, Pyromancer, Ranger, Reaper
  blurb text,                                   -- short carousel / card summary
  notes text,                                   -- longer guide body (why it works, etc.)
  youtube_url text,                             -- full watch URL or youtu.be link
  thumbnail_path text,                          -- optional Storage path; null → YouTube thumb
  board_still_path text,                        -- catalog board still in bucket board-stills; null → client paint
  author_id uuid,                               -- FK to profiles (nullable for legacy)
  author_name text,                             -- display snapshot at submit
  is_op boolean not null default false,         -- owner-curated OP badge
  op_requested boolean not null default false,  -- submit asked for OP; approve later
  build_tag text,                               -- theory | feasible | real | null
  is_featured boolean not null default false,   -- homepage video carousel
  is_public boolean not null default true,
  route_r3 text,                                -- optional free-text note
  route_r10 text,                               -- optional free-text note
  route_r3_item_id text references items (id),  -- Round 3 skill (items.id)
  route_r10_item_id text references items (id), -- Round 10 skill (items.id)
  gold_count integer,                           -- typical gold to assemble (guide meta)
  rank text,                                    -- league key: bronze, silver, gold, platinum, diamond, master, grandmaster, grandma
  starting_bag_id text references items (id),   -- class starter loadout (may be sold off-board)
  history jsonb,                                -- optional run history for round scrubber (null = none)
  vote_score integer not null default 0,        -- net up/down (sum of build_votes)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index builds_hero_class_idx on public.builds (hero_class);
create index builds_is_public_idx on public.builds (is_public);
create index builds_is_op_idx on public.builds (is_op) where is_op = true;
create index builds_is_featured_idx on public.builds (is_featured) where is_featured = true;
create index builds_created_at_idx on public.builds (created_at desc);
```

FK applied in [`013_profiles.sql`](../sql/013_profiles.sql):

```sql
alter table public.builds
  add constraint builds_author_id_fkey
  foreign key (author_id) references public.profiles (id)
  on delete set null;
```

### Column notes

| Column | Purpose |
|---|---|
| `id` | Internal primary key |
| `slug` | Stable public id used in URLs (`/builds/{slug}/`) |
| `title` | Display name on list/detail pages |
| `hero_class` | Build’s hero class (icon from `assets/icons/classes/`) |
| `blurb` | **Short** one–two sentence pitch for carousel / cards |
| `notes` | **Long** guide writeup (synergies, route notes later) |
| `youtube_url` | Showcase video; null if none |
| `thumbnail_path` | Custom thumb in Storage; if null, derive from YouTube |
| `board_still_path` | Baked bag still in public Storage bucket `board-stills` (`{author_id}/{uuid}.webp`). Null → catalogs paint client-side. Not the featured YouTube thumb. |
| `author_id` | Link to `profiles.id` when submitted with Discord session |
| `author_name` | Display snapshot at submit (profile page shows live name) |
| `is_op` | Manual OP badge (owner approval) |
| `op_requested` | Submit flagged OP; stays false on `is_op` until approved |
| `build_tag` | Exclusive authenticity: `theory` · `feasible` · `real` (or null). `real` means published with attached run `history`. |
| `is_featured` | Include in homepage Twitch-style carousel |
| `is_public` | Hide drafts / private builds from public lists |
| `gold_count` | Typical gold spent to run this build (info rail) |
| `rank` | League badge key for info rail (`bronze` … `grandma`) |
| `event_slug` | Community event this build was submitted for (`019_builds_event_slug.sql`). Null = not an event entry. Catalog filter uses `FEED_EVENTS` in `js/pages/builds/feed-event-filter.js`. |
| `route_r3_item_id` / `route_r10_item_id` | Round 3 / Round 10 skill picks (`items.id`) |
| `starting_bag_id` | Class starting bag chosen at run start (loadout); not required on the final board |
| `history` | Optional JSON: `{ runId, rounds: [{ round, result, placements }] }` for the build-page W/L scrubber. Null = final board only. Catalog thumbs still use `build_placements` (last round when history was published). |
| `vote_score` | Net community score (`sum(build_votes.vote)`). Updated by `vote-build`. See [`docs/pages/votes.md`](../../pages/votes.md). |

### `blurb` vs `notes`

| | `blurb` | `notes` |
|---|---|---|
| Length | 1–2 sentences | Long-form |
| Where used | Carousel focus card, OP cards | Build guide page body |
| Example | “Endless attacks with hurricane weapons…” | Full “why it works” + route details |

### Does not store

- Item names, rarities, effects, or sprites
- Canonical final-board cells (those are `build_placements`; `history` may repeat per-round copies)
- Combination/recipe data
- Finished tooltip / card HTML
- Raw Steam `history.db` blobs

## 2. Frontend usage

Featured carousel:

```js
const { data: featured } = await supabase
  .from('builds')
  .select('id, slug, title, hero_class, blurb, youtube_url, thumbnail_path, is_op, author_name')
  .eq('is_public', true)
  .eq('is_featured', true)
  .order('updated_at', { ascending: false })
  .limit(5);
```

Detail page:

```js
const { data: build } = await supabase
  .from('builds')
  .select(`
    id,
    slug,
    title,
    hero_class,
    blurb,
    notes,
    youtube_url,
    thumbnail_path,
    is_op,
    author_name,
    history,
    placements:build_placements (
      id,
      x,
      y,
      r,
      gems,
      item:items ( id, gid, name, rarity, type, image, shape, cost, effect, class, extra_types )
    )
  `)
  .eq('slug', 'demo-build')
  .eq('is_public', true)
  .single();
```

## 3. Row Level Security (RLS)

```sql
alter table public.builds enable row level security;

create policy "Public read published builds"
  on public.builds
  for select
  to anon, authenticated
  using (is_public = true);

create policy "Authors read own builds"
  on public.builds
  for select
  to authenticated
  using (author_id = auth.uid());
```

Contest entries use `event_held` plus `is_public = false` until the gallery clock in
[`024_event_entry_privacy.sql`](../sql/024_event_entry_privacy.sql). Authors can still
read their own row and placements. `sync_event_build_visibility()` releases them when
that clock passes.

Until Auth, insert/update from the Supabase dashboard, a service-role script, or the
owner-gated Edge Function `submit-build` (see `supabase/functions/submit-build/` and
`docs/pages/create-submit.md`). No public anon INSERT.

## 4. Seeding

Demo / showcase seed rows were retired. Prefer **Create → Submit** (`submit-build`) or a
service-role insert for real OP boards. Homepage carousel reads `is_featured = true`.

## 5. YouTube views (important)

Official [YouTube Help](https://support.google.com/youtube/answer/171780): **autoplayed embeds do not increment views**.

IFrame API note: a playback counts only if started via the **native play button** in the player.

**Carousel implication**

| Behavior | Counts as a YouTube view? |
|---|---|
| Muted autoplay preview in the carousel | **No** |
| User clicks play on an in-page embed | **Yes** (if they watch long enough) |
| **Watch** opens youtube.com / youtu.be | **Yes** |

Recommended UX: muted autoplay is fine for atmosphere; **Watch** (and optional in-page play after a click) are what grow the channel.

## 6. Suggested workflow

1. Create `builds` + RLS + seed featured rows.
2. Create `items` when catalog work starts.
3. Create `build_placements` for real grids.
4. Admin toggles for `is_op` / `is_featured` / soft-hide via `/admin/` (`docs/pages/admin.md`).

## Checklist

- [x] `builds` table created
- [x] Unique `slug` enforced
- [x] Columns: `blurb`, `youtube_url`, `thumbnail_path`, `is_op`, `is_featured`
- [x] RLS: public can `SELECT` where `is_public = true`
- [x] No public insert/update yet
- [x] ≥5 featured demo builds seeded for carousel
- [x] `build_tag` + `op_requested` for create submit (`008_build_submit.sql`)
- [x] `starting_bag_id` class loadout (`009_starting_bag.sql`)
- [x] `history` jsonb for publish-with-history scrubber (`010_build_history.sql`)
- [x] Authenticity tags `theory` | `feasible` | `real` (`011_build_authenticity_tags.sql`; remaps legacy `theorycraft`)
- [x] `vote_score` + `build_votes` (`012_build_votes.sql`)
- [x] `event_slug` for catalog Events filter (`019_builds_event_slug.sql`)
- [x] `board_still_path` + Storage bucket `board-stills` (`020_builds_board_still_path.sql`)
- [x] Event entries stay private to the author until the gallery opens (`024_event_entry_privacy.sql`)

SQL: [`docs/db/sql/001_builds.sql`](../sql/001_builds.sql)  
Apply: `node scripts/_apply-builds.mjs` (uses `.env` `SUPABASE_DB_PASSWORD` + host from `SUPABASE_DB_URL`)  
Authenticity tags: `node scripts/_apply-build-authenticity-tags.mjs`  
Votes: `node scripts/_apply-build-votes.mjs`  
Event slug: `node scripts/_apply-builds-event-slug.mjs`  
Board stills: apply [`020_builds_board_still_path.sql`](../sql/020_builds_board_still_path.sql) in the SQL editor (column + bucket + policies)
