# Codex handoff

Codex writes this file only. Cursor writes [`CURSOR_HANDOFF.md`](CURSOR_HANDOFF.md). Read **both** before starting. Do not edit the other handoff. Do not invent progress. Label new ideas **Proposal** until measured or approved.

Shared instructions stay in root [`AGENTS.md`](../AGENTS.md). Only one assistant edits that file at a time.

## Owned paths

- `js/shared/nav/`, `js/shared/nav.css` (mobile nav profile footer layout)
- `js/pages/builds/builds.css` (Builds mobile grid card spacing and vote-control density)
- `docs/pages/create/feature/imageUpload/` (canonical paused screenshot-import documentation)
- `js/pages/builds/` (build listing grid view)
- `js/pages/build/` (build-page tooltip header)
- `legal/about/`, `legal/terms/`, `legal/privacy/` (legal page content)
- `js/pages/legal/` (shared legal page styling and boot)
- `AGENTS.md` (legal-page maintenance rule)
- `js/shared/filter-drawer.js`, `js/shared/filter-drawer.css` (narrow filter-drawer chrome)
- `js/pages/builds/feed-filter-drawer.js`, `js/pages/builds/builds.css` (build filters)
- `js/pages/events/events-filter-drawer.js`, `js/pages/events/events.css` (events filters)
- `events/index.html` (events filter cache version)
- `js/shared/nav/` and `js/shared/nav.css` (mobile navigation animation)
- `items/`, `js/pages/items/` (Items page mobile layout repair)
- `scripts/_cache/screenshot-eval/baselines/2026-10-01-p19/` (P19 eval-only origin research artifacts)
- `scripts/_cache/screenshot-eval/baselines/2026-10-01-p20/` (P20 eval-only board-localization research artifacts)
- `scripts/_cache/screenshot-eval/baselines/2026-10-01-p21/` (P21 eval-only combat board-region artifacts)
- `js/shared/screenshot-grid.js`, `js/shared/screenshot-detector.js`, `js/shared/screenshot-*.js` (paused screenshot-import implementation)
- `js/pages/create/screenshot-*.js`, `js/pages/create/board-import.js`, `js/pages/create/board-editor.js`, `js/pages/create/board-onboard.js`, `js/pages/create/label-tool.js` (paused screenshot-import entry points)
- `js/pages/dev-screenshot-import/`, `dev/screenshot-import/`, `dev/export-check/` (paused screenshot-import development routes)
- `supabase/functions/screenshot-to-build/` (paused legacy screenshot-recognition endpoint)
- `scripts/screenshot-detector/`, `scripts/screenshot-eval/`, `scripts/screenshot-to-build/`, `assets/data/detector-*.json`, `assets/ml/screenshot-detector/` (preserved screenshot-import research implementation)
- `docs/features/screenshot-detector.md` (compatibility pointer) and `docs/pages/create/feature/imageUpload/` (canonical screenshot-import documentation)
- `js/pages/create/inventory-preview.js` (mobile Create drag-hover grid positioning)
- `index.html`, `js/shared/config.js`, and `js/pages/home/` (public Pages bootstrap and homepage first-load diagnostics)
- `.gitignore` and `assets/item-sprites/` (static item-sprite Pages deployment)
- `docs/pages/auth.md` (Discord OAuth production redirect configuration)

Before editing product code, list the folders you are taking in this section. Do not take paths already listed under **Owned paths** in [`CURSOR_HANDOFF.md`](CURSOR_HANDOFF.md). Screenshot import is Codex-owned while listed above.

## Confirmed

No Codex session has recorded work here yet. Screenshot-import scores and blockers are in the Cursor handoff.

### 2026-09-30 build grid view

- Changed the desktop build-listing grid view from two columns to three in `js/pages/builds/builds.css`. The existing one-column mobile breakpoint remains unchanged.
- Validation: `git diff --check` reports only pre-existing warnings in unrelated files; the edited CSS contains no new whitespace errors.

### 2026-09-30 legal pages

