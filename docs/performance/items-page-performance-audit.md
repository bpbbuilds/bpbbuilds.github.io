# Items page performance audit

**Date:** 2026-10-14
**Scope:** `/items/` initial load, filters, catalog scrolling, responsive layout, tooltips/live art, and item spotlight interactions.
**Goal:** make the page publish-ready without changing the visible catalog, filter rules, item ordering, or responsive composition.

## Verdict

The page is functional, but it is not publish-ready for a performance-sensitive desktop or a throttled/average machine. The two reported problems have the same root shape: catalog work is being performed in the user-visible path.

1. A filter change does the filter computation, a second filter computation, a full filtered-list sort/pack decision, DOM parking/placement, and then waits for the nearby images to load/decode before the paint is considered complete.
2. Scrolling intentionally waits 64 ms after movement (or up to 320 ms during a long fling) before refreshing the virtual window. The catalog also keeps a large overscan band and keeps parked nodes/sprites warm, so the pool grows to the entire 518-item library after a scroll session.

The fix plan below separates **state/layout work** from **sprite decode and non-critical decoration**. The catalog should update its visible geometry immediately, then progressively attach sprites in viewport priority. No filter or scroll interaction should wait for every nearby image.

## Measurement notes

Measurements were taken against the local page at `http://127.0.0.1:5501/items/` with Chromium at 1440×900. They are directional evidence, not a production CDN/Supabase benchmark. A 4× CPU throttle was used to expose interaction cost.

| Scenario | Observed result | Why it matters |
| --- | ---: | --- |
| Static shell navigation timing | DOMContentLoaded ~204 ms | The HTML shell is not the problem; async boot is. |
| Catalog ready | first grid ready ~1.07 s in the measured run | Catalog startup is after the shared nav/access gate and several data assets. |
| Initial catalog | 518 items; 315 item nodes mounted; ~2,805 px scroll height | A large first window is intentionally mounted before the user scrolls. |
| Type filter, normal CPU | ~111 ms from click to visible update | Acceptable on a fast development machine, but not guaranteed. |
| Search (`hammer`), normal CPU | ~115 ms | The visual update includes more than the predicate itself. |
| Type filter, 4× CPU | ~878 ms | Noticeable delay; this is the reported “filter does not update instantly” failure. |
| Search (`hammer`), 4× CPU | ~596 ms | Search is debounced only 40 ms, then rendering/decode dominates. |
| Scroll stress | max frame gap ~66.7 ms; 55 frames >16.7 ms; 7 >33 ms; long tasks measured at ~59/92/65 ms | This is visible scroll hitching, not only a synthetic timing difference. |
| After scrolling | pool reaches 518 item nodes | The virtualizer is retaining the whole catalog, increasing DOM/style/memory work. |
| Initial sprite state | ~148 of 315 visible nodes still sprite-pending after the measured warm period | The grid can be laid out while visible item faces are still waiting on image work. |
| Initial resource set | ~250 requests; ~11.3 MB transferred in the local run; theme/brand assets are several MB | Shared chrome and image layers consume the critical path before item interaction. |

## Section 1 — Shared navigation and page bootstrap

**Relevant paths:** `js/pages/items/index.js:7-13`, `js/shared/nav.js:71-134`, `js/shared/access-gate.js`, `js/shared/nav/session.js`.

### Finding 1 — Must: catalog startup is blocked by shared nav work

**What:** `boot()` awaits `initNav()` before starting `initItemsCatalog()`. `initNav()` first awaits site access, builds a hidden nav, waits for every nav image, then awaits auth/admin/founding painting.

**Problem:** an item page cannot begin its data/layout work while the nav waits on access, network auth/profile calls, founding status, crown/profile art, and image completion. This makes the first useful catalog paint depend on unrelated chrome and user-state latency.

**Fix:** start the catalog bootstrap in parallel with nav/access work. Keep access authorization enforced; this is only scheduling. Render the nav skeleton/layout immediately, defer non-critical auth/founding decoration until after the catalog has a stable first window, and do not make footer/social assets part of the catalog critical path.

**If skipped:** slow Supabase/auth/CDN responses continue to delay the item catalog even when item data is locally cached.

### Finding 2 — Should: oversized shared image assets are on the critical path

