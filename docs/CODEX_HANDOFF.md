# Codex handoff

Codex writes this file only. Cursor writes [`CURSOR_HANDOFF.md`](CURSOR_HANDOFF.md). Read **both** before starting. Do not edit the other handoff. Do not invent progress. Label new ideas **Proposal** until measured or approved.

Shared instructions stay in root [`AGENTS.md`](../AGENTS.md). Only one assistant edits that file at a time.

## Owned paths

- `js/pages/create/meta-drops.js`, `js/pages/create/drag-pointers.js`, and `js/pages/create/editor-state.js` (Build-tab priority drops from history-attached boards and catalog)

- `js/pages/create/create.css` and `js/pages/create/rail-chrome.css` (desktop Create layout scaling for board and Filter/Build rail)

- `js/pages/admin/tab-cosmetics.js`, `js/pages/admin/api.js`, and `supabase/functions/admin-builds/` (owner-gated cosmetic publishing repair)

- `js/pages/admin/report-filters.js` (remove obsolete Guest reporter filter)

- `js/pages/admin/tab-members.js`, `js/pages/admin/api.js`, `js/pages/admin/admin.css`, `supabase/functions/admin-builds/`, and `docs/pages/admin.md` (owner-only website/Discord member roster)

- `js/pages/admin/admin.css` (Admin Overview site-access KPI-card visual alignment)

- `docs/todo.md` (implementation-status reconciliation)

- `supabase/functions/vote-build/`, `supabase/functions/report-sim/`, `supabase/functions/submit-build/`, `supabase/functions/screenshot-to-build/`, and their deployment configuration (whole-site audit remediation)
- `supabase/migrations/`, `docs/db/sql/`, and `supabase/tests/` for the audit-remediation migration and regression coverage
- `docs/pages/auth.md`, `docs/pages/admin.md`, `docs/db/tables.md`, and `legal/about/`, `legal/terms/`, `legal/privacy/` for security-behavior maintenance

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
- `js/shared/auth.js` (Discord OAuth callback handling)
- `js/shared/supabase.js` (OAuth client configuration)
- `js/shared/access-gate.js`, `js/shared/access-gate.css`, `js/shared/discord-join.js`, `js/shared/nav.js`, `js/shared/config.js`, `js/shared/config.example.js`, and `css/shared.css` (private/live Discord-member site access gate)
- `scripts/write-config.mjs` (private/live mode configuration generation)
- `js/pages/admin/api.js`, `js/pages/admin/metrics.js`, and `js/pages/admin/admin.css` (owner Live/Private control on Admin Overview)
- `supabase/functions/site-access/`, `supabase/config.toml`, `supabase/migrations/20261002000000_site_access.sql`, and `docs/db/sql/028_site_access.sql` (persisted access-mode setting and owner API)
- `docs/pages/admin.md`, `docs/pages/auth.md`, `docs/db/tables.md`, and `legal/about/`, `legal/terms/`, `legal/privacy/` (runtime access-mode documentation and legal maintenance)
- `js/pages/*/index.js` and `js/pages/admin/shell.js` (Private-mode boot gate)
- `supabase/functions/discord-guild/`, `supabase/migrations/20261002010000_private_access_data.sql`, and `docs/db/sql/029_private_access_data.sql` (Private-mode database read enforcement)
- `dev/confirm/`, `dev/create-rail/`, `js/pages/create-rail/`, `js/pages/create/rail-chrome.css`, `builds/berserk-bloodline/`, `builds/poison-garden-ranger/`, `builds/pyro-furnace/`, `builds/reaper-harvest/`, and `docs/todo.md` (removal of obsolete public sandboxes and legacy route shells)
- Public route HTML heads (`index.html`, `404.html`, `items/`, `builds/`, `create/`, `events/`, `challenges/`, `market/`, `quest/`, `sim/`, `u/`, `overlay/`, `legal/`, and `admin/`) for static Open Graph and social-card metadata

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

### 2026-10-01 Discord callback completion and sprite URL repair