- Updated About, Terms, and Privacy copy with September 30, 2026 revision metadata, current feature details, and explicit policy-update language. Corrected the founding entitlement description from 50 to the current cap of 10.
- Restyled the shared legal page CSS with the adopted form-style dark panel, outlined display headings, gold accents, and a town-scene background while preserving the existing shared nav/footer boot.
- Added a shared `AGENTS.md` rule requiring a legal-page review and date/content update when material authentication, payment, upload, analytics, storage, moderation, or related behavior changes.
- Validation: `git diff --check` passed for the edited paths; only line-ending normalization warnings were reported.

### 2026-09-30 build tooltip header

- Rearranged the build preview tooltip header so the creator face is left-aligned, creator/build/class names stack in the middle, and the hero class icon is right-aligned.
- Validation: `node --check js/pages/build/more-build-tip.js` passed; `git diff --check` reported no whitespace errors in the edited tooltip files.

### 2026-09-30 YouTube video cursor

- Added the site interactive cursor to the build-page YouTube shell and cross-origin iframe so the game cursor remains visible while hovering the player.
- Validation: CSS-only change; no whitespace errors reported for the edited build stylesheet.

### 2026-10-01 builds filter drawer

- Fixed the Builds mobile filter button: the drawer was bound both by `feed.js` after it rendered the markup and again by `index.js`. Both click handlers toggled, immediately closing the panel. The page boot now relies on the feed-owned binding only.
- Validation: JavaScript syntax check and whitespace check passed for the edited Builds page entry point.

### 2026-09-30 architecture review (no implementation)

- Reviewed the screenshot-import brief, both handoffs, the live browser pipeline, grid/detector/NCC/paint/bag/solver/gap-fill code, catalog/socket metadata, board geometry, and the Playwright evaluator. No product files or manifests changed.
- The live pipeline is `screenshot-apply` → downsampled seam-grid discovery/crop → 640px browser ONNX item and bag passes → detector-led direct placement → local NCC pose/top-k repair → bag fabric/mask placement → limited NCC gap-fill → unresolved 1x1 placeholders. The older solver/refiner path is fallback-only when direct placement produces no placements.
- The code retains the detected pitch and crop, but every current downstream placement, bag mask, solver, refiner, paint renderer, and detector coordinate clamp uses fixed `BOARD_COLS=9`, `BOARD_ROWS=7`. Supporting genuinely variable board dimensions is a separate representation/UI migration, not merely a detector change.
- Existing useful foundations: catalog shapes with all 90-degree rotations, body-cell collision, sprite-display calibration, canonical item sprites, socket-offset metadata, local NCC, a whole-board paint residual score, a fixed truth-set evaluator, and an explicit `__unrecognized__` placeholder. Current solver is greedy and detector-prior capped, not a global top-K optimizer.
- Screenshot import has no dedicated skill or socketed-gem recognition pass. Although socket offsets load into catalog items, import writes every placement with `gems: []`; loose gems are only normal detector/gap-fill candidates.
- Previously recorded score: live v1 58/150; cached v5-80 64/150; v7b 54/150. The P0 baseline run below re-measured live v1 at 58/150.

### 2026-09-30 perfection work queue (documentation only)

- Added the former screenshot-import perfection queue, now consolidated into [`imageUpload/`](pages/create/feature/imageUpload/README.md). It freezes the benchmark and hard constraints, makes eval-only v5-80 tiled inference the sole active experiment, requires raw pre-placer detection metrics, and defers occupancy, reference retrieval, global selection, skills/jewels/sockets, and variable-board work behind measured gates.
- No screenshot-import code, model, manifest, benchmark truth, training data, or evaluation results changed.

### 2026-09-30 P0 baseline evidence

- Verified `assets/data/detector-manifest.json` is `v1`, 426 classes, 429 bytes, and byte-identical to `scripts/_cache/detector-manifest-v1-backup.json`. Both SHA-256 hashes are `5203C4A89D0A4C3CD2C1C8A9F81ADF64498C40BB805CEEAE4BA6848D0B2B29E5`.
- Ran the fixed eight-shot command from the perfection queue with the live v1 manifest. Result: **58/150** item cells, **57/150** cell+rotation, skills **0/7**, jewels **0/1**. Per-shot results and the full log/artifacts are retained in [`scripts/_cache/screenshot-eval/baselines/2026-09-30-v1/`](../scripts/_cache/screenshot-eval/baselines/2026-09-30-v1/).
- Archived the existing cache-only v5-80 comparison log: **64/150** item cells, **63/150** cell+rotation, skills **1/7**, jewels **0/1**. It remains unpublished; no live manifest or deployed asset points to it.
- No production behavior changed. P0 is complete; this evidence is the gate for the eval-only P1 tile experiment.

