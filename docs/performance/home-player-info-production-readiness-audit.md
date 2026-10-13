# Home Player Info production-readiness performance audit

**Date:** 2026-10-13
**Scope:** Home Player Info promo preset, its Player Info assembly loop, the shared placed-board renderer, sprite/cosmetic loading, and long-lived-cycle behavior.
**Audit goal:** Identify what delays the first visible wave, what can consume CPU/DOM/memory over time, and whether the section is ready for production deployment without changing its visual composition, ordering, timing, or responsive layout.

## Release verdict

The section is stable in the focused synthetic runtime checks. The performance pass below closes the clearest local long-session retention risk without changing the Player Info composition, ordering, wave timing, hover pause, or responsive layout. This audit still does **not** certify device- or network-independent production readiness without a deployed-device trace.

The important pre-fix finding was a finite but real long-session DOM-retention path: the placed-grid pool kept parked item nodes for every distinct placement key it had seen during the mount. Before the fix, one 63-placement board stayed at 63 nodes when repeated 100 times with the same keys, but 12 distinct build-key sets grew the parked pool to **819 item nodes**. After the scoped prune, the same distinct-build probe peaks at 126 nodes during the current/next handoff and ends at **63 retained nodes** (one next-build window).

The largest first-load cost is not the CSS wave. It is the blocking preparation before the first board paint: the nested public-build query, three parsed asset-extra documents, and synchronous awaiting of the current and next build's image decodes. The exact production time is CDN/device dependent and was not measured against a deployed site in this audit.

## What is already protected

The current implementation already includes the major safeguards from the earlier audit:

- A two-build/192-entry decoded sprite cache with eviction and one-build-ahead warm-up.
- Memoized normalized placements, ordered placements, bag subsets, `itemsById`, and sprite URL sets per build and asset-extras version.
- Module-level caching for the three static asset-extra JSON documents.
- Bag-fabric input signatures so the Player Info second wave can retain unchanged FilledSlot nodes.
- A placed-grid resize gate that defers ResizeObserver repaint during the bag/item/depart sequence.
- A dedicated `appearMissing` path so pooled item nodes replay the Player Info item wave without making the first-wave bags animate again.
- A 240px viewport activation lead rather than the former 400px lead.
- Transform/opacity-only animation paths; no broad Player Info `will-change` promotion.
- Active-build guarding for deferred creator-count responses.
- Hidden caption author hydration is skipped when Player Info hides that author.

These controls passed the existing sprite-cache, P1, P2, animation, wave, responsive, skeleton, syntax, and diff checks before this report was written.

## Measured evidence



### Local data and asset shape

The local history sample is useful for sizing work, but it is not a production traffic distribution:


| Measure                           | Result                       |
| --------------------------------- | ---------------------------- |
| Sample builds                     | 8                            |
| Average placements/build          | 45                           |
| Maximum placements/build          | 66                           |
| Unique item IDs                   | 114                          |
| Serialized sample JSON            | 333,216 bytes                |
| `item-shapes.json`                | 230,563 bytes                |
| `socket-offsets.json`             | 38,407 bytes                 |
| `sprite-display.json`             | 182,765 bytes                |
| Item-sprite files present locally | 649                          |
| Item-sprite bytes present locally | 60,641,479 bytes (~57.8 MiB) |


The full sprite directory is not downloaded for one board. Only the current/next build URLs are warmed, but each warm can still issue multiple image requests and decodes before the first visible wave.

### Synthetic maximum-board cycle probe

`scripts/home-promo-production-audit.mjs` mounts the real placed-grid renderer in Chromium with a dense 63-placement board, runs 100 bag/item/clear cycles, then runs 12 distinct placement-key sets to expose parked-pool retention. It measures DOM counts and the browser Performance/Heap domains. This is a regression probe, not a substitute for a real device trace.

Latest local run:


