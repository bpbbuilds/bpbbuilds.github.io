# Launch event (thin MVP)

**Status:** Phase 1 launch requirement — one public contest at go-live.  
**Not:** multi-event hub, auto `history.db` scoring (those are Phase 2 / 1.1).

Related: [`launch-phase-1.md`](../../product/launch-phase-1.md) · [`highestDPS.md`](eventIdeas/highestDPS.md) (theme vision) · [`blob-cosmetics-pipeline.md`](../profile/blob-cosmetics-pipeline.md)

---

## Goal

Open the site with a community moment: clear rules, a prize cosmetic, and a way to enter. You judge; the site grants the winner cosmetic.

## First event theme

**DPS Stone** (Highest DPS vs stone / dummy) — players make a real (unranked/ranked) run in Backpack Battles, then submit **`history.db`** as proof. Launch: owner exports entries + shared dummy, judges DPS manually, may cut a results video. Full vision (auto leaderboard + top‑3 highlight video) lives in [`highestDPS.md`](eventIdeas/highestDPS.md). **v1 does not build the auto scorer.** Public title on `/events/` is **DPS Stone**; slug stays `highest-dps`.

Thin v1 entry (pin in Discord + site when upload lands):

- **Canonical:** `history.db` for the real run (Discord attach and/or site upload)
- Optional announce post; YouTube clip only as flavor — not the score source

## Public page checklist

- [x] `/events/` parchment page (rules, dates TBD, how to enter, prize)
- [x] Public page is a **catalog** (featured strip + filtered cards + detail via `?e=highest-dps`) — not a single article; copy lives in [`catalog-data.js`](../../../js/pages/events/catalog-data.js)
- Event banners: **1280×720 PNG (16:9)** in `assets/events/<slug>.png` (same file for featured / cards / detail)
- [ ] Fill real **dates** + Discord channel link before announce
- [ ] Prize art final (event winner cosmetic) — placeholders OK until then
- [x] Nav **Events** → `/events/`
- [ ] After close: announce winner; grant `grant_event_trophy` via SQL (see below)

## Prize + other launch cosmetics

**Catalog now:** starters free for every profile; exclusive flair still Premium / Founding / event.

| Cosmetic id | Earn |
|---|---|
| `leaf_crown`, `wiz_hat`, `bucket_helm`, `shades`, `gem_pin`, `scarf`, `star_aura`, `stick_sword`, `shield`, `ruby_boots` | `starter` — everyone |
| `premium_crown`, `grant_premium_badge` | `plan` is `premium` or `founding` |
| `grant_founding_crown` | `plan` is `founding` |
| `grant_event_trophy` | id listed in `profiles.cosmetic_grants` |

Catalog: [`assets/data/blob-cosmetics.json`](../../../assets/data/blob-cosmetics.json).

### Manual event grant (owner / SQL editor)

```sql
-- Append event trophy for a winner (discord_id known)
update public.profiles
set cosmetic_grants = (
  select jsonb_agg(distinct x)
  from jsonb_array_elements_text(
    coalesce(cosmetic_grants, '[]'::jsonb) || '["grant_event_trophy"]'::jsonb
  ) as t(x)
)
where discord_id = 'WINNER_DISCORD_SNOWFLAKE';
```

Column: [`021_profiles_cosmetic_grants.sql`](../../db/sql/021_profiles_cosmetic_grants.sql) — apply in Supabase; client cannot self-grant (trigger).

## Art brief (launch three + base)

Same canvas as wardrobe base ([`assets/blob/blob-base.png`](../../../assets/blob/blob-base.png)):

| File | Role |
|---|---|
| `assets/blob/blob-base.png` | Peeking Light blob (final art TBD) |
| `assets/blob/cosmetics/premium-crown.png` | Premium Crown hat overlay (64×64, transparent) |

Rules:

- Transparent overlay PNGs, aligned to the base (dunkbin-style)  
- Black outline; do not fully cover the blob  
- Inventory tile = site composites **base + this overlay** (no separate icon set)  
- Replace placeholder files when final art lands  

Detail: [`blob-cosmetics-pipeline.md`](../profile/blob-cosmetics-pipeline.md).

## Out of scope here

- Owner events hub UI  
- Auto DPS from uploaded `history.db`  
- Marketplace / soft currency  
- Community cosmetic submissions  
