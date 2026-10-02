# Blob cosmetics pipeline (design note)

**Status:** deferred — keep for when we ship real Light blob art + community/ moderated cosmetics.  
**Not building now.** Profile Blob/Inventory UI and `profiles.equipped_avatar` already exist; this doc is the *art + ingest* contract.

Related: [`profile.md`](profile.md) · [`launch-phase-1.md`](../../product/launch-phase-1.md) · [`launch-phase-2.md`](../../product/launch-phase-2.md) (marketplace / economy later)

---

## Verdict

For community (or moderated) pixel cosmetics on a fixed blob, the DunkOrSlam / dunkbin model is near-optimal:

**fixed canvas overlay + slot z-layers**

Improve the *pipeline* (one source size, metadata, Storage ingest, auto checks). Do **not** replace the equip model with bones, Spine, Live2D, or freeform x/y placement — those help studio-rigged heroes, not open hat submissions.

---

## What dunkbin actually does

Reverse-engineered from [dunkbin.com](https://dunkbin.com/) plus community docs:

| Source | Role |
|---|---|
| [SweatUpdated (commands / economy)](https://docs.google.com/document/d/1uKdlSDVIU2d8xPsqVhJ_yqSHAUMowdfowHnBO_K5Dqg/edit) | Chat currency, shop, equip commands — not the art spec |
| [Creating Cosmetics for the Sweat Shop (Viowlet)](https://docs.google.com/document/d/1Z-npmABGdFnKi30S5wYveKCkMzHLjxnkr546vdsVTjg/edit) | Official creator contract |
| [Cosmetic backlog](https://tinyurl.com/cosmetic-backlog) | Moderated sheet → live `/img/{id}-{md5}.png` |

### Art contract (theirs)

| Rule | Spec |
|---|---|
| Draw size | **70×70** on the sweatling |
| Submit size | Upscale **×3 → 210×210** PNG, transparent, **without** the base character |
| Outline | Black outline required |
| Animated submit | **Sprite sheet** (all frames in one image), max **39×39 frames**, posted at ×3 |
| Frame timing | Artist picks a **Delay** (seconds between frames); one delay for the whole anim — slow parts = duplicate frames |
| Templates | [70×70](https://i.imgur.com/PtgKt8Z.png) · [210×210](https://i.imgur.com/D8jXHiO.png) |
| Test | [dunkbin.com/test](https://dunkbin.com/test) |

### Equip / layers (theirs)

Stack order (closest to body → front):

1. Hat / head  
2. Face  
3. Neck / shoulders  
4. Body / effect (rare / events)  
5. Full Head — replaces hat + face together  

Alignment is baked into the art on the shared canvas. No per-item position math. Creators must not fully cover the sweatling.

### Community → live

1. Artist posts PNG/GIF + sheet in Discord  
2. Row in backlog (Creator, Delay, Status, per-slot preview URLs)  
3. Moderated Accept / Decline / Review  
4. Staff hosts file on dunkbin — **no** public self-publish into production  

### Runtime formats (theirs)

| Stage | Format |
|---|---|
| Discord share | Static PNG, GIF preview, and/or horizontal sprite sheet |
| Live site | Almost always **210×210 `.png`** — static or **APNG**; JS also has a legacy strip + CSS `steps()` + delay path |

Equip = CSS absolute layers over `sweatling.png`; one sprite per slot.

### Inventory tiles (theirs) — important

Backpack / shop grids do **not** show a separate cropped icon. Each tile is a **mini paper-doll**: base sweatling + **that one** cosmetic layered on (same overlay file as equip). Label under the tile is like `0x Cartman Beanie` / `1x Rudolph Nose`.

So:

- **Storage:** still one overlay PNG per cosmetic (no second thumbnail asset)  
- **Inventory UI:** runtime composite (base + item), not “hat alone on empty canvas”  
- **Equipped preview:** same stack, often with the player’s full loadout  

Artists still submit overlays without the sweatling; the site puts the sweatling back under them for browsing.

### Launch cosmetics (BPB Phase 1)

**Universal:** base blob + wardrobe + `starter` cosmetics for every signed-in profile. **Exclusive flair:** Premium / Founding / event grants (`premium_crown`, `grant_premium_badge`, `grant_founding_crown`, `grant_event_trophy`). See [`launch-event.md`](../events/launch-event.md) and [`launch-phase-1.md`](../../product/launch-phase-1.md).

---

## BPB recommendation

### Keep (same as dunkbin)

- One transparent **artboard** matching the blob base  
- Slot = **z-layer** (our UI already: Hat, Face, Full head, Neck, Body, Hand)  
- Cosmetic file = full-frame overlay (still or animated), already aligned  
- Inventory / catalog tiles = **blob + that cosmetic** (CSS or canvas composite) — same as dunkbin backpack, not a separate icon set  
- Exclusivity rules in data (e.g. Full head conflicts with Hat + Face)  
- Same loadout JSON everywhere (`profiles.equipped_avatar` → profile / sim / OBS later)  
- Scarcity of Body / Hand via **grant rules**, not art tech  

### Improve vs dunkbin

| Dunkbin quirk | Prefer for BPB |
|---|---|
| Draw at 70, ship 210 | One **native** source size (e.g. 70 or 128); we upscale once server-side → fewer wrong-size rejects |
| Discord + spreadsheet | Structured submit → Supabase Storage + row (slot, delay, checksum); backlog UI later |
| GIF for share, APNG/sheet for live | Prefer **WebP animated** or short **APNG** for live; GIF only as optional Discord-friendly preview |
| Delay only in backlog | Store `frameDelayMs` (+ optional `frameCount`) on the cosmetic record |
| Soft “don’t cover blob” rules | Authoring kit + checklist; later auto checks (alpha footprint, max fill %) |
| Manual layer testing | In-browser compositor (wardrobe already) as accept gate |
| Live-composite every inventory tile | Fine at our catalog size; if lists get huge, optional cached poster stills (base+item baked once) |

### Do not build (unless goals change)

- Bone / Spine / Live2D for community hats  
- Freeform drag x/y/scale on equip  
- Cropped per-slot canvases (hat-only 40×20 PNGs) — misalignment hell  
- A second hand-drawn “icon” asset per cosmetic (dunkbin doesn’t need it; composite covers browse)  
- Open upload straight into production  

### Authoring kit (when we ship)

- Base blob PNG at the locked pixel size  
- Ghost guides (face, chin, shoulders — same idea as Viowlet’s highlight areas)  
- Empty layer templates per slot  
- Static **poster frame** required even for animated items (lists / tooltips / reduced-motion)  

### Pipeline sketch (future)

```text
Artist draws on template
        ↓
Submit (slot, still or sheet/APNG, frameDelayMs, preview)
        ↓
Moderation + wardrobe stack test
        ↓
Storage: /blob-cosmetics/{id}.webp|png  (+ optional baked tile still)
        ↓
Catalog row → inventory grant → equip into equipped_avatar
        ↓
Render:
  inventory tile = base blob + this cosmetic
  wardrobe / sim / OBS = base + full loadout layers
```

Marketplace / soft currency / trading stay Phase 2 — see [`launch-phase-2.md`](../../product/launch-phase-2.md). This note is only the **art + equip stack**.

---

## Our slots (locked in UI)

Shoulder-up paper doll (no background slot in v1):

| Slot | Notes |
|---|---|
| Hat | Closest headwear / hair edits that should still mix with Face |
| Face | Glasses, masks, etc. |
| Full head | Mutual exclusive with Hat + Face when equipped |
| Neck | Collars / shoulders |
| Body | Front effects; keep rare |
| Hand | Held / gesture overlays |

Placeholder catalog today: [`assets/data/blob-cosmetics.json`](../../../assets/data/blob-cosmetics.json).

---

## When to reopen this

- Light blob base art is final at a locked pixel size  
- Ready for first original cosmetic set (no shop yet)  
- Or first moderated community submit path  

Until then: leave wardrobe UI as-is; don’t invent a second equip system.
