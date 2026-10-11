# Home page performance audit and implementation plan

## What was measured

Production `https://bpbbuilds.com/` was audited on 2026-10-11 with Chrome DevTools MCP in a fresh, isolated browser context. All page-load runs used a cache-bypassed reload. Results are lab data, not CrUX field data; Chrome reported that no CrUX data is available for this page.

| Test | Conditions | LCP | CLS | Scroll evidence |
| --- | --- | ---: | ---: | --- |
| Desktop load | Default desktop, unthrottled CPU/network | 824 ms | 0.17 | Not tested in this run |
| Mobile load | 390 x 844, Fast 3G, 4x CPU slowdown | 3,658 ms | 0.18 | Not tested in this run |
| Mobile scroll | Same mobile profile; scripted top-to-bottom-to-top scroll over 3.6 s | N/A | 0.00 during scripted scroll | 944 ms total forced reflow work |

No console errors or failed initial requests were found. INP was not measured because the audit did not exercise a representative click/tap interaction.

## Findings and solutions

### 1. Scroll jank is confirmed: synchronous layout work is too expensive

The focused mobile scroll trace recorded `944 ms` of forced reflow work. That is not one continuous 944 ms freeze, nor is it a per-scroll cost, but it is substantial main-thread layout work during a 3.6-second scroll. It is the strongest explanation for the reported scroll lag.

The trace identified overlapping reflow-triggering frames in these paths:

| Path | Time attributed by the trace |
| --- | ---: |
| `js/shared/item-live-art/potion-liquid.js` `drawPotion` | 898 ms |
| `js/shared/backpack-grid/render.js` `render` | 773 ms |
| `js/pages/home/combat-sky/index.js` `scrollTime` | 354 ms |
| `js/pages/home/home-promo-assemble.js` `cellTarget` | 220 ms |
| `js/shared/nav/scroll-logo.js` `pageScrollY` | 97 ms |
| `js/pages/home/home-promo-assemble.js:617` | Top reported trigger |

These values overlap, so they must not be added together. They point to DOM writes being followed by geometry reads that force Chrome to synchronously recalculate layout.

**Solution:** batch reads separately from writes; run one scroll update per `requestAnimationFrame`; cache geometry; use transforms instead of layout-changing properties; and pause non-visible decorative work with `IntersectionObserver`.

**Expected impact:** directly targets the observed 944 ms reflow budget. Success means no long layout task while scrolling, not a promised 944 ms reduction in page-load time.

### 2. The DOM grows too large while the user scrolls

The initial constrained-mobile load had 686 elements. During the scroll trace this rose to `6,185` elements. `div.bpb-bg__items` had 595 children, and Chrome recorded a 53 ms style recalculation affecting 471 elements.

**Solution:** do not keep every decorative backpack, potion, background, and catalog element live in the DOM. Virtualize/recycle repeated elements, use `content-visibility: auto` for off-screen sections, and render or hydrate detailed content only near the viewport.

**Expected impact:** less style/layout work and memory pressure while scrolling. This improves smoothness rather than a single load-time metric.

### 3. The LCP asset is discovered only after JavaScript runs

The LCP element in both load traces was the navigation logo, `assets/brand/logo-backpack-battles.png`. `js/shared/nav.js` inserts it, making it unavailable to the HTML parser. Chrome found it at low priority, without `fetchpriority="high"`.

| LCP breakdown | Desktop | Mobile |
| --- | ---: | ---: |
| LCP | 824 ms | 3,658 ms |
| TTFB | 2 ms | 2 ms |
| Resource-load delay | 752 ms | 3,252 ms |
| Download | 3 ms | 2 ms |
| Render delay | 67 ms | 402 ms |

**Solution:** put the first-view logo directly in initial HTML, retain intrinsic dimensions, and assign `fetchpriority="high"` while it remains the LCP element. Do not lazy-load it. If the home hero should be the visual priority instead, make that hero directly discoverable in HTML and optimize it as LCP.

**Expected impact:** the trace attributes up to 0.75 s desktop and 3.25 s constrained-mobile delay to discovering the current LCP resource. The actual LCP reduction may be lower because a different element can become LCP afterward.

### 4. Layout stability misses the Core Web Vitals target