| Measure                                    | Result    |
| ------------------------------------------ | --------- |
| First empty → bags                         | 7.1 ms    |
| First bags → full board                    | 4.1 ms    |
| First clear                                | 1.5 ms    |
| Same-key cycle median                      | 4.6 ms    |
| Same-key cycle p95                         | 7.6 ms    |
| Same-key cycle max                         | 9.5 ms    |
| Bag-stage p95                              | 3.5 ms    |
| Item-stage p95                             | 2.6 ms    |
| Clear-stage p95                            | 3.6 ms    |
| Stable same-key max item nodes             | 63        |
| Stable same-key max visible items          | 63        |
| Stable same-key max bag fabric cells       | 16        |
| Stable same-key max appearing items        | 63        |
| Distinct build-key sets exercised          | 12        |
| Retained item nodes after distinct sets    | 819       |
| Nodes after `grid.destroy()`               | 0         |
| Aggregate task duration                    | 0.57 s    |
| Aggregate layout duration                  | 0.044 s   |
| Aggregate style-recalc duration            | 0.346 s   |
| Aggregate layout/style recalculation count | 341 / 542 |


Interpretation:

- Repeating one build does not grow the board DOM in this probe; the fixed bag/item replay path is stable.
- The pool does grow when placement keys are new. The 819-node result is the equivalent of the original board plus 12 distinct build-key sets, with old entries parked rather than removed.
- `grid.destroy()` removes the board cleanly, so a full page teardown does not leave those nodes behind.
- The synthetic per-cycle scripting cost is modest in headless Chromium. It does not include CDN transfer, image decode/upload, Supabase latency, blob cosmetics, or a low-power CPU/GPU.



## Bottlenecks ranked by production risk



### P0 — first visible wave waits on network and image decode

`playAssemble()` waits for the build data and asset extras, then awaits `warmBuild(firstBuild)`. Player Info also warms the next build before its first board paint. That sequencing prevents decode jank during the wave, but it makes the first visible reveal dependent on the slowest required image decode.

The build query is nested (`builds` → `profiles` → `build_placements` → `items`) and requests up to 12 builds. The local sample is 333 KB serialized for only 8 builds; production payload size can be larger. The three static extras total about 452 KB uncompressed and are fetched in parallel, but their JSON parsing still runs on the main thread.

**Production measurement required:** deployed Chromium/Edge network trace for the Home route, including TTFB, response size, image request count, decode time, and the timestamp from section mount to first bag paint and first item paint.

### P1 — parked placed-grid nodes accumulate across distinct builds

`mountPlacedGrid()` deliberately parks old entries to support keep-alive behavior. Player Info cycles through a fixed fetched set, so the growth is bounded by the union of all placement keys in that set, not infinite. However, 12 dense builds can leave hundreds of hidden item nodes in the DOM, along with their child sprite/shadow/marker structures.

This was the main remaining “bogs down over time” risk. It increased DOM traversal and style-recalculation scope even when only the current build was visible. The current `spriteCache` bound did not limit this DOM pool.

**Implemented:** `mountPlacedGrid()` now exposes a scoped `pruneParked({ keepKeys })` operation. Player Info calls it after departure/clear and retains only the next build's placement keys, while Create/build pages keep their existing keep-alive pool behavior. The production probe now repeats the 12-build rotation with the same prune policy and asserts the retained DOM stays bounded.

### P1 — first-time blob cosmetics add asynchronous image work

The visible Player Info identity calls `hydrateFaces()` after each build paint. The cosmetic map is cached, but a blob can add up to six overlay image elements, and the first encounter can request/decode those images. The result is an asynchronous DOM update during the visible cycle. The hidden caption author path is already skipped, so this duplication is limited to the visible Player column.

**Implemented:** `warmFaceAssets()` prewarms the active/next Player Info cosmetic URLs with a URL-keyed decode promise cache. `hydrateFaces()` still owns the same visible DOM composition and fallback behavior.

### P1 — nested build query and event-visibility RPC determine startup latency

`fetchRealBuilds()` waits for `syncEventBuildVisibility()` before requesting the build list. The RPC is module-promise cached, so repeated mounts in one page do not repeat it, but it still sits on the initial data path. The nested query returns all placement/item data needed for the loop, which is convenient but payload-heavy.

**Recommended production measurement/fix:** record the RPC and nested query separately in a deployed trace. If the RPC is not required for this visual surface, move it off the first-paint path; otherwise keep the server-side visibility guarantee but return a smaller purpose-built promo projection.

### P2 — creator-count request can repaint the visible identity