### 2026-09-30 P1 tiled inference experiment

- Added eval-only `--model=v5-80` asset substitution in the evaluator and query-gated overlapping native tiles. The live manifest and deployed assets were not changed; placement, collision, snapping, and UI stayed on the existing path.
- Fixed eight-shot tiled result: **63/150** item cells vs **64/150** whole-crop v5-80 control; cell+rotation **60/150**; skills **2/7**; jewels **0/1**; raw name-at-cell **37/150**.
- Failure gate: `real-003` remained **0/23** and raw **0/23**; `pine-protector` regressed **29/29 -> 25/29**. Tiling is not publishable and should not advance to production. Full evidence is in [`scripts/_cache/screenshot-eval/baselines/2026-09-30-p1-v5-80-tiled/`](../scripts/_cache/screenshot-eval/baselines/2026-09-30-p1-v5-80-tiled/).
- Proceed to P2 occupancy measurement; do not tune a new detector architecture around this tile result.

### 2026-09-30 P2 occupancy measurement

- Added standalone eval-only `scripts/screenshot-eval/occupancy.mjs`; it uses native screenshot pixels, seam-grid geometry, and center-vs-border luminance evidence. It does not identify items, call placement, or change importer behavior.
- Truth occupancy is derived from the existing eight fixtures, detector class names, `item-shapes.json`, and labeled rotations. Aggregate fixed-corpus best threshold: precision **0.747**, recall **0.877**, F1 **0.807** (TP 271, FP 92, FN 38).
- Per-screenshot results show useful signal on real-001, real-007, real-008, and pine-protector, but poor mixed-fabric behavior on real-003, real-013, and leather-quad. The current truth does not include an explicit bag-fabric label, so fabric stratification is still pending.
- Occupancy remains advisory-only; no placement integration. Evidence: [`scripts/_cache/screenshot-eval/baselines/2026-09-30-p2-occupancy/`](../scripts/_cache/screenshot-eval/baselines/2026-09-30-p2-occupancy/).

### 2026-10-01 narrow filter drawer stability

- Removed the shared narrow-screen right gutter that reserved page width for a fixed Filters tab. Fixed tabs now overlay the page without shifting closed-state content on create/profile and other consumers of `bpb-filter-drawer`.
- Changed the narrow Events closed Filters control from an in-flow row to a fixed edge tab, so the feed no longer moves when the control appears or disappears. Its click handler now explicitly consumes the click before toggling the right-hand drawer; the events CSS/JS cache keys were updated.
- No filter data or filter behavior changed. Validation: `node --check js/pages/events/events-filter-drawer.js` and `git diff --check` passed for the edited paths.

### 2026-10-01 builds drawer layering

- Raised the isolated Builds layout above the fixed navigation only while its mobile filters are open, so the drawer and backdrop cover the nav.
- Validation: `git diff --check` passed for the edited Builds stylesheet.

### 2026-10-01 builds filter-tab overlay

- Changed the closed Builds Filters tab from a viewport-fixed control with a reserved feed gutter to an absolute overlay anchored to the persistent Builds layout. It now sits over the page edge without narrowing or moving feed content; the feed's internal scroll keeps it visually pinned.
- Validation: `git diff --check` passed for the edited Builds stylesheet.

### 2026-10-01 mobile Builds grid

- Changed Builds grid view to use two columns through the mobile breakpoints, including widths at and below 720px.
- Validation: `git diff --check` passed for the edited Builds stylesheet.

### 2026-10-01 card Build Info row

- Changed card-view Build Info to a four-column row so Class, Rank, Sub, and Gold display side by side. The card-specific desktop sizing now uses one info row; compact and grid views are unchanged.
- Validation: `git diff --check` passed for the edited Builds stylesheet.

### 2026-10-01 fluid Builds typography

- Replaced fixed Builds card, compact, and grid typography sizes with bounded `clamp()` values. Author names, build titles, metadata, labels, flairs, vote scores, actions, and Build Info text now scale down on mobile while retaining desktop caps.
- Validation: `git diff --check` passed for the edited Builds stylesheet.