CLS is 0.17 desktop and 0.18 mobile; good is `<= 0.10`. The main content shifts around initial render. Chrome also identified `bpb-skel-shimmer` as a non-composited `background-position-x` animation contributing to later shifts.

**Solution:** reserve final dimensions with explicit width/height or `aspect-ratio`; ensure skeleton and populated content have identical outer geometry; replace the shimmer with a transform-based overlay or static placeholder; honor `prefers-reduced-motion`.

**Expected impact:** visual stability only, not network speed. This should remove the 0.07-0.08 CLS excess needed to reach the target.

### 5. Images carry about 2.8 MB of avoidable payload

Chrome estimates 2.8 MB of potential image-delivery savings. Examples include `BigBloodthorne.png` downloaded at 297 x 650 but displayed at 24 x 54 (287 KB potential saving), `RubyWhelp.png` at 320 x 337 displayed at 51 x 54 (143 KB), and board-still WebPs at 704 x 576 displayed near 308 x 252 (roughly 107-126 KB each).

**Solution:** generate dedicated home-card and item-sprite derivatives; use `srcset`/`sizes`; serve WebP or AVIF when acceptable; compress board stills; and lazy-load below-the-fold images with intrinsic dimensions.

**Expected impact:** removes 2.8 MB. As an upper-bound illustration, that volume is about 14 seconds of serialized transfer at 1.6 Mbps Fast 3G; actual LCP improvement will be smaller because many images are parallel or below the fold.

### 6. The home route loads a broad, non-critical JavaScript graph

The desktop load made about 500 requests. The route loads home sections alongside board rendering, item live-art, tooltips, premium/Stripe helpers, custom cursor work, create/builds helpers, Supabase, and ESM CDN dependencies. The mobile trace attributes 272 ms main-thread work to ESM CDN code and 74.7 KB transfer to Supabase.

**Solution:** load only first-view code synchronously. Dynamically import below-fold build cards, board rendering/painting, detailed live-art, tooltips, premium/Stripe actions, and create-page helpers at intersection or user intent. Do not initialize custom cursor behavior on this route unless it is essential.

**Expected impact:** up to 272 ms of directly observed third-party main-thread work can be deferred, plus unmeasured parse/network contention. Verify that each split does not delay the first interaction.

### 7. Startup layout work is high on a constrained phone

The mobile page-load trace recorded a 317 ms layout update affecting 447 of 481 nodes and a 153 ms style recalculation affecting 419 elements. It also flagged forced layouts in `featured-stage.js`, nav scaling, and combat-sky initialization.

**Solution:** defer off-screen section assembly; cache measurements; consolidate resize/startup work into one frame; and avoid creating large skeleton catalogs before they are visible.

**Expected impact:** 317 ms is the first measurable layout target. It cannot be added to scroll-reflow savings because the work can overlap.

### 8. Repeat visits cannot reuse assets long enough

Inspected GitHub Pages assets use `cache-control: max-age=600`; Chrome estimates 5.4 MB of short-cache-lifetime opportunity.

**Solution:** use fingerprinted asset filenames plus a CDN/build layer that marks versioned files immutable for a long lifetime, while keeping HTML short-lived.

**Expected impact:** repeat-visit improvement only. It can avoid up to 5.4 MB of retransfers; it does not fix cold-load LCP.

### 9. The page preconnects to an origin it does not use early

Chrome marked the `https://www.youtube.com/` preconnect as unused during the load.

**Solution:** remove it unless an above-the-fold YouTube resource reliably loads; add the connection hint only when that feature becomes relevant.

**Expected impact:** small. It removes unnecessary early socket/TLS work but is not expected to materially change LCP alone.

### 10. Scroll-linked decorative animation competes with user input

The scroll trace specifically includes combat-sky timing, potion drawing, backpack-grid painting, and nav logo effects. Even if each is visually desirable, running all four on every scroll frame creates contention on 4x-throttled mobile hardware.

**Solution:** set a performance budget for scroll work: one animation frame callback, no layout read after a DOM write, skip updates when input is pending, lower effect density on small/slow screens, and turn off decorative animations for reduced-motion users.

**Expected impact:** smoother frame pacing and lower battery use. Measure with a repeat scroll trace; this should be treated as a responsiveness improvement, not a load-time claim.

## Prioritized implementation order

