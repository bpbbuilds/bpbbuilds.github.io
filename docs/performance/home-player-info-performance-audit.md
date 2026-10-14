# Home Player Info animation performance audit

**Date:** 2026-10-13
**Scope:** The owner-only Home animation-lab **Player Info** preset and the shared placed-board renderer it exercises.
**Goal:** Improve runtime cost without changing the visible composition, timing, ordering, or responsive appearance.

## Executive summary

The Player Info preset is visually correct and its focused smoke checks pass, but its current implementation has several avoidable costs:

1. **Sprite memory can grow for the lifetime of the loop.** Player Info exits its cycle before the normal next-build prefetch/prune path, so decoded `Image` objects in `spriteCache` are not bounded as random builds rotate.
2. **Each build is normalized and painted repeatedly.** A representative local sample contains 45 placements on average (66 at the maximum). The cycle clears the board, paints bags, paints the full board again, departs the board, and clears it, while `mapItem`, shape/socket resolution, sorting, sprite lookup, fabric-cell construction, and DOM reconciliation run on each pass.
3. **The same board gets two full identity/cosmetic paths.** Player Info hides the author in the caption and then paints the visible player column. Both paths currently hydrate face/cosmetic overlays; the creator-count lookup also adds one Supabase request per author the first time that author is seen.

Other costs are material but lower priority: three static JSON fetch/parse operations per mount, image decode work on first encounter with later random builds, ResizeObserver-triggered repaint opportunities during the wave, a 400px early viewport activation margin, and per-cell/per-node animation setup. The board already uses CSS transforms/opacity for the visual wave, so these should be preserved.

This document is an audit and fix plan only. **No product code was changed for the audit.** The safe first fixes are bounded sprite retention plus one-build-ahead prefetch, memoized build normalization, and removal of duplicate hidden-author hydration. Those changes should be measured before and after with a browser Performance trace and heap snapshots.

## P0 implementation status — 2026-10-13

The requested memory/decode slice is now implemented:

- `home-promo-sprite-cache.js` bounds decoded sprite retention to a configurable two-build window and 192-entry hard cap, with LRU touch order and eviction.
- Player Info warms its initial next build before the first board paint and warms each later next build before that build's first visible wave.
- `scripts/home-promo-sprite-cache-smoke.mjs` runs 20 repeated rotations and checks the cache bound, current/next retention order, next-build warm state, and eviction.

The remaining P1/P2 items below are still recommendations where they are not covered by this implementation slice. The original audit statement above describes the audit-only phase before these implementation slices.

## P1 implementation status — 2026-10-13

The requested CPU/DOM reduction slice is now implemented:

- Normalized placements, ordered placements, bag subsets, `itemsById`, and sprite URL sets are memoized per build and parsed asset-extras object.
- The Player Info second wave keeps the pooled bag nodes and uses a pre-cell-expansion bag signature to leave unchanged FilledSlot fabric mounted.
- Hidden caption authors no longer run face/cosmetic hydration. Creator-count requests are deferred and only apply if their build token is still active.
- The three static asset-extra JSON results are shared through a module-level promise cache.
- Placed-grid ResizeObserver work is rAF-coalesced and can be paused/deferred during the Player Info bag/item/depart sequence, then released once.

The remaining recommendations are measurement/tuning work (for example viewport-margin tuning and layer/paint profiling), not claimed completed by this code slice.

## P2 measured polish status — 2026-10-13

The scheduling/layer pass is now measured and partially implemented:

- The viewport lead was tuned from 400px to 240px. The browser smoke confirms that a section 200px into the tuned lead activates, while a section 260px beyond the viewport does not; the old 400px margin would activate that farther section.
- A representative 66-item/cell browser probe reports the shared item animation as `bpb-bg-appear-library` and the capacity animation as `home-promo-fabric-in`; both remain transform/opacity-based and the probe reports `will-change: auto` for those nodes. No new `will-change` rule was added.
- The same probe measured the two whole-board bag selectors at approximately 6.3ms for 5,000 passes (~0.0013ms per pass) in the local headless browser. That query is not visible enough to justify extra node-reference bookkeeping, so the fallback scan remains intentionally unchanged. The probe is retained to catch regressions.