- Claimed `js/shared/auth.js` and `js/shared/supabase.js` for the OAuth callback repair. Supabase now uses an explicit PKCE completion in the shared auth helper, so the Discord `code` is exchanged before any page asks for the session. Consumed callback parameters and stale OAuth errors are removed from browser history, preventing Back from replaying an expired state.
- Investigated the reported `bad_oauth_state` with hosted Auth logs: one stale callback failed, but the immediately following fresh attempt completed a Discord login successfully. The live Auth endpoint was verified to create a fresh provider state and use the required Supabase callback URL.
- Renamed the 12 case-mismatched static item sprites to their catalog names (including Blueberries, Bow and Arrow, Thornburst, and Con-Trap-Tron), fixing the Pages 404s on case-sensitive hosting.
- Validation: `node --check` passed for both changed shared modules; all 521 canonical sprite names from `sprite-thumbs.json` exist after the rename; targeted `git diff --check` passed.

### 2026-10-01 Private/live Discord-member access mode

- Confirmed the prior implementation was only an optional post-sign-in Discord invite prompt; it did not restrict site access.
- Added a shared private-launch access gate. `siteAccessMode: 'live'` remains the deployed default. Setting `BPB_SITE_ACCESS_MODE=private` before `node scripts/write-config.mjs` produces a config that requires Discord sign-in and an affirmative `discord-guild` membership response on every standard site page. The gate is fail-closed, supplies sign-in, server-join, recheck, and account-switch actions, and removes stale optional invite prompting while private mode is active.
- Updated Auth documentation plus About, Terms, and Privacy to describe the optional member-only launch access. Their existing October 1, 2026 revision date remains current.
- Limitation documented: GitHub Pages is static public hosting, so this blocks the web application UI rather than turning already-published files/URLs private; non-public data still needs Supabase RLS/private Storage.
- Validation: `node --check` passed for the new gate, shared navigation, Discord prompt, config, and config writer; `git diff --check` passed. The page-entry audit confirmed all normal public page boots reach shared navigation (admin reaches it through its shell).

### 2026-10-01 Admin runtime site-access switch

- Added the owner-only Live / Private control to the Admin Overview. It uses the new `site-access` Edge Function and `site_settings` table instead of requiring a config edit and GitHub Pages redeploy; Live remains the initial database value.
- Applied `20261002000000_site_access.sql` to project `xklkysmakrmgtiztsqug` and deployed `site-access`. Public GET returned `live`; an unauthenticated mode-change POST returned 401.
- Updated the shared access gate to read the runtime mode on page load, while preserving the generated config as a local fallback. Private continues to require signed-in Discord server membership.
- Live mode now resolves without showing a checking screen or registering an auth-change membership recheck; the Discord membership request begins only after the runtime mode resolves to Private.

### 2026-10-01 Private access boot enforcement

- Corrected the private-gate logo to the deployed `assets/brand/logo-bpb.png` path.
- All standard site entry points now wait for `initNav()` to confirm access before starting page-specific data/UI code. A denied private visitor remains at the gate; after a successful recheck the page reloads and then boots normally. This stops removal of the gate element from starting the normal application in that tab.
- Limitation: GitHub Pages remains public static hosting. Static source/assets can still be fetched or inspected, so absolute private-site enforcement needs an authenticated hosting/proxy layer in front of a custom domain; this UI boot gate cannot provide that on `bpbbuilds.github.io` alone.

### 2026-10-01 Private access data enforcement

- Added `029_private_access_data.sql`: when the runtime setting is Private, restrictive RLS policies deny anonymous and unverified reads of items, recipes, builds, placements, and profiles. A verified Discord-server membership is recorded for 15 minutes on the user profile by `discord-guild`.
- Applied migration `20261002010000_private_access_data.sql` and deployed the updated `discord-guild` Edge Function. The runtime setting was Private during validation; the anonymous `private_site_access_allowed` RPC returned `false`, confirming direct public database reads are denied.
- Updated Auth/schema docs and Terms/Privacy for the short-lived membership-verification timestamp and database enforcement. `node --check` and `git diff --check` passed.

### 2026-10-01 Obsolete route cleanup

- Removed the standalone confirmation and Create rail sandboxes, plus four legacy static build route shells (`berserk-bloodline`, `poison-garden-ranger`, `pyro-furnace`, `reaper-harvest`). The live Create rail keeps its shared chrome; no source links point to the removed routes.
- Removed the now-stale Create rail sandbox TODO entry. `dev/export-check/` was not touched because Cursor currently owns it; screenshot label/review/import routes and fixtures remain preserved.