**What:** the measured request set includes approximately 1.37 MB `logo-bpb.png`, 1.34 MB Discord art, 1.22 MB YouTube art, plus other brand/theme assets. `waitForImages()` waits for all nav images before replacing the skeleton.

**Problem:** large decorative images compete with item data and first catalog sprites. The footer social images are not needed to filter or scroll items.

**Fix:** provide visually equivalent WebP/AVIF/appropriately sized variants, use intrinsic dimensions, and lazy-load below-fold/footer/social art. Keep the nav’s critical logo/banner subset small and cacheable. Validate at 1440, 1080, short desktop, tablet, and mobile.

**If skipped:** bandwidth and image decode contention remain a first-load cost, especially on work laptops and mobile/tablet hardware.

## Section 2 — Catalog data and first paint

**Relevant paths:** `js/pages/items/catalog/index.js:617-675`, `:718-756`, `js/pages/items/catalog/data.js`, `js/shared/item-live-art/index.js`.

### Finding 3 — Must: too much data is required before the real catalog is promoted

**What:** initialization awaits the items query, combinations, library layout, sprite display, socket offsets, shapes, origins, class masks, mentioned stacks, sprite thumbs, and `loadLiveArt()` together (`catalog/index.js:637-675`). The local asset group included about 1 MB of data JSON before images.

**Problem:** only item identity, ordering, shape, and the first viewport are required to show a useful catalog. Recipe/spotlight metadata, live-art definitions, and some overlays are interaction or hover concerns. Waiting for all of them lengthens time-to-first-catalog and makes a slow optional request look like a page failure.

**Fix:** split bootstrap into phases:

1. Critical: item rows, library order/layout, shapes needed for the first window, and thumb URL metadata.
2. First interaction: remaining overlay metadata and the next viewport’s sprites.
3. Idle/spotlight: recipe index, builds-for-item data, live-art definitions and effect layers.

Cache immutable JSON with content hashes/long-lived cache headers and share module-level promises so repeated page mounts do not refetch.

**If skipped:** first paint remains coupled to the slowest optional request and cold-cache catalog loads stay inconsistent.

### Finding 4 — Should: initial overscan is much larger than the viewport

**What:** the Items page passes `virtualPadEm: 24` (`catalog/index.js:466-477`), while the shared virtualizer default is 6 em. The first measured paint mounted 315 nodes for a 623 px-high scroller.

**Problem:** the page pays DOM/style/image work for a broad band that the user cannot see. This helps a fast wheel in theory, but it increases first paint and decode contention—the exact work that makes filters feel delayed.

**Fix:** replace the fixed 24 em pad with a measured adaptive band (start around 6–10 em, tune from scroll velocity and device class). Keep one viewport ahead for fast input, but do not warm multiple viewport heights on initial load. Record the chosen value and verify 1440/1080/tablet/mobile.

**If skipped:** every filter and initial layout continues to process hundreds of off-screen entries before the user sees the result.

## Section 3 — Filters and search

**Relevant paths:** `js/pages/items/catalog-filters.js:187-319`, `js/pages/items/filter-logic.js:258-406`, `js/pages/items/catalog/index.js:450-461`, `:509-565`.

### Finding 5 — Must: filter changes wait on rendering and image warming

**What:** a control change calls `schedulePaintGrid()`. It runs `filterItems()` immediately for the count, then on the next animation frame `paintGrid()` runs `filterItems()` again, sorts/group-sorts, rebuilds the packed layout when needed, parks/repositions nodes, and `paintNow()` awaits `warmItemSprites()` for all entries near the viewport (`item-pool.js:1037-1053`). `warmItemSprites()` attaches images and waits for every load/decode promise (`item-pieces.js:436-459`), with a per-image timeout.

**Problem:** the filter result is logically ready before the catalog visually changes, but the visible update is coupled to network/cache/decode work. On 4× CPU, the measured type filter took ~878 ms and search ~596 ms. A slow or broken nearby image can gate a paint until its timeout path resolves.

**Fix:** make filter application two-phase and synchronous from the user’s perspective:

