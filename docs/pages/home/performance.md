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

### Background-specific optimization options

The combat sky is a special case: it is fixed behind the whole Home page, so it cannot simply be lazy-loaded once the hero leaves the viewport. The current implementation creates a 1920×1080 stage with roughly a dozen masked sprite layers, then updates many CSS custom properties on every scroll animation frame. The stage is compositor-promoted with `transform`, but the color changes still invalidate paint for the masked layers. The trace attributed 354 ms to `combat-sky` in the original production scroll and 200 ms in the updated local trace; these numbers overlap other work and are not additive.

The source background set is about **2.07 MB** before browser decoding: `Speckles.jpg` is 944 KB, `Hill2.png` 375 KB, `Hill1.png` 322 KB, `Hill3.png` 140 KB, and `Path.png` 131 KB. A serialized Fast 3G upper bound for that full set is roughly 10 seconds, but the browser requests assets in parallel and not all delay LCP. Treat that figure as a payload-risk bound, not a measured load delay.

| Option | Scroll smoothness | Load / memory effect | Visual trade-off | Risk and effort |
| --- | --- | --- | --- | --- |
| **1. Static mobile/slow-device mode**: keep one pre-painted day/night background on small screens or when reduced motion is enabled; remove scroll-linked `applyTime` updates. | **Highest immediate gain** for phones; removes the combat-sky scroll callback and nearly all of its paint work. | One small derivative can reduce mobile bytes and decoded surfaces; exact savings require generating the derivative. | The day-to-night scrub is replaced by a fixed scene or a single short opacity transition. | **Implemented locally.** Low risk / low effort; repeat the constrained-mobile scroll trace to measure the actual reduction. |
| **2. Coarse stepped animation**: update the sky only when scroll progress crosses 2–5% buckets, with a short compositor-only transition between buckets. | High; turns dozens of per-frame color changes into a small number of updates during a scroll. | No required asset change; can reduce CPU and paint frequency, but does not reduce the 2.07 MB source set by itself. | Slightly less exact scrub fidelity; motion still reads as continuous. | **Implemented locally.** Uses 40 desktop buckets (2.5%) and 120 ms transform/opacity transitions; compare frame pacing before calling the gain measured. |
| **3. Pre-baked checkpoint layers**: render 4–8 day/night snapshots as flattened WebP/AVIF images and crossfade two adjacent snapshots with `opacity`/`transform`. | **High**; one or two composited layers replace many mask recolors and CSS-variable writes. | Usually fewer decoded layers and potentially 30–60% lower transfer than the current PNG/JPEG set, but this must be measured after export. | Color transitions are approximate between checkpoints; too few snapshots can show banding or noticeable steps. | **Medium risk / medium effort.** Best balance if preserving the overall art direction matters. |
| **4. Convert masks and textures to responsive WebP/AVIF derivatives**: produce mobile and desktop sizes for the hills/path and omit or shrink speckles on mobile. | Indirect but meaningful; smaller decoded textures reduce paint and memory pressure. | Potentially the largest byte win. The current 2.07 MB set is the baseline; actual savings depend on alpha quality and dimensions. | Compression artifacts may show around mask edges; AVIF encoding/decoding needs browser QA. | **Medium risk / medium effort.** Preserve PNG fallbacks for unsupported or visibly degraded assets. |
| **5. Reduce active layer count by viewport/profile**: keep sky, two hills, path, and one celestial layer on phones; retain windmill/speckles/full detail on desktop. | High on constrained phones because fewer masks repaint per update. | Fewer requests, decodes, and compositor surfaces; likely lowers both transfer and memory. | Less depth/detail on mobile, but the scene silhouette remains recognizable. | **Low–medium risk / medium effort.** Gate by viewport and motion preference, not by user-agent sniffing. |
| **6. Canvas 2D with cached frames**: draw a small set of precomputed frames to one canvas and change the frame index from scroll progress. | High if frames are cached and drawing is throttled; avoids layout and many DOM style mutations, though canvas paint still costs CPU. | Can reduce DOM memory; asset bytes stay similar unless frames are compressed into an atlas/video. | Less flexible per-layer tinting and more work for crisp scaling/retina output. | **Medium–high risk / high effort.** Requires pixel-ratio, resize, accessibility, and image-decode testing. |
| **7. OffscreenCanvas/WebGL or a scrubbed video**: move rendering off the main thread or decode a compressed animation stream. | **Potentially highest**, especially on long scrolls, because main-thread scroll handling becomes minimal. | A video/atlas can reduce requests, but decode/GPU memory and seek behavior vary widely on mobile. | Video seeking can feel delayed; exact frame seeking, reduced motion, and poster behavior need careful handling. | **High risk / high effort.** Consider only after the CSS/static/checkpoint options fail the target. |

#### Recommended order for the background