### 2026-10-01 responsive Build Info correction

- Restored desktop card Build Info to its two-column, three-row layout with Sub and Gold spanning their rows. The four-column single-row layout is now scoped to the existing `max-width: 900px` mobile breakpoint, so Class, Rank, Sub, and Gold remain side by side only on mobile.
- Validation: the final selectors were inspected; `git diff --check` reports pre-existing trailing whitespace elsewhere in the already-modified Builds stylesheet, unrelated to this correction.

### 2026-10-01 mobile navigation animation

- Added a filter-drawer-style slide/fade animation to the mobile navigation drawer and backdrop. The drawer now stays mounted for 220ms while closing, so the `hidden` attribute no longer cuts off the transition; reduced-motion users get no transition.
- Validation: `node --check js/shared/nav/drawer.js` passed; CSS diff inspection completed.

### 2026-10-01 Items mobile layout repair

- Restored the Items page outer `items-main` shell; the previous mobile change incorrectly applied `items-layout` to the outer `<main>`, causing the catalog grid rules to target the page shell instead of the dynamically rendered catalog.
- Wired the Items filter rail to the shared narrow filter drawer: the mobile toggle/backdrop now live with the catalog layout, the real filter panel has a close button, and the drawer binds after the live filters replace the loading skeleton.
- Validation: `node --check` passed for the Items catalog, shell, and filter modules; edited-path whitespace check passed.

### 2026-10-01 Create mobile catalog scrollbar clearance

- Reserved a mobile-only lane to the right of the Create catalog’s horizontal scrollbar so its track ends before the fixed sell chest instead of running underneath it.
- Desktop sizing and the Create page’s board/parked-item layout are unchanged. Validation: `git diff --check -- js/pages/create/create.css` passed.

### 2026-10-01 Create mobile filter tab

- Centered the Create page’s mobile filter drawer toggle against the full viewport rather than the catalog section.
- The Create-only toggle now reads “Filters / Build”; the shared default remains “Filters” for other pages. Validation: `node --check` passed for both filter-drawer modules and `git diff --check` passed for the edited paths.

### 2026-10-01 Create mobile filter panel height

- Made the open Create mobile filter panel explicitly use the full dynamic viewport height, with matching minimum and maximum heights, so it reaches both the top and bottom page edges.
- The right-side drawer width and transition remain unchanged. Validation: `git diff --check -- js/pages/create/create.css` passed.

### 2026-10-01 Items mobile catalog and filters

- Fixed the Items catalog’s narrow-screen width: the desktop width formula could resolve below zero, leaving the rendered backpack grid at `0px` wide even though item nodes existed.
- Added responsive filter wrapping and sizing for narrow drawers. Type, buff, debuff, rarity, and search controls now stay inside the panel; the panel scrolls vertically when the viewport is short.
- Browser validation passed at 320px and 390px: items rendered with a full-width grid, no horizontal filter overflow, and no page errors. Desktop validation at 1440px kept the sticky filter rail and rendered catalog intact.

### 2026-10-01 mobile navigation open fix

- Fixed the mobile nav drawer animation class being applied to `#site-nav` instead of its `.site-nav-shell` child. The click state was changing, but the CSS open selector never matched, leaving the drawer off-canvas.
- Validation: `node --check js/shared/nav/drawer.js` passed; mobile browser open/close behavior was verified at 390px.

### 2026-10-01 Create mobile upload and scrollbar spacing

- Reduced the mobile Create upload target width so it stays clear of the centered Filters / Build tab.
- Kept the item catalog flush to the left and the existing right-side chest clearance, while reducing the scrollbar height and visually insetting its track so it is centered within the catalog section.
- Validation: narrow Create geometry was checked at 390px and 600px; `git diff --check -- js/pages/create/create.css` passed.

### 2026-10-01 Create mobile drag reliability

- Made catalog item and bag touch gestures reliable on narrow Create layouts: item touches now use JS-controlled gesture handling, mostly horizontal movement still scrolls the catalog, and vertical/diagonal movement starts a captured drag.
- Validation: `node --check js/pages/create/drag-pointers.js` passed; touch drag/drop was verified at 390px with an item placed into the board bag.