- Compute one filtered result and one stable signature per input state; reuse it for the count and paint.
- Repack/park/place the visible geometry immediately and remove pending entries from the old result immediately.
- Attach sprites for the first viewport asynchronously in priority order. Do not `await Promise.all()` before completing the filter paint. Unhide each item when its own image is ready; retain a deterministic placeholder for slow/error images.
- Cancel/ignore stale sprite work when a newer filter state arrives.
- Keep the search debounce short (40–80 ms for typing) but do not use debounce to mask render/decode latency.

**Acceptance:** on a 4× CPU profile, a filter click/search shows the correct item set and count in under 100 ms of main-thread work, with sprite faces filling progressively afterward; no stale previous result remains visible.

**If skipped:** the page will continue to feel broken on slower machines even if the filter predicate itself is optimized.

### Finding 6 — Should: filter predicate allocates and recomputes per item

**What:** `filterItems()` builds active arrays on each call; `itemTypes()` creates a `Set` for each item when type filters are active; search lowercases each item name per pass; metadata fallbacks allocate `Set`s; `sortByLibraryOrder()` copies and sorts the result (`filter-logic.js:258-406`, `catalog/data.js:196-206`).

**Problem:** these are small at 518 items, but the function is called twice per interaction and again during initialization. They become measurable under CPU throttle and combine with packing/DOM work.

**Fix:** normalize once during data mapping: lowercase name, normalized types/stacks/classes, numeric rarity/order, and prebuilt membership sets. Compile a filter signature and cache results by signature + data generation. Reuse the same array for count and paint. Cache default library order; only sort the filtered subset when grouping or an explicitly different order is selected.

**If skipped:** CPU cost scales linearly with the catalog and remains duplicated for every click/search/resize path.

### Finding 7 — Should: a filter state change invalidates the whole packed layout

**What:** `showPacked()` creates a pack key by joining all filtered IDs and calls `packItems()` when the key changes (`item-pool.js:1079-1105`). `packItems()` scans candidate cells until every item shape fits (`pack.js:79-145`).

**Problem:** changing one toggle repacks every matching item and then computes a new visible slice. This is correct, but it is unnecessary work for common filter changes and competes with the input frame.

**Fix:** cache pack results by `{filter signature, grouping, flow, columns, compact, data generation}`. For the default ungrouped library, keep the exact persisted layout whenever possible. For grouped results, move packing to an idle task or worker-compatible pure path and commit the result once; never block sprite attachment on packing.

**If skipped:** large result sets and grouping remain a source of filter latency after sprite work is fixed.

## Section 4 — Catalog scrolling and virtualization

**Relevant paths:** `js/shared/backpack-grid/item-pool.js:899-1134`, `:1148-1203`, `js/shared/backpack-grid/item-virtual.js:48-91`, `js/shared/backpack-grid/item-pieces.js:496-530`, `js/shared/backpack-grid/backpack-grid.css:42-162`.

### Finding 8 — Must: virtual-window refresh is deliberately late

**What:** the passive scroll handler waits 64 ms after the last scroll event, with a 320 ms maximum wait during a long fling (`item-pool.js:1148-1203`). Only then does it calculate the visible slice, park/create nodes, and schedule sprite warming.

**Problem:** native scrolling continues while the DOM window is stale. During a fast scroll, the user can see empty/pending cells or an old window, then a burst of work lands after the delay. The stress run showed a 66.7 ms max frame gap and long tasks of ~59/92/65 ms.

**Fix:** keep the scroll listener passive, but use a cheap rAF window update immediately for the next viewport and a trailing catch-up pass after settling. Split the work: position/park only in the scroll frame; decode/attach sprites outside that frame. Use scroll velocity to expand the next-window band only during a fast fling, then shrink it after settling.

**Acceptance:** no blank/pending band appears during a normal wheel/trackpad scroll, and a 4× CPU trace keeps scroll frame work below ~8 ms with no long task over 50 ms attributable to the catalog.

**If skipped:** scroll will continue to feel sticky even if the first catalog paint is fast.

### Finding 9 — Must: parked pool and decoded sprites are unbounded for a page session

**What:** `parkWarmEntry()` keeps off-window nodes/sprites warm. After scrolling, the measured pool contains all 518 items, not only the viewport plus a small reserve.

**Problem:** retaining every DOM subtree and decoded image increases memory, style recalculation, hit-testing, and later filter/resize work. It also makes long sessions degrade, matching the report of lag that gets worse over time.

