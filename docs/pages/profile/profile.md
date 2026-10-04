# Profile page (`/u/`) — todos

Check off as we ship. Live today: thin persona + builds list ([`js/pages/u/`](../../../js/pages/u/)).

Related: [`auth.md`](../auth.md) · [`launch-phase-1.md`](../../product/launch-phase-1.md) · [`launch-phase-2.md`](../../product/launch-phase-2.md) · [`sim-product.md`](../../sim/sim-product.md) · [`blob-cosmetics-pipeline.md`](blob-cosmetics-pipeline.md) (deferred art / ingest contract)

**Not this page’s job:** cosmetics marketplace, soft currency economy, stream alert blobs → Phase 2.

---

## Target shape (locked)

```text
┌──────────────────────────────────────────────────────────┐
│  Persona (always): avatar · name · Discord · flairs       │
├──────────┬───────────────────────────────────────────────┤
│  Left    │  Module stage (swaps on rail click)             │
│  rail    │  Builds | Blob | Inventory | Settings           │
│  [count] │                                               │
└──────────┴───────────────────────────────────────────────┘
```

- One HTML page; tabs via `?tab=builds|blob|inventory|settings` (share + back button)
- Settings rail **owner only**; visitors get Builds + view equipped blob
- Default backdrop = town/profile scene; no frosted full-page panel

---

## Shell

- [x] Persona strip stays outside tabs (avatar, name, Discord id, plan flairs)
- [x] Game-style **left rail** (Interface-like tiles: Builds / Blob / Inventory / Settings)
- [x] Active rail state; click swaps module stage only (no full navigation)
- [x] Deep-link tab works with back button / share URL (`?tab=`)
- [x] Coin balance under avatar (gold icon + `profiles.coins`) — marketplace spend later
- [x] Split modules under `js/pages/u/` (`shell.js`, `tab-*.js`, ≤ ~500 lines each)

---

## Builds tab

- [x] Author’s public builds (reuse feed row / board thumbs)
- [x] Builds-page filter rail (sort / view / tags / class / ranks / liked / mine) — right of the list
- [x] Favorited / upvoted builds section (owner: local upvotes; visitors don’t see others’ likes yet)
- [x] Default tab for everyone

---

## Blob tab

- [x] Blob preview on the page (center stage; Discord face for now)
- [x] Shoulder-up equip slots: **Hat, Face, Full head, Neck, Body, Hand** (2 columns)
- [x] Owner: edit / equip cosmetics (inventory rail — search, slot filter, drag or click-to-equip)
- [x] Visitor: view equipped only (no edit chrome)
- [x] Write equip to same path sim uses (`profiles.equipped_avatar` JSON v1 loadout; sim still resolves face → Discord until blob art) — [`profile-avatar.js`](../../../js/shared/profile-avatar.js)
- [x] Cosmetic **tooltips** (BPB frame): name, description, fiscal **worth** (gold coin + value; `cost` in catalog, `0` = not buyable/sellable), rarity (`Common|Rare|Epic|Legendary|Godly|Unique`), **Created by** (`artist`) and **Original owner** (`owner`), date added — inventory tiles + filled slots

Placeholder cosmetics in [`assets/data/blob-cosmetics.json`](../../../assets/data/blob-cosmetics.json): **starters free for every profile**; Premium / Founding / event pieces stay exclusive flair (`cost: 0`). Ownership: `starter` | plan | `cosmetic_grants`. Inventory tiles composite blob + item. Art / ingest: [`blob-cosmetics-pipeline.md`](blob-cosmetics-pipeline.md) · launch event: [`../events/launch-event.md`](../events/launch-event.md).

**Universal (not Premium-gated):** base Light blob, wardrobe equip, Identity Discord↔blob, Inventory browse, starter cosmetics.

---

## Inventory tab

- [x] Grid of owned cosmetics (blob parts)
- [x] Equip on **Blob** tab; Inventory is browse + filter
- [x] Owner browse; visitors optional read-only later
- [x] Feeds Blob equip

---

## Settings tab

- [x] Owner-only rail item (omit on others’ profiles)
- [x] Manage billing / Stripe portal (shared helpers)
- [x] Other account knobs — plan/Discord facts, Get Premium / membership, Sign out
- [x] **Identity** — Discord profile picture vs website blob (`equipped_avatar` loadout `base`); drives profile persona, nav, sim You avatar

Display name stays Discord-synced (no local rename editor yet). Discord avatar still syncs; Identity chooses which face is shown publicly.

---

## Premium / Founding presence

Beyond the flair chip — brainstorm then ship **one** clear look:

- [ ] Brainstorm: animated / shimmer name, display-face treatment, Discord-style nameplate / avatar ring / soft gold wash, etc.
- [ ] Keep parchment/leather; honor `prefers-reduced-motion`
- [ ] Founding distinct from Stripe Premium if both show
- [ ] Ship chosen treatment on persona strip (and maybe bylines later)

Also tracked under Membership in [`launch-phase-1.md`](../../product/launch-phase-1.md).

---

## Profile backgrounds

- [ ] Deferred — default town/profile scene for now (no equipable backdrop slot in v1)
- [ ] Original art only when revived; rail + persona stay readable
- [ ] Grant / Premium / founding paths TBD; marketplace later (Phase 2)

---

## Wire-outs

- [x] Equipped blob shows on `/sim/` you avatar pick (blob base; cosmetics layers later)
- [ ] OBS overlay loadout — Phase 1 Light blobs in [`launch-phase-1.md`](../../product/launch-phase-1.md)

---

## Done when

- [x] Identity strip + left rail + one module stage
- [x] Builds / Blob / Inventory / Settings work (Settings self-only)
- [x] Deep-link tab without a second HTML page
- [x] Owner equips blob; visitors see it
- [ ] Same equip path ready for sim