### 2026-10-01 Items mobile filter search ordering

- Moved the Items drawer search field directly beneath its header and above the grouping control on screens up to 900px. Debuff filters remain at the end of the panel; desktop retains its original grouping-to-search order.
- Validation: browser checks at 390px confirmed the order and no page errors; a 1440px check confirmed the desktop order remains unchanged. `git diff --check -- js/pages/items/filters.css` passed.

### 2026-10-01 Mobile nav profile footer

- Reworked the mobile drawer footer so the account area is dedicated to the selected profile avatar/blob with the user name below it. The old shop-sign/banner image is hidden in the drawer; premium/admin/social controls sit in a separate utility area above the profile footer. Desktop navigation is unchanged.
- Validation: mobile browser check at 390px confirmed the drawer layout, hidden account banner, and no page errors. `node --check` passed for the nav markup and session modules; `git diff --check` passed for the edited nav paths.

### 2026-10-01 Mobile nav profile scale

- Enlarged the dedicated mobile-drawer avatar/blob to the largest practical square that fits a phone drawer: up to 12rem (192px at 390px), with the profile name remaining below it.
- Validation: browser geometry check at 390px confirmed a 192px avatar, name below the avatar, and no page errors. `git diff --check -- js/shared/nav.css` passed.

### 2026-10-01 Builds mobile grid header and sizing

- Reduced the mobile grid board cell size responsively so two-column cards stay within their columns. Grid headers now place the avatar/byline on the left, votes on the right, and the build title on a full-width row below; vote button padding and score spacing are tightened.
- Validation: browser check at 390px confirmed 10 grid cards, no page errors, a 189px board inside each 188px card with inter-card separation, and the intended byline/vote/title geometry. `node --check js/pages/builds/post-row.js` passed; edited-path whitespace check reports only pre-existing warnings in the stylesheet.

### 2026-10-01 Mobile nav profile avatar scale

- Increased the mobile drawer profile avatar/blob from the compact 3.5rem treatment to a prominent 8rem display. The name remains centered directly underneath; desktop account sizing is unchanged.

## Blockers

- Screenshot import is intentionally launch-paused. Do not enable its client or server gates until the resume guide's validation and publishing requirements are met.
- A 518-class model must not be published without its matching class list; no training or publication was performed.

## Next step

Keep the launch gates disabled. If work resumes, start from the canonical image-upload resume guide; do not begin new research or training without an explicit task.

### 2026-10-01 Items responsive catalog sizing

- Claimed the Items page responsive catalog sizing feature. Product edits will stay in `js/pages/items/` and the shared catalog API only; screenshot-import paths remain owned by Cursor.
- Added a responsive Items catalog watcher: below desktop width it repacks around 52px cells with a six-column minimum, while desktop restores the 20-column library layout.
- Validation: Playwright checks at 390px (6 columns / 60px), 768px (14 / 52.7px), 1100px (9 / 56.7px), and 1440px (20 columns); no page errors. `node --check` and `git diff --check` passed.

### 2026-10-01 Items mobile detail spotlight

- Claimed the Items mobile item-detail layout. Product edits will stay in the Items spotlight and shared tooltip positioning paths; screenshot-import paths remain owned by Cursor.
- Stacked the focused item, tooltip, swipeable recipe carousel, and builds carousel on screens up to 900px; desktop keeps the existing side/bottom spotlight arrangement. Large focused pieces are scaled to the available top area and panel positions recalculate on resize and async build results.
- Validation: browser geometry checks passed at 390px, 768px, 900px, and 1440px; mobile recipe scrolling was confirmed (`scrollWidth` exceeded the viewport); no page errors. `node --check` and `git diff --check` passed.

### 2026-10-01 Create desktop catalog width

- Claimed the Create desktop catalog geometry issue. Product edits will stay in `js/pages/create/` and its Create-specific catalog overrides; screenshot-import paths remain owned by Cursor.
- Restored the original Create desktop sizing rules: fixed 32rem filter rail, calculated board width, and the original board/catalog split. Narrow media rules were left unchanged.
- Validation: at 1550px the board/catalog/filter columns measured 622px / 319px / 512px with the rail immediately beside the catalog; at 1440px they measured 512px / 224px / 512px. At 1100px and 390px the mobile layout stayed stacked with the drawer off-canvas. `node --check` and `git diff --check` passed.