**Fix:** use a bounded pool/LRU. Keep the current viewport, one next viewport, and a small configurable reserve. When the cap is exceeded, remove the least-recent off-window entries and release their sprite sources/live-art layers. Reuse nodes for nearby entries; do not destroy/recreate the current window. Measure pool size and decoded-image memory in a repeated scroll/filter cycle smoke.

**If skipped:** memory and DOM cost grow toward the full library and later interactions get progressively slower.

### Finding 10 — Should: every visible-slice calculation scans all placements

**What:** `placementsNearViewport()` loops through every placement and recalculates item bounds (`item-virtual.js:48-91`). The same pattern is used for warm/appear culling.

**Problem:** 518 is not large, but this scan runs during scroll, filter, and resize paths. It is avoidable and becomes more expensive as the library grows.

**Fix:** cache each placement’s numeric bounds and index placements by row (and column for horizontal fill). Query only the rows intersecting the viewport plus the overscan band. At minimum, cache `itemHeightEm`/`itemWidthEm` in normalized item metadata so no shape lookup is repeated in the scroll frame.

**If skipped:** scroll CPU grows linearly with every future catalog expansion and remains coupled to main-thread scrolling.

### Finding 11 — Should: resize can trigger another full pack/paint during active interaction

**What:** `catalog-responsive.js:21-71` observes both the host and bag, schedules a rAF, and changes columns around breakpoints. Each column/fill-width change invalidates packing and the visible window.

**Problem:** scrollbar appearance, browser zoom, or a short desktop resize can cause repeated repacks while the catalog is already decoding/scrolling.

**Fix:** commit only the final size in a frame, suppress resize repaints during active scroll/appear/decode, and cache layouts by column count. Ignore sub-pixel/scrollbar-only changes; the grid already has a resize epsilon in `item-pool.js` and should use the same rule at the responsive boundary.

**If skipped:** resizing or opening a responsive filter drawer can produce a burst of repack and sprite work.

## Section 5 — Sprites, tooltips, and live art

**Relevant paths:** `js/shared/backpack-grid/item-pieces.js:430-481`, `:496-530`, `js/shared/item-live-art/index.js`, `js/shared/backpack-grid/item-pool.js:810-859`, `js/shared/tooltip.js` and `js/pages/items/catalog/index.js:758-760`.

### Finding 12 — Must: sprite warming is a blocking batch

**What:** `paintNow()` awaits all nearby `warmItemSprites()` work before finishing the paint. Each item may attach stills, full layers, and live-art mounts; each image waits for load/decode or a timeout.

**Problem:** image decode is not a reliable UI synchronization point. It is variable across machines, can be delayed by cache/network, and can leave filter/scroll work waiting on unrelated entries.

**Fix:** make sprite warming a cancellable priority queue. First attach the static thumb URL without waiting; decode only the current viewport in small batches; decode the next viewport at idle priority. Resolve each item independently and keep a lightweight error/placeholder state. Pause or cancel the queue when the user filters or scrolls again.

**If skipped:** any slow image can delay a whole visible update and produce the “items are not loaded fast enough” symptom.

### Finding 13 — Should: live art can add animation and layer work to scrolling

**What:** hover/focus delegates activate live art; potions can remain animated while visible, and the global live-art scheduler has a draw cap. Layer assets include large noise/effect files.

**Problem:** moving across many items or scrolling through potion/holo entries can create canvas/WebGL/RAF and texture upload work during interaction. The cap limits damage but does not make activation free.

**Fix:** keep static stills while scrolling; activate live art only for the focused/hovered item or spotlight, pause when the tab is hidden, and hard-cap active canvases per page. Preload only the small static thumb; load effect layers on first activation and release inactive layers after a bounded idle period.

**If skipped:** fast pointer movement and potion-heavy sections can reintroduce jank after catalog virtualization is fixed.

### Finding 14 — Should: tooltip work is correctly delegated but should not invalidate catalog paint

**What:** tooltips are wired once after the initial paint and hidden on every `paintGrid()` call. Switching filters while a tip is open can cause tooltip teardown/transition work alongside catalog repaint.

**Problem:** tooltip animation is not the primary bottleneck, but it competes with the same frame as filtering and can cause extra style/layout work on a dense item DOM.