### 2026-10-01 Deferred CSS performance work

- Added a TODO for page-level CSS entry files plus a production bundle/minify step. Runtime CSS `@import` alone is explicitly not the intended optimization.

### 2026-10-01 Static social metadata

- Added canonical URLs, descriptions, Open Graph, and Twitter card metadata to the main public pages. Static build-view metadata is intentionally generic; per-build cards need generated HTML or an edge host.

### 2026-10-01 Login security audit (no changes)

- Found a critical Private-mode bypass: `discord_guild_verified_at` is not frozen by `profiles_protect_owner`, while authenticated users can update their own profile row. A user can set that timestamp directly and satisfy the Private RLS policy without a Discord membership check. Also flag the profile insert fallback: it permits self-supplied membership fields if a profile row is ever missing.
- Recommended next work: freeze server-managed fields (including the Discord verification timestamp) on both update and insert, tighten profile grants/policies, move the private-access helper out of exposed `public`, and add RLS deny/allow regression tests.
- Updated admin/auth/schema documentation and the access wording in About, Terms, and Privacy. Validation: `node --check` passed for changed browser/config scripts and `git diff --check` passed.

### 2026-10-01 Login security remediation

- Claimed `js/shared/auth.js`, the 030 database documentation/migrations, access tests, auth/schema docs, and the affected legal/public HTML heads for login security remediation.
- Applied `20261002020000_login_security_hardening.sql` and `20261002021000_enable_private_access_rls.sql` to project `xklkysmakrmgtiztsqug`. Authenticated browser profile changes can no longer self-set ownership, Discord membership verification, plan/payment, grants, or coins; fallback inserts are also normalized to safe values.
- Moved the Private-mode predicate from exposed `public` to the unexposed `private` schema, set an empty function search path, removed its public RPC, and enabled RLS on every table protected by its restrictive policy. With the runtime setting still Private, an anonymous `items` REST read now returns `[]`; the former public RPC returns HTTP 404.
- OAuth redirect targets are constrained to the current origin in addition to the Supabase allow-list. Added meta CSPs to normal application pages (a full response-header CSP needs a proxy/custom host rather than GitHub Pages alone), and documented the enforced behavior in Auth, schema, Terms, Privacy, and About.
- Added `supabase/tests/login_security_rls.sql` for local `supabase test db` regression coverage. Node syntax and `git diff --check` passed; browser smoke testing could not run because this checkout has no installed Playwright package.

## Proposal

None.

### 2026-10-01 Supabase Advisor RLS remediation

- Claimed the 031 RLS migration/documentation, access tests, and this handoff to resolve the Advisor findings for `founding_promo`, `member_daily`, and `page_views`.
- Applied `20261002022000_enable_advisor_rls.sql` to project `xklkysmakrmgtiztsqug`. The tables keep no direct client policies; their existing SECURITY DEFINER RPCs retain the necessary server-side behavior.
- Verified anonymous REST reads for all three return `[]`. Added local pgTAP checks that each table has RLS enabled; `git diff --check` passed.

### 2026-10-01 Premium pipeline security audit (no changes)

- Checkout and Portal correctly require a verified Supabase JWT; Stripe Price and return URLs are server-owned; the Stripe webhook verifies `stripe-signature`; plan fields are server-managed; Discord role syncing mirrors rather than grants entitlement.
- Found two material follow-ups: `checkout.session.completed` grants `plan = premium` without requiring the fetched subscription to be `active`/`trialing` (or checking Checkout payment state), and a `premium_until` of null is treated as entitled indefinitely by both Edge and browser helpers. A delayed/failed payment plus incomplete Stripe data could therefore create a temporary or indefinite entitlement.
- `profiles_select_all` also exposes `stripe_customer_id`, `voter_key`, owner state, and verification timestamps through the Data API in Live mode. Stripe customer ids should not be public, and exposed voter keys can undermine the vote identity model. Replace broad profile table reads with a safe public projection and a private self-profile RPC/view before launch.

### 2026-10-01 Premium pipeline remediation