The measured runtime counters from the same probe (TaskDuration 0.0219s, LayoutDuration 0.00035s, RecalcStyleDuration 0.00156s, 4 layouts, 4 style recalculations) are a baseline rather than a production-device guarantee.

## Evidence and methodology

### Inspected paths

- `js/pages/home/home-promo-assemble.js` — data load, asset extras, sprite predecode, build loop, Player Info two-stage wave, caption/player identity.
- `js/pages/home/home-promo-band.js` — activity/hover/viewport lifecycle and launcher setup.
- `js/shared/backpack-grid/item-pool.js` — pooled board paint, bag fabric, resize/render scheduling, sprite warm-up.
- `js/shared/backpack-grid/item-pieces.js` — appear-wave ordering, reflow, stagger and cleanup.
- `js/pages/home/home-promo-band.css` — Player Info fade/board animation rules.

### Static measurements

Using `assets/data/author-history-builds.json` as the representative local sample:

| Measure | Result |
| --- | ---: |
| Builds in sample | 8 |
| Average placements per build | 45 |
| Maximum placements in one build | 66 |
| Unique item ids in sample | 114 |
| Sprite metadata entries (`assets/data/sprite-display.json`) | 523 |
| Item-sprite files | 649 |
| Item-sprite bytes | 60,641,479 (~57.8 MiB) |

Relevant implementation sizes are also large enough that repeated work matters: `home-promo-assemble.js` is about 900 lines, `item-pool.js` about 1,350 lines, and `item-pieces.js` about 1,100 lines. Size is not itself a defect; it indicates that a board cycle touches a substantial shared surface.

### Verification status

The existing focused checks passed before this audit, including the Player Info wave, browser wave, animation, activity/hover, responsive, creator-performance, and bag-synergy smokes, plus `node --check` on the touched Player Info modules and `git diff --check`.

No Chrome/Edge Performance trace or heap snapshot was available in this audit. Therefore, the severity ratings below are **code-evidence ratings**, not claims about a measured frame-time percentage. The measurement plan at the end is required before choosing aggressive changes.

## Current pipeline

1. `fetchRealBuilds()` calls `syncEventBuildVisibility()`, then requests up to 12 public `real` builds with profile data and nested placements/items (`home-promo-assemble.js:145-175`).
2. `loadAssetExtras()` fetches and parses `item-shapes.json`, `socket-offsets.json`, and `sprite-display.json` in parallel (`home-promo-assemble.js:131-138`).
3. The first build's item sprites are decoded into `spriteCache` before mounting the board (`home-promo-assemble.js:685-715`).
4. Each cycle maps and sorts every placement (`home-promo-assemble.js:735-746`), paints caption/player identity, clears the pooled board, then runs the Player Info bag wave followed by the full item wave (`home-promo-assemble.js:749-811`).
5. The shared pool sorts placements, reconciles pooled item nodes, recomputes bag fabric cells, and starts the CSS appearance wave (`item-pool.js:356-413`, `item-pieces.js:769-825`).
6. The board holds for 2.5 seconds, departs, clears, and selects a new random sequence. Hover and viewport activity can pause the cycle, but do not remove the work already performed (`home-promo-band.js:191-207`).

## Findings

### P0 — Player Info sprite cache is not bounded

**Evidence:** `spriteCache` is a `Map` of decoded `Image` objects (`home-promo-assemble.js:685-714`). The normal path prefetches the next build and calls `retainBuildSprites(build, nextBuild)` at `home-promo-assemble.js:886-887`. The Player Info branch `continue`s at `home-promo-assemble.js:809-812`, before that prefetch/prune block. Player Info randomizes its build sequence at `home-promo-assemble.js:897-899`.