Implement in this order. Re-run the specified check before advancing to the next item.

| # | Change | Why now | Verification / success criterion |
| ---: | --- | --- | --- |
| 1 | Add one `requestAnimationFrame` scroll scheduler; batch reads before writes in `home-promo-assemble`, `backpack-grid/render`, `potion-liquid`, `combat-sky`, and `scroll-logo`. | Directly addresses confirmed scroll jank. | Repeat mobile scroll trace; forced-reflow time falls materially and no individual long layout task appears. |
| 2 | Stop off-screen live-art, potion, backpack, and combat-sky updates with `IntersectionObserver`. | Removes work the user cannot see. | Scroll trace shows fewer active update paths while sections are off-screen. |
| 3 | Cap DOM growth: virtualize/recycle decorative nodes and use `content-visibility: auto` for distant sections. | The DOM reaches 6,185 elements while scrolling. | Scroll trace DOM count and style-recalculation scope fall substantially. |
| 4 | Make the navigation logo (or intended hero) parser-discoverable in HTML, with dimensions and justified priority. | Largest measured mobile LCP opportunity. | Cache-bypassed mobile trace: LCP resource is discovered from HTML, no longer Low priority, and LCP improves. |
| 5 | Fix skeleton/populated layout contracts and replace the background-position shimmer. | CLS currently fails the good threshold. | Desktop and mobile reload traces: CLS `<= 0.10`. |
| 6 | Generate and ship correctly sized responsive derivatives for the largest home images. | 2.8 MB potential image savings. | Network trace: fewer transferred image bytes; visual comparison confirms no quality regression. |
| 7 | Lazy-load below-fold board stills, class art, and catalog images while preserving aspect ratio. | Reduces initial transfer and DOM pressure. | First-viewport request count/bytes decrease; no new CLS. |
| 8 | Dynamically import below-fold build/board/live-art/tooltip modules. | The route currently loads broad shared functionality. | Mobile trace: ESM/CDN main-thread work and initial module count decrease; interaction remains responsive. |
| 9 | Remove create-page and payment/premium helpers from initial home startup unless immediately needed. | They do not support the first viewport for a signed-out visitor. | Module/network trace confirms they are absent until needed. |
| 10 | Reduce startup measurement and scaling work in featured stage, nav, and combat sky. | Initial mobile layout costs 317 ms. | Mobile reload trace: layout/update time falls from the current 317 ms target. |
| 11 | Remove unused YouTube preconnect and add origin hints only for first-view dependencies. | Low-risk cleanup after critical work. | Network-dependency insight no longer reports the unused preconnect. |
| 12 | Introduce immutable caching for fingerprinted static assets. | Improves repeat visits, not cold LCP. | Repeat visit shows cache hits and a materially lower transfer total. |

## Implementation status: steps 1-3

Implemented on 2026-10-11 and verified with a local mobile smoke trace (`390 x 844`, Fast 3G, 4x CPU):

1. **Frame-batched home work:** combat-sky now caches the document scroll range instead of reading it inside every scroll-frame calculation. Existing scroll handlers remain passive and rAF-batched.
2. **Off-screen decorative work:** the home promo loop now waits when its section is beyond a 400px viewport margin, and live potion/holo art inside that decorative promo paints once rather than redrawing continuously.
3. **Deferred home DOM:** class showcase, item explorer, and build vault now mount when they are within a 700px viewport margin rather than all during startup.

The local trace reported no console errors and measured about 1,794 total elements after the scripted scroll, versus 6,185 in the earlier production trace. This is directional local evidence only: the local server and production trace are not directly comparable, and forced-layout work remains in the promo/grid paths. Re-run the production mobile scroll trace after deployment before treating the reduction as a final performance result.

## Measurement discipline

- Use the same cache-bypassed desktop and `390 x 844` / Fast 3G / 4x CPU mobile profiles for before/after comparison.
- Repeat the same top-to-bottom-to-top scroll path after steps 1-3 and 10.
- Record LCP, CLS, initial request count, transferred image bytes, DOM count, forced-reflow time, long tasks, console messages, and failed requests.
- Exercise a representative carousel/navigation tap after the first pass so the next audit can capture INP.
- Do not combine estimated savings. Verify each change independently and retain only improvements that hold in the trace.