- Claimed Stripe webhook/entitlement helpers, the sensitive-profile migrations/docs, profile client paths, access tests, and this handoff for Premium-pipeline security remediation.
- Applied `20261002023000_profile_sensitive_columns.sql` and `20261002024000_require_self_profile_auth.sql` to project `xklkysmakrmgtiztsqug`. Public profiles now expose display/cosmetic/plan fields only; Stripe customer ids, vote keys, ownership, and access verification cannot be selected through the Data API. `get_my_profile()` is authenticated and self-only.
- Deployed `stripe-webhook`. Checkout completion now fetches and verifies an `active`/`trialing` subscription with a valid period end before granting Premium. Paid entitlement now fails closed when the Stripe period end is missing or invalid. Founding remains lifetime access.
- Verified anonymous profile reads can select safe fields but receive 401 for `stripe_customer_id`, `voter_key`, and `is_owner`; anonymous self-profile RPC calls receive 400. Node syntax checks and `git diff --check` passed. Legal pages were reviewed; this tightening does not change what data is collected or the membership terms.

### 2026-10-01 Admin security audit (no changes)

- JWT-based admin functions (`admin-builds`, `admin-reports`, `site-access`) validate the session with Auth and re-check `profiles.is_owner` using the service role. Their actions are allow-listed; admin data queries and mutations are not controlled by the client-side page gate. `member_stats` and `page_view_stats` independently perform an owner check in SECURITY DEFINER database functions.
- Found a critical latent secret-exposure path: `scripts/write-config.mjs` copies `BPB_SUBMIT_SECRET` into the public browser `config.js` whenever that environment variable is present. The current committed config is blank, but the local `.env` has a submit secret, so a future config-generation run could publish the shared break-glass credential and grant curation/report access to anyone.
- Also flag the architectural risk of one long-lived shared submit secret accepted by both admin edge functions and stored in `sessionStorage` after entry. Owner JWT remains the safer normal path. Recommend removing the secret from generated browser config entirely, making it a server-only emergency credential, and adding rate-limit/audit logging for emergency-secret use.

### 2026-10-01 Admin secret remediation

- Claimed public config generation, admin browser auth/gate paths, admin Edge Functions, the emergency-audit migration/docs, and this handoff to remove browser break-glass access and add server-side emergency-use controls.
- `write-config.mjs` no longer reads or emits `BPB_SUBMIT_SECRET`; regenerated `config.js` contains no submit secret. The web admin is owner-Discord-JWT only and no longer offers, stores, or sends a shared secret.
- Applied `20261002025000_admin_emergency_audit.sql` and deployed `admin-builds` / `admin-reports`. The server-only emergency header is recorded in an RLS-protected table and limited to five uses per endpoint per ten minutes; audit/rate-limit database failures fail closed.
- Validation: regenerated config has no `submitSecret`; admin gate has no browser secret/session storage; Node syntax checks and `git diff --check` passed.

### 2026-10-01 Whole-site security audit (no implementation)

- Completed a read-only review of the GitHub Pages client, tracked secret exposure, Supabase RLS/migrations and Storage policies, Discord/OAuth, payment entitlements, admin functions, and every deployed Edge Function source. No tracked `.env` file or historical tracked `.env` path was found.
- Confirmed high-priority abuse paths: unauthenticated callers can create unlimited UUID identities for `vote-build`, so they can manipulate build vote totals; and `report-sim` accepts anonymous, unbounded report submissions including arbitrary session JSON, allowing report/database cost and moderation-queue flooding.
- Confirmed the Private-mode limitation also includes the public `board-stills` Storage bucket: protected database reads do not make already-published static files or public Storage objects private. This is material if Private mode is expected to hide user build imagery/content.
- Additional remediation candidates: add per-account/rate controls to `submit-build`; add rate/budget limits before re-enabling costly screenshot inference; remove or audit/rate-limit the `submit-build` shared emergency secret path; migrate legacy SECURITY DEFINER functions from `search_path = public` to an empty, fully-qualified search path; and use an authenticated proxy/CDN for response security headers and true private hosting.
- No production, database, deployment, or legal-page files changed in this audit.

### 2026-10-01 Whole-site security remediation