**Why it costs:** Every newly encountered build can add unique decoded sprite images. The browser may retain the image and decoded backing memory until the section is torn down, even though only the current board is visible. With 114 unique item ids in the local sample and a larger server dataset, this is an unbounded memory trend across a long-lived Home tab.

**Potential fix (visually neutral):** Keep a bounded LRU containing the current and next one or two builds; predecode the next build before it is shown, then prune all other URLs after the predecode settles. If decode fails, retain the URL entry only long enough for the normal image fallback. Add a smoke assertion that the cache never exceeds the retained-build budget after repeated cycles.

### P0 — First encounter with later random builds can decode during the wave

**Evidence:** Only `playerCycle[0]` is decoded before the loop (`home-promo-assemble.js:715`). The next-build prefetch appears only in the non-Player Info path (`home-promo-assemble.js:886-887`).

**Why it costs:** When a later random build is selected, image fetch/decode can overlap `grid.update()` and the two visual waves. Decode and image upload can compete with style/layout/paint work, producing a hitch even though the CSS animation itself is unchanged.

**Potential fix:** Combine this with the P0 bounded cache: start a one-build-ahead prefetch as soon as the current build is known, await only the current build before painting, and let the next build warm in the background. Keep the existing visual hold and stagger values.

### P1 — Repeated normalization and sprite lookup per cycle/pass

**Evidence:** The cycle calls `placementsForBuild()` once at `home-promo-assemble.js:740-744`. Sprite preloading independently remaps every placement through `mapItem()` and `getSpriteUrl()` (`home-promo-assemble.js:686-711`). The pool then maps/looks up every visible placement again while painting (`item-pool.js:392-430`).

**Why it costs:** Shape/socket application, item object allocation, sprite metadata lookup, sorting, and URL creation repeat for the same build. Randomized rotation means a previously seen build pays this cost again.

**Potential fix:** Memoize an immutable normalized build result keyed by build id/slug plus an asset-extras version. Store the ordered placement list, `itemsById`, and sprite URL set together. Reuse it for prefetch and both Player Info waves; clone only when a caller truly mutates a placement. This should not alter positions, z-order, or item metadata.

### P1 — Four broad board passes per Player Info build

**Evidence:** The Player Info branch clears (`home-promo-assemble.js:768`), paints bags (`793-798`), paints the full board (`800-805`), departs and clears (`808-811`). Each `grid.update()` enters the pooled board paint path (`item-pool.js:356-640`), including sorting, node reconciliation, and fabric refresh.

**Why it costs:** A 45-placement average build can touch dozens of DOM nodes and fabric cells multiple times for one visible cycle. The second wave intentionally reuses bag fabric, but it still walks the placements and pool to reconcile the full board.

**Potential fix:** Keep the two-stage visual contract but make the second pass incremental: retain the bag placement set and add item nodes to the existing pool, while leaving unchanged bag nodes/fabric untouched. Alternatively, add a stable placement signature so an identical bag-only paint can early-return after confirming the signature. Benchmark both; do not remove the clear/depart state until screenshots and animation tests prove equivalence.

### P1 — Bag fabric cell calculation and HTML rebuild repeat work

**Evidence:** `syncBagFabric()` builds a `cells` map by walking every bag and every `bagBodyCells()` result, then sorts keys and constructs an HTML string (`item-pool.js:97-167`). The existing `preserveExisting` guard only returns after the full cell computation and key generation (`item-pool.js:139-149`). Player Info enables fabric preservation (`home-promo-assemble.js:716-721`) and paints bags twice.

**Why it costs:** The second wave avoids flashing existing fabric, but still pays most of the combinatorial cell/signature work first. The per-cell HTML replacement also creates many spans on the first bag wave.

**Potential fix:** Cache a bag-fabric signature and generated cell HTML by normalized bag placement signature, rotation, and board geometry. Check the signature before calling `bagBodyCells()`; preserve existing nodes when the signature is unchanged. Keep the current fade-in classes and delays.

