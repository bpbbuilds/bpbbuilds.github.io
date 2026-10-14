# Home Player Info performance optimization handoff

**Date:** 2026-10-13
**Scope:** Home owner-only **Player Info** animation section and the shared placed-board renderer it uses.
**Purpose:** **Improve runtime cost without changing the visible composition, timing, ordering, or responsive appearance.**

## Status

The P0, P1, and measured P2 work is implemented. The section keeps the same player column, board composition, diagonal bag/item wave, hold/depart timing, hover pause, click-through link, and responsive layout. The remaining work is production-device profiling and tuning only; no visual redesign is pending in this optimization pass.

## What changed

### P0 — memory and decode stability

- Added `js/pages/home/home-promo-sprite-cache.js` with a configurable active/next-build window, 192-entry hard cap, LRU touch order, and eviction.
- Player Info warms its initial next build before the first board paint and warms each later next build before that build's first visible wave.
- Older random-cycle sprites are released instead of accumulating for the lifetime of the Home tab.
- Added `scripts/home-promo-sprite-cache-smoke.mjs`; it rotates through 20 cycles and checks cache bounds, current/next retention, next-build warm state, and eviction.

### P1 — repeated CPU/DOM work

- `js/pages/home/home-promo-assemble.js` memoizes each build's mapped placements, ordered placements, bag subset, item map, and sprite URL set against the parsed asset-extras object.
- The three static asset-extra JSON results are shared through a module-level promise cache across Home promo mounts.
- `js/shared/backpack-grid/item-pool.js` computes a cheap bag-fabric input signature before expanding bag cells. The Player Info second wave reuses unchanged FilledSlot nodes rather than rebuilding their HTML.
- Hidden caption authors skip face/cosmetic hydration because the caption is intentionally author-hidden in Player Info.
- Creator-count requests are deferred and their result is applied only when the originating build token is still active.
- `js/shared/backpack-grid/render.js` exposes an rAF-coalesced `setResizePaused()` gate. Player Info holds the gate across the bag/item/depart sequence and releases one deferred resize paint afterward. Other placed boards retain their existing behavior.
- Added `scripts/home-promo-p1-performance-smoke.mjs` for the memoization, hydration, fabric-signature, active-token, and resize-gate contracts.

### P2 — scheduling and measured polish

- Tuned the activity observer lead from `400px` to `240px` in `js/pages/home/home-promo-band.js`. This keeps a near-viewport warm-up window while avoiding work hundreds of pixels before the section is relevant.
- Kept the existing transform/opacity animation model. No Player Info-specific `will-change` rule was added.
- Profiled the bag fade selectors with a representative 66-item/cell board. The local headless run measured approximately 5–6ms for 5,000 two-selector passes (about 0.0011–0.0013ms per pass), so the scan is not visible enough to justify additional cached-node bookkeeping. It remains intentionally unchanged.
- Added `scripts/home-promo-p2-performance-smoke.mjs` to measure viewport activation boundaries, animation names, `will-change`, selector cost, and DevTools performance counters.

## Visual invariants

The optimization code must preserve these existing contracts:

- Player Info has no catalog; the player identity column remains visible.
- Bags appear before items, ordered in the existing top-left-to-bottom-right diagonal.
- The 45ms per-entry stagger, 960ms wave phases, 2.5s hold, and 400ms depart behavior remain unchanged.
- Hover pauses the active animation and timers; leaving resumes the same build.
- The board remains clickable and links to the displayed build view.
- Capacity cells keep the catalog-style opacity fade and retain their current delays.
- Existing 1440px, 1080px, tablet/narrow, and mobile-excluded layout behavior remains covered by the browser smoke.
- Other Home promo launchers and non-Player placed boards do not inherit Player Info-only timing or cache behavior.

## Evidence collected

### Representative data shape

The local `assets/data/author-history-builds.json` sample contains 8 builds, averaging 45 placements and reaching 66 placements at the maximum, with 114 unique item ids. The sprite manifest contains 523 metadata entries; the item-sprite directory contains 649 files totaling about 57.8 MiB. This is large enough for repeated mapping, decode, and DOM work to matter, but not a production-wide distribution.

### P2 browser probe

The latest P2 smoke used a representative 66-item/cell board and reported:

| Counter | Local headless sample |
| --- | ---: |
| Viewport lead boundary | 240px activates; 260px beyond does not |
| Former 400px boundary | 260px beyond would activate |
| Item animation | `bpb-bg-appear-library` |
| Capacity animation | `home-promo-fabric-in` |
| Item/cell `will-change` | `auto` / `auto` |
| Selector scan | ~5.5ms per 5,000 passes (~0.0011ms/pass) |
| Task duration | 0.0217s |
| Layout duration | 0.00033s |
| Recalc-style duration | 0.00165s |
| Layout/style recalculation count | 4 / 4 |

These numbers are regression evidence, not a guarantee for every device. A real production trace is still required for device-specific frame and memory targets.

## Verification run

The following checks pass after the optimization work:

```text
node scripts/home-promo-sprite-cache-smoke.mjs
node scripts/home-promo-p1-performance-smoke.mjs
node scripts/home-promo-p2-performance-smoke.mjs
node scripts/admin-home-player-info-animation-smoke.mjs
node scripts/admin-home-player-info-animation-browser-smoke.mjs
node scripts/admin-home-player-info-wave-smoke.mjs
node scripts/admin-home-player-info-wave-browser-smoke.mjs
node scripts/home-promo-activity-smoke.mjs
node --check js/pages/home/home-promo-band.js
node --check js/pages/home/home-promo-assemble.js
node --check js/pages/home/home-promo-caption.js
node --check js/shared/backpack-grid/item-pool.js
node --check js/shared/backpack-grid/render.js
git diff --check
```

## Remaining production profiling checklist

Run Chrome or Edge DevTools traces at 1440×900, 1080×720, a narrow desktop/tablet width, and the existing mobile-excluded breakpoint. Record:

- scripting, style, layout, paint, composite, and long-task time during both waves;
- dropped frames during bag reveal, item reveal, hold, and depart;
- image decode/network cache behavior for the current and next build;
- JS heap and decoded-image memory after 5 and 20 random cycles;
- DOM node count and ResizeObserver callbacks during a cycle;
- whether any production device shows the bag selector scan as a visible cost.

Do not reduce the stagger, remove the hold/depart phases, add broad `will-change`, or alter the diagonal order based only on a synthetic benchmark. Any further tuning must pass the existing visual/browser smokes at the supported viewport range.

## Related records

- [Exploratory audit and bottleneck findings](./home-player-info-performance-audit.md)
- [Sprite cache smoke](../../scripts/home-promo-sprite-cache-smoke.mjs)
- [P1 performance smoke](../../scripts/home-promo-p1-performance-smoke.mjs)
- [P2 performance smoke](../../scripts/home-promo-p2-performance-smoke.mjs)