**Fix:** keep delegation, but schedule hide/switch after the catalog geometry commit; avoid measuring the tooltip during scroll; pause tooltip transitions while the catalog is actively scrolling and restore them on settle. Do not clone full item layers for a hover tooltip when a static thumb is sufficient.

**If skipped:** filter/scroll improvements can still show occasional one-frame flashes or input lag when a tooltip is open.

## Section 6 — Item spotlight, recipes, and builds

**Relevant paths:** `js/pages/items/spotlight.js`, `spotlight-recipes.js`, `spotlight-builds.js:244-319`, `js/pages/items/spotlight.css`.

### Finding 15 — Should: spotlight opens a full-size clone and can do network work on the interaction path

**What:** opening an item creates a full-res item clone/underlay and FLIP transition. Recipe data is indexed locally, while builds-for-item performs `syncEventBuildVisibility()` and Supabase queries before rendering (`spotlight-builds.js:244-319`).

**Problem:** the main catalog can be responsive while the click appears stalled waiting on a large sprite decode or two remote build queries. Full-resolution layers also compete with the catalog’s sprite queue.

**Fix:** open the spotlight shell immediately with the static thumb and skeleton panels. Load full-resolution art and secondary recipe/build panels after the open animation. Cache by item ID, cancel stale requests on close/new item, and bound the build result/card image count. Keep auth/visibility checks server-side.

**If skipped:** item click feels slower than hover/filter and can trigger a burst of memory/decode work.

## Section 7 — Filters rail, responsive layout, and CSS

**Relevant paths:** `js/pages/items/catalog.css`, `js/pages/items/filters.css`, `js/shared/backpack-grid/backpack-grid.css`, `js/pages/items/wheel-to-grid.js`.

### Finding 16 — Should: filter rail synchronization does broad DOM work

**What:** `syncFilterUi()` queries every filter control and updates classes/ARIA after each toggle (`catalog-filters.js:337+`). The custom wheel bridge uses a non-passive listener on the filter rail and performs lerped rAF writes when forwarding to the catalog (`wheel-to-grid.js:94-201`).

**Problem:** this is not the main catalog cost, but filter clicks can combine broad control updates, catalog repaint, and wheel forwarding. On short desktops the rail and catalog can both be active scroll surfaces.

**Fix:** update only the changed control and derived group state; batch label/count changes in one microtask. Keep the wheel listener limited to the rail, never the catalog scroller, and stop the lerp immediately when native scrolling takes over. Profile short 1080p and tablet layouts where both rails overflow.

**If skipped:** filter interactions remain more expensive than their state change requires and can feel inconsistent on short screens.

### Finding 17 — Nice: CSS/DOM containment is conservative because of decorations

**What:** `backpack-grid.css` explicitly avoids `content-visibility` because stars/diamonds can sit outside the item body AABB (`backpack-grid.css:162`). The item grid therefore relies on JS virtualization and still has a large absolute-positioned DOM.

**Problem:** the browser cannot skip as much style/paint work as it could with containment.

**Fix:** after the pool cap and sprite queue land, test scoped `contain: layout paint` on parked/off-window wrappers and a separate decoration layer that stays inside its item bounds. Do not add `content-visibility` blindly; retain visual effects and verify tooltip hit targets at all breakpoints.

**If skipped:** the page retains higher style/paint cost, but this is lower priority than the JS window and decode fixes.

## Publish-ready fix order

### P0 — required before release

- [x] Start catalog bootstrap in parallel with nav decoration; keep access checks intact.
- [x] Make filter paint synchronous for geometry/count and move sprite decode to cancellable per-item background work.
- [x] Replace the 64/320 ms scroll-only refresh with an immediate cheap rAF window update plus trailing catch-up.
- [x] Bound the virtual DOM/decoded-sprite pool; evict old off-window entries with an LRU.
- [x] Reduce/adapt the 24 em overscan and prioritize current/next viewport only.
- [x] Add normalized filter metadata and one cached filter result per state signature; remove the duplicate `filterItems()` pass.