1. **Implemented locally:** add a static mobile/slow-device fallback and verify the same scroll trace. This isolates how much of the reported lag belongs to the combat sky without changing desktop art.
2. **Implemented locally:** if desktop fidelity must remain fully scroll-scrubbed, use coarse stepped animation and remove per-frame color writes that do not change visibly.
3. Build **4–8 flattened checkpoints** and crossfade them. This is the preferred full-fidelity direction because it keeps the scene recognizable while reducing masked-layer paint work.
4. Export **responsive WebP/AVIF derivatives** and reduce mobile layer count; compare transferred bytes, decoded image memory, and scroll frame pacing.
5. Reserve Canvas/WebGL/video for a measured case where the first four options cannot reach a stable 60 fps target.

For every option, rerun the same 3.6-second top-to-bottom-to-top trace and record: combat-sky self-time, total forced-reflow time, long tasks over 50 ms, dropped-frame percentage, total image bytes, decoded image memory, and visual checkpoints at 390×844, 1366×768, 1920×1080, and 2560×1440. A background change is successful only if the scroll trace improves without creating a new LCP, CLS, image-decoding, or accessibility regression.

#### Option 1 implementation status

The Home combat sky now selects a fixed frame at `T_REDUCED` for compact viewports (`<=767px`), reduced-motion/reduced-data users, Save-Data connections, and devices reporting two or fewer logical cores. In that mode it performs one `applyTime` call, attaches no scroll listener, disables windmill rotation, and releases the `will-change` compositor hints that are only useful for animation. Resize still updates the stage scale for orientation changes. Desktop devices retain the existing full scroll-scrubbed sky.

This is an implementation change, not yet a measured win. The follow-up audit should compare the same mobile scroll trace against the 1,634 ms local forced-reflow baseline and verify that the combat-sky path drops out without causing a visual or LCP regression. The static frame intentionally preserves the current art assets for now; generating a smaller mobile derivative is a separate payload optimization.

#### Option 2 implementation status

The desktop combat sky now quantizes scroll progress into 40 buckets (2.5% each). It applies tint/color changes only when the scroll crosses into a new bucket; movement and opacity use a 120 ms CSS transition between checkpoints. The compact static fallback from option 1 bypasses this path entirely. This reduces update frequency and paint pressure without changing the background asset payload, so the success measure is scroll frame pacing and combat-sky self-time—not LCP or transferred bytes.

## Prioritized implementation order

Implement in this order. Re-run the specified check before advancing to the next item.

| # | Change | Why now | Verification / success criterion |
| ---: | --- | --- | --- |
| 1 | Add one `requestAnimationFrame` scroll scheduler; batch reads before writes in `home-promo-assemble`, `backpack-grid/render`, `potion-liquid`, `combat-sky`, and `scroll-logo`. | Directly addresses confirmed scroll jank. | Repeat mobile scroll trace; forced-reflow time falls materially and no individual long layout task appears. |
| 2 | Stop off-screen live-art, potion, backpack, and combat-sky updates with `IntersectionObserver`. | Removes work the user cannot see. | Scroll trace shows fewer active update paths while sections are off-screen. |
| 3 | Cap DOM growth: virtualize/recycle decorative nodes and use `content-visibility: auto` for distant sections. | The DOM reaches 6,185 elements while scrolling. | Scroll trace DOM count and style-recalculation scope fall substantially. |
| 4 | Make the navigation logo (or intended hero) parser-discoverable in HTML, with dimensions and justified priority. | Largest measured mobile LCP opportunity. | **Implemented locally.** Re-run cache-bypassed production mobile trace: confirm HTML discovery/high priority and lower LCP. |
| 5 | Fix skeleton/populated layout contracts and replace the background-position shimmer. | CLS currently fails the good threshold. | **Implemented locally.** Re-run desktop and mobile reload traces: CLS `<= 0.10`. |
| 6 | Generate and ship correctly sized responsive derivatives for the largest home images. | 2.8 MB potential image savings. | **Implemented locally for home item previews.** Re-run network trace: confirm WebP thumbnails replace source PNGs, then add a board-still derivative pipeline for the remaining remote-image opportunity. |
| 7 | Lazy-load below-fold board stills, class art, and catalog images while preserving aspect ratio. | Reduces initial transfer and DOM pressure. | **Implemented locally.** Production first-viewport trace must show fewer bytes/requests and no new CLS. |
| 8 | Dynamically import below-fold build/board/live-art/tooltip modules. | The route currently loads broad shared functionality. | **Implemented locally.** Production mobile trace must show lower initial module/main-thread work while sections remain responsive when reached. |
| 9 | Remove create-page and payment/premium helpers from initial home startup unless immediately needed. | They do not support the first viewport for a signed-out visitor. | **Implemented locally.** Fresh-load trace must keep Create collision, Premium offer, and Stripe portal modules absent until their features are used. |
| 10 | Reduce startup measurement and scaling work in featured stage, nav, and combat sky. | Initial mobile layout costs 317 ms. | **Implemented locally.** The final local reload recorded a 50 ms largest layout update (143/360 nodes); confirm on production after deploy. |
| 11 | Remove unused YouTube preconnect and add origin hints only for first-view dependencies. | Low-risk cleanup after critical work. | **Implemented locally.** The first-view document no longer contains a YouTube preconnect. |
| 12 | Introduce immutable caching for fingerprinted static assets. | Improves repeat visits, not cold LCP. | **Deployment-ready, not repo-completable on bare GitHub Pages.** Use the existing version stamper with an edge/CDN immutable-cache rule, then measure a repeat visit. |