### P1 — Duplicate face/cosmetic hydration in Player Info

**Evidence:** Player Info asks `paintPromoCaption()` to hide the author (`home-promo-assemble.js:749-758`), then separately calls `paintPromoPlayer()` (`home-promo-assemble.js:764-767`). Both painting paths call the shared face/cosmetic hydration in their respective helpers.

**Why it costs:** The hidden caption path can still query and append cosmetic/avatar overlay work that is not visible. The visible player column then repeats that work. This is especially noticeable when a blob/cosmetic image must be loaded or decoded.

**Potential fix:** Add an explicit `hydrateAuthor: false`/`skipFaceHydration` option for hidden caption authors, or pass the already hydrated face result from the player column into the caption helper. Preserve the visible player markup and fallback behavior.

### P1 — Creator-count query can add an asynchronous repaint per author

**Evidence:** `creatorCount()` caches by author id but makes a Supabase `head` count query on the first encounter (`home-promo-assemble.js:724-732`). Player Info paints a zero/placeholder first, then repaints when the query resolves (`home-promo-assemble.js:764-767`).

**Why it costs:** Each unseen creator adds a network request and a second identity render during the animation loop. A slow request can resolve after the build has changed and cause stale work unless the helper guards the active build.

**Potential fix:** Batch counts for the selected build authors, include the count in the build query/view, or defer the count until after the first visible hold. Add an active-build token before applying an asynchronous result. Keep the displayed count and layout dimensions stable.

### P1 — Static asset extras are fetched and parsed on every mount

**Evidence:** `loadAssetExtras()` starts three fetches each time `playAssemble()` is mounted (`home-promo-assemble.js:131-138`). Browser HTTP caching can avoid transfer, but JSON parsing and object creation still repeat.

**Potential fix:** Use a module-level promise keyed by root/base URL and an asset-manifest version. Reuse the parsed object for all Home presets and performance-lab mounts. Invalidate only when the manifest/version changes.

### P1 — ResizeObserver can schedule a repaint around the wave

**Evidence:** The placed-board `ResizeObserver` schedules `render()` with `requestAnimationFrame` (`item-pool.js:1087-1097`). The pool already has an appear guard, but Player Info's two-stage wave can still cause board-size changes from surrounding layout, especially at responsive breakpoints.

**Why it costs:** A resize-triggered render can repeat the full pool/fabric pass while CSS appear/depart animations are active.

**Potential fix:** Keep the rAF coalescing, but expose a short “Player Info wave active” guard to skip non-essential repaint until the current wave completes, then render once. Alternatively freeze the committed cell geometry for the wave and only render after a real host-size change. Verify 1440, 1080, short desktop/tablet, and mobile-excluded behavior before shipping.

### P2 — viewport preactivation was tuned after measurement

**Evidence:** The activity observer now uses a scoped `PROMO_VIEWPORT_ROOT_MARGIN = '240px 0px'` (`home-promo-band.js:14-18`, `home-promo-band.js:209-217`). The P2 browser smoke compares the new boundary with the former 400px behavior.

**Why it costs:** A Home section several hundred pixels outside the viewport can be considered active, so fetch/decode/animation setup can run while the user is still viewing another section. The previous 400px margin activated a probe 260px beyond the viewport.

**Implemented fix:** A 240px lead preserves a near-viewport warm-up window while avoiding the farther activation boundary. The smoke covers the activation boundary; production-device traces should still validate perceived reveal timing.

### P2 — Animation setup creates many per-node style/listener operations

**Evidence:** `playAppearInLibraryBatch()` clears every entry, forces one intentional reflow, and stamps a delay/class on every item (`item-pieces.js:777-825`). Bag fabric similarly stamps a delay and one-time `animationend` listener for every cell (`item-pool.js:181-217`). Player Info increases the stagger to 45ms (`home-promo-assemble.js:45-46`) so many nodes remain in an active animation window.