- Applied `20261002030000_abuse_controls.sql` to project `xklkysmakrmgtiztsqug` and deployed `vote-build`, `report-sim`, `submit-build`, and `screenshot-to-build`.
- Votes now require a valid signed-in account and are capped at 30 changes per minute per account; caller-provided anonymous voter UUIDs are no longer accepted. Simulator reports now require sign-in, cap each account at five per hour, and reject oversized request/session snapshots.
- Build publishing is account-only and capped at 12 per hour; the unlogged/rate-unlimited `submit-build` shared-secret path was removed. Screenshot import remains paused, but will be capped at three requests per hour per account if re-enabled.
- `board-stills` is now a private Storage bucket. Browser previews request a short-lived signed URL subject to the existing Live/Private Storage policy, so an object URL by itself no longer exposes a board still.
- Validation: migration push and all four Edge Function deployments completed successfully; JavaScript syntax and targeted whitespace checks passed. Docker was unavailable, so no local Supabase test container ran.

### 2026-10-02 TODO reconciliation

- Reconciled `docs/todo.md` with shipped work recorded by both assistants. Marked the completed mobile navigation/home responsive pass, broader mobile-view pass, subscription/Stripe/Discord-role and Premium-CTA work, Phase 1 launch work (with the current founding cap of 10), and updated the admin/vote descriptions to match the hardened implementation.
- Kept paused screenshot import, CSS bundling, Cloudflare-dependent dynamic build sharing, simulator parity, Phase 2, and research items open.

### 2026-10-02 Admin site-access visual alignment

- Restyled the Admin Overview Live/Private site-access section with the same layered parchment gradient, border/shadow depth, spacing, and active gold emphasis used by KPI tiles. The two mode choices now read as compact KPI-style controls; behavior and owner-only access are unchanged.

### 2026-10-02 Admin member roster

- Added an owner-only Members-tab line-item roster that merges website profiles, Discord guild members, and published-build counts. It shows website, Discord, and Premium/Founding status, Discord and Premium duration, and published builds; Discord-only members remain visible.
- Added the `members` action to the already owner-gated `admin-builds` Edge Function; no roster data is exposed through public RLS/API access. Deployed the function. Node checks and targeted whitespace validation passed; Docker was unavailable for local Supabase tests.

### 2026-10-02 CSP and board-preview console repair

- Removed `frame-ancestors` from every meta CSP because browsers ignore that directive outside an HTTP response header (which GitHub Pages cannot set). The existing font assets loaded from `fonts.gstatic.com` are now explicitly allowed by `font-src`.
- A board-still signed URL that is unavailable or rejected now transparently falls back to the existing locally painted board preview, rather than raising an unhandled `No signed board still URL` error.

### 2026-10-02 Admin access panel shade

- Added the Admin Overview Live/Private access panel to the same Patch3 dark shade treatment used by KPI tiles. Its mode controls and behavior are unchanged.

### 2026-10-02 Admin access panel sizing

- Constrained the Live/Private access panel to `width: 100%` with `box-sizing: border-box` and a matching `max-width`, preventing its padded shadow panel from extending beyond the KPI section.

### 2026-10-02 Admin Analytics styling

- Restyled Analytics traffic tables and empty-state text with white UI text, light table separators, and the shared dark Patch3 shaded panel treatment used by KPI content. Analytics data and RPC behavior are unchanged.

### 2026-10-02 History class picker layout

- Changed the Create History upload picker from a three-column wrapping grid to seven equal columns in one row, one per hero-class icon. Selection behavior and the rest of the History overlay are unchanged.

### 2026-10-02 Admin member profile links

- Website members in the Admin Members roster now have their displayed name linked to `/u/?d={discord_id}`. Discord-only rows remain non-linked; roster data and authorization are unchanged.

### 2026-10-02 Admin member status icons

- Replaced the Members roster Website, Discord, and Premium text badges with status icons using the BPB logo, Discord icon, and Premium crown. Icons retain accessible labels/tooltips and active/inactive visual states.

### 2026-10-02 Admin Builds metadata text

- Changed Admin Builds line-item metadata (creator, hero class, and created time) to white UI text with the existing outline treatment for readability on the dark shaded cards.

### 2026-10-02 Cosmetic publish authorization