## Implementation status: steps 1-9

Implemented on 2026-10-11 and verified with a local mobile smoke trace (`390 x 844`, Fast 3G, 4x CPU):

1. **Frame-batched home work:** combat-sky now caches the document scroll range instead of reading it inside every scroll-frame calculation. Existing scroll handlers remain passive and rAF-batched.
2. **Off-screen decorative work:** the home promo loop now waits when its section is beyond a 400px viewport margin, and live potion/holo art inside that decorative promo paints once rather than redrawing continuously.
3. **Deferred home DOM:** class showcase, item explorer, and build vault now mount when they are within a 700px viewport margin rather than all during startup.

The local trace reported no console errors and measured about 1,794 total elements after the scripted scroll, versus 6,185 in the earlier production trace. This is directional local evidence only: the local server and production trace are not directly comparable, and forced-layout work remains in the promo/grid paths. Re-run the production mobile scroll trace after deployment before treating the reduction as a final performance result.

4. **HTML-discoverable LCP candidate:** Home now preloads the full navigation wordmark and renders that same dimensioned, high-priority image in the initial HTML navigation shell. The JavaScript navigation swap reuses the resource after it loads rather than making discovery depend on the module graph.
5. **Stable skeleton rendering:** Shared skeleton shimmer now moves a pseudo-element with `transform` instead of animating `background-position`; the brief home pending-sprite placeholder is static. Both retain their reserved geometry, and reduced-motion disables the transform animation.
6. **Right-sized home item art:** Small home item-orbit and starting-bag previews use the existing `assets/item-thumbs/1x/*.webp` derivatives instead of full `assets/item-sprites/*.png` files, with an error fallback to the source image. This directly covers the oversized item-sprite class of the audit; signed remote board stills need a separate storage-side responsive-derivative pipeline and are intentionally not claimed as solved here.

Local Chrome verification at the original constrained mobile profile (`390 x 844`, Fast 3G, 4x CPU) found no console errors. It confirmed the live navigation wordmark dimensions (`992 x 403` intrinsic) and successful 1x WebP thumbnail loads for home bag previews. These are implementation checks, not before/after Core Web Vitals measurements; rerun production traces after deployment to measure LCP, CLS, and transferred bytes.

7. **Native lazy media:** Below-fold class portraits, orbit/item previews, vault avatars/class art, and board-still images now use `loading="lazy"` plus asynchronous decoding. Their existing width/height or CSS reservation remains intact.
8. **Real below-fold module splitting:** The Home entry no longer statically imports the class showcase, item explorer, or build vault. Each is dynamically imported near the viewport. The observers register sequentially after the preceding section has real height, preventing empty hosts from collapsing together and triggering every import at startup.
9. **Intent-only helpers:** Home’s promo uses its fixed board constants directly instead of importing the Create collision module. The shared navigation dynamically imports the Premium offer and Stripe portal only after the founding or billing control is used, so signed-out home startup does not fetch payment UI/helpers.

A fresh local Chrome load confirmed that item explorer/vault were unmounted at startup, while Premium offer, Stripe portal, Create collision, and board-thumb modules were absent. Scrolling mounted the deferred sections in order; mounted board-still images exposed `loading="lazy"` and `decoding="async"`. This is a local implementation check only; rerun the production mobile trace after deployment for comparable request, byte, and main-thread results.

## Updated implementation audit: steps 10-12

This is a second, local implementation audit on 2026-10-11. It used an isolated Chrome context at `390 x 844`, Fast 3G, and 4x CPU slowdown. It is intentionally labelled local: the Python static server has very different document latency and cache headers from production, so these figures must not be compared numerically with the earlier production values. They are the correct before-deploy measurement for the current working tree.