The count is intentionally deferred and active-build guarded, which prevents stale updates. The first visit to each author still adds one Supabase head-count request and a second identity paint. It is unlikely to dominate board animation, but it can contend with the first cycle on a slow connection.

**Implemented:** creator counts remain deferred and active-build guarded, and now use a module-level bounded cache plus in-flight promise de-duplication across promo mounts. The count request still never blocks the board wave.

### P2 — animation setup and fabric scans are measurable but currently small

The item wave clears/restarts classes, forces one intentional reflow, and writes a stagger to each appearing item. FilledSlot fabric writes one delay/class per cell. The local P2 probe reports transform-based item animation, opacity-based fabric animation, and `will-change: auto`; its 5,000-pass selector check was about 5.2 ms total (~0.0010 ms/pass).

No evidence justifies changing the 45 ms stagger, 960 ms wave phases, 2.5 s hold, diagonal order, or transform/opacity model. Those are visible product contracts.

### P2 — lifecycle teardown is not an explicit public API

The promo band creates an IntersectionObserver and pointer listeners, while `playAssemble()` owns a long-running loop that exits when the board disconnects. The live Home page mounts this once, so this is not expected to grow during ordinary browsing. Repeated admin test mounts/unmounts would be safer with an explicit teardown that disconnects the observer, removes listeners, cancels the pending count timer, and destroys the grid.

## Overtime stability matrix


| State                               | Current behavior                                                           | Audit status                 |
| ----------------------------------- | -------------------------------------------------------------------------- | ---------------------------- |
| Same build repeated                 | Pool nodes and fabric remain stable in 100 synthetic cycles                | Pass                         |
| Random sequence over fetched builds | Sprite cache is bounded to active/next and 192 entries                     | Pass in focused smoke        |
| Random sequence over fetched builds | Player Info prunes parked nodes outside the next-build key window      | Pass in local retention probe |
| Creator counts                      | Map is bounded by authors in the fetched set; responses are token-guarded  | Pass, network cost remains   |
| Asset extras                        | Module promise cache avoids repeated parse/fetch per root                  | Pass for one production root |
| Cosmetic metadata                   | Module-level map plus active/next URL decode warm-up                     | Pass in focused smoke; device trace remains |
| Resize during wave                  | rAF-coalesced and deferred by Player Info gate                             | Pass in focused smoke        |
| Full section teardown               | `grid.destroy()` removes board nodes                                       | Pass in synthetic probe      |




## Production-readiness checklist

Before marking this surface fully production-ready, capture one real Chrome or Edge trace at 1440×900 and 1080×720 (plus a narrow desktop/tablet width):

- [ ] Record first bag paint and first item paint relative to Home navigation and section mount.
- [ ] Record Supabase RPC/query TTFB, response bytes, and parse time.
- [ ] Record asset-extra transfer/parse time and image request/decode/upload time for current and next builds.
- [ ] Record dropped frames and long tasks during bag wave, item wave, hold, and departure.
- [ ] Record JS heap, DOM node count, and decoded-image memory after 1, 5, and 20 distinct build rotations.
- [x] Add/verify a capped placed-grid prune for parked Player Info nodes; then repeat the 12-build retention probe.
- [ ] Test repeated mount/unmount in the admin performance lab for observer/listener cleanup.



## Commands and artifacts

The reproducible synthetic audit is:

```text
node scripts/home-promo-production-audit.mjs
```

Related existing checks:

```text
node scripts/home-promo-sprite-cache-smoke.mjs
node scripts/home-promo-p1-performance-smoke.mjs
node scripts/home-promo-p2-performance-smoke.mjs
node scripts/admin-home-player-info-animation-smoke.mjs
node scripts/admin-home-player-info-animation-browser-smoke.mjs
node scripts/admin-home-player-info-wave-smoke.mjs
node scripts/admin-home-player-info-wave-browser-smoke.mjs
git diff --check
```



## Final finding

The animation pipeline no longer shows a same-build runtime growth pattern in the local stress probe. The Player Info loop now also bounds parked DOM retention to the next-build window, prewarms the active/next blob cosmetic images, and reuses creator-count requests across mounts. The remaining production work is a real deployed-device trace for network/decode/long-task budgets, so the honest status is **production-ready in behavior and locally optimized, with device-specific performance still to be measured** rather than a blanket 100% certification.