- Fixed Admin Cosmetics publishing and published-ID loading to use the owner-authenticated `admin-builds` Edge Function instead of direct browser writes/reads against the RLS-protected `cosmetic_drops` table. Added allow-listed `cosmetics` and `publish_cosmetic` actions with server-side field validation and service-role persistence.
- Deployed `admin-builds` and passed the Admin Cosmetics JavaScript syntax check. Missing legacy cosmetic image files remain separate catalog asset gaps; they do not block publishing.

### 2026-10-02 Sim Reports reporter filter

- Removed the obsolete Guest option from the Admin Sim Reports reporter filter. Reports are authenticated-only now; legacy Guest rows are not offered as a current filter choice.

### 2026-10-02 Security contribution rules

- Added a shared `AGENTS.md` security checklist covering server authorization, secrets, RLS/Storage, input limits, escaping/CSP, payment entitlements, regression coverage, deployment validation, and legal-page review requirements for future changes.

### 2026-10-02 Create Build-tab priority drops

- Restored priority drops from history-uploaded board items, including history-scrubber items whose rendered key does not match a draft key. Dropping onto Needs, Wants, or Good to have changes only the placement priority and keeps the attached history locked.
- Catalog drags now work for any matching item already on the board, including duplicate copies. A selected matching copy is used first; otherwise an unclassified copy is selected. Catalog items absent from the board remain rejected.
- Mobile drop targeting now accounts for the dragged sprite’s position as well as the finger/pointer, so the held item can reach the Build tab controls without an accidental board move.
- Corrected the held-item overlap calculation to measure coverage of the item rather than the much wider tier panel. A visible drop over a tier now resolves as a priority-only change instead of falling through to the history-unlock prompt.

### 2026-10-02 Create desktop responsive scaling

- Replaced the fixed desktop Create board/rail dimensions with bounded fluid sizes: the board scales between 30rem and 56rem, while the Filter/Build rail scales between 21rem and 32rem. The 2560px composition remains unchanged at its maximum size.
- Added matching desktop clamps for Filter/Build tabs, labels, submit control, and Build-tab item icons so those sections stay visible and proportional at 1080p/1440p widths. The existing mobile layout breakpoint remains unchanged.
- `git diff --check` passed. The existing browser onboarding layout script could not reach its expected onboarding state in the local static run, so no browser visual assertion was produced.

### 2026-10-02 History picker catalog guard

- Made the Create History picker read-only with respect to catalog drags. Catalog drag starts are ignored while a history database run is being previewed, preventing items from being placed on the board before a run is selected or the picker is closed.

### 2026-10-02 Create toolbar layout stability

- Reserved a normal toolbar row above the Create board from the initial empty state. The row is invisible until the first bag/item is placed, including reserved Play/Export control space, so revealing controls no longer pushes the board stage or Parked strip downward.
- On narrow Create layouts, tightened only the page header and reduced the catalog from 30dvh to 24dvh so the reserved toolbar, full board, and Parked strip remain visible together.

### 2026-10-02 Temporary Premium testing grant

- Granted the requested verified tester a seven-day Premium entitlement through 2026-10-09 and synchronized the Discord Premium role. The existing entitlement expiry check will return the account to free access afterward unless renewed.

### 2026-10-02 Create compact toolbar row

- Reworked the narrow Create-board toolbar into a compact single row: the edit controls now align from the left instead of reserving the center, while gold, stamina, and the stamina status stay together at the right.
- Reduced only the narrow-layout icon, label, and gap sizes. The same rules also apply when the board column itself is narrow on an otherwise wide screen. History-locked boards retain their unlock control in the row.
- The economy readout itself is now non-wrapping at every board width, which prevents the stamina status from becoming a second toolbar line when a desktop board column is constrained.

### 2026-10-02 Parked layout diagnostic

- Added a temporary magenta inset outline to the Create page Parked section to make its rendered bounds visible during layout debugging.

### 2026-10-02 Parked capacity reduced

- Reduced the Parked tray from three rows (27 unique stacks) to two rows (18 unique stacks). The mobile tray now uses the same two-row grid with horizontal scrolling for narrow widths, and drag/drop capacity checks use the new 18-item limit.

### 2026-10-02 Create toolbar alignment

- Left-aligned the Create toolbar controls (layer toggles, reset, media/export, and Play) while keeping the gold/stamina readout right-aligned. History unlock remains the leftmost control when shown.