| Test | Result | What changed / what it means |
| --- | ---: | --- |
| Cache-bypassed local mobile reload | **LCP 3,829 ms** | The LCP candidate is the combat-sky hill, created after JavaScript starts. Its trace showed a **3,454 ms** discovery delay. A trial image preload could not be reused by the CSS mask-image request (Chrome reported a credential-mode mismatch), so it was removed rather than shipping a duplicate request. Use an actual parser-visible image or refactor the hill rendering before treating this as solved. |
| Cache-bypassed local mobile reload | **CLS 0.18** | Matches the earlier production baseline numerically, but is not a production comparison; it still misses the <=0.10 target. |
| Reload layout | **50 ms** largest layout update, 143/360 nodes | Down from the old production-trace reference of 317 ms / 447 nodes, but cross-environment comparison is not a measured production reduction. |
| Scripted 3.6 s top-to-bottom-to-top local scroll | **1,634 ms** forced reflow; **1,972** max DOM elements | Scrolling is still the largest active problem. This local run reaches much less DOM than the old production 6,185, but its reflow total is not comparable and is not a success metric. |
| Final document check | **0** YouTube preconnects | The unused early connection has been removed; `i.ytimg.com` remains because featured thumbnails can use it. |

### What was completed

10. **Startup geometry work:** combat-sky delays its document-height read until an animation frame and batches later range updates from resize/document-size changes. Featured-stage no longer forces `offsetHeight` before revealing the track. Nav spacer writes are skipped when the measured height has not changed. The fresh trace also showed that the combat-sky hill is the new LCP candidate; do not use a plain image preload for its current CSS mask-image implementation because Chrome cannot reuse that request. The next LCP fix is an actual parser-visible image or a hill-rendering refactor.
11. **Connection hint hygiene:** removed the unused `www.youtube.com` preconnect. This should have only a small load-time benefit; its purpose is to remove needless early socket/TLS work, not claim a large LCP reduction.
12. **Cache deployment path:** this repository already supplies `npm run stamp-assets`, which adds a content/version query string to HTML-referenced CSS, JS, and font preloads. Bare GitHub Pages does not let this repository send immutable `Cache-Control` headers, so a Cloudflare (or comparable) proxy rule is still required: immutable long TTL for fingerprinted `/assets/*` and versioned CSS/JS; short-lived HTML. A service worker was deliberately not added because it would be a separate offline/stale-content product decision.

### Remaining scroll lag points and next fixes

The updated scroll trace identifies these overlapping forced-layout paths. Times overlap and **must not be summed**; each is a responsiveness budget, not an additional page-load delay.

| Priority | Current local trace point | Forced-reflow time | Fix | Likely benefit / verification |
| ---: | --- | ---: | --- | --- |
| 1 | `potion-liquid.js` `drawPotion` | 1,634 ms | Keep potion art frozen outside the visible promo and replace geometry reads inside the draw loop with cached dimensions. | Largest scroll target; a successful repeat trace removes this path from the top trigger. |
| 2 | `backpack-grid/render.js` `render` | 628 ms | Render only the currently visible grid state; batch reads before writes and avoid rebuilding decorative cells while scrolling. | Reduced main-thread layout during the promo portion of the scroll. |
| 3 | `scroll-logo.js` `pageScrollY` | 371 ms | Read a single scroll owner once per frame; avoid querying the alternate scroller unless that layout is actually active. | Removes recurring nav work after the initial compact/expanded transition. |
| 4 | `combat-sky/index.js` `scrollTime` | 200 ms | Keep scroll position/range in cached state and skip decorative sky updates when the page is outside the home viewport or input is pending. | Lower per-frame sky cost; no visual change to normal first-view use. |
| 5 | `layout-plates.js` `containScale` | 139 ms | Cache plate/container dimensions with `ResizeObserver` rather than calculating them in animation ticks. | Eliminates read-after-write work in live art. |
| 6 | `home-promo-assemble.js` `cellTarget` | 109 ms | Precompute cell targets and update only cells whose state actually changed. | Fewer layout reads during promo assembly. |
| 7 | `home-items-explore-tabs.js` `playOrbitAppear` | 117 ms | Start/stop the orbit only while its section is visible; use transform/opacity-only keyframes. | Prevents a lower-page entrance animation from competing with scroll. |

The same scroll trace recorded style recalculations of 101 ms (394 elements), 95 ms (428), and 63 ms (351). Seven lazy-loaded images still lack explicit dimensions in Chrome's issues panel; add width/height or an `aspect-ratio` reservation to remove their contribution to residual shifts. The recommended next implementation is therefore the potion/grid geometry pass above, not more preconnect tuning.

## Measurement discipline

- Use the same cache-bypassed desktop and `390 x 844` / Fast 3G / 4x CPU mobile profiles for before/after comparison.
- Repeat the same top-to-bottom-to-top scroll path after steps 1-3 and 10.
- Record LCP, CLS, initial request count, transferred image bytes, DOM count, forced-reflow time, long tasks, console messages, and failed requests.
- Exercise a representative carousel/navigation tap after the first pass so the next audit can capture INP.
- Do not combine estimated savings. Verify each change independently and retain only improvements that hold in the trace.