### 2026-10-01 Create mobile catalog ordering

- Claimed the Create mobile catalog ordering feature. Product edits will stay in `js/pages/create/` and the shared catalog API; screenshot-import paths remain owned by Cursor.
- Added a Create-only narrow-screen rarity sort: Common → Rare → Epic → Legendary → Godly → Unique, with existing library order as the tie-breaker. The horizontal strip therefore progresses left-to-right while desktop, standalone Items, and active grouping modes retain their existing order.
- Validation: mobile Create rendered a 320-column / 7-row horizontal strip at 390px; `node --check` passed for the changed modules.

### 2026-10-01 P19 real-007 image-derived origin correction (eval only)

- Claimed `scripts/_cache/screenshot-eval/baselines/2026-10-01-p19/` only. The live importer, benchmark truth, models, manifests, and Cursor-owned evaluation paths were not changed.
- `real-007` is a 841×607 source with a detected 10×7, 80.420625px lattice; raw seam-grid origin is `(-28.91, -20.50)` while `bagRect` is clamped to `(0, 0, 804, 563)`, score 1.2944. An interior seam-phase read (after excluding the frame-dominated ridge) estimated +30.7,+11.9 match pixels; quantized +30,+12. The pre-registered diagnostic was +29,+11, a +1,+1 difference after quantization.
- All-face, 518-reference, ±8 NCC on the 27 real-007 ordinary instances: current origin **0/0/0/0/0** vs image-derived **21/21/21/21/21** top-1/3/5/10/20; truth-derived diagnostic produces the same result. Correct-reference gray counts at ≥.45/.60/.70/.80 are **0/0/0/0** current and **21/19/11/4** corrected. The 21 recovered top-1s have residual searches within 2 match pixels, excluding the approximately one-cell neighboring-copy locks.
- Recalculated fixed 150-item all-face benchmark, retaining P17 values for the other 123 instances: **64/68/72/75/75**, a +21 gain at every cutoff, all from real-007. The correction gate only triggers when both raw origins are negative and the crop starts at `(0,0)`; controls real-001 `(6,18)`, real-010 `(27.75,-4.62)`, and pine-protector `(5,21)` do not trigger and receive zero correction.
- Validation: `node --check scripts/_cache/screenshot-eval/baselines/2026-10-01-p19/rank.mjs` and `git diff --check` passed for the P19-owned paths.

### 2026-10-01 P20 real-003 / real-008 board-coordinate recovery (eval only)

- Claimed `scripts/_cache/screenshot-eval/baselines/2026-10-01-p20/` only. The live importer, benchmark truth, models, manifests, and Cursor-owned evaluation paths were not changed.
- Raw `detectBagGrid` is not stable evidence for real-003: the direct source pass returns origin `(-20.48,158.72)`, 353.28px cells, 11×6, clamped rect `(0,159,3886,2120)`, score 1.2090; P13's 900px pre-pass instead yielded 12×7 at about 309.7px with `(91,0,3718,2167)`. Both encompass combat HUD/opponent content. Existing bag-model detections are similarly contaminated: strong left player-cluster bags coexist with Leather Bag 0.793 and Potion Belt 0.716/0.626 in the right combat/opponent region. No player-only image region is identified.
- real-008's direct seam result is origin `(38,27)`, 90px cells, 7×6, rect `(38,27,630,540)`, score 1.2189. Canonical 9×7 alternatives `(38,27;70×77.14)` and an alternate seam phase `(15,34;70×77)` were retained as hypotheses, but neither has independent bag/seam support over the selected 7×6 lattice. P14's truth-only audit remains 13/22 visibly correct for the forced canonical map, with 8 neighboring-object cells.
- P20's conservative image-only selector therefore abstains for both fixtures; it does not force 9×7 or alter the P19 real-007 correction. Full evidence and the small hypothesis table are in [`scripts/_cache/screenshot-eval/baselines/2026-10-01-p20/report.md`](../scripts/_cache/screenshot-eval/baselines/2026-10-01-p20/report.md).

### 2026-10-01 P21 combat player-board localization (eval only)