**Why it costs:** The CSS transform/opacity design is appropriate, but per-node class/style/listener setup and simultaneous compositing can be expensive on lower-power desktops.

**Potential fix:** Keep transforms and opacity, but use event delegation or a single cleanup timer for fabric cells where safe, avoid broad `will-change` on every node, and only promote the active wave subset if measurement shows layer pressure. Do not reduce the stagger/duration without a product decision because it changes the visible motion.

### P2 — `fadeNewBagChrome()` scans the board after both paints

**Evidence:** Player Info calls `fadeNewBagChrome()` after each `grid.update()` (`home-promo-assemble.js:797`, `804`).

**Potential fix:** Have the pool return the newly mounted bag-cell nodes or keep a per-board node set so the fade helper does not query the entire board after each wave. Keep the exact fade class and timing.

## Prioritized implementation plan

### P0: memory and decode stability

1. Introduce a bounded sprite cache (current + next build, with a small configurable LRU).
2. Start one-build-ahead decode for Player Info and prune after the next build is warm.
3. Add a repeated-cycle smoke test that asserts cache size remains bounded and that the next build is warmed before its first paint.

### P1: remove repeated CPU/DOM work

4. Memoize normalized placements, `itemsById`, ordering, and sprite URL sets per build/extras version.
5. Make the Player Info second wave incremental or signature-aware so unchanged bag nodes/fabric are not rebuilt.
6. Cache bag-fabric signatures/HTML or node sets before calculating individual cells.
7. Skip hidden-caption face hydration; make creator-count application active-build-safe and batch/defer counts.
8. Cache the three parsed asset-extra JSON documents at module scope.
9. Coalesce or defer ResizeObserver repaint during a Player Info wave.

### P2: scheduling and measured polish

10. Validate the tuned 240px viewport margin on production devices and adjust only if a real reveal delay appears.
11. Measure animation layers/paint; retain transform/opacity and avoid unmeasured `will-change` changes.
12. Keep the whole-board bag fade scan unless a production trace shows it is visible; the local 66-node benchmark did not.

## Measurement plan and acceptance criteria

Capture Chrome or Edge DevTools traces for at least five Player Info cycles at:

- 1440×900 (reference desktop)
- 1080×720 (short desktop)
- a narrow desktop/tablet width
- mobile only to confirm the existing mobile exclusion is unchanged

For each run, record:

- scripting, rendering, painting, and composite time per cycle;
- long tasks over 50ms and the function/URL responsible;
- dropped frames during the bag wave, item wave, hold, and depart phases;
- network transfer/cache status and image decode durations;
- JS heap and image/decoded-memory growth after 5 and 20 cycles;
- DOM node count before/after a cycle.

The optimization is acceptable only if the visual smoke/browser checks remain unchanged, the active board remains responsive to hover pause and click-through, and the cache/heap no longer grows with every new random build. A reasonable initial target is no new >50ms long task attributable to Player Info on the reference desktop and no monotonic sprite-memory growth across 20 cycles; set device-specific frame targets after the first trace.

## Changes to avoid without evidence

- Do not remove the diagonal wave, bag-first/item-second sequence, 45ms stagger, hold, depart, or hover pause solely to improve a guessed metric.
- Do not replace transforms/opacity with layout properties such as `top`, `left`, `width`, or `height` in the animation path.
- Do not globally disable the shared pool/fabric renderer; other pages depend on it.
- Do not widen the Supabase query or preload the full catalog for Player Info; the preset intentionally avoids catalog mounting.
- Do not treat browser HTTP caching as proof that repeated JSON parsing or image decode is free.

## Bottom line

The largest risk is not the visible CSS wave itself; it is the work around it: unbounded decoded sprite retention, late image decode, repeated normalization, repeated pooled-board/fabric passes, and duplicate identity hydration. Address the P0 cache/prefetch issue first, then memoize and make the second wave incremental. Those changes can preserve the current screenshots and motion while reducing memory pressure, first-encounter hitches, and repeated main-thread work.