Completed in this pass: Itemiary now measures the viewport and adapts its base 6em overscan up to 14em during faster movement instead of mounting a fixed 24em band; the visible composition and ordering remain unchanged. Filter metadata is normalized once per catalog data generation, and a bounded state-signature cache reuses one result for the count, paint, initialization, and responsive repaint paths. Together with the first four P0 fixes, catalog initialization, filtering, sprite readiness, and scrolling are decoupled from slow optional work. No markup, dimensions, visual styling, or access behavior changed.

### P1 — required for a stable “publish-ready” interaction budget

- [x] Cache packed layouts by filter/group/column signature; preserve the exact default library layout.
- [x] Cache placement bounds and query visible rows rather than scanning every placement.
- [x] Defer live-art layers and keep only focused/spotlight animation active; pause when hidden.
- [x] Open spotlight immediately and defer full art/build queries behind a skeleton/cache.
5. Defer/lower-size nav/footer decorative images and cache immutable data assets.
6. Coalesce responsive column changes and suppress repack while scrolling.

### P2 — polish after P0/P1 profiling

1. Optimize filter-control DOM updates and wheel forwarding.
2. Add scoped CSS containment only after decoration bounds are proven safe.
3. Convert remaining large decorative PNGs to equivalent modern formats and verify visual parity.

Completed in this pass: packed Itemiary layouts now use a bounded 24-entry LRU keyed by flow, column/row limit, compact mode, grouping values, item order, and normalized item bounds. The persisted/default placed library path is unchanged. Placement width/height bounds are computed once per layout and indexed by row; scroll-window queries inspect only intersecting rows while preserving placement order and the previous horizontal/vertical inclusion rules. No markup, dimensions, styling, animation timing, or responsive behavior changed.

Completed in this pass: Itemiary live art now paints the same first frame but does not keep idle catalog potions/holos on a continuous RAF; hover/focus and spotlight entries opt into animation, and both the JS scheduler and CSS glow timelines pause when the document is hidden. Spotlight geometry and the existing immediate tooltip remain synchronous, while live-art mounting and recipe/build detail work move to the next frame; completed build results use a bounded cache. No visible composition, dimensions, or interaction affordances changed.

## Acceptance checks for the fixes

- **Initial load:** catalog first-window geometry appears without waiting for auth/founding/footer decoration; record LCP, first catalog paint, and time-to-interactive on cold cache and warm cache.
- **Filtering:** type/class/rarity/search/grouping update the count and visible geometry in ≤100 ms main-thread work on a 4× CPU profile; no stale entries remain; images progressively fill without blocking the state change.
- **Scrolling:** no blank band during wheel/trackpad scroll; no catalog long task >50 ms in a 4× CPU trace; median frame stays near 16.7 ms on a normal desktop; verify fast fling and reverse scroll.
- **Memory:** after 10 filter/scroll cycles, DOM pool and decoded sprite queue remain under fixed caps; no monotonic growth toward all 518 nodes unless the cap is intentionally configured that way.
- **Responsive:** verify 1440 desktop, 1080/short desktop, narrow desktop/tablet, and mobile; check filter rail scroll, catalog scroll, resize, zoom, and reduced motion.
- **Interaction:** tooltip, hover/live art, spotlight, recipes, and builds panel remain correct while a filter or scroll is in progress; stale async work cannot repaint a newer state.
- **Regression:** run syntax checks, focused browser smokes, `git diff --check`, and a production-like build/static-server smoke with cache disabled and enabled.

## Not checked in this audit

- Real production CDN cache headers, compression, HTTP/2/3 prioritization, and geographic latency.
- Supabase server query plans, RLS timing, or production row counts beyond the local 518-item dataset.
- Long-session heap snapshots on the user’s work computer and real mobile Safari/Chrome devices.
- Accessibility/performance interaction with browser extensions, privacy filters, or corporate proxies.
- A DevTools trace after each proposed fix; the next implementation task should capture before/after traces using the same scripted filter and scroll scenarios.

## Final assessment

All six P0 items and the first four P1 items are implemented and checked above. The page still benefits from the remaining P1 work—decorative-image prioritization and responsive repack coalescing—before calling the entire performance program publish-ready. The completed work keeps catalog bootstrap, filtering, packed layouts, placement queries, live-art scheduling, spotlight detail work, scroll windows, sprite readiness, and memory bounded without changing the rendered composition.