- Claimed `scripts/_cache/screenshot-eval/baselines/2026-10-01-p21/` only. The live importer, benchmark truth, models, manifests, and Cursor-owned scripts were not changed.
- For `real-003` (4096x2304), existing cached bags mapped through P13's geometry form two graph components without truth: 12 left detections (confidence 0.300-0.945; mean 0.788; union `(245.8,359.1) 2102.9x1944.9`) and 5 right detections (0.334-0.793; mean 0.581; union `(3045.5,346.7) 1050.5x1535.5`). Boxes connect only when their gap is at most 0.75 P13 cells; the opponent detections are not unioned into the player component.
- Player selection uses image/game-HUD evidence, not truth. The reconstruction preserves distinct `Core/Character.tscn` player and `Core/Opponent.tscn` mirrored HUDs. In real-003, the blue `servus3` HUD sits below the left component and the green `Gegner` HUD below the right. The player proposal is `(0,0) 2581x1838`: left component, contiguous top/left panel edge, and area above the combat HUD. This is a composition-specific rule; without the same mirrored landmark pair it must abstain.
- Existing seam fitting remains insufficient on the selected real-003 region: full / half / 0.22 scale crops return `8x6 @ 288.75`, `9x6 @ 277.35`, and `9x6 @ 279.55` pixels with phase changes. It is more constrained than the global 11x6/12x7 failure but not a stable 9x7; no retrieval was run. The truth stores logical cells rather than raw image item centers, so no new physical-containment count can be honestly computed; P14's preserved bad-global audit remains 3/23 visibly on content.
- Contact-sheet review found one additional two-board combat fixture, `real-004`, with the same left/right HUD composition. Its left visual board crop is 9x7 at 80px at full and half scale; the right crop is unstable. This supports side selection on these two compositions, not an aspect-ratio-general rule. Evidence: [`report.md`](../scripts/_cache/screenshot-eval/baselines/2026-10-01-p21/report.md), [`real-003-overview.png`](../scripts/_cache/screenshot-eval/baselines/2026-10-01-p21/real-003-overview.png), and [`additional-fixtures.md`](../scripts/_cache/screenshot-eval/baselines/2026-10-01-p21/additional-fixtures.md).
- Conclusion: a new segmentation model is not justified for region localization yet. The smallest next experiment is deterministic mirrored-HUD plus bag-component validation on more unlabeled combat captures before revisiting real-003 seam/grid fitting; it was not started here.

### 2026-10-01 screenshot import launch pause and documentation consolidation

- Screenshot-to-build is now disabled by the explicit `SCREENSHOT_IMPORT_ENABLED = false` client flag. Create hides the Media/import entry point while retaining manual placement, history import, saving, loading, and publishing. Image paste/drop and direct `importScreenshotFile` calls stop before the import pipeline loads.
- The development route redirects to Create while disabled, and `supabase/functions/screenshot-to-build` returns 404 before authentication, catalog work, image handling, or inference unless its server environment flag is explicitly `true`.
- Preserved all importer modules, models, scripts, benchmark artifacts, P19/P20/P21 results, and APIs. The canonical feature record is [`docs/pages/create/feature/imageUpload/README.md`](pages/create/feature/imageUpload/README.md); the former detector document is a compatibility pointer only.
- Updated About, Terms, and Privacy to describe the paused screenshot capability. The existing October 1, 2026 revision date remains current.
- Validation: Node syntax checks passed for all changed browser modules. Browser smoke checks confirmed Media is hidden, History remains available, direct import is rejected, the dev route redirects to Create, and no browser errors occurred. `git diff --check` found only a pre-existing trailing-whitespace warning in `docs/todo.md`. Deno was unavailable locally, so the Edge Function could not receive a Deno type check.

### 2026-10-01 Create mobile navigation mark

- Claimed the Create mobile navigation logo adjustment in the existing Codex-owned shared navigation stylesheet.
- On Create at widths up to 1100px, the header now shows the smaller compact BPB mark rather than the full wordmark. Other pages and desktop retain their existing logo behavior.
- Validation: Playwright at 390px confirmed `page-create`, hidden full mark, visible 116px compact mark, and no page errors. `git diff --check -- js/shared/nav.css` passed.

### 2026-10-01 Create mobile drag-hover grid

- Claimed `js/pages/create/inventory-preview.js` for the Create board drag-hover grid repair.
- Preview tiles now use the board's local layout dimensions rather than its transform-scaled screen rectangle. This prevents the mobile board transform from shrinking the tiles twice while an item is held over the grid.
- Validation: at 390px the board's 96px local cells scale to 41.1px on screen; an active catalog drag rendered 41.1px hover tiles, exactly matching the visible board cells, with no page errors. `node --check` and targeted `git diff --check` passed.

### 2026-10-01 Mobile navigation profile avatar size

- Updated the existing Codex-owned mobile drawer profile styling so it overrides the blob renderer's 40px inline fallback size.
- The dedicated footer profile avatar/blob now renders at up to 12rem (192px), with the username below it.
- Validation: an open mobile drawer at 390px with a blob profile rendered a 192px avatar and the name below it; targeted `git diff --check` passed.

### 2026-10-01 Public GitHub Pages deployment

- Repointed this workspace's `origin` to the public `bpbbuilds/bpbbuilds.github.io` repository, retaining its special name so the site remains at `https://bpbbuilds.github.io/`.
- Committed the current website as `3f2e6c0`, merged the prior public landing-page history with the `ours` strategy as `3940a4f`, and pushed `main` using the `bpbbuilds` GitHub account. `.env` remained ignored and the staged-content scan found no credential-pattern matches.
- GitHub Pages is configured for `main` at `/` with HTTPS enabled. Added `.nojekyll` to publish this static site without Jekyll processing; the resulting Pages build for `a2084db` completed successfully.

### 2026-10-01 Home production bootstrap and first-load repair

- Claimed `index.html`, `js/shared/config.js`, and `js/pages/home/` for the public Pages bootstrap and initial-load repair.
- Published the browser-safe Supabase configuration with the privileged submit secret blank, added a lightweight SVG favicon, removed the Tailwind CDN runtime, and aligned font preload URLs with their CSS font URLs.
- Deferred the data-heavy Create promo to the existing below-fold idle path and keep the featured YouTube iframe on its poster until the visitor selects it. A cold 1440px check rendered the featured carousel with no iframe or YouTube request until click; the click then mounted one iframe as expected. Database responses measured about 170–370ms, while several eager images were 0.5–1.7MB, so the slowdown was not primarily database wait time.
- Validation: browser console had no Tailwind/config/favicon/font-preload warnings; the public config loaded, favicon returned success, and no page errors occurred. `node --check` passed for changed home modules and targeted `git diff --check` passed.
- Restored the Items Explore tab behavior without Tailwind: the component's flex layout now explicitly honors its `[hidden]` panels. At 390px, only Weapons was visible initially and selecting Bags showed only its panel; no page errors occurred.
- Replaced the temporary SVG tab mark with the existing `logo-bpb.png` brand asset; its linked favicon request succeeds locally.
- Added a compact fallback `favicon.ico` generated from the BPB logo for clients that still request `/favicon.ico`. The live Pages response has no Permissions-Policy header and no matching policy tokens in site source; those unsupported-policy warnings originate outside this static site.

### 2026-10-01 Static item sprite deployment

- Removed the `assets/item-sprites/` ignore rule and committed the 638 static item sprites (56.7MiB) needed by board, catalog, and homepage rendering.
- Pushed commit `528ad04` to the public Pages repository. GitHub Pages built it successfully, and `https://bpbbuilds.github.io/assets/item-sprites/LeatherBag.png` returned HTTP 200 after deployment.

### 2026-10-01 Discord OAuth production callback

- Updated the hosted Supabase Auth URL configuration for project `xklkysmakrmgtiztsqug`: Site URL is now `https://bpbbuilds.github.io/`, with redirects allowed for the GitHub Pages site and the two Live Server development origins (`127.0.0.1:5500` and `localhost:5500`). The client already supplies its current page as `redirectTo`, so a sign-in initiated on Pages returns to Pages instead of the former local-IP Site URL.
- Documented the exact URL configuration in `docs/pages/auth.md`. Updated About, Terms, and Privacy to describe the approved BPB Builds return URL; their existing October 1, 2026 revision date remains current.
- Validation: re-read the hosted Auth configuration after the update and confirmed the Site URL and allow list. `git diff --check` passed for the documentation and legal changes.

## Proposal

None.
