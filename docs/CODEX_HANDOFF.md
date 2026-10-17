# Codex handoff

### 2026-10-16 Builds class/rank/event filter groups 270 - complete

- Codex owns `js/pages/builds/feed-filters.js`, the Builds filter CSS in
  `js/pages/builds/builds.css`, the focused regression, `docs/todo.md`, and
  this handoff for this task.
- Scope: present hero classes as one Items-style icon row, league ranks as a
  compact multi-column icon grid, and the existing event selection as
  checkmark controls without changing state, URL, or filtering semantics.
- No legal, authentication, database, or security behavior changes are in
  scope.
- Updated `js/pages/builds/feed-filters.js` so Hero class and League rank have
  labeled Items-style groups. Hero class keeps one equal-width icon row;
  League rank uses four columns over two rows for readable icons. Replaced the
  single event dropdown with checkmark controls: “All events” maps to the
  existing `null` state, and event slugs continue using the existing
  `?event=` and filtering path.
- Added `scripts/builds-filter-groups-smoke.mjs`. Verification passed at
  1440×900, 1080×720, 768×900, and 390×844 using the real desktop rail/stacked
  filter widths, including row/grid geometry, event pressed-state markup, and
  overflow. Existing Builds tag, filter-preset, personal-filter, shade,
  card-info, and surface-padding smokes, generated filter-state markup,
  changed-module syntax, and `git diff --check` also pass. Work remains local
  and uncommitted; no push was requested. Next step: none for this task.

### 2026-10-16 Builds tag filter columns 269 - complete

- Codex owns `js/pages/builds/feed-filters.js`, the Builds filter CSS in
  `js/pages/builds/builds.css`, the focused regression, `docs/todo.md`, and
  this handoff for this task.
- Scope: give the Builds Tags group an Items-style two-column layout and
  category-colored Patch3 tag surfaces while preserving filter state,
  query behavior, menus, and the responsive filter drawer.
- No legal, authentication, database, or security behavior changes are in
  scope.
- Updated `js/pages/builds/feed-filters.js` so the existing five tag buttons
  keep their `data-feed-tag` and `aria-pressed` contracts inside a named Tags
  shade and dedicated two-column grid. Added matching OP, Feasible, Theory,
  Real, and Featured Patch3 fill tokens and responsive text sizing in
  `js/pages/builds/builds.css`; the fills match the existing clickable build
  card hashtags.
- Added `scripts/builds-filter-tags-smoke.mjs`. Verification passed at
  1440×900, 1080×720, 768×900, and 390×844 for two columns, five clickable
  controls, category surfaces, Patch3 masks, and no horizontal overflow.
  Existing Builds tag/shade/card-info/surface-padding smokes, shared filter
  preset smoke, changed-module syntax, and `git diff --check` also pass.
  Work remains local and uncommitted; no push was requested. Next step: none
  for this task.

### 2026-10-16 Build tooltip Alt preview correction 268 - complete

- Codex owns the build tooltip preview interaction and its focused smoke tests
  in `js/pages/build/more-build-tip.js`,
  `js/pages/build/more-build-tip.css`,
  `scripts/build-tooltip-animation-smoke.mjs`,
  `scripts/build-tooltip-animation-browser-smoke.mjs`, `docs/todo.md`, and
  this handoff. Cursor does not own these paths.
- Added a real `Alt` keydown path to the existing lightweight no-stats preview,
  with repeat suppression and `aria-keyshortcuts="Alt"`, so the preview starts
  without moving the pointer from the hovered build. The indicator now shows an
  `Alt` keycap beside the game play icon and its center is aligned to the
  board's top-right corner, including responsive scaling.
- Updated the focused static/browser smoke coverage. Verification passed for
  Alt activation, play/pause state, live board mounting, indicator alignment,
  1440×900/1080×720/768×900/390×844 placement, changed-file syntax, and
  `git diff --check`. Marked the todo clarification complete. No legal or
  security surfaces changed. Work remains local and uncommitted; no push was
  requested. Next step: none for this task.

### 2026-10-16 Shared filter preset 267 - complete

- Codex owns the shared filter preset, its focused regression, the filter-page
  stylesheet imports, the page-specific filter root opt-ins and chrome cleanup,
  `docs/todo.md`, and this handoff. Cursor does not own these paths.
- Added `js/shared/filter-preset.css` as the Items-derived visual source of
  truth: transparent filter hosts, no competing outer slabs, and the same soft
  Patch3 section bands using the Items `rgba(14, 15, 16, 0.09)` shade token.
  Opted the real filter rails into the preset across Items, Builds, Create,
  Events, Admin, Sim's build browser, and profile inventory/settings surfaces.
  Removed the Builds/Sim section-band suppressors so page-specific layout,
  menus, scrollbar, and drawer behavior remain intact while their surfaces
  match Items.
- Added `scripts/filter-preset-smoke.mjs`; it checks every filter root and page
  stylesheet import, exercises the shared and page CSS combinations, and
  verifies the host/band contract at 1440×900, 1080×720, 768×900, and 390×844.
  Passed the focused smoke, changed-module syntax checks, Builds tag/shade
  regressions, Builds card/surface smokes, and `git diff --check`.
  Marked the todo complete. No legal or security surfaces changed. Work remains
  local and uncommitted; no push was requested. Next step: none for this task.

### 2026-10-16 Builds tag preset 266 - complete

- Codex owns `js/pages/builds/post-row.js`, `js/pages/builds/builds.css`, the
  focused Builds tag preset regression, `docs/todo.md`, and this handoff for
  the hashtag tag visual preset and filter navigation on Builds cards. Cursor
  does not own these paths. No legal or security surfaces are in scope.
- Build flairs now render as `#TagName` links. Build tags route to the existing
  Builds `tags=` filter, event tags route to the existing `event=` filter, and
  all categories use the shared Items Patch3 mask with distinct OP, event,
  authenticity, featured, and regular tint tokens. Hover/focus raises and
  brightens clickable tags while preserving responsive wrapping.
- Added `scripts/builds-tag-preset-smoke.mjs` and marked the todo complete.
  Verification passed at 1440×900, 1080×720, 768×900, and 390×844 for tag
  rendering, scribble masks, hover behavior, link contracts, and overflow;
  existing Builds shade/card-info/surface-padding smokes, changed-module
  syntax checks, and `git diff --check` also passed. Work remains local and
  uncommitted; no push was requested. Next step: none for this task.

### 2026-10-16 Builds line-item shade 265 - complete

- Codex owns `js/pages/builds/builds.css`, the focused Builds surface smokes,
  `docs/todo.md`, and this handoff for replacing the public Builds view's black
  listing surfaces with the Items page's dark Patch3 shade treatment across
  card, compact, and grid views. Cursor does not own these paths. No legal or
  security surfaces are in scope.
- Removed the opaque `#111`/`bg-dark-textured.webp` fills from the public Builds
  listing surfaces. Card view now shades its header and body as one panel;
  compact and grid views shade their complete wrappers with the shared
  responsive Patch3 mask and transparent backgrounds.
- Updated the focused source/browser regressions and marked the todo complete.
  Verification passed at 1440×900, 1080×720, 768×900, and 390×844 for the
  dark shade, plus Builds card-info/surface-padding smokes, changed-module
  syntax checks, and `git diff --check`. Work remains local and uncommitted;
  no push was requested. Next step: none for this task.

### 2026-10-16 Items catalog static art + WebP derivatives 262 - complete

- Codex owns `items/index.html`, `js/pages/items/catalog/index.js`, `js/pages/items/catalog/shell.js`, `js/pages/items/spotlight.js`,
  `js/shared/backpack-grid/item-pieces.js`, `js/shared/backpack-grid/item-pool.js`,
  `js/shared/item-live-art/index.js`, the focused Items static-art/P1 smokes,
  the catalog sprite derivative tooling and generated catalog derivatives,
  `docs/todo.md`, `docs/performance/items-page-performance-audit.md`, and this handoff for removing
  live item animation from the Items page and serving optimized static art.
  Cursor does not own these paths. Scope is limited to the Items catalog and
  its clicked-item showcase; placed boards, Create, Sim, Home, and other
  consumers retain their existing live-art behavior.

- Items catalog and clicked-item spotlight now pass `liveArt: false`; static
  filtering/loading paints also pass `appear: false`, so catalog items never
  mount live potion/glow layers or replay entrance animation. The `/items/`
  page skips automatic live-art manifest loading, while Home/Create/Sim/placed
  boards retain their prior live-art behavior. Home’s existing host-level
  `data-bpb-live-art="off"` is inherited by nested Itemiary grids.
- Expanded the thumbnail builder and generated 649 source-sprite derivatives
  at both `assets/item-thumbs/1x/` and `assets/item-thumbs/2x/`. The catalog
  selects density-aware WebP with PNG fallback; source PNGs remain for
  full-resolution board/export consumers. Manifest coverage and runtime static
  markup are checked by `scripts/items-static-art-smoke.mjs`.
- Marked the todo/performance-audit entries complete and bumped the Items entry
  module cache token. Verification passed: thumbnail build freshness, static-art
  runtime/asset smoke, Items P0/P1 performance, pointer/nav, spotlight
  composition/layout/hover/scrollbar, Create pointer, changed-file syntax, and
  `git diff --check`. No legal/security surfaces changed. Work remains local
  and uncommitted; no push was requested. Next step: none for this task.

### 2026-10-16 Home windmill first-paint handoff 264 - complete

- Codex owns `index.html`, `js/pages/home/index.js`,
  `js/pages/home/combat-sky.js`, `js/pages/home/combat-sky.css`,
  `js/pages/home/combat-sky/index.js`, the focused Home background smoke
  coverage, `docs/todo.md`, and this handoff for keeping the static windmill visible but paused
  during first paint, then handing it to the animated layer after its assets
  are ready. Cursor does not own these paths. Scope is limited to the Home
  background; the admin scroll-preview mode must remain unchanged.
- Added a first-paint windmill shell to Home HTML, preloaded the tower/blade
  masks, and made the 16:9 placeholder responsive without waiting for JS scale
  calculation. The Home initializer adopts that shell, keeps it paused, waits
  for both mask assets, then removes the pause class so the normal CSS spin
  starts without the windmill popping into view. Cache tokens were bumped;
  admin scroll-preview behavior remains unchanged.
- Added `scripts/home-windmill-first-paint-browser-smoke.mjs` and expanded the
  first-paint contract smoke. Verification passed at 2560×1440, 1920×1080,
  1366×768, tablet, and mobile; existing Home background mode smoke, changed
  module syntax checks, and `git diff --check` also passed. No legal/security
  surfaces changed. Work remains local and uncommitted; no push was requested.
  Next step: none for this task.

### 2026-10-16 Items spotlight combinations safe area 263 - complete

- Codex owns `js/pages/items/spotlight.css`, `js/pages/items/spotlight.js`,
  `js/pages/items/spotlight-recipes.js`, the focused combinations-panel smoke,
  `docs/todo.md`, and this handoff for verifying and, if needed, correcting the
  clicked-item combinations panel between the fixed navigation and the Builds
  using this item strip at 1080p and other supported viewports. Cursor does not
  own these paths. Mobile remains on the existing stacked spotlight layout.
- Verified the existing implementation already passes the live navigation and
  Builds safe bounds into the combinations panel, clamps its height/position,
  and relayouts after asynchronous Builds data appears. No product layout change
  was needed; marked the todo entry complete and added
  `scripts/items-spotlight-combinations-smoke.mjs` to prevent regressions.
- Verification passed: combinations safe-area smoke at 2560×1440, 1920×1080,
  1366×768, 1440×900, tablet, and mobile; existing spotlight composition and
  tooltip layout smokes; changed-module syntax checks; and `git diff --check`.
  No legal/security surfaces changed. Work remains local and uncommitted; no
  push was requested. Next step: none for this task.

### 2026-10-14 Simulator audit batch: Amulets of Feasting through Light
- Claimed simulator audit work and advanced the source-backed 1:1 audit through
  Amulet of Feasting, Fortune, Life, and Light. Each now has a dedicated,
  two-sided focused regression and a `verified_1to1` Admin-audit dashboard
  entry. No user live-match verification is required.
- Corrected source lifecycle timing: Feasting and Fortune now apply their
  affected-item modifiers in `onPrepare`; Life applies healing efficiency in
  `onPrepare` while retaining its combat-start health/activation behavior; and
  Light binds its listeners in `onPrepare` so it sees combat-start activations.
- Changed paths: `js/pages/sim/engine/scripts/ports-an-accessories.js`,
  `ports-buff.js`, `ports-ai-d.js`, `ports.js`,
  `scripts/build-sim-fidelity-ledger.mjs`, generated ledger/dashboard files,
  and the four focused smoke scripts. Focused smokes, source parity/call audits,
  ledger/dashboard checks, syntax checks, and `git diff --check` passed.
- Existing global audit signals remain: triaged `ruby_egg` lifecycle-hook gap,
  19 duplicate registrations, and unrelated static call-review candidates.
  Next item: Amulet of Steel. This work is local and uncommitted; unrelated
  user changes remain in the working tree.

### 2026-10-14 Home background swap complete
- Replaced the Home falling-item background with the existing scroll-scrubbed
  time-of-day combat sky and animated windmill. `index.html` now loads
  `combat-sky.css`, and `js/pages/home/index.js` boots `initCombatSky()` before
  navigation/auth work so the background is present on first paint.
- Added `scripts/home-background-mode-smoke.mjs`, covering the stylesheet and
  boot contract, removal of the falling-item layer, and windmill animation
  keyframes. Smoke and JS syntax checks passed; staged diff check passed.
- Committed locally as `31d8680` (`Use animated time-of-day Home background`).
  The commit is not pushed; unrelated local work remains unstaged.

### 2026-10-14 Home build class icon sizing complete
- Enlarged the left-anchored class icon with fluid `clamp()` sizing in
  `js/pages/home/home-promo-band.css`; the title remains centered and the icon
  remains square at all supported widths.
- Extended `scripts/home-promo-title-surface-smoke.mjs` to require the larger
  icon size and square geometry. Focused title-surface and existing Player Info
  smokes passed at desktop, short desktop, tablet, and mobile widths.
- Committed locally as `082dcfc` (`Enlarge Home build class icon`). The commit
  is not pushed; unrelated local work remains unstaged.

### 2026-10-14 Home build-animation title alignment complete
- Anchored the class icon to the left edge of the existing dark title surface
  while making the title own the full row and remain centered. The responsive
  behavior is unchanged across desktop, short desktop, tablet, and mobile.
- Extended `scripts/home-promo-title-surface-smoke.mjs` to assert the icon is
  absolutely positioned, the title is centered, the dark surface is retained,
  and no viewport overflows are introduced. Focused and existing Home Player
  Info smokes passed.
- Committed locally as `f301180` (`Align Home build class icon left`). The
  commit is not pushed; unrelated local work remains unstaged.

### 2026-10-14 Home build-animation title surface complete
- Added the Home build-animation title/class surface in
  `js/pages/home/home-promo-band.css`, reusing the same Patch3-backed
  `rgba(14, 15, 16, 0.14)` shade as the Gold and Rank cells. Fluid padding and
  a scoped pseudo-element keep the title and class icon legible without
  changing the board, player, gold, or rank layout.
- Added `scripts/home-promo-title-surface-smoke.mjs`. It passed at 1440,
  1080/short desktop, tablet, and mobile widths; the Player Info browser smoke
  also passed with no horizontal overflow and the existing responsive card
  metrics unchanged. `git diff --cached --check` passed before commit.
- Committed as `c6c836b` (`Add dark Home build title surface`). Owned paths:
  `js/pages/home/home-promo-band.css` and
  `scripts/home-promo-title-surface-smoke.mjs`. Unrelated local work remains
  unstaged.

### 2026-10-14 Choose Your Hero bag links complete
- Claimed and updated `js/pages/home/home-class-showcase.js` and its stylesheet.
  The subtitle now explains both navigation paths. Revealed starting bags are
  accessible links using the existing Builds search chip format
  (`q=[[item_id]]`), so each bag opens the Builds page filtered to that exact
  bag; the card's hero links and delegated card navigation remain unchanged.
- Added `scripts/home-class-showcase-bag-links-smoke.mjs` to verify the copy,
  anchor contract, pointer styling, exact item-id serialization, and positive /
  negative build matching. Verification passed: bag-link smoke, Admin Choose
  Your Hero static/browser smokes, Home pointer smoke, and `git diff --check`.
- Responsive behavior is unchanged and verified at 1440, 1080, tablet, and
  mobile widths. Owned paths: `js/pages/home/home-class-showcase.js`,
  `js/pages/home/home-class-showcase.css`, and the new smoke script. Committed
  and pushed as `8e70aa3` (`Link Choose Your Hero bags to filtered builds`).
  Unrelated local edits remain unstaged.

### 2026-10-14 Home clickable cursor audit complete
- Claimed and updated the Home pointer surfaces in
  `js/pages/home/featured-stage.css`, `home-class-showcase.css`,
  `home-items-explore.css`, and `home-promo-band.css`. CSS cursor variables now
  fall back to the native `pointer`/`default` values because the custom game
  cursor stylesheet is intentionally not loaded; the featured carousel's
  active media also explicitly owns the pointer because its delegated click
  mounts the preview while the surrounding active copy remains default.
- Added `scripts/home-pointer-smoke.mjs`, covering the active preview media,
  delegated hero card, item sprite, build cell, promo board link, and inactive
  featured slide at 1440, 1080, tablet, and mobile widths. Verification
  passed: focused Home pointer smoke and `git diff --check`. No mobile
  override was added because the site uses the platform cursor on mobile.
- Owned paths: the four Home stylesheets above and the new pointer smoke. The
  pointer-only commits `8dcbe6e` and `a87cefd` are pushed to `origin/main`;
  unrelated local work remains unstaged.

### 2026-10-14 Discord latest build image repair complete
- Repaired only the two newest Builds forum threads:
  `bpbb-crazy-debuff-invin-build-9ini5d` and
  `bpbb-molten-greatsword-on-alchemist-is-awesom-vvki8f`.
- Root cause was the existing public `discord-builds` bucket's 2 MiB file
  limit. Generated board PNGs are 5.6–6.5 MiB, so hosting failed and the bot
  fell back to unavailable `board-stills` URLs. `bot/board-thumb.js` now reads
  and upgrades the bucket to a 10 MiB limit before upload; the guarded repost
  refuses to delete a target if its replacement image cannot be hosted.
- Deleted/reposted both targets. Final live verification shows zero message
  attachments, one embed image per post, `discord-builds/*.png` URLs, and HTTP
  200 `image/png` responses. Added the bucket/repost contract assertions to
  `discord-build-image-smoke.mjs`; syntax and smoke checks passed. This code
  change is local and has not been pushed.

### 2026-10-14 Tooltip-to-tooltip fade restart complete
- Shared tooltip hosts now add a scoped anchor-switch animation whenever visible
  content is replaced. Item/cosmetic, build-preview, event, and Home curated
  loadout tooltips fade through the transition instead of swapping at full
  opacity; ordinary show/hide and reduced-motion behavior remain intact.
- Owned paths for this change: `js/shared/tooltip-motion.js`,
  `js/shared/tooltip.css`, and tooltip transition smoke coverage.
- Responsive rule: tooltip placement and scale are unchanged at 1440,
  1080/short desktop, tablet, and mobile; only the opacity lifecycle changes.
- Added static coverage for the swap class/keyframes and browser coverage that
  switches anchors, samples the fade, checks replacement content, and verifies
  reduced-motion/responsive states. Verification passed: tooltip transition
  static/browser smokes, tooltip scale smoke, curated-loadout responsive smoke,
  JS syntax checks, and `git diff --check`. This work is local and has not been
  pushed.

### 2026-10-14 Player Info card background complete
- Added the Choose Your Hero card treatment only to
  `.home-promo--player-info .home-promo__card`: a black-to-gray radial gradient,
  `#3a322c` outline, and `1.5rem` radius. The surrounding build-animation
  section remains transparent and mask-free.
- Preserved the card's existing fluid layout, frame removal, animation content,
  and no-overflow behavior at 1440, 1080/short desktop, tablet, and mobile
  widths. Bumped the Home promo stylesheet cache key in the live Home page and
  both admin animation test/performance surfaces.
- Updated the static and browser smokes to assert the card surface, border, and
  radius while retaining the transparent outer section checks. Verification
  passed: Player Info animation/skeleton smokes, Home section skeleton and
  first-paint browser smokes, no-skeleton shape smoke, and `git diff --check`.
  This work is local and has not been pushed.

### 2026-10-14 Local website changes pushed
- Committed and pushed the staged product/assets/regression set as
  `82bd0396a3934edf01d06ffb19a7ee95d58873d3` (`Sync local website updates`) to
  `origin/main`; the remote ref was verified to match the local commit.
- The staged set includes the Home visual/performance work, Patches banner and
  route, shared tooltip fade lifecycle, Ranger asset, Discord embed-image fix,
  and their responsive smoke coverage.
- Credential-bearing local PowerShell helpers, account-reset SQL/test scripts,
  scratch completion summaries, and `.omc/` state remain untracked and were not
  published. The working tree is otherwise clean relative to `origin/main`.

### 2026-10-14 Curated loadout metadata spacing and avatar scale complete
- Removed the extra board-to-metadata flex gap and reduced the board still's
  reserved transparent tail by a small responsive amount, bringing creator
  information visibly closer without changing the board image or ordering.
- Increased creator pfp/blob rendering to a fluid `3rem`–`4rem` clamp and raised
  the face source request to 64px so the larger face stays crisp. The compact
  mobile card remains within its width and the blob remains uncropped/square.
- Added `home-curated-loadout-meta-browser-smoke.mjs`, a red/green responsive
  geometry check covering 1440, 1080, 768, and 390px, including the overlap
  bound, square avatar size, source contract, and horizontal overflow. Updated
  Home cache keys. Verification passed: the focused smoke, Home no-skeleton and
  footer/first-paint browser smokes, JS syntax checks, and `git diff --check`.
  This work is local and has not been pushed.

### 2026-10-14 Footer corner underlay correction complete
- The footer host now paints the same `bg-hills-night-deep.jpg` scene as the
  curated loadouts band behind its masked top corners, so the left/right curve
  reveals cannot fall through to the Town Square body background. Mobile keeps
  the opaque textured footer fallback because its curve mask is disabled.
- Bumped the Home loadouts stylesheet cache key and extended
  `home-footer-browser-smoke.mjs` to assert the matching underlay plus the
  existing 24/25px overlap, stacking order, responsive mask, and no overflow.
  Verification passed: footer smoke, Home no-skeleton smoke, first-paint smoke,
  and `git diff --check`. This work is local and has not been pushed.

### 2026-10-14 Curated loadouts background underlap complete
- The Home footer host now overlaps the curated build-loadout band by the
  footer's transparent curve height (24px desktop/short desktop, 25px tablet),
  with the footer promoted above the loadout background as the interactive top
  layer. Phones keep the existing unmasked textured footer and do not overlap.
- Bumped the Home curated-loadouts stylesheet cache key and extended the footer
  browser smoke to measure the exact overlap, stacking order, responsive mask,
  and horizontal overflow at 1440, 1080, 768, and 390px. Verification passed:
  `home-footer-browser-smoke.mjs`, `home-section-skeleton-browser-smoke.mjs`,
  `home-section-skeleton-smoke.mjs`, `home-first-paint-browser-smoke.mjs`, and
  `git diff --check`. This work is local and has not been pushed.

### 2026-10-14 Remove Home loading skeletons complete
- Scope: remove every visible/loading skeleton from the Home page only, including
  section placeholders, sprite/bag placeholders, Player Info's coordinated stack,
  and the shared navigation placeholder while Home boots. Other pages retain the
  shared skeleton helpers and their existing loading states.
- Owned paths for this change: `js/pages/home/`, `js/pages/home/index.js`,
  `js/shared/nav.js`, and focused Home skeleton smoke scripts.
- Responsive rule: Home remains fluid at 1440, 1080/short desktop, tablet, and
  mobile; removing placeholders must not introduce horizontal overflow.
- Each Home section now mounts clean markup (or an explicit error status) while
  data loads, and the shared nav skips its placeholder only when `body.page-home`
  is active. Cache keys were bumped for the changed Home modules/styles.
- Verification passed: `home-section-skeleton-smoke.mjs`,
  `home-section-skeleton-browser-smoke.mjs`,
  `home-promo-player-skeleton-browser-smoke.mjs`,
  `home-promo-skeleton-shape-smoke.mjs`,
  `home-promo-skeleton-lifecycle-browser-smoke.mjs`,
  `home-first-paint-browser-smoke.mjs`, `home-footer-browser-smoke.mjs`,
  `home-promo-activity-smoke.mjs`,
  `admin-home-player-info-animation-browser-smoke.mjs`, all touched-module
  `node --check` checks, and `git diff --check`. This work is local and has not
  been pushed.

### 2026-10-14 Patches banner sizing and route complete
- Standardized the Patches pennant to the same responsive desktop slot as the
  Events/Market/Quest banners, including the narrower 1200px desktop breakpoint;
  the supplied artwork now fills that slot without the previous undersized
  plaque. Mobile/tablet behavior remains drawer-only.
- Added `/patch-notes/` as the linked under-construction Patches page, reusing
  the established Market coming-soon surface with its own page module and
  metadata. The existing nav link already targets this route.
- Added static and responsive browser smoke coverage. Verification passed:
  `nav-patches-smoke.mjs`, `nav-patches-browser-smoke.mjs`,
  `patch-notes-page-smoke.mjs`, `patch-notes-page-browser-smoke.mjs`,
  `home-first-paint-browser-smoke.mjs`, `node --check`, and `git diff --check`.
  This work is local and has not been pushed.

### 2026-10-14 Restore home footer side curves complete
- The footer base is transparent again on desktop/tablet so the existing masked
  textured pseudo-layer can reveal the left/right top curves. The pseudo-layer
  still covers the full footer below the curve. Mobile keeps an opaque textured
  base because its curve mask is intentionally disabled.
- Updated the footer smoke to assert transparent desktop/tablet bases, the
  responsive curve masks, and the opaque unmasked mobile fallback. Verification
  passed: `home-footer-browser-smoke.mjs`, `admin-footer-presets-browser-smoke.mjs`,
  `home-first-paint-browser-smoke.mjs`, and `git diff --check`. This work is
  local and has not been pushed.

### 2026-10-14 Featured-to-Player Info spacing adjustment complete
- Reduced only the featured stage shell's bottom margin from `2rem` to `1.25rem`,
  trimming the gap before the Player Info build animation by 12px on desktop,
  short desktop, and tablet. The existing mobile `1.15rem` spacing remains
  unchanged.
- Added a responsive smoke assertion for the compact inter-section gap and
  bumped the featured stylesheet cache key. Verification passed:
  `home-section-skeleton-browser-smoke.mjs`, `home-first-paint-browser-smoke.mjs`,
  `admin-home-player-info-animation-browser-smoke.mjs`, and `git diff --check`.
  This work is local and has not been pushed.

### 2026-10-14 Home Player Info skeleton overlay correction complete
- The four translucent panels were the Player Info skeleton stack painting above the
  finished caption, player, board, and details. The assembler now marks the card
  explicitly ready (`data-promo-ready="true"`, `aria-busy="false"`) and hides/removes
  the stack defensively; the error boundary follows the same cleanup path. A CSS
  fallback prevents a stale live-reload stack from remaining visible after ready.
- Bumped the home promo module and stylesheet cache keys so local reloads receive
  the corrected lifecycle code. Added assertions for zero skeleton surfaces and
  the ready/busy state after animated and reduced-motion paints.
- Verification passed: `home-promo-skeleton-lifecycle-browser-smoke.mjs`,
  `home-promo-player-skeleton-browser-smoke.mjs`,
  `admin-home-player-info-animation-browser-smoke.mjs`, both promo `node --check`
  checks, and `git diff --check`. This work is local and has not been pushed.

### 2026-10-14 Footer navigation pill buttons complete

- Restyled the shared footer navigation links as compact pill buttons with the
  exact scrollbar thumb yellow `#eac914`, dark readable text, subtle game-style
  rim/shadow, hover lift, and visible keyboard focus. Regular and slim footer
  presets both use the treatment; social icon links remain unchanged.
- Added static and responsive browser assertions for the yellow background,
  pill radius, flex button geometry, regular/slim presets, wrapping, and no
  overflow at 1440, 1080, 768, and 390px. Verification:
  `admin-footer-presets-smoke.mjs`, `admin-footer-presets-browser-smoke.mjs`,
  `home-footer-browser-smoke.mjs`, `home-section-skeleton-browser-smoke.mjs`,
  and `git diff --check` pass. No auth, data, legal-page, or migration
  behavior changed. This work is local and has not been pushed.

### 2026-10-14 Curated Build Loadouts footnote removal complete

- Removed the redundant “Browse every featured board in the catalog” line from
  the curated loadouts success view and removed its unused style rule. The
  section title, build rail, buttons, and empty/error states are unchanged.
- Added a static regression rejecting the removed copy. Verification:
  `home-section-skeleton-smoke.mjs`,
  `home-section-skeleton-browser-smoke.mjs`, `node --check
  js/pages/home/home-builds-vault.js`, and `git diff --check` pass. No auth,
  data, legal-page, or migration behavior changed. This work is local and has
  not been pushed.

### 2026-10-14 Home footer exposed-edge correction complete

- Root cause: the footer's curved `::before` texture intentionally has
  transparent pixels in its 24px/25px top step, but the footer itself was
  transparent. Those pixels therefore revealed the hills scene as a brown
  strip above the dark footer.
- Added an opaque dark-textured underlay to the Home footer itself. The curved
  mask remains in place, but every transparent edge pixel now resolves to the
  footer's own texture instead of the page background; footer content, bounds,
  and responsive edge geometry are unchanged.
- Updated the Home footer browser/static checks to require the opaque texture
  underlay and preserve the desktop/short-desktop/tablet/mobile mask and
  overflow contracts. Verification: `home-footer-browser-smoke.mjs`,
  `admin-footer-presets-smoke.mjs`, and `git diff --check` pass. No auth, data,
  legal-page, or migration behavior changed. This work is local and has not
  been pushed.

### 2026-10-14 Home build-animation height stabilization complete

- Root cause: the Player Info build title was clamped to two lines but only
  reserved its natural height. A one-line title therefore shortened the entire
  promo card by about 32px at 1440px, shifting the following Home section and
  exposing an inconsistent page-background gap.
- Reserved the two-line title footprint with a responsive `min-height` on the
  Player Info title. The existing two-line clamp, typography, board, and
  animation remain unchanged; only the short-title whitespace is stabilized.
- Added a browser regression that compares one-line and two-line card heights
  at 1440, 1080, 768, and 390px, plus static coverage for the reservation.
  Verification: `admin-home-player-info-animation-smoke.mjs`,
  `admin-home-player-info-animation-browser-smoke.mjs`,
  `home-section-skeleton-browser-smoke.mjs`,
  `home-promo-player-skeleton-browser-smoke.mjs`, and `git diff --check` pass.
  No auth, data, legal-page, or migration behavior changed. This work is local
  and has not been pushed.

### 2026-10-14 Patches navbar banner asset replacement complete

- Renamed the supplied banner image from
  `assets/theme/ui/df9ee347-d41a-48d6-a31c-a6f2c9523d8c.png` to the canonical
  `assets/theme/ui/ui-patches-banner.png` and switched the navbar markup to
  use it. The temporary generated `ui-patches-banner.svg` was deleted after
  its references were removed; the markup now carries the supplied 1100x1430
  intrinsic dimensions to avoid a load-time layout shift.
- Updated the static and responsive Patches navbar smokes to validate the PNG
  signature, reject stale SVG references, load the new asset, and preserve the
  desktop/tablet/mobile visibility and overflow contracts. Verification:
  `nav-patches-smoke.mjs`, `nav-patches-browser-smoke.mjs`,
  `node --check js/shared/nav/markup.js`, and `git diff --check` pass. No auth,
  data, legal-page, or migration behavior changed. This work is local and has
  not been pushed.

### 2026-10-14 Discord build embed-only image fix complete

- Root cause: new forum posts still sent `build.png` as a normal multipart
  attachment while also declaring the board image in the embed. Discord then
  rendered the same board once above the embed and once inside it.
- New posts now host a generated board image when it fits the public image
  bucket and always send the board only through the embed URL; no board file is
  included in the thread message payload. Existing still URLs remain the safe
  fallback when generated PNG hosting is rejected by the bucket limit.
- Added `discord-build-image-smoke.mjs` and a guarded
  `repost-discord-builds.mjs` maintenance path. Verified the two newest live
  posts, deleted and recreated them in chronological order, and confirmed both
  replacement messages have zero attachments and one embed image. The local
  bot state was updated with the replacement thread IDs. `node --check` and
  `git diff --check` pass. No auth, data, legal-page, or migration behavior
  changed. Code and scripts are local and have not been pushed.

### 2026-10-14 Curated Build Loadouts metadata spacing complete

- Tightened the board-to-metadata flex gap from 0.45rem to 0.15rem while
  leaving the board's required overhang reservation intact.
- Increased creator pfp/blob rendering to a responsive 2.5rem–3rem clamp and
  raised the face source request to 48px. The author row, class icon, links,
  and board composition are unchanged.
- Added static coverage for the spacing and avatar contracts. Responsive Home
  section smoke coverage and JavaScript syntax checks pass at 1440, 1080, 768,
  and 390px with no overflow. No auth, data, legal-page, or migration
  behavior changed. This work is local and has not been pushed.

### 2026-10-14 Curated Build Loadouts hover glow removed

- Removed the card-level `drop-shadow` hover/focus filter from the Curated
  Build Loadouts rail. Hovering no longer adds the unwanted glow; row pause,
  stacking order, focus outline, and card links remain unchanged.
- Added a focused static regression to ensure the hover/focus rule cannot
  reintroduce the glow. Responsive Home section smoke coverage remains green
  at 1440, 1080, 768, and 390px with no overflow. No auth, data, legal-page,
  or migration behavior changed. This work is local and has not been pushed.

### 2026-10-14 Home footer coverage complete

- Root cause: the footer used one full-height SVG mask, so its curve geometry
  scaled with the footer content and left the lower textured surface visually
  disconnected from the footer copy.
- Replaced it with the same fixed-step composite mask geometry as the aligned
  Home surfaces: 24px/320px on desktop, 25px/100px at tablet, and a plain
  textured surface below 400px. The pseudo-element remains inset to all four
  footer edges, so the texture covers the entire footer height.
- Added static and browser assertions for the fixed edge sizes, mobile
  fallback, full pseudo-element bounds, responsive cover sizing, and no
  horizontal overflow. Bumped the Home stylesheet query to invalidate the old
  cached mask. Verification: `admin-footer-presets-smoke.mjs`,
  `home-footer-browser-smoke.mjs`, and `git diff --check` pass. No auth, data,
  legal-page, or migration behavior changed. This work is local and has not
  been pushed.

### 2026-10-14 Choose Your Hero curve-size alignment complete

- Root cause: the previous inverted Hero mask used a full-section SVG whose
  24px-looking curve coordinates were stretched over the entire band height,
  producing a much larger dip than Explore 500 Items.
- Replaced it with a fixed-step composite mask matching Explore's geometry:
  24px depth and 320px corner transitions on desktop, 25px depth and 100px
  corners at the tablet breakpoint. The Hero remains inverted, viewport-flush,
  and disables the edge mask below 400px like Explore Items.
- Updated static/browser coverage to assert the fixed mask sizes, matching
  breakpoint geometry, mobile fallback, all four hero presets, and no overflow.
  Verification: `admin-home-class-showcase-test-smoke.mjs`,
  `admin-home-class-showcase-test-browser-smoke.mjs`, and `git diff --check`
  pass. No auth, data, legal-page, or migration behavior changed. This work
  is local and has not been pushed.

### 2026-10-14 Home Player Info skeleton dismissal boundary complete

- Root cause: the Player Info assembler mounted the complete bag + item board
  during the second wave, but waited another `PLAYER_WAVE_MS` before removing
  the four-surface loading stack. This left the skeleton visibly covering
  ready content during the remainder of the intro.
- The stack now clears immediately after the complete board composition is
  mounted; the wave animation and board-complete activity state still finish
  on their existing schedule.
- Added a normal-motion regression to
  `home-promo-skeleton-lifecycle-browser-smoke.mjs` that waits for both bag
  and item nodes, then asserts no skeleton remains over the loaded section.
  Verification: lifecycle, Player Info shape/responsive, animation, section
  skeleton, and JavaScript syntax smokes pass. No auth, data, legal-page, or
  migration behavior changed. This work is local and has not been pushed.

### 2026-10-14 Shared tooltip enter fade correction complete

- Fixed the shared tooltip show lifecycle so hosts that start hidden commit
  their transparent base frame before receiving `is-visible`. Item, build, and
  event tooltips now visibly fade in instead of appearing instantly, while
  repeated refreshes of an already-visible tooltip do not restart the fade.
- Extended the tooltip static/browser regression coverage to assert a
  transparent enter frame, an in-progress opacity value, full opacity after
  the transition, hidden-host coverage for build/event tips, responsive
  behavior, reduced motion, and unchanged fade-out cleanup. Verification:
  `tooltip-transition-smoke.mjs`, `tooltip-transition-browser-smoke.mjs`,
  `tooltip-scale-smoke.mjs`, and `git diff --check` pass. No auth, data,
  legal-page, or migration behavior changed. This work is local and has not
  been pushed.

### 2026-10-14 Curated Build Loadouts transition overlap complete

- Added a responsive negative top margin to the Curated Build Loadouts
  wrapper, pulling it 24px upward at desktop and scaling to 14.4px at tablet
  and mobile. This lets the Explore Items lower dip overlap the loadouts
  surface without changing the loadout content, background, or edge bleed.
- Added static and responsive browser coverage for the negative overlap margin,
  deep-night background, viewport edges, and no horizontal overflow at 1440,
  1080, tablet, and mobile widths. Verification:
  `home-section-skeleton-smoke.mjs`, `home-section-skeleton-browser-smoke.mjs`,
  and `git diff --check` pass. No auth, data, legal-page, or migration
  behavior changed. This work is local and has not been pushed.

### 2026-10-14 Home footer inverted top edge complete

- Applied the same full-width SVG mask used by Choose Your Hero to the Home
  footer's textured background. The footer surface now rises through the
  center and sits lower at both sides, while footer copy remains above the
  masked layer and existing responsive padding is unchanged.
- Added static and browser coverage for the curve mask, textured background,
  responsive cover sizing, paint isolation, and no horizontal overflow at
  1440, 1080, tablet, and mobile widths. Verification:
  `admin-footer-presets-smoke.mjs`, `home-footer-browser-smoke.mjs`, and
  `git diff --check` pass. No auth, data, legal-page, or migration behavior
  changed. This work is local and has not been pushed.

### 2026-10-14 Choose Your Hero inverted top edge complete

- Added a full-width SVG mask to the Choose Your Hero background layer. Its
  top edge rises through the center and sits lower at both sides, inverting the
  Explore 500 Items edge treatment while keeping the dark texture, content
  rail, and viewport-flush bleed unchanged.
- Added static and responsive browser coverage for the inverted mask, dark
  texture, 1440/1080/tablet/mobile geometry, all four preview presets, and no
  horizontal overflow. Verification: `admin-home-class-showcase-test-smoke.mjs`,
  `admin-home-class-showcase-test-browser-smoke.mjs`, and `git diff --check`
  pass. No auth, data, legal-page, or migration behavior changed. This work is
  local and has not been pushed.

### 2026-10-14 Home Player Info skeleton lifecycle and final-shape alignment complete

- Fixed the build-animation loading surface so invalid/empty loaded builds are
  filtered before the animation loop, preventing a microtask loop from
  stranding the skeleton over a ready section. The assembler now clears the
  skeleton when no playable build exists, when the board cannot mount, and the
  Home boundary also clears it on unexpected render failures.
- Rebuilt the four-surface skeleton around the Player Info card grid instead of
  arbitrary percentage offsets. The title, player, board, and details surfaces
  now follow the responsive desktop/tablet/mobile layout; the board skeleton
  keeps the final 9:7 board ratio and profile height remains substantial on
  narrow screens.
- Added lifecycle and shape coverage for valid first paint, empty loaded data,
  responsive geometry, board ratio, and skeleton removal. Verification:
  `home-promo-skeleton-lifecycle-browser-smoke.mjs`,
  `home-promo-skeleton-shape-smoke.mjs`,
  `home-promo-player-skeleton-browser-smoke.mjs`,
  `admin-home-player-info-animation-smoke.mjs`,
  `home-section-skeleton-smoke.mjs`, JavaScript syntax checks, and
  `git diff --check` pass. No auth, data, legal-page, or migration behavior
  changed. This work is local and has not been pushed.

### 2026-10-14 Shared tooltip fade transitions complete

- Added a shared `tooltip-motion.js` lifecycle and applied coordinated
  opacity/transform/visibility states to item/cosmetic hosts
  (`.bpb-tooltip-float`), build-preview tips, and event tips. Fade-out keeps
  content mounted until the transition completes; rapid re-hover cancels the
  pending cleanup. Reduced-motion disables the CSS transition and uses
  immediate cleanup.
- Added static and browser coverage for fade-in/out, cleanup, responsive
  desktop/tablet/mobile behavior, and reduced-motion. Existing tooltip
  scale/parity coverage remains green.
- Verification: `tooltip-transition-smoke.mjs`,
  `tooltip-transition-browser-smoke.mjs`, `tooltip-scale-smoke.mjs`,
  `audit-tooltip-parity.mjs`, JavaScript syntax checks, and `git diff --check`
  pass. No auth, data, legal-page, or migration behavior changed. This work
  is local and has not been pushed.

### 2026-10-14 Curated Build Loadouts full-bleed background complete

- Confirmed the Curated Build Loadouts section already uses a full-bleed
  wrapper; hardened its frame-edge calculations with a zero-pixel fallback so
  the deep-night hills background reaches both viewport edges even if the
  frame token is unavailable. The centered rail and card behavior are
  unchanged.
- Added browser assertions for exact left/right viewport alignment at 1440,
  1080, tablet, and mobile widths, responsive cover scaling, and no overflow.
- Verification: `home-section-skeleton-smoke.mjs`,
  `home-section-skeleton-browser-smoke.mjs`, and `git diff --check` pass. No
  auth, data, legal-page, or migration behavior changed. This work is local and
  has not been pushed.

### 2026-10-14 Choose Your Hero full-bleed background complete

- Moved the Choose Your Hero texture onto a full-bleed pseudo-element that
  extends across the desktop frame inset while leaving the centered hero rail
  and card composition in place. The texture remains cover-scaled and uses no
  extra bleed at tablet/mobile widths where the frame inset is zero.
- Added browser assertions for the transparent content band, textured
  background layer, viewport-edge offsets, all four supported viewport sizes,
  card sizing, animation presets, and no horizontal overflow.
- Verification: `admin-home-class-showcase-test-browser-smoke.mjs`,
  `admin-home-class-showcase-test-smoke.mjs`,
  `home-section-skeleton-browser-smoke.mjs`, JavaScript syntax checks, and
  `git diff --check` pass. No auth, data, legal-page, or migration behavior
  changed. This work is local and has not been pushed.

### 2026-10-14 Home build-animation background removal complete

- Removed the Player Info/build-animation section's decorative radial field and
  stepped edge mask. The section and card now remain transparent while the
  board animation, four-surface skeleton, and responsive layout are unchanged.
- Updated the focused browser smoke to assert transparent section/card surfaces
  and no mask at 1440, 1080, tablet, and mobile widths.
- Verification: `home-promo-player-skeleton-browser-smoke.mjs` passed with four
  skeletons, transparent surfaces, no mask, and no horizontal overflow. No
  auth, data, legal-page, or migration behavior changed. This work is local and
  has not been pushed.

### 2026-10-14 Home Player Info four-surface skeleton complete

- Replaced the legacy single `[data-promo-section-skeleton]` overlay on the
  Home Player Info/build-animation preset with one coordinated stack of
  exactly four responsive skeleton surfaces: title, Player Info, board, and
  build details. The stack is scoped to the Player Info launcher and all four
  remain visible until the first complete build has painted; error/empty states
  still clear it safely.
- Updated the assembler to remove the stack only after title/player/details
  data is painted and the board's full content has rendered, including the
  reduced-motion path. Added static/browser coverage for exactly four
  surfaces, absence of the legacy skeleton, positive geometry at 1440/1080/
  768/390, and no horizontal overflow.
- Verification: `home-promo-activity-smoke.mjs`,
  `admin-home-player-info-animation-smoke.mjs`,
  `admin-home-player-info-animation-browser-smoke.mjs`,
  `admin-home-player-info-wave-smoke.mjs`,
  `admin-home-player-info-wave-browser-smoke.mjs`,
  `home-promo-player-skeleton-browser-smoke.mjs`,
  `home-section-skeleton-smoke.mjs`,
  `home-section-skeleton-browser-smoke.mjs`, JavaScript syntax checks, and
  `git diff --check` pass. No auth, data, legal-page, or migration behavior
  changed. This work is local and has not been pushed.

### 2026-10-14 Home Player Info board-hover completion gate complete

- Player Info hover tracking now attaches to the rendered board link instead of
  the whole promo section. A board hover no longer pauses an in-progress bag
  or item wave; the assembler marks the board complete after the second wave,
  then pauses the completed-board hold/handoff until the pointer leaves.
- Added activity-state coverage for in-progress reveal, completed-board pause,
  pointer release, and starting a new build while the pointer remains over the
  board. Static wiring coverage verifies the board-only pointer listeners and
  completion gates.
- Verification: `home-promo-activity-smoke.mjs`,
  `admin-home-player-info-animation-smoke.mjs`,
  `admin-home-player-info-animation-browser-smoke.mjs`,
  `admin-home-player-info-wave-smoke.mjs`,
  `admin-home-player-info-wave-browser-smoke.mjs`,
  `home-promo-player-skeleton-browser-smoke.mjs`, JavaScript syntax checks,
  and `git diff --check` pass. No auth, data, legal-page, or migration
  behavior changed. This work is local and has not been pushed.

### 2026-10-14 Home Curated Build Loadouts hover clarity complete

- Removed the Curated Build Loadouts rule that applied `brightness(0.35)` and
  `blur(2.5px)` to neighboring cards. Hovering still pauses the active row and
  keeps the hovered card's existing focus/drop-shadow treatment, while all
  other builds retain their normal appearance.
- Added a static contract for the removed dim/blur selector and verified the
  responsive Home skeleton harness at 1440, 1080, 768, and 390px with no
  horizontal overflow.
- Verification: Home section static/browser smokes, JavaScript syntax checks,
  and `git diff --check` pass. No auth, data, legal-page, or migration
  behavior changed. This work is local and has not been pushed.

### 2026-10-14 Home footer textured-black background complete

- Replaced the Home footer's brown wash with the existing
  `assets/theme/backgrounds/bg-dark-textured.webp` surface, using a dark
  fallback and responsive `cover` sizing. Footer spacing, border, content, and
  edge-to-edge layout remain unchanged.
- Updated `home-footer-browser-smoke.mjs` to assert the textured-black asset,
  responsive cover sizing, boundary isolation, and no horizontal overflow at
  1440, 1080, 768, and 390px.
- Verification: `home-footer-browser-smoke.mjs`, Home section skeleton smoke,
  JavaScript syntax check, and `git diff --check` pass. No auth, data,
  legal-page, or migration behavior changed. This work is local and has not
  been pushed.

### 2026-10-14 Home Curated Build Loadouts deep-night background complete

- Updated `.home-vault__band` for the Curated Build Loadouts section to use
  `assets/theme/backgrounds/bg-hills-night-deep.jpg`, with a dark fallback,
  centered positioning, no-repeat behavior, and fluid `cover` sizing. The
  change is scoped to this section; its marquee, content, and responsive layout
  remain unchanged.
- Added static and browser smoke assertions for the asset and cover sizing at
  desktop (1440px and 1080px), tablet (768px), and mobile (390px), with no
  horizontal overflow reported.
- Verification: `home-section-skeleton-smoke.mjs`,
  `home-section-skeleton-browser-smoke.mjs`, JavaScript syntax checks, and
  `git diff --check` pass. No auth, data, legal-page, or migration behavior
  changed. This work is local and has not been pushed.

### 2026-10-14 Home Choose Your Hero dark texture complete

- Updated `.home-mobs__band` to use the existing `assets/theme/backgrounds/bg-dark-textured.webp` surface with a dark fallback, centered cover sizing, and no-repeat behavior. The change is scoped to Choose Your Hero; the card rail, Ranger preset, and other Home sections are unchanged.
- Added static and responsive browser assertions for the dark-textured asset, fluid cover sizing, seven cards, rail behavior, and no horizontal overflow at 1440, 1080, 768, and 390px.
- Verification: `admin-home-class-showcase-test-smoke.mjs`, `admin-home-class-showcase-test-browser-smoke.mjs`, JavaScript syntax check, and `git diff --check` pass. No auth, data, legal-page, or migration behavior changed. This work is local and has not been pushed.

### 2026-10-14 Home Player Info Vault gradient correction complete

- Corrected the Home build-animation/Player Info background to match the Vault
  Hunters Loot/Progress/Conquer section's exact neutral gradient: neutral-800
  (`oklch(26.9% 0 0)`) to neutral-950 (`oklch(14.5% 0 0)`). The warmer Explore
  Items gradient is no longer reused by this surface.
- Preserved the existing stepped top/bottom edge treatment, full-viewport bleed,
  narrow-mobile mask fallback, and no-overflow behavior. Extended the Player
  Info browser smoke to assert both Vault gradient stops at 1440, 1080, 768,
  and 390px.
- Verification: `scripts/home-promo-player-skeleton-browser-smoke.mjs`, Home
  promo JavaScript syntax check, and `git diff --check` pass. No auth, data,
  legal-page, or migration behavior changed. This work is local and has not
  been pushed.

### 2026-10-14 Ranger idle test-preset quality and playback complete

- Replaced the Ranger idle test-preset video source with the extracted,
  render-scale-2 VP9 asset at `666x810`, 60fps, transparent alpha, preserving
  the static WebP fallback for browsers without VP9 support. The live Home
  surface remains static and does not download the roughly 25 MB video until
  the owner selects the Ranger idle preset.
- Kept the static art visible until the first decoded video frame is ready,
  then crossfaded to the video through `requestVideoFrameCallback`. Added
  generation guards so switching presets cannot restart a stale media listener,
  and kept the video on a compositor-friendly 3D transform path. Responsive
  sizing now matches the card art at desktop, short desktop, tablet, and mobile.
- Added the bake script's `--scale` support and strengthened the focused smoke
  checks for the high-resolution source, alpha, first-frame handoff, 60fps
  playback, reduced-motion fallback, responsive sizing, and no overflow.
- Verification: `admin-home-class-showcase-test-smoke.mjs`,
  `admin-home-class-showcase-test-browser-smoke.mjs` (1440, 1080, 768, and
  390px; all presets), JavaScript/Python syntax checks, `ffprobe` metadata, and
  `git diff --check` pass. No auth, data, legal-page, or migration behavior
  changed. This work is local and has not been pushed.

### 2026-10-14 Home Player Info full-bleed background complete

- Extended the Player Info gradient/masked surface to bleed across the Home
  screen-frame inset, so its background reaches both viewport edges while the
  internal build composition remains centered.
- Added bounds assertions to `home-promo-player-skeleton-browser-smoke.mjs`;
  1440, 1080, tablet, and mobile all report left `0`, right viewport width,
  and no horizontal overflow. No auth, data, legal-page, or migration behavior
  changed. This work is local and has not been pushed.

### 2026-10-14 Home Player Info curved gradient edges complete

- Added the Vault Hunters-style stepped/curved mask around the existing Player
  Info gradient, with desktop and tablet step geometry plus the narrower mobile
  geometry. The mask is disabled below 400px, matching the source site's
  small-screen behavior, while preserving the build animation DOM, timing, and
  responsive layout.
- Extended `home-promo-player-skeleton-browser-smoke.mjs` to assert the edge
  mask at 1440, 1080, and tablet widths, its deliberate mobile fallback, and no
  horizontal overflow. No auth, data, legal-page, or migration behavior
  changed. This work is local and has not been pushed.

### 2026-10-14 Home Player Info Vault Hunters gradient complete

- Added the Vault Hunters overview section's neutral radial-gradient treatment
  to the Home build-animation/Player Info surface, with a solid fallback and
  responsive-safe cover positioning. The build animation DOM and timing remain
  unchanged.
- Extended `home-promo-player-skeleton-browser-smoke.mjs` to assert the
  gradient and fallback color at 1440, 1080, tablet, and mobile viewports.
- No auth, data, legal-page, or migration behavior changed. This work is local
  and has not been pushed.

### 2026-10-14 Home page skeleton ownership complete

- Removed all static/page-level Home skeleton markup from `index.html`; the five
  section hosts, navigation host, and footer host now start empty.
- Removed the unused `home-first-paint.css` page-shell stylesheet. Featured,
  Promo, Hero, Items, and Vault continue to create their own section skeletons
  when their modules mount; shared navigation still owns its loading surface in
  `initNav()`.
- Updated the static and responsive browser smoke contracts to assert empty Home
  hosts before boot, section-owned skeleton behavior, no horizontal overflow,
  and the existing desktop/tablet/mobile background fallback. Verification:
  `home-section-skeleton-smoke.mjs`, `home-first-paint-browser-smoke.mjs`,
  `home-section-skeleton-browser-smoke.mjs`,
  `home-promo-player-skeleton-browser-smoke.mjs`,
  `home-footer-browser-smoke.mjs`, syntax check, and `git diff --check` pass.
- No auth, data, legal-page, or migration behavior changed. This work is local
  and has not been pushed.

### 2026-10-14 Admin Builds uploaded-board thumbnails live deployment complete

- Root cause: today’s `builds` rows already had valid `board_still_path` values,
  but the deployed `admin-builds` Edge Function was version 24 from October 6
  and did not return that field. The local Admin thumbnail fallback was
  correct but could not receive the stored path.
- Deployed the current owner-gated `admin-builds` function to project
  `xklkysmakrmgtiztsqug`; the live function is now version 25 (2026-10-14).
  An unauthenticated POST reaches the function and returns its expected 401.
- Verification: `scripts/admin-builds-board-thumbnail-smoke.mjs`, Admin Builds
  and board-thumb JavaScript syntax checks, and `git diff --check` pass. The
  owner should reload the Admin Builds tab to fetch the new payload; no data
  migration or legal-page change was needed.

### 2026-10-13 Local website changes pushed

- Pushed the accumulated safe website/source/documentation changes on `main`.
  The feature commit is `d22f410`; the follow-up PDF renderer commit is
  `dad873b`. `origin/main` is synchronized at `dad873b`.
- Ran all 44 staged smoke scripts successfully and passed staged diff checks.
  The repository has no `npm test` script, so `npm test` reports the expected
  missing-script error rather than running a suite.
- Credential-bearing local helper scripts and scratch status summaries remain
  unstaged and were not pushed.

### 2026-10-13 Ranger idle bottom-up section reveal (in progress)

- Codex owns the isolated Choose Your Hero Ranger preset reveal in
  `js/pages/admin/home-class-showcase-test.js` and
  `js/pages/admin/home-class-showcase-test.css`, its cache-busted test-page
  reference in `admin/test/home/sections/chooseYourHero/index.html`, and the
  focused Choose Your Hero static/browser smoke coverage.
- Scope: keep Home, Compact, and Wireframe previews unchanged; make only the
  Ranger game-idle preset enter from below instead of exposing the horizontal
  rail's smooth-scroll movement, while retaining responsive and reduced-motion
  behavior.

### 2026-10-13 Ranger idle bottom-up section reveal complete

- The Ranger game-idle preset now uses a fluid, preset-scoped bottom-up reveal
  (`home-class-showcase-ranger-bottom-in`) and disables smooth rail scrolling
  only for that preset. Selecting Ranger also snaps the centered rail without a
  horizontal transition, so the section no longer appears to enter from the
  right. Home, Compact, and Wireframe retain their existing rail behavior.
- The reveal distance stays bounded with a desktop-to-mobile clamp and a small
  mobile override; reduced-motion users receive no entrance animation. The
  live Home surface and Ranger media playback are unchanged.
- Verification: static smoke, browser smoke with Ranger/non-Ranger rail and
  animation assertions at 1440, 1080, 768, and 390 pixels, reduced-motion
  browser coverage, JavaScript syntax checks, and `git diff --check` pass. No
  auth, data, legal-page, or migration behavior changed. No push requested.

### 2026-10-13 Ranger idle playback smoothness (in progress)

- Codex owns the Ranger idle presentation in
  `js/pages/home/home-class-showcase.js`, the shared Choose Your Hero styles,
  the isolated admin test controller/styles, the generated Ranger idle media,
  and focused animation playback coverage.
- Scope: preserve the game-derived motion and static/reduced-motion fallback,
  but avoid dropped frames from decoding the large animated WebP on the test
  page. Use a browser-friendly animated source with a WebP fallback and keep
  all non-Ranger cards and the live Home surface unchanged.

### 2026-10-13 Ranger idle playback smoothness complete

- Root cause: the 24.8 MiB, 900-frame animated WebP was being decoded as an
  `<img>` animation. The source keyframes and 17ms frame timing are valid, but
  this path can make Chromium/Edge drop presentation frames under normal page
  paint/decode load.
- Added `assets/characters/char-ranger-idle.webm`, a transparent VP9 60fps
  encode at the same 337×412 composition (about 6.3 MiB). The Ranger test
  preset now prefers the media pipeline, keeps the static sprite visible until
  the first video frame is ready, and falls back to the animated WebP only when
  WebM playback/autoplay is unavailable. The live Home caller remains static.
- Extended the hero image styles to cover the video surface without changing
  card geometry, hover treatment, compact/wireframe presets, reduced motion, or
  mobile behavior. Updated cache-busts for the test page and Home stylesheet.
- Verification: source/static smoke, video-load/transparency/advancing-playback
  browser smoke at 1440, 1080, 768, and 390 pixels, JavaScript syntax checks,
  VP9/WebM metadata inspection (`337×412`, `60/1`), and `git diff --check` pass.
  No auth, data, or legal-page behavior changed; no migration or legal-page
  maintenance was needed.

### 2026-10-13 Home first-paint skeleton composition (in progress)

- Codex owns the Home initial loading shell in `index.html`, scoped Home
  loading styles, `js/pages/home/index.js`, and focused first-paint coverage.
- Scope: show the Home background/frame and section-level skeletons for the
  featured, promo, hero, items, builds, and footer hosts before async boot;
  preserve the hydrated composition and responsive behavior at desktop,
  short desktop, tablet, and mobile widths.

### 2026-10-13 Home first-paint skeleton composition complete

- `index.html` now ships a static, single-surface skeleton for Featured,
  Create, Choose your hero, Explore items, Curated builds, and the footer, so
  the complete Home composition is visible before module hydration. Existing
  section initializers replace these placeholders in place, and deferred
  sections retain their current mount timing.
- Added `js/pages/home/home-first-paint.css` for fluid promo/footer placeholder
  sizing, with desktop, short desktop, tablet, and mobile rules and reduced
  motion support. `body.page-home` now has the Town Square image as a CSS
  fallback (scroll attachment on narrow screens) while the canvas background
  starts before the asynchronous navigation/access gate.
- Added `scripts/home-first-paint-browser-smoke.mjs` and extended the static
  Home skeleton smoke. Verification passed: first-paint browser checks at
  1440, 1080, 768, and 390 pixels, existing responsive section-skeleton
  browser smoke, JavaScript syntax checks, and `git diff --check`. No auth,
  data, or legal-page behavior changed; no migration or legal maintenance was
  needed.

### 2026-10-13 Admin Builds baked board thumbnail fallback (in progress)

- Codex owns the Admin Builds payload/thumbnail boundary in
  `supabase/functions/admin-builds/index.ts`, `js/pages/builds/board-thumbs.js`,
  and focused Admin Builds board-thumbnail coverage.
- Scope: preserve uploaded `board_still_path` in the owner list response so new
  builds can use the existing baked thumbnail fallback when live placement data
  is unavailable, without changing build actions or authorization.

### 2026-10-13 Admin Builds baked board thumbnail fallback complete

- Root cause: `supabase/functions/admin-builds/index.ts` omitted
  `board_still_path` from `BUILD_COLS`, so the Admin Builds payload discarded the
  baked board still already saved by new submissions. The thumbnail renderer's
  fallback could not use the stored image and displayed `No board` when live
  placement rows were unavailable.
- Added `board_still_path` to the owner list/update projection. The existing
  `mountFeedBoardThumbs` path now receives the stored still and keeps it visible
  while retaining live placement rendering when available.
- Added `scripts/admin-builds-board-thumbnail-smoke.mjs`, covering payload
  preservation and the baked/live fallback contract. Verification passed:
  focused smoke, JavaScript syntax check, and `git diff --check`.
- No build data was changed and no authorization, legal-page, or migration
  changes were needed. The updated Edge Function must be deployed for the
  production Admin Builds endpoint to return the field.

### 2026-10-13 Admin Cosmetics surface alignment (in progress)

- Codex owns the Cosmetics tab presentation in `js/pages/admin/tab-cosmetics.js`,
  `js/pages/admin/admin.css`, and focused Cosmetics visual smoke coverage.
- Scope: align the Cosmetics tab sections, catalog cards, and filter rail with
  the shared Builds/admin clear-shadow surface while preserving all cosmetic
  actions, permissions, and responsive behavior across desktop, short desktop,
  tablet, and mobile widths.

### 2026-10-13 Admin Cosmetics surface alignment complete

- `js/pages/admin/tab-cosmetics.js` now uses the shared admin panel heading/body
  structure and renders catalog entries through the same raised card surface as
  the Builds tab; review, upload, edit, publish, and queue actions are unchanged.
- `js/pages/admin/admin.css` now gives Cosmetics one clear/shadowed outer panel,
  fluid section/card spacing, Patch3 filter-rail chrome, and narrow/mobile
  behavior matching the existing Builds layout. The layout was checked at
  1440, 1080, 768, and 390 pixel viewports with no horizontal overflow.
- Added `scripts/admin-cosmetics-design-smoke.mjs` and
  `scripts/admin-cosmetics-design-browser-smoke.mjs`. Verification passed:
  focused/static smoke, responsive browser smoke, shared admin-surface smoke,
  Builds shadow smoke, JavaScript syntax checks, and `git diff --check`.
- No authorization, data, upload, or legal-page behavior changed; no migration
  or legal-page maintenance was needed.

### 2026-10-13 Owner cosmetic inventory entitlement (in progress)

- Codex owns the self-profile ownership handoff in `js/pages/u/index.js`, the
  owner cosmetic entitlement contract in `js/pages/u/blob/catalog.js`, and
  focused owner/non-owner cosmetic inventory coverage.
- Scope: carry the trusted owner role into the signed-in owner’s own profile
  wardrobe so every current and future catalog cosmetic appears unlocked in
  Blob and Inventory; do not materialize a stale grant list or weaken server
  profile protections. Public visitor profiles remain unchanged.

### 2026-10-13 Owner cosmetic inventory entitlement complete

- Root cause: public profile reads intentionally omit `is_owner`, but the
  signed-in owner’s own `/u/` page passed that public row into both the Blob
  wardrobe and Inventory tabs. The existing catalog entitlement already has a
  server-role-backed owner bypass, so the owner path never reached it.
- `js/pages/u/index.js` now overlays `is_owner: true` only when the target
  profile matches the authenticated `viewerProfile` and that trusted profile
  is an owner. Visitor profile data remains unchanged and does not expose the
  owner role.
- Because inventory remains derived from the catalog, owners automatically see
  current and future cosmetics without a materialized `cosmetic_grants` list;
  non-owners retain the existing starter/Premium/founding/event checks.
- Added `scripts/profile-owner-cosmetics-smoke.mjs`. Verification: owner
  entitlement smoke, changed-profile JavaScript syntax checks, and
  `git diff --check` pass. No migration or legal-page change was needed; the
  server-managed owner role and existing profile RLS protections remain the
  authorization boundary.

### 2026-10-13 Ranger idle quality pass (in progress)

- Codex owns the Ranger idle asset, its cache-busted source reference, and the
  bake/verification paths while improving the preset’s visual fidelity.
- Scope: address the 294×360 source being enlarged in the hero card by baking a
  larger, higher-quality animation; keep the game timing, reduced-motion/static
  fallback, and responsive composition stable; measure the resulting payload
  before choosing any additional frame-rate increase.

### 2026-10-13 Ranger idle quality pass complete

- Re-baked Ranger from the extracted game tracks at 60 FPS / 900 frames over
  the same 15-second loop. The output is now 337×412 instead of 294×360, so it
  is enlarged substantially less by the hero card and is visibly sharper.
- Selected WebP quality 76 with encoder method 3 after measuring the larger
  alternatives: the final asset is approximately 23.70 MiB. The 60 FPS/high
  resolution quality-88 candidate was approximately 33 MiB and was not kept.
- Updated the cache-bust to `60fps-480q76-20261013`; static and
  reduced-motion behavior remain unchanged.
- Verification: Python syntax, Pillow metadata (`900` frames, `337×412`),
  Choose your hero static smoke, responsive browser smoke at 1440, 1080,
  tablet, and mobile widths, JavaScript syntax, and `git diff --check` pass.

### 2026-10-13 Ranger idle 30 FPS asset (in progress)

- Codex owns the generated Ranger idle asset at
  `assets/characters/char-ranger-idle.webp`, its cache-busted source reference
  in `js/pages/home/home-class-showcase.js`, and focused asset verification.
- Scope: rebake the existing extracted game Ranger idle animation at 30 FPS,
  keep the current preset URL and reduced-motion/static fallback unchanged, and
  verify frame timing, loop metadata, dimensions, and browser loading.

### 2026-10-13 Ranger idle 30 FPS asset complete

- Rebaked the extracted 15-second Ranger `Idle` AnimationPlayer at 30 FPS:
  450 frames, 294×360 transparent WebP, looping, approximately 10.43 MiB at
  quality 72 / encoder method 3. The preset still uses the game-derived source
  track rather than duplicating the old 8 FPS frames.
- Added a configurable `--method` WebP encoder option to
  `scripts/bake-chibi-idle.py` so future high-frame-rate bakes can tune encode
  time without changing the source animation.
- Added a `30fps-20261013` asset query version in the shared Choose your hero
  source so deployed browsers do not retain the prior 8 FPS file from cache.
  Static and reduced-motion fallbacks remain unchanged.
- Verification: Python syntax, Pillow metadata (`450` frames, `294×360`),
  Choose your hero static smoke, responsive browser smoke at 1440, 1080,
  tablet, and mobile widths, JavaScript syntax, and `git diff --check` pass.

### 2026-10-13 Featured build link routing (in progress)

- Codex owns the scoped Featured carousel link path in
  `js/pages/home/featured-stage.js`, the small URL helper (if needed), and
  focused Featured link smoke coverage.
- Scope: point Featured “View build” links at the canonical build-view route
  with an encoded slug, preserving the existing carousel and external Watch
  link.

### 2026-10-13 Featured build link routing complete

- Root cause: the Featured carousel generated `/builds/<slug>/`, but the static
  site’s build page resolves community builds at `/builds/view/?slug=<slug>`.
- Updated the Featured “View build” target to the canonical query route and
  URL-encode the slug; the external Watch link and carousel behavior are
  unchanged.
- Added `scripts/home-featured-link-smoke.mjs` to prevent the old route from
  returning. Verification passes for the link smoke, Featured mention smokes,
  Home section skeleton/static browser smokes across desktop, short desktop,
  tablet, and mobile, JavaScript syntax, and `git diff --check`.

### 2026-10-13 Choose Your Hero Ranger idle preset (in progress)

- Codex owns the isolated Choose Your Hero animation-preset paths in
  `js/pages/admin/home-class-showcase-test.js`,
  `js/pages/admin/home-class-showcase-test.css`,
  `js/pages/home/home-class-showcase.js`, the generated Ranger idle asset under
  `assets/characters/`, and focused Choose Your Hero smoke coverage.
- Scope: audit the extracted game Ranger `Idle` AnimationPlayer, reproduce its
  15-second motion only in a new owner-only test preset, leave the live Home
  section and all non-Ranger cards unchanged, and verify responsive/reduced
  motion behavior before committing.

### 2026-10-13 Choose Your Hero Ranger idle preset complete

- Audited `tools/game-extract-full/CharacterClasses/Ranger/RangerChibiSprite.tscn`:
  the game’s chibi Ranger uses a looping 15-second `Idle` AnimationPlayer with
  leg, body, head, arm, and bow-angle tracks. The existing compositor now also
  accepts a Chibi skin and produced
  `assets/characters/char-ranger-idle.webp` from the game’s Lucky Ranger skin
  at 8fps/360px for a lightweight browser asset.
- Added the owner-only `Ranger game idle` preset to the Choose Your Hero test
  page. It swaps only Ranger’s image in place, restores the static sprite when
  leaving the preset, and keeps the live Home section and other hero cards
  unchanged. Reduced-motion users remain on the static sprite.
- Verification: Choose Your Hero static/browser smokes pass at 1440, 1080,
  tablet, and mobile widths; browser coverage confirms the animated asset loads,
  only Ranger switches, the static source restores, and reduced motion blocks
  the animation. JavaScript/Python syntax checks and `git diff --check` pass.

### 2026-10-13 Home Player Info performance pass (in progress)

- Codex owns the scoped Home Player Info performance paths in
  `js/pages/home/home-promo-assemble.js`, `js/pages/home/home-promo-band.js`,
  `js/pages/home/home-promo-caption.js`, `js/shared/blob-face.js`, and the
  placed-grid lifecycle paths in `js/shared/backpack-grid/render.js` and
  `js/shared/backpack-grid/item-pool.js`.
- Scope: implement the three highest-impact, visually neutral findings from
  `docs/performance/home-player-info-production-readiness-audit.md`, switch the
  live Home create promo to the Player Info preset, add focused regression
  coverage/documentation, and verify before a scoped commit/push.

### 2026-10-13 Home Player Info performance pass complete

- Added `mountPlacedGrid().pruneParked({ keepKeys })` and wired Player Info to
  release parked item nodes after departure while retaining only the next
  build's placement window. Create/build placed grids keep their prior
  keep-alive behavior.
- Added URL-keyed `warmFaceAssets()` decode prewarming for active/next blob
  cosmetics and a bounded cross-mount creator-count cache with in-flight
  request de-duplication. The synchronous face markup, overlay order, wave
  timing, hover pause, and responsive CSS remain unchanged.
- Made the live Home create promo use the Player Info preset by default. The
  production probe now reports 126 peak handoff nodes and 63 retained nodes
  after 12 distinct synthetic builds (down from the pre-fix 819 retained-node
  result), with the board fully empty after destroy.
- Verification: Node syntax checks, P1/P2/sprite/selection/activity smokes,
  Player Info animation/wave/skeleton browser smokes, the production audit,
  and `git diff --check` pass. Device/network traces remain a future release
  measurement; no visual or timing changes were introduced by the optimization
  pass.

### 2026-10-13 Create onboarding copy-path feedback (in progress)

- Codex owns the Create onboarding copy-path handler in
  `js/pages/create/board-onboard.js`, its stylesheet cache-bust in
  `create/index.html`, the onboarding module cache-bust in
  `js/pages/create/board-editor.js`, and focused regression coverage in
  `scripts/create-copy-path-smoke.mjs`.
- Scope: make one Copy path click show `Copied!` when the async Clipboard API
  exists but rejects, using the same user-gesture-safe legacy fallback used by
  the Build share flow; preserve the existing reset label and responsive UI.

### 2026-10-13 Create onboarding copy-path feedback complete

- Root cause: `navigator.clipboard.writeText()` can be present but reject on
  the first click when browser permission, local HTTP, or privacy policy blocks
  the async write; `board-onboard.js` caught that rejection and silently left
  the label unchanged.
- Added a textarea + `execCommand('copy')` fallback and kept the existing
  `Copied!`/`Copy path` timer behavior. Bumped the onboarding module query in
  `js/pages/create/board-editor.js` so deployed browsers fetch the fix.
- Verification: `scripts/create-copy-path-smoke.mjs` reproduces a rejecting
  Clipboard API and confirms one click invokes the fallback and shows
  `Copied!`; Create module syntax checks and `git diff --check` pass. The
  broader `_test-onboard-create.mjs` was also attempted but remains blocked at
  its later clear-button click by the existing site-nav pointer interception;
  that failure is outside the copy-path flow.

### 2026-10-13 Create page clickable-pointer audit (in progress)

- Codex owns the scoped Create-page pointer token/interactive-control rules in
  `js/pages/create/create.css`, the Create stylesheet cache-bust in
  `create/index.html`, and the focused regression coverage in
  `scripts/create-page-pointer-smoke.mjs`.
- Scope: restore the native pointer for Create controls whose click, keyboard,
  or drag activation is exposed, preserve default/disabled and grab cursors,
  and verify the behavior at desktop, narrow desktop/tablet, and mobile widths.

### 2026-10-13 Create page clickable-pointer audit complete

- Root cause: Create and its shared catalog/history styles referenced the
  optional game-cursor variables, but the site intentionally no longer loads
  `css/cursor.css`; the unresolved variables made those `cursor` declarations
  invalid and browsers fell back to `auto`/`default`.
- Scoped native cursor tokens and a semantic interactive-control baseline to
  `js/pages/create/create.css`. Active buttons, links, tabs, options, menu
  items, selects, inputs, board hits, ring controls, and history controls now
  resolve to `pointer`; disabled/aria-disabled controls retain their default or
  component disabled cursor; draggable catalog/parked pieces retain `grab` and
  `grabbing`; the unarmed Needs/Wants/Good-to-have drop boxes remain passive
  until a valid board item arms them.
- Bumped the Create stylesheet query in `create/index.html` and added
  `scripts/create-page-pointer-smoke.mjs`, covering 1440, 1080, tablet, and
  mobile widths plus active/disabled/grab/passive states. Verification:
  pointer smoke, ring-editor affordance smoke, default-bag smoke, Create JS
  syntax checks, an actual local Create-page interactive-element audit, and
  `git diff --check` pass. No legal, simulator, or backend changes were needed;
  no push requested.

### 2026-10-13 Home/nav section-level skeletons (in progress)

- Codex owns the shared nav skeleton, Home section loading placeholders, and focused skeleton smoke coverage in:
  `js/shared/nav/markup.js`, `js/shared/nav.css`, `js/shared/skeleton.js`, `js/shared/skeleton.css`,
  `index.html`, `js/pages/home/featured-stage.js`, `js/pages/home/featured-stage.css`,
  `js/pages/home/home-promo-band.js`, `js/pages/home/home-promo-band.css`,
  `js/pages/home/home-class-showcase.js`, `js/pages/home/home-class-showcase.css`,
  `js/pages/home/home-items-explore.js`, `js/pages/home/home-items-explore.css`,
  `js/pages/home/home-builds-vault.js`, `js/pages/home/home-builds-vault.css`,
  `js/pages/home/home-section-skeleton.css`, `scripts/home-section-skeleton-smoke.mjs`,
  `scripts/home-section-skeleton-browser-smoke.mjs`, `scripts/home-promo-player-skeleton-browser-smoke.mjs`,
  and `scripts/admin-home-player-info-animation-smoke.mjs`.
- Scope: use one full-surface skeleton for the nav and one section-level skeleton per Home section while preserving loaded composition and responsive geometry.

### 2026-10-13 Home/nav section-level skeletons complete

- Replaced the nav's logo, shelf, banner, pennant, and social placeholders with one responsive `site-nav__skel-surface`; the static Home shell and dynamic `navSkeletonHtml()` now use the same single surface.
- Added one section-level Home skeleton for Featured builds, Create/promo, Choose your hero, Explore items, and Curated build loadouts. The promo no longer renders nested caption/board/catalog/stat skeleton fragments; it removes its single loading surface when the first real build or status is ready. Deferred Home sections keep their placeholder visible until their data mount settles.
- Added responsive static/browser smoke coverage at 1440, 1080, tablet, and mobile widths. Verification: `home-section-skeleton-smoke`, `home-section-skeleton-browser-smoke`, Player Info skeleton/animation smokes, Choose your hero smokes, CSP smoke, Home promo selection/activity/cache/P1/P2 smokes, JavaScript syntax checks, and `git diff --check` pass. No blockers; no push requested.

### 2026-10-13 Home Choose your hero admin test page (in progress)

- Codex owns the isolated Choose your hero test route/controller/styles and focused smoke coverage:
  `admin/test/home/sections/chooseYourHero/index.html`,
  `js/pages/admin/home-class-showcase-test.js`,
  `js/pages/admin/home-class-showcase-test.css`,
  `scripts/admin-home-class-showcase-test-smoke.mjs`,
  `scripts/admin-home-class-showcase-test-browser-smoke.mjs`.
- Scope: expose the live Home Choose your hero section on an owner-gated page with responsive preview presets and no nav/footer, without changing the live Home mount.

### 2026-10-13 Home Choose your hero admin test page complete

- Added owner-gated route `admin/test/home/sections/chooseYourHero/index.html`, matching the existing Home section test structure and omitting nav/footer.
- The controller mounts the live `home-class-showcase` implementation and exposes Home skin, Compact rail, and Wireframe preview controls. Scoped CSS keeps presets/test chrome isolated from the live Home page and covers desktop, short desktop, tablet, and mobile widths.
- Verification: `node scripts/admin-home-class-showcase-test-smoke.mjs`, `node scripts/admin-home-class-showcase-test-browser-smoke.mjs`, `node scripts/admin-test-csp-smoke.mjs`, `node --check js/pages/admin/home-class-showcase-test.js`, and `git diff --check` pass. No live Home behavior changed; no push requested.

### 2026-10-13 Player Info production-readiness performance audit (in progress)

- Codex owns the final Player Info performance audit report and any focused synthetic audit coverage under `docs/performance/` and `scripts/home-promo-production-audit.mjs`.
- Scope: production-readiness findings for startup/decode, repeated-cycle CPU/DOM work, memory/DOM stability, observers, and animation scheduling; no visual or timing changes are authorized by this audit request.

### 2026-10-13 Player Info production-readiness performance audit complete

- Added `docs/performance/home-player-info-production-readiness-audit.md` with measured startup/data shape, 100 same-key cycle results, 12-distinct-build retention results, ranked production risks, and release gates. The main remaining risk is parked placed-grid DOM retention across distinct build keys: the synthetic 63-placement probe remained stable at 63 nodes for 100 same-key cycles but reached 819 retained item nodes after 12 distinct key sets.
- Added `scripts/home-promo-production-audit.mjs` as a repeatable Chromium probe. It also confirms `grid.destroy()` clears the board, the current/next sprite cache and P1/P2 safeguards remain covered, and no visual/timing code was changed for this audit.
- Verification: audit script syntax and run, sprite-cache/P1/P2 smokes, Player Info animation/wave smokes, and `git diff --check` pass. Production-device/network trace and a parked-node cap remain documented follow-ups; no blockers to the report and no push requested.

### 2026-10-13 Player Info pooled item wave replay (in progress)

- Codex owns the staged item-wave replay fix in `js/shared/backpack-grid/render.js`, `js/shared/backpack-grid/item-pool.js`, `js/pages/home/home-promo-assemble.js`, and the focused Player Info wave coverage.
- Scope: preserve the fixed bag-first wave while replaying item intros for pooled DOM nodes on later Player Info build transitions.

### 2026-10-13 Player Info section skeleton consolidation (in progress)

- Codex owns the Player Info loading skeleton markup/styles in `js/pages/home/home-promo-band.js`, `js/pages/home/home-promo-band.css`, and the focused skeleton smoke coverage.
- Scope: replace nested title/avatar/info skeleton fragments with one cohesive skeleton per major Player Info section while leaving the loaded layout and other Home promo launchers unchanged.

### 2026-10-13 Player Info pooled item wave replay complete

- Root cause: `appearNewOnly` is intentionally limited to newly created DOM nodes for catalog keep-alive behavior. Player Info reuses item nodes across cycles, so later item waves had no appear candidates even though the bags replayed.
- Added the scoped `appearMissing` option to the placed-grid pipeline. Player Info keeps `appearNewOnly: true` for stable first-wave bags and sets `appearMissing: true` for second-wave entries absent from the previous bag set, replaying pooled item intros with the existing diagonal stagger.
- Extended `scripts/admin-home-player-info-wave-browser-smoke.mjs` to run a repeated item cycle and assert pooled item animation/delays. Player Info wave, animation, responsive, skeleton, P1/P2 performance, syntax, and `git diff --check` verification pass. No blockers; no push requested.

### 2026-10-13 Player Info section skeleton consolidation complete

- Player Info loading now uses one section-level skeleton each for player details, build title, board, and build information; nested item-level skeleton fragments are gone from that preset. Catalog, chest, and creator launchers retain their existing loading behavior.
- Added `scripts/home-promo-player-skeleton-browser-smoke.mjs`; it verifies one skeleton per section, no nested item fragments, four status regions, and no horizontal overflow at 1440, 1080, tablet, and mobile widths.
- Verification: skeleton browser smoke, responsive Player Info browser smoke, animation static smoke, P1/P2 performance smokes, JavaScript syntax check, and `git diff --check` pass. No blockers; no push requested.

### 2026-10-13 Player Info two-line build title (in progress)

- Codex owns the scoped title treatment in `js/pages/home/home-promo-band.css` and the responsive Player Info smoke checks.
- Scope: allow the Player Info build title to occupy two lines with an ellipsis clamp while preserving the existing single-line truncation on other Home promo variants.

### 2026-10-13 Player Info two-line build title complete

- Player Info titles now wrap to two lines and use a two-line ellipsis clamp; other Home promo title variants retain their existing single-line behavior.
- The responsive Edge smoke verifies the two-line computed clamp, available title height, avatar treatment, and no horizontal overflow at 1440, 1080, tablet, and mobile widths. Static animation smoke, syntax checks, and `git diff --check` pass. No blockers; no push requested.

### 2026-10-13 Player Info fabric exit animation (in progress)

- Codex owns the FilledSlot exit treatment in `js/pages/home/home-promo-assemble.js`, `js/pages/home/home-promo-band.css`, and the focused Player Info wave browser/static smokes.
- Scope: animate bag-capacity squares out with the existing bag departure wave before the pooled board clears them; preserve hover pause, reduced-motion behavior, and all existing intro timing.

### 2026-10-13 Player Info fabric exit animation complete

- `departBoardItems()` now maps each FilledSlot cell to its owning bag placement key, applies a matching stagger, and adds `home-promo__fabric--depart` before the pooled board clears the fabric. The new `home-promo-fabric-out` animation fades the squares out with the bag departure; reduced-motion users receive an immediate fade rather than a motion animation.
- Added runtime regression coverage to `scripts/admin-home-player-info-wave-browser-smoke.mjs` and static assertions for the departure class/keyframes. Player Info animation/responsive/wave smokes, P1/P2 performance smokes, syntax checks, and `git diff --check` pass. No blockers; no push requested.

### 2026-10-13 Player Info blob frame treatment (in progress)

- Codex owns the scoped Player Info identity-frame change in `js/pages/home/home-promo-band.css` and its responsive browser smoke.
- Scope: keep Discord/profile photos circular, but make blob faces use an uncropped square/contain presentation so equipped cosmetics can extend beyond the base silhouette; other avatar surfaces remain unchanged.

### 2026-10-13 Player Info blob frame treatment complete

- Added a Player Info-only `:has(.bpb-face)` override: blob identity frames are square and `overflow: visible`, including their link wrapper, while Discord/profile photos retain the circular/hidden crop.
- Extended the responsive Edge smoke to assert blob `0px` radius/visible overflow and profile `50%` radius/hidden overflow at 1440, 1080, tablet, and mobile widths. Animation/static smoke, syntax, and `git diff --check` pass. No blockers; no push requested.

### 2026-10-13 Player Info repeat-wave animation regression (in progress)

- Codex owns the Player Info repeat-cycle animation fix in `js/shared/backpack-grid/render.js`, `js/pages/home/home-promo-assemble.js`, and the focused Player Info wave browser/static smoke checks.
- Scope: preserve the bag-first/item-second animation contract while ensuring pooled nodes replay their intro animation on each new build cycle; other placed-grid surfaces remain unchanged.

### 2026-10-13 Player Info repeat-wave animation regression complete

- Root cause: Player Info always used `appearNewOnly: true`, which intentionally skips intro classes on parked pooled nodes. After the first cycle, reused bag/item nodes therefore appeared immediately while the depart animation still ran.
- Added a per-update `appearNewOnly` override to `mountPlacedGrid`. Player Info now disables new-only filtering for the first bag wave (replaying pooled bag intros) and enables it for the second item wave (keeping bags stable while new items animate).
- Extended `scripts/admin-home-player-info-wave-browser-smoke.mjs` to reproduce a cleared/reused cycle and assert the pooled bag receives its intro class again. Added static wiring assertions. Focused Player Info animation/wave/browser smokes, sprite/P1/P2 performance smokes, syntax checks, and `git diff --check` pass. No blockers; no push requested.

### 2026-10-13 Build-view vote control full-height sizing complete
- Codex owned the Build-view vote control sizing and header-layout smoke for this adjustment. The right column now uses the full title/tag height with larger, vertically stacked up/score/down controls and fluid bounds across desktop, tablet, and mobile.
- Updated `js/pages/build/build.css` so the identity column anchors title/tags to the row edges, the vote column has a responsive minimum height, and the icons/score scale up inside the full-height control. Extended `scripts/build-view-header-layout-smoke.mjs` to assert vertical order, full-column fill, enlarged icons, alignment, and no overflow. Density, title-spacing, syntax, and diff checks pass.

### 2026-10-13 Build share first-click feedback complete
- Codex owned the Build-view share clipboard path and focused smoke for this fix. The regression was an available-but-rejected Clipboard API that skipped the textarea fallback, so users could see no `Copied!` feedback until repeated attempts.
- `js/pages/build/share.js` now falls back to the textarea copy path when `navigator.clipboard.writeText` rejects, preserving the existing success/failure labels and timer behavior. Added `scripts/build-share-smoke.mjs`, which simulates the rejection and verifies one click reaches `Copied!` with the copied state. Syntax and diff checks pass; no legal, simulator, or backend changes were needed.

### 2026-10-13 Build-view vote column stretch complete
- Codex owned the Build-view header geometry and its focused layout smoke for this adjustment. The identity column remains title-over-tags; the vote slot now stretches from the header top through the bottom of the tags at all supported widths and centers the vote control within that column.
- Updated `js/pages/build/build.css` and extended `scripts/build-view-header-layout-smoke.mjs` to assert the vote slot’s top/bottom alignment and no overflow at 2560, 1920, 1440, 768, and 390 widths. Density, title-spacing, syntax, and diff checks pass.

### 2026-10-13 Build-view interactive cursor coverage complete
- Codex owns the Build-view cursor affordance for this task: `js/pages/build/build.css`, the shared Premium cursor fallback in `js/shared/premium-offer.css`, and the focused pointer smokes. Scope covers Discuss, item/bag tooltip targets, round history and navigation, board toggles, votes, Remix, Share, Premium Play, author/event links, and disabled controls.
- Added a page-scoped native cursor contract so every semantic Build control/link and item target resolves to `pointer`, while disabled/aria-disabled controls resolve to `default`. Existing optional game-cursor tokens now have native fallbacks on the Build stylesheet. The previously fixed nav/Premium controls are included in the same cursor push.
- Added `scripts/build-page-pointer-smoke.mjs`. Build and Premium pointer smokes plus existing Build density/header/title-spacing checks pass at desktop, short desktop, tablet, and mobile sizes. No legal, simulator, or backend changes were needed.

### 2026-10-13 Premium control pointer fallback complete
- Codex owns the focused shared Premium/navigation cursor regression for this task: the nav Free Premium button, the founding-members dialog close/View Premium features controls, and the Premium-features dialog close/Got it controls.
- These controls now use `var(--bpb-cursor-pointer, pointer)`. The fallback preserves the native browser cursor after the custom cursor rollback while keeping any future cursor token override available; click behavior and responsive layout are unchanged.
- Added `scripts/premium-pointer-smoke.mjs`, which verifies the four controls resolve to `pointer` at 1440×900, 1080×720, 768×900, and 390×844. The focused smoke, syntax checks, and `git diff --check` pass. No legal, simulator, or backend changes were needed.

### 2026-10-13 Admin tab surface normalization complete
- Owned paths: `js/pages/admin/admin.css`, `js/pages/admin/shell.js`, `scripts/admin-surface-smoke.mjs`, and `scripts/admin-surface-browser-smoke.mjs`. Added one shared translucent Patch3 surface with inset edge, soft shadow, fluid spacing, and responsive sizing to the common admin stage used by Overview, Reports, Builds, Events, Cosmetics, Analytics, Members, Overlay, and Marketplace.
- Replaced the separate dark reward-plate treatment at the Reports, Analytics, and Members outer layers with the shared surface while retaining readable inner KPI, chart, table, filter, and row contrast. Existing tab behavior, data, and permissions are unchanged.
- Verification: the new static smoke, responsive Edge browser smoke at 1440/1080/768/390px, existing Admin Builds view smoke, JavaScript syntax checks, and `git diff --check` pass. No blockers or simulator changes.

### 2026-10-13 Combat-start sequence PDF complete
- Owned paths: `docs/sim/combat-start-sequence.pdf`, `scripts/render-combat-start-pdf.mjs`, and `scripts/render-combat-start-pdf.py`. Rendered the complete combat-start Markdown, including the priority table and 519-item appendix, as a 15-page A4 PDF with print styling and page numbers.
- Verification: Node syntax check, Python compile check, renderer structure check (title, 20 headings, 2 tables, 7 lists, 2 code blocks), valid `%PDF-1.4`/15-page file check, and PyPDF2 text checks for the title, priority section, `puzzlebag_j`, and the 519-item coverage line all pass. No simulator behavior changed.

### 2026-10-13 Combat-start complete item catalog complete
- Owned paths: `docs/sim/combat-start-sequence.md` and `scripts/build-combat-start-catalog.mjs`. Scope was documentation only: enumerate every catalog item with a prepare/pre-combat/combat-start/post-combat-start or inventory-start hook, group the complete explicit trigger-priority overrides, and record the default-Normal boundary. No simulator behavior changes were in scope.
- Added `scripts/build-combat-start-catalog.mjs` as the reproducible generator. The document now classifies all 519 catalog items (29 explicit-priority, 321 default-Normal items with a direct start hook, and 169 default-Normal items without one), while keeping shared extract base/support classes separate.
- Verification: generator syntax check, idempotent regeneration, exact 519/519 catalog-ID coverage check, and trailing-whitespace check pass. No simulator ledger run was needed because this was documentation-only. No blockers; future source/catalog changes should rerun the generator and review its diff.

### 2026-10-13 Admin Builds collection buttons complete
- Codex owns the Admin Builds collection-control markup for this task. Scope is converting Uploaded builds/Pending OP to actual buttons below Search and above View while retaining Featured/Hidden as status filters.
- Converted Uploaded builds and Pending OP to two full-width collection buttons directly below Search and above View. Featured/Hidden remain under Status as existing filters; smoke, syntax, and `git diff --check` pass.

### 2026-10-13 Admin Builds Pending OP filter complete
- Codex owns the Admin Builds Pending OP consolidation for this task. Scope is removing the separate queue mount, adding Uploaded builds/Pending OP list choices, and routing both through the middle Builds panel; API behavior remains unchanged.
- Removed the standalone Pending OP section from the Builds tab. The filter rail now offers Uploaded builds and Pending OP alongside Featured/Hidden; selecting either reloads only the middle list, with approve/deny actions preserved for Pending OP. Smoke, syntax checks, and `git diff --check` pass.

### 2026-10-13 Admin Builds in-place actions complete
- Codex owns the Admin Builds action success flow for this task. Scope is the Builds panel’s local state/DOM update after a successful moderation mutation; no API authorization behavior changes.
- Successful moderation actions now merge the API’s returned build (with a local fallback for older responses) into the current list and repaint the cards in place. Featured/hidden filters immediately remove builds that no longer match, while action buttons and counts update without a panel remount. Added the pure `build-action-state.js` helper for focused coverage; smoke, syntax, and `git diff --check` pass.

### 2026-10-13 Admin Builds remove View build action complete
- Codex owns the admin Builds action-bar adjustment for this task. Remove only the explicit View build button; retain board/title links and moderation actions.
- Removed the explicit View build button from all admin Builds view action bars while preserving board/title links and Feature/Unfeature plus Hide/Restore controls. Smoke, syntax, and `git diff --check` pass.

### 2026-10-13 Admin Builds Grid actions complete
- Codex owns the Grid-card action visibility correction for this task. Scope is limited to Grid card layout CSS and the focused admin Builds smoke; Card and Compact behavior remain unchanged.
- Reset Grid card body `min-height` and kept the action footer in normal flow so View build, Feature/Unfeature, and Hide/Restore remain visible. The smoke asserts View build, Feature, and Hide markup; syntax and `git diff --check` pass.

### 2026-10-13 Admin Builds filter order complete
- Codex owns the admin Builds filter markup order for this task. Scope is limited to placing View below Search and above List; existing menu behavior and responsive stacking remain unchanged.
- Reordered the View selector directly below Search and above List. The admin Builds smoke now asserts that order, and syntax plus `git diff --check` pass.

### 2026-10-13 Admin Builds view-menu stacking fix complete
- Codex owns the admin Builds filter menu stacking correction for this task. Scope is limited to the Builds filter rail CSS and focused verification; no shared filter or simulator paths.
- Raised the Builds view-menu shade and its open grouping above the Character shade, matching the public Builds filter stacking pattern. The focused admin Builds smoke, syntax check, and `git diff --check` pass.

### 2026-10-13 Admin Builds view modes complete
- Codex owns the admin Builds view selector/state, admin row templates, board-thumb view pass-through, and `js/pages/admin/admin.css` responsive variants for this task.
- Scope: add Card and Grid views while retaining Compact as the default; preserve admin actions and existing auth/API behavior.
- No simulator, shared navigation, legal, or screenshot-import paths are in scope.
- Added the shared Card/Grid/Compact selector to the admin Builds filter rail, passed the selected view through the board renderer, and added responsive admin-specific templates/styles. `scripts/admin-builds-views-smoke.mjs`, JavaScript syntax checks, and `git diff --check` pass.

### 2026-10-12 Combat-start ordering audit (in progress)
- Codex owns the extracted-game versus simulator start-of-battle ordering audit, including trigger-priority parity, per-item pre/combat/post passes, preparation/listener order, and Dark Lantern threshold reactions. Scope excludes the unrelated local simulator band edits and untracked admin/debug files in the worktree.

### 2026-10-12 Combat-start ordering audit complete
- Audited `Core/Game.gd`, `Core/Character.gd`, `Items/Item.gd`, and every extracted `onPrepare` damage listener. The simulator now shuffles/sorts each side using the source trigger-priority map, runs player items before opponent items, keeps each item's socket/pre-start/arm work contiguous, and connects threshold listeners before any combat-start effects. Source priority overrides are checked against the extracted classes with no simulator-only combat priorities.
- Corrected Dark Lantern's opening self-damage path to use the source `loseHealth` semantics (bypassing block/resistance), log the self-health event before dispatch, and emit `character_damaged` before the lethal/death path; threshold listeners (including Health Potion, boots, bags, rings, cubes, potions, Phoenix-family, and other extracted listeners) observe it from `onPrepare`. Dark Lantern still only grants invulnerability on lethal reincarnation, not at combat start. Added exact-50% strict-threshold coverage and compatibility aliases for direct handler callers.
- Added `scripts/sim-combat-start-priority-smoke.mjs` and `scripts/sim-dark-lantern-start-threshold-smoke.mjs`; lifecycle, priority, threshold, Phoenix/Lantern, ring, resource, and focused source smokes pass. `node scripts/build-sim-fidelity-ledger.mjs --check`, syntax checks, and `git diff --check` pass. The full smoke sweep still reports unrelated existing failures (`browser-smoke`, `game-cursor-smoke`, several older candidate/alias fixtures); no unrelated fixes were folded into this task.
- Updated the hook-audit mapping so a source `onDamaged`/`onTriggerPotion` callback implemented as an inline `onPrepare` listener is recorded as covered; the ledger remains at 492 source-ported rows, zero unresolved/deferred rows, and one intentional Ruby Egg lifecycle triage.

### 2026-10-12 Dark Lantern combat-start invulnerability clarification (in progress)
- Codex owns the Dark Lantern lifecycle regression that distinguishes its combat-start activation event from the lethal-hit invulnerability window. Scope is limited to the focused simulator smoke and source-aligned evidence; unrelated local simulator band edits remain untouched.

### 2026-10-12 Dark Lantern combat-start invulnerability clarification complete
- Confirmed the extracted source only calls `makeInvulnerable` from the lethal `onDamaged` reincarnation path. Combat start loses 50% max HP and calls `activate()` for the item event/animation; it does not grant invulnerability.
- Added a focused simulator regression to `scripts/sim-phoenix-lantern-smoke.mjs` asserting 50% opening HP, zero invulnerability at combat start, and one activation event. Phoenix/Lantern smoke, syntax, diff, and `node scripts/build-sim-fidelity-ledger.mjs --check` pass. No product handler change was required.

### 2026-10-12 Admin-backed Premium accounting correction complete
- Reclassified the two verified admin profiles, `smojowastaken` and `bpbbuilds`, from `plan = 'premium'` to `plan = 'free'` while retaining `is_owner = true`, `founding_slot = null`, and `premium_until = null`. The shared entitlement logic grants owners Premium access before plan checks, while `isPaidPremium` now returns false for these non-paying admin accounts.
- Refreshed `member_daily` in the same transaction: live snapshot is users 5, paid Premium 0, founding 3, revenue $0.00. The founding status remains 3/10. No website files or unrelated worktree files were changed.

### 2026-10-12 Live admin entitlement correction complete
- Audited the live `public.profiles` and `auth.users` records before changing anything. `smojowastaken` was the only requested admin consuming a founding slot; `bpbbuilds` existed as a free, non-founding profile; no `BPB Bot` profile or Auth account exists in the project.
- Updated only the two verified profiles: `smojowastaken` and `bpbbuilds` now have `is_owner = true`, `plan = 'premium'`, `founding_slot = null`, and `premium_until = null` (owner-backed permanent access). The live founding count changed from 4 to 3; users remain 5. The missing `BPB Bot` identity was not fabricated or modified.
- Verified the transaction's identity guards, post-update invariants, and live `founding_slots_used()` / `get_founding_status()` response. No product files or unrelated worktree files were changed by this operation.

### 2026-10-12 Blob-first profile avatar default (in progress)
- Codex owns the shared profile identity default, Blob loadout default parsing, focused avatar regression coverage, and the related profile-schema documentation for making the website Blob the first-visit/default identity while preserving an explicit Discord profile-picture choice. Scope excludes the unrelated local simulator band edits and untracked admin/debug files in the worktree.

### 2026-10-12 Blob-first profile avatar default complete
- Profiles with no saved `equipped_avatar` choice now resolve to the website Blob across shared face rendering, profile/nav/build/event surfaces, and the simulator's You avatar default. Explicit `discord`/`base: "discord"` choices still resolve to the synced Discord picture; anonymous/null profiles retain their existing empty fallback. Blob loadout parsing/serialization and the settings Discord preview now preserve the distinction.
- Updated the profile/simulator schema notes to document Blob as the NULL/default identity. Added `scripts/avatar-default-smoke.mjs`, refreshed the Discord fallback fixture to opt into Discord explicitly, and verified both avatar smokes, changed-module syntax, simulator empty/playback smokes, `node scripts/build-sim-fidelity-ledger.mjs --check`, and `git diff --check`. `npm run sim-harness` remains blocked by the unrelated stale `stoneGolemPort.onPreCombatStart` call at `scripts/sim-harness.mjs:188`.

### 2026-10-12 Simulator invisibility/invulnerability VFX audit (in progress)
- Codex owns the extracted game source/asset audit, simulator status-event wiring, actor/item visual effects, focused smoke coverage, and performance/reduced-motion handling for invisibility and invulnerability visuals. Scope excludes the unrelated local simulator band edits listed in the worktree status.

### 2026-10-12 Simulator invisibility/invulnerability VFX audit complete
- Audited `Core/Character.gd` and `Core/Character.tscn`: the game uses one `InvulnerabilityBubble` sprite with `RingLight.png` and the `Invulnerable`/`Vulnerable` animation. Crown, Holy Spear, Shiny Mantle, King Goobert, and Frog Prince use `BookOfLightActivationPulse.tscn`; Dark Lantern uses `DarkResurectionPulse.tscn`; White Queen grants the character state but has no item pulse scene.
- Imported the extracted `RingLight.png` byte-for-byte. Every simulator `grantInvuln` caller now carries its item and placement key into one UI-only visual event. Added a cached actor aura and source-matched item burst layer using compositor-only transforms/opacity, with a binary-search snapshot lookup, no particle-node allocation, and `prefers-reduced-motion` fallbacks.
- Added `scripts/sim-invulnerability-vfx-smoke.mjs` (source/asset audit, grant event, Dark Lantern engine event) and `scripts/sim-invulnerability-vfx-browser-smoke.mjs` (actor aura, item pulse, expiry, 1080p viewport, reduced motion). The CSS uses fluid `clamp()` sizing for supported desktop/mobile surfaces. Focused VFX, used-art, Phoenix/Lantern, Wave-D, log, syntax, diff, and `node scripts/build-sim-fidelity-ledger.mjs --check` checks pass. `npm run sim-harness` remains blocked by the pre-existing stale `stoneGolemPort.onPreCombatStart` call at `scripts/sim-harness.mjs:188`; unrelated local band edits and untracked admin/debug files remain untouched.
- Product changes committed as `2101d63` (`Add simulator invulnerability visuals`); handoff record follows in this commit.

### 2026-10-12 Simulator used-item visual-state audit (in progress)
- Codex owns the source-derived persistent used/empty/ash visual-state map, simulator snapshot/render wiring, focused regression coverage, and audit evidence for consumable and stateful item art. Scope is limited to gameplay-visible visual states that persist after an item is used; unrelated local simulator edits remain untouched.

### 2026-10-12 Simulator used-item visual-state audit complete
- Audited extracted source texture/state paths. All catalog Potion/Flask subclasses use the shared live potion art and now render empty at the first consumed activation during scrub/rewind. Source-backed persistent texture states now cover Phoenix and Enraged Phoenix ash, Dark Lantern used, Deer Totem active rage, Dual Wielding active set, Full Body Protection active set, Vampiric Gloves active/consumed, Pumpkin fatigue glow, Lucky Cat paw thresholds, and Scale balance side.
- Added `visualState` to simulator piece snapshots and a shared source-asset variant map. Simulator chrome swaps both item and shadow art, updates cooldown shade art, restores normal art on rewind/destroy, and keeps potion levels synchronized without per-frame event rescanning. Imported the extracted variant PNGs into `assets/item-sprites/`.
- Card reveal/active-face behavior remains covered by the existing shared card chrome. Chainsaw frame animation and other particle/light/shader-only `onStateChanged` paths were audited as presentation-only (no alternate persistent Icon texture); they remain represented by the simulator activation/charge surfaces rather than being mislabeled as static art swaps.
- Added `scripts/sim-used-visuals-smoke.mjs` (source inventory, all potion live-art coverage, state mapping, Phoenix/Dark Lantern snapshot checks) and `scripts/sim-used-visuals-browser-smoke.mjs` (live base + shadow swap and rewind). Focused visual, card, Phoenix, Pumpkin/Scale, cooldown, syntax, diff, and `node scripts/build-sim-fidelity-ledger.mjs --check` checks pass. `npm run sim-harness` remains blocked by the pre-existing stale `stoneGolemPort.onPreCombatStart` test call; no unrelated local files were staged. Committed and pushed as `d7d8056`.

### 2026-10-12 Phoenix / Enraged Phoenix / Dark Lantern synergy audit (in progress)
- Codex owns the Phoenix-family resurrection lifecycle, Dark Lantern `reincarnated` reaction, Fire type-multiplicity path, focused source audit, and regression smoke while bringing these three item ports into source-aligned simulator behavior.

### 2026-10-12 Phoenix / Enraged Phoenix / Dark Lantern synergy audit complete
- Audited `Exclusive/Phoenix.gd`, inherited `Exclusive/Phoenix2.gd`, and `Exclusive/DarkLantern.gd`: Enraged Phoenix now runs the inherited prepare/resurrection listener and Fire multiplicity (`fire=6`), while Dark Lantern reacts to every owner reincarnation with Fire-linked effect damage and Dark-linked debuffs.
- Added priority-aware combat-bus dispatch so Dark Lantern's source High trigger priority wins a shared lethal event before Normal-priority Phoenix handlers; its reincarnation signal is emitted before activation and is covered for both Phoenix sources.
- Added `scripts/sim-phoenix-lantern-smoke.mjs`; it verifies standalone resurrection, Enraged Phoenix crit/multiplicity, Dark Lantern response, and the combined High-priority interaction. Source hook/call audits, focused wave smoke, syntax, diff, and `node scripts/build-sim-fidelity-ledger.mjs --check` pass. Committed and pushed as `e3e0bf1`; unrelated local files remain unstaged.

### 2026-10-12 Ruby Egg start-only Heat/Reflect correction (in progress)
- Codex owns the Ruby Egg simulator lifecycle port, its no-cooldown regression, source-aligned debuff Reflect behavior, and the focused smoke while correcting the stale cooldown loop.

### 2026-10-12 Ruby Egg start-only Heat/Reflect correction complete
- Audited `RubyEgg.gd`: it grants debuff Reflect in `onPreCombatStart`, then calls `doCooldownEffect(false)` once from `onCombatStart` for Heat and activation; it has no combat cooldown. Removed the simulator cooldown hook so it no longer receives the default 2.5-second loop, and routed Reflect through the shared stat mutation surface.
- Added `scripts/sim-ruby-egg-smoke.mjs`, which verifies the standard poison, blind, and cold Reflect paths, plus corrected the lifecycle smoke, future generator template metadata, registry row, and simulator backlog evidence. Focused Ruby Egg, source lifecycle, syntax, diff, and `node scripts/build-sim-fidelity-ledger.mjs --check` checks pass. Committed as `650d8da`; unrelated local files remain unstaged.

### 2026-10-12 Puzzle Bag of Endurance Hammer highlight regression (in progress)
- Codex owns the Create drag-synergy predicate/rendering path and its focused regression while tracing why a held Hammer does not visibly highlight Puzzle Bag of Endurance. Existing local bag-synergy edits are preserved; this task will only add the smallest missing behavior and test.

### 2026-10-12 Puzzle Bag of Endurance Hammer highlight regression complete
- Root cause was an empty HistoryDB placement key: drag feedback normalized `key: ""` to `puzzlebag_j:face:x,y`, while the placed-grid renderer retained an empty DOM key, so the compatible bag could not be found for highlighting.
- The placed-grid key path now uses the same non-empty-key fallback as drag feedback and the visible fabric. Added an empty-key HistoryDB regression to `scripts/create-bag-synergy-browser-smoke.mjs`; it verifies the fallback DOM key and active Hammer highlight.
- Focused browser/source synergy, duration-hover, syntax, diff, and simulator ledger checks pass. The complete bag-synergy fix set was committed and pushed as `19383d0`; unrelated local files remain unstaged.

### 2026-10-12 Hammer board-hover Puzzle Bag highlight regression (in progress)
- Codex owns the Create affect-preview cleanup boundary and its browser regression while tracing why Hammer's compatible Puzzle Bag border disappears only after the pointer enters the board.

### 2026-10-12 Hammer board-hover Puzzle Bag highlight regression complete
- The board preview used the full affect-layer `clear()` when Hammer produced no affect/star tiles, which also removed the independently computed BagBorder state. `sync()` now clears only affect tiles for valid held items without an origin or affect marks; drag-end and invalid-item paths still clear both systems.
- Extended `scripts/create-bag-synergy-browser-smoke.mjs` through the real `createPreviewController.previewAt()` path, including inventory preview tiles, and verified the Puzzle Bag remains active with a dashed outline after board entry. Focused synergy, duration-hover, syntax, diff, and simulator ledger checks pass. This fix was committed and pushed as `c6339da`; unrelated local files remain unstaged.

### 2026-10-12 Simulator stun target/duplicate-event audit (in progress)
- Codex owns the simulator Hammer stun application/event path, shared stunned-target state, the focused regression coverage, and this handoff while auditing duplicate stun presentation and ensuring dummies/opponent boards are affected.

### 2026-10-12 Simulator stun target/duplicate-event audit complete
- Audited `Core/Character.gd`, `Items/Item.gd`, and `Items/Hammer.gd`: the game keeps one `stunnedDuration = max(...)` state, emits one stun combat event, and pauses the stunned character's item cooldown/trigger loop. The animation label is presentation only.
- Removed the simulator's duplicate manually-pushed stun events from Hammer, Brass Knuckles, Thor's Hammer, and Thornburst. `grantStun()` now carries source metadata into the single event, including the actual duration and source item.
- Verified side-relative targeting: a player Hammer targets the training dummy and suppresses dummy swings during the active stun; an opponent-board Hammer targets the player and updates the player's `stunnedUntil` state. Added `scripts/sim-stun-behavior-smoke.mjs` for both directions.
- Focused stun, duration, parity, wave-C, chess, vs-board, log, syntax, diff, and ledger checks pass. `npm run sim-harness` still has the pre-existing stale `stoneGolemPort.onPreCombatStart` test call and remains unrelated to this change. This change set is staged for the requested commit and push.

### 2026-10-12 Create bag-synergy visible-fabric regression (in progress)

- Codex owns the real placed-board bag-fabric highlight path, its focused browser regression, and this handoff.
- Root-cause hypothesis under test: Create's placed board renders shared `.bpb-bg__fabric` cells above the per-bag slot layer, so `is-drag-synergy` can be present while the visible bag outline remains unchanged. Scope is to expose the same compatible/hover state on the visible fabric cells without changing bag acceptance rules.

### 2026-10-12 Create bag-synergy visible-fabric regression complete

- Confirmed the issue on the real placed-board path: per-bag slots received `is-drag-synergy`, but the shared `.bpb-bg__fabric` layer was painted above them and had no highlight state.
- Fabric cells now retain the owning bag placement keys (including the deterministic no-key HistoryDB fallback), and drag feedback mirrors compatible/hover classes onto those visible cells. The existing per-bag state remains for Itemiary/rotation paths.
- Added the real `mountPlacedGrid` regression to `scripts/create-bag-synergy-browser-smoke.mjs`. Focused source/browser synergy, duration-hover, ring-affordance, ledger, syntax, and diff checks pass. Changes are local and not committed or pushed in this turn.

### 2026-10-12 Simulator stun-duration correction (in progress)

- Codex owns the simulator effect-duration multiplier path, simulator live-item tooltip duration display, the focused Time Melting/Puzzlebag Endurance regression, and this handoff while correcting seed `2965184550` behavior. Scope is to preserve source duration parameters, apply the shared duration factor to stun effects (including Hammer and related ports), expose the modified duration in simulator tooltips, and push only after focused and ledger verification.

### 2026-10-12 Simulator stun-duration correction complete

- Time Melting and Puzzlebag of Endurance now add multiplicative prepared duration factors instead of mutating only `params.dur`; named parameters such as `dur_stun` and `dur_stunself` are covered. Puzzlebag J now runs its source-aligned `onPrepare` path, so overlapping Endurance bags compose correctly.
- Hammer, Thor's Hammer, chess, and every other simulator stun path now read the shared prepared duration helper. Simulator piece snapshots carry duration parameters, and live simulator tooltips rewrite the effect text with the prepared value (including the four-Endurance seed case).
- Added `scripts/sim-duration-effects-smoke.mjs`; it verifies base, Endurance, four-bag, Time Melting, combined, and tooltip values. Focused duration, wave, parity, noop, ledger, syntax, and diff checks pass. `npm run sim-harness` remains blocked by its pre-existing `stoneGolemPort.onPreCombatStart` stale test call; the handler is already named `onPrepare` in the existing port.

Codex writes this file only. Cursor writes [`CURSOR_HANDOFF.md`](CURSOR_HANDOFF.md). Read **both** before starting. Do not edit the other handoff. Do not invent progress. Label new ideas **Proposal** until measured or approved.

### 2026-10-12 Main branch reconciliation complete

- Safely committed this workstation's 118 tracked website, documentation, migration, and smoke-test changes; merged the ten newer `origin/main` commits; and pushed the combined result to `main` as `d38d9fe`.
- The only merge conflict was concurrent Codex-handoff additions. Both factual sets of records were retained. The shared build-view, live-item-art, and navigation edits merged automatically and passed focused checks.
- Kept local-only status summaries plus untracked PowerShell/SQL admin/debug scripts out of Git because they are not website release files and several require separate secret-safe review before sharing.

### 2026-10-08 Create bag-synergy indicator claim (in progress)

- Codex owns the source-derived bag-effect predicate, Create drag-time bag-border indicator, focused smoke, and this handoff.
- Scope: while a non-bag item is held, visually identify only placed bags whose `showBagBorderForItem` / `canApplyEffect` rule accepts it, with a stronger state over the hovered compatible bag. No persistent recommendation UI or simulator behavior changes.

### 2026-10-08 Create bag-synergy indicator complete

- Added the source-derived `Bag.canApplyEffect` / `showBagBorderForItem` rules for every current effect bag, including the direct Portable Altar override and charge emitters. The shared duration predicate now recognizes current named duration parameters such as Hammer's `dur_stun`, so Puzzlebag of Endurance can identify the same target on Create.
- While a non-bag is held, compatible placed bags show a green cell-following border; the compatible bag under the pointer brightens further. The indicator persists while a drag is over Parked, Sell, catalog, or Build Info, and clears on drop/cancel. This does not change simulator effect resolution.
- Added `scripts/create-bag-synergy-smoke.mjs` (every source effect-bag acceptance rule plus rejects) and `scripts/create-bag-synergy-browser-smoke.mjs` (1440, 1080, narrow, mobile, hover emphasis, cleanup). Both pass, as do changed-module syntax checks, `node scripts/build-sim-fidelity-ledger.mjs --check`, and `git diff --check`.

### 2026-10-08 Create duration-affect feedback repair claim (in progress)

- Codex owns the named-duration DOM stamp, placed Time Melting hover/star regression, Puzzlebag Endurance drag regression, and this handoff.
- Scope: make every numeric `dur` / `dur_*` parameter visible to the existing Create `canAffect` and bag-border paths, and keep the game-like bag/star visual treatment unchanged except for the missing compatible state.

### 2026-10-08 Create duration-affect feedback repair complete

- Create item DOM now exports the shared duration predicate, including named fields such as Hammer's `params.dur_stun`, so placed Time Melting hover logic lights the Hammer star after placement.
- Puzzle Bag of Endurance is covered by the same drag-time duration rule; holding Hammer highlights it and hovering that bag applies the brighter game-like segmented/dashed green border. The treatment scales with the existing cell `em` sizing across desktop, narrow, and mobile smoke viewports.
- Passed `scripts/create-duration-hover-smoke.mjs`, `scripts/create-bag-synergy-smoke.mjs`, `scripts/create-bag-synergy-browser-smoke.mjs`, changed-module syntax checks, `node scripts/build-sim-fidelity-ledger.mjs --check`, and `git diff --check`.

### 2026-10-08 Puzzle Bag no-key drag regression claim (in progress)

- Codex owns the Create drag-border fallback for legacy placements without explicit keys, its focused browser regression, and this handoff.
- Root-cause evidence: `paintPooled` assigns a deterministic `id:face:x,y` DOM key when a HistoryDB/legacy placement has no `key`, while `syncBagBorders` discarded that same placement before lookup. Scope is the fallback lookup only; keyed placements and the duration predicate remain unchanged.

### 2026-10-08 Puzzle Bag no-key drag regression complete

- `syncBagBorders` now derives the same `id:face:x,y` fallback key as `paintPooled`, so legacy/HistoryDB Puzzle Bag of Endurance placements highlight when Hammer is held even when the placement has no explicit key.
- Extended the browser smoke with the exact no-key DOM/placement case; keyed Puzzle Bag, hovered emphasis, responsive viewports, Time Melting’s placed Hammer star, source rules, syntax, ledger, and diff checks pass.

### 2026-10-07 profile avatar CDN fallback claim (in progress)

- Codex owns the shared profile-image failure fallback, the direct Discord-avatar views that bypass `faceHtml`, the focused browser smoke, and this handoff.
- Scope is broken external profile images only: render the existing initials or empty state after an image error; blob identity and unrelated artwork fallbacks remain unchanged.

### 2026-10-07 profile avatar CDN fallback complete

- `faceHtml()` now marks Discord-avatar images and a single delegated error handler replaces failed external images with initials or the caller's existing empty-state class. Blob identity markup is unchanged.
- Added the same markers to event participant faces, Admin report/member rows, simulator profile selectors, and the large simulator profile avatar; simulator avatar swapping can restore an image after a fallback replacement.
- Added `scripts/avatar-fallback-smoke.mjs`; it proves both the shared helper and a direct profile-image surface recover from a 404. Changed-module syntax checks and `git diff --check` pass.
- Checked off the matching `docs/todo.md` item. No authentication, storage, or legal-page behavior changed.

### 2026-10-07 create filter search reorder claim (in progress)

- Codex owns the Create-only Filter-panel ordering rule and its focused browser smoke.
- Scope is presentation only: Search moves above Grouping in the Create rail; the shared Items page markup/order and all filter logic remain unchanged, with Debuffs last.

### 2026-10-07 create filter search reorder complete

- Added Create-scoped flex ordering so Search renders immediately after the filter header, Grouping and the remaining filter groups follow, and Debuffs stays last. The shared Items filter markup and logic were not changed.
- Added `scripts/create-filter-order-smoke.mjs`; it verifies the order at 1440p, 1080p, narrow desktop/tablet, and mobile widths. The smoke passes, changed CSS/test syntax checks pass, and `git diff --check` passes.
- Checked off the matching `docs/todo.md` item. No authentication, storage, or legal-page behavior changed.

Shared instructions stay in root [`AGENTS.md`](../AGENTS.md). Only one assistant edits that file at a time.

## Owned paths

### 2026-10-10 browser tooling setup

- Codex owns the BPB browser-tooling setup: `.cursor/mcp.json`, `.cursor/rules/browser-tools.mdc`, `scripts/start-chrome-devtools-mcp.mjs`, `scripts/browser-smoke.mjs`, `docs/testing/browser-tools.md`, and this handoff. Scope is local development/debugging only; do not change production deployment or application behavior.

### 2026-10-10 Builds view desktop scaling

- Claimed `builds/view/index.html`, `js/pages/build/index.js`, `js/pages/build/build.css`, and this handoff to use the existing slim footer and tune the dedicated `/builds/view/` desktop layout without changing the shared footer or the separate build-history page.

### 2026-10-11 Builds view targeted desktop density complete

- Replaced the full Builds-view `zoom` with the Items/Create viewport shell. The board scales only inside its dedicated stage on short desktops while the title, round controls, and rails retain their normal desktop density; the shared nav keeps its existing proportional scale.
- At 2560×1440 the board remains its native 720×560. At 1920×1080, only the board scales to the available 720×493 stage (~88%), the page remains exactly viewport height, and neither axis overflows.
- The board stage no longer clips item or bag artwork that intentionally overhangs the top or bottom of its grid. The page shell remains viewport-bounded.

### 2026-10-11 shared nav targeted desktop density complete

- Replaced the shared nav's global desktop transform scale with a targeted short-viewport adjustment: only the empty bottom clearance contracts while the shelf, logo, banners, and controls keep their normal desktop size. The measured nav spacer remains the content boundary.
- Browser verification: at 1920×1080 the nav ends at ~225px with a full-size 384×156 logo; at 2560×1440 it remains the unchanged ~300px reference composition. The Builds view stays one viewport tall with no horizontal overflow.

### 2026-10-11 responsive hybrid rule complete

- Added the always-applied `.cursor/rules/responsive-hybrid.mdc` rule. It makes the Items/Create targeted responsive system the default for all current and future pages: fluid primary regions, locally scaled visual canvases only, bounded internal scrollers, normal-sized controls/nav, and required 2560×1440 + 1920×1080 verification. Full-page/layout/nav scaling is an explicit exception only.
- Applied the same targeted short-desktop policy to the shared footer: preserve normal content size and screen-frame clearance while reducing only excess top/bottom padding.

### 2026-10-11 shared nav density and Builds top-gap correction

- Codex owns `js/shared/nav.js`, `js/shared/nav.css`, `js/shared/nav/scroll-logo.js`, `js/pages/build/build.css`, and this handoff for a viewport-scaled desktop navigation shell plus a smaller Builds view top inset. Shared nav behavior must retain the existing mobile drawer and the 2560x1440 reference composition.

### 2026-10-04 admin-selected event winners (in progress)

- Claimed `js/pages/admin/event-desk.js`, `js/pages/admin/api.js`, `js/pages/admin/admin.css`, `supabase/functions/admin-builds/index.ts`, a new event-winner migration, `docs/pages/admin.md`, the affected legal pages, and this handoff. The feature will let an owner select or replace one winner only for an event whose configured voting is off; persistence and authorization remain server-side, while public event configuration and unrelated admin functions stay unchanged.

### 2026-10-04 disabled screenshot UI removal (in progress)

- Claimed the Create-page onboarding/import UI, Premium comparison copy, and the Discord Premium feature list for this cleanup. Product edits are limited to removing the disabled screenshot entry point and its Premium feature row/copy; the paused screenshot detector implementation, assets, server function, and research documentation remain preserved and unchanged.

### 2026-10-03 Northflank Discord bot deployment preparation (in progress)

- Claimed `bot/env.js`, `bot/watch.js`, `bot/Dockerfile`, `.dockerignore`, `scripts/check-bot-board-thumb-deps.mjs`, `docs/features/northflank-discord-bot.md`, `docs/sim/sim-port-wave-backlog.md`, `assets/data/sim-fidelity-ledger.json`, `js/shared/auth.js`, `js/shared/entitlements.js`, `js/shared/premium-offer.js`, `js/pages/sim/engine/scripts/ports-wave-d-unique.js`, `supabase/migrations/20261003010000_fix_founding_claim_trigger.sql`, and this handoff to prepare the existing Discord Gateway watcher for a Northflank Combined Service, repair the founding Premium claim flow, fix the simulator Wave D module import, and reconcile the simulator port backlog with live source/ledger state. The change is limited to environment loading, process lifecycle/health handling, a production image definition, build-context secret/file exclusion, deployment documentation, the client-side founding claim result handling, the secured founding-claim database path, one invalid simulator import, and simulator backlog documentation/data; no Discord behavior or website code is being redesigned.

- Claimed `supabase/config.toml`, `supabase/functions/discord-guild/index.ts`, `docs/pages/auth.md`, `legal/about/index.html`, `legal/terms/index.html`, `legal/privacy/index.html`, and this handoff to repair the authenticated private-mode Discord membership check. The edge function must retain its own signed-user validation; this work only corrects gateway routing/configuration and any necessary factual documentation.

- Claimed `js/pages/sim/AGENTS.md`, `.cursor/rules/sim-item-porting.mdc`, `docs/sim/sim-item-porting.md`, and this handoff to turn the simulator's fidelity guidance into a mechanical, evidence-first item-port workflow suitable for future agents. This task adds process rules and verification instructions only; it does not change simulator behavior or item coverage.

### 2026-10-03 Northflank Discord bot deployment preparation complete

- Founding Premium audit/fix: the live public status RPC confirms the promo is started, open, and capped at 10 (0 used at audit time); anonymous claim RPC calls are rejected. The client regression was a missing `getSupabase` import in `js/shared/entitlements.js`, which made every automatic and manual claim return the caught `exception` result. Restored that import. The claim button now treats returned error/unknown responses as failures instead of silently refreshing the same offer; ordinary race outcomes (already entitled, full, not started, ineligible) refresh the offer with current state. `auth.js` now logs any unhandled claim result for future diagnosis.
- Validation: `node --check` passes for `auth.js`, `entitlements.js`, and `premium-offer.js`; live `get_founding_status` verifies `{ started: true, open: true, used: 0, total: 10 }`; an unauthenticated live claim is rejected with HTTP 400. An authenticated RPC smoke cannot be run without a real Discord account session, so the first eligible sign-in after deployment remains the final live verification.
- Persistence follow-up: the profile protection trigger was also reverting the security-definer claim write because `auth.uid()` remains set inside that RPC. Applied migration `20261003010000_fix_founding_claim_trigger.sql` to the linked Supabase project and pushed commit `5c39288`. It gives only the current claim transaction a local marker, verifies that the entitlement write persisted, serializes claims with a transaction advisory lock, and enforces unique assigned slots. Live end-to-end verification now passes: `smojowastaken` persisted as `plan = founding`, `founding_slot = 1`; the public status is `started = true`, `open = true`, `used = 1`, `total = 10`.
- Simulator import repair: the uncommitted Wave D backlog rewrite had removed eight stable port definitions while leaving their registry references, added an import (`addEffectDamageFactor`) that does not exist, and referenced an undefined `befuddlementPort`. Restored the complete known-good Wave D source from the current `main` baseline rather than leaving a page-blocking partial port set. Validation: `node --check` and a real ESM import pass; all 10 registered Wave D ports resolve. The file is byte-equivalent to `HEAD`, so no simulator commit was needed.

- Simulator backlog refresh: regenerated `docs/sim/sim-port-wave-backlog.md` from the current fidelity ledger rather than retaining manual completion claims. It now records 519 catalog items, 351 source-ported items, 92 runtime ports still incomplete, 49 source-unresolved items, one deferred supported-mode gap, and 26 intentional no-combat rows: 142 unique incomplete/deferred rows total. The three confirmed behavior gaps (Power of the Moon, Wand of Dissonance, and Rib Saw Blade) are explicitly prioritized. Ledger freshness, the Wave D smoke, and the 13-check continuous audit pass; no implementation status was inferred from the presence of a handler alone.

- Private-mode Discord check repair: `discord-guild` already validates a supplied bearer JWT with `auth.getUser`, but it was missing the corresponding `verify_jwt = false` gateway configuration. The gateway was therefore returning 401 before the function could run. Added the configuration, deployed `discord-guild`, and verified an unauthenticated POST now reaches the function and returns its expected `401 {"error":"Sign in required"}` response. Its signed-user and live Discord membership paths remain server-side and fail closed.

- Simulator import delegation rules: added `docs/sim/sim-item-porting.md`, a step-by-step source dossier, implementation, regression, ledger, stop-condition, and handoff protocol. Updated the local simulator `AGENTS.md` to make that runbook mandatory for new/deepened ports, and added Cursor's always-applied engine rule `sim-item-porting.mdc`. The rules forbid broad wave rewrites, handler-count completion claims, module-global item state, guessed source semantics, registry/import breakage, weakened evidence, and untested player/opponent/event/UI behavior.

- Claimed `js/shared/cosmetic-upload-modal.js`, `js/pages/admin/tab-cosmetics.js`, `js/pages/admin/api.js`, `js/pages/u/blob/catalog.js`, `scripts/write-config.mjs`, `js/shared/config.example.js`, `supabase/functions/admin-builds/index.ts`, `supabase/functions/cosmetic-catalog/index.ts`, `supabase/config.toml`, `supabase/migrations/20261003020000_cosmetic_catalog_pipeline.sql`, `docs/db/sql/033_cosmetic_catalog_pipeline.sql`, `bot/cosmetic-drops.js`, and this handoff to replace the admin cosmetic upload's local-only behavior with an owner-gated live catalog draft/publish pipeline. Existing user edits in shared admin/bot paths will be preserved.

- Cosmetic upload pipeline complete: admin uploads now send bounded PNG/WebP data to the owner-authenticated `admin-builds` function, which stores the image in the dedicated public `cosmetic-assets` bucket and creates an unpublished catalog draft. The admin catalog loads drafts, adds the uploaded row immediately, and Publish marks it live; the public `cosmetic-catalog` function merges published DB rows into the static wardrobe catalog, while the Discord bot only announces rows with `published = true`. Applied migrations `20261003020000` and `20261003021000`, deployed `cosmetic-catalog` and `admin-builds`, regenerated the tracked browser config, and verified public catalog 200 plus unauthenticated admin upload 401. Old uploads were never persisted by the previous local-only callback, so the user's cosmetic must be selected again once.

- Claimed the live cosmetic cleanup scope: `public.cosmetic_drops`, profile `cosmetic_grants`/`equipped_avatar` inventory state, and the dedicated `cosmetic-assets` storage prefix. The requested operation will preserve only the `premium_crown` catalog item and any `premium_crown` loadout slot, clear all other cosmetic grants/loadout references, and leave plan/founding entitlements unchanged. No website source or unrelated storage objects will be edited.

- Cosmetic cleanup complete: schema audit found no separate inventory/cosmetic tables beyond `public.cosmetic_drops` and the profile inventory fields. The live catalog now contains only published `premium_crown`; all profile `cosmetic_grants` values are normalized to empty JSON arrays; loadouts retain the one `premium_crown` slot and contain no other cosmetic IDs; the dedicated `cosmetic-assets` bucket has no non-crown objects. Plan/founding entitlements and unrelated storage objects were not changed. Public `cosmetic-catalog` verification returns exactly one item: `premium_crown`.

- Follow-up claim: publish the already-present `assets/data/blob-cosmetics.json` static-catalog cleanup so GitHub Pages/Admin no longer merges the 13 retired local fallback entries. Only this catalog file is in scope; unrelated worktree edits remain unstaged.

- Static catalog cleanup complete: committed and pushed `8c9e101` (`Retain only premium crown in static cosmetic catalog`). GitHub Pages propagation was verified after cache refresh; `assets/data/blob-cosmetics.json` now returns exactly one item, `premium_crown`.

- Claimed `admin/index.html` for the Admin Cosmetics tooltip bootstrap fix. The local page already includes the classic `js/shared/tooltip.js` dependency, but the deployed page did not; this scoped change will publish that script before the Admin module and leave the repeated idempotent entitlement diagnostics unchanged.

- Claimed `js/shared/auth.js` for sign-in lifecycle deduplication: `initAuth()` can be reached by both shared navigation and the Admin shell, so post-sign-in profile sync/founding checks are now coalesced per user session without changing entitlement decisions.

- Admin tooltip/sign-in cleanup complete: pushed `14b234a` (`Load tooltip API before admin modules`) and `4b4b8e8` (`Deduplicate post-sign-in initialization`). The deployed Admin HTML now places `tooltip.js` before the module; `node --check js/shared/auth.js` and live cache-busted checks pass. The repeated “Already entitled” diagnostics were caused by duplicate initialization, not an entitlement failure; one check now runs per session.

- Power of the Moon audit: the current uncommitted rewrite of `js/pages/sim/engine/scripts/ports-threshold.js` is not a valid import. It has a syntax error at `getP1(/* item descriptor reference */, 1)`, ends mid-`slothPort`, exports only 2 ports instead of the baseline 10, and omits the required `THRESHOLD_PORTS` export. `node --check`, the scheduler/hook audits, the ESM ports import, and the continuous audit all fail before simulator behavior can be tested. The existing ledger/source evidence still correctly records the `CombatTimer.advanceTime` gap; no correctness claim is granted.

- Claimed `js/pages/u/blob/cosmetic-tooltip.js`, `js/shared/tooltip.js`, and this handoff to expand cosmetic hover details. The tooltip will show the catalog description, cosmetic ID, slot, creator/artist/owner, correctly localized added date, entitlement path, rarity/type, preview, and catalog worth while escaping all text through the existing renderer.

- Cosmetic tooltip expansion complete: pushed `8dd9b54` (`Expand cosmetic tooltip details`). `node --check` passes for both modules, the sample Premium Crown payload includes the new metadata and entitlement text, and the live custom-domain scripts now contain both the cosmetic detail fields and the shared “Obtained by” renderer. Date-only catalog values are parsed as local calendar dates to avoid timezone shifts.

- Follow-up: Northflank exposed a missing dynamic import for `bot/board-thumb.js`. Traced its full local ESM tree (18 modules): `map-item`, `board-still/paint`, the complete `backpack-grid` export tree, and `item-live-art`. The image already contains every dependency except `js/shared/board-still/paint.js`; added its explicit `COPY` and a source/Docker dependency assertion at `scripts/check-bot-board-thumb-deps.mjs`. Required thumbnail assets are already copied: shapes, sprite metadata, socket offsets, live-art metadata, item sprites, and `FilledSlot.png`. `assets/item-layers` remains excluded because this server call does not request glows.
- Validation: the dependency assertion passes, both entry modules pass `node --check`, and an isolated Node import of `paint.js` with the bot canvas DOM shim passes. `.dockerignore` does not exclude any required board-still JS path.

- Audited the existing bot: `bot/watch.js` is the persistent Node.js ESM worker, `discord.js` is 14.27.0, it uses the Discord Gateway with Guilds/GuildMembers/GuildMessages intents, polls Supabase REST/Storage, has no existing public HTTP endpoint, and relies on repository assets plus ignored `bot/data/*.json` runtime state.
- Updated `bot/env.js` to prefer Northflank's `process.env` and use the local `.env` only as a development fallback. The watcher now fails fast when its Discord or Supabase runtime variables are missing.
- Updated `bot/watch.js` with an optional internal `/healthz` endpoint, Gateway disconnect/reconnect diagnostics, invalidated-session restart behavior, and graceful SIGTERM/SIGINT shutdown. Discord.js remains responsible for normal Gateway reconnects.
- Added `bot/Dockerfile` (Node 22, production-only `npm ci`, explicit bot/shared-module/asset copies, container health check) and `.dockerignore` to keep local secrets, ignored state, models, and unrelated site files out of the build context.
- Added `docs/features/northflank-discord-bot.md` with the exact Combined Service configuration, environment variable names only, volume/health-check guidance, deployment verification, and the requested checklist. Nothing was deployed and no secret values were added.
- Validation: `node --check` passed for all 32 bot JS/MJS files; environment-loader checks passed; all 15 Dockerfile `COPY` source paths exist; `git diff --check` passed for the owned edited paths. Docker itself is not installed locally, so the image build remains a Northflank-side check.
- Blocker/next step: create the Northflank Combined Service manually, confirm its `256 MB` configuration is using the free Sandbox allocation before accepting anything billable, inject the six required secret/config variables plus `BOT_HEALTH_PORT=8787`, attach a single-read/write `/app/bot/data` volume, deploy one replica, verify `/healthz` and `/test`, then stop the local watcher after the Northflank instance is healthy. Increase to `512 MB` only if Northflank reports an out-of-memory restart.

### 2026-10-03 Builds event-tag ordering

- Claimed `js/pages/builds/post-row.js`, `js/pages/builds/builds.css`, `js/pages/build/event-banner-tip.css`, and `docs/CODEX_HANDOFF.md` for merging event marks into the build tag row. Event tags will render first while retaining their event link and hover-card behavior across card, compact, and grid views.

### 2026-10-03 Items spotlight recipe positioning

- Claimed `js/pages/items/spotlight.js`, `js/pages/items/spotlight-recipes.js`, `js/pages/items/spotlight.css`, and `docs/CODEX_HANDOFF.md` for the item-detail craftable panel positioning fix and desktop responsive layout pass. The narrow stacked detail layout remains in scope for regression validation.

### 2026-10-03 Items desktop filter rail sizing

- Claimed `js/pages/items/catalog.css` and `docs/CODEX_HANDOFF.md` for a desktop-only Items filter/catalog geometry pass. The filter rail will be container-aware above the mobile breakpoint while the catalog keeps its existing fluid desktop size; existing narrow drawer rules remain unchanged.

### 2026-10-03 Package 4 port backlog

- Claimed `docs/sim/sim-port-wave-backlog.md` and `docs/CODEX_HANDOFF.md` to record the current 142 incomplete simulator ledger rows as an evidence-first, source-driven backlog. This is planning inventory only; no port status or Package 4 completion claim changes.

- Added the 142-row checkbox backlog grouped into 49 source-resolution rows, 92 existing-but-incomplete ports, and one deferred supported-mode item. It also calls out the three source-confirmed behavior gaps that must lead the work. The list is derived from the ledger and has exactly 142 actionable checkboxes; Package 4 remains open.

### 2026-10-03 Roadmap Package 6 continuous audit and patch-drift workflow

- Claimed `scripts/sim-patch-drift.mjs`, `scripts/sim-continuous-audit.mjs`, `assets/data/sim-patch-baseline.json`, `.github/workflows/sim-continuous-audit.yml`, `docs/sim/sim-patch-drift.md`, `docs/sim/sim-validation.md`, and `docs/sim/sim-1to1-execution-plan.md` to add a source-hash baseline, deterministic changed-item/core-impact report, a non-mutating simulator audit entry point, and its CI check. Existing fixture failures and missing live evidence must remain explicit; this package will not alter fixture bands or grant fidelity status.

- Completed the workflow: the baseline covers 519 catalog rows, full catalog parameter records, resolved item script/function hashes, and the tracked shared combat core. Any patch now reports a sorted review wave; an affected `fixture_validated` or `live_validated` row blocks baseline acknowledgement until downgraded.
- Added `node scripts/sim-continuous-audit.mjs --check`, a green 13-check source/audit/log/lifecycle/event/socket/two-board gate, with optional family and fixture modes. The fixture-inclusive mode deliberately exposes the four outstanding deterministic band failures and 0/11 retained live captures rather than hiding them.
- Added the stable GitHub Actions check and the documented patch procedure. `docs/sim/sim-validation.md` now owns every current unexplained fixture/source gap with an owner, evidence, severity, and next-evidence requirement. Package 6 is checked off; this does not complete Packages 4, 5, or 7.

### 2026-10-03 Roadmap Package 3 event-contract conformance

- Claimed `js/pages/sim/sim-events.js`, `js/pages/sim/engine/log-export.js`, `js/pages/sim/log/sim-log-sentences.js`, `js/pages/sim/log/sim-meter-metrics.js`, `js/pages/sim/hud/sim-hud.js`, `js/pages/sim/controls/sim-scrubber.js`, `scripts/sim-event-contract-smoke.mjs`, `docs/sim/sim-event-contract.md`, and `docs/sim/sim-1to1-execution-plan.md` to establish a shared, source-documented event corpus across log, meter, HUD/snapshots, scrubber, and JSON export. The suite must leave unrepresented game EventTypes and the three known item gaps visible rather than treating coverage as parity.

- `js/pages/create/create.css` (remove temporary Parked layout diagnostic)
- `js/pages/sim/engine/scripts/ports.js`, `js/pages/sim/engine/scripts/ports-wave-d-weapons.js`, and `scripts/sim-harness.mjs` (Stone Golem regeneration activation parity repair and regression coverage)

- `js/pages/sim/sim.css`, `js/pages/sim/hud/sim-hud.css`, `js/pages/sim/hud/sim-avatars.css`, and `js/pages/sim/controls/sim-scrubber.css` (desktop Sim responsive scaling)

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

### 2026-10-03 Items desktop filter rail sizing

- Restored the standalone Items catalog's fluid desktop width and changed its width calculation to use the actual content container instead of `100vw`. The 512px filter rail now remains inside the viewport at 1920px (catalog 1360px, filter 512px) while the 1440px proportions remain unchanged (880px / 512px); existing narrow drawer media rules remain unchanged.
- Validation: Playwright CSS geometry check measured the filter rail fully inside the viewport at 1920px, 1440px, 1280px, and 1080px, with catalog widths of 1360px, 880px, 720px, and 520px; `git diff --check` passed.

### 2026-10-03 Builds event-tag ordering

- Merged event marks into the same flair row as OP, Feasible, Theory, Real, and Featured tags. Event marks are inserted first, retain their event link and hover-card hook, and are kept outside the build-title anchor so all three feed views remain valid HTML.
- Validation: browser-rendered card, compact, and grid rows confirmed event-first ordering, four combined tags, event link preservation, and no nested anchors; `node --check js/pages/builds/post-row.js` and `git diff --check` passed.

### 2026-10-01 Items mobile detail spotlight

- Claimed the Items mobile item-detail layout. Product edits will stay in the Items spotlight and shared tooltip positioning paths; screenshot-import paths remain owned by Cursor.
- Stacked the focused item, tooltip, swipeable recipe carousel, and builds carousel on screens up to 900px; desktop keeps the existing side/bottom spotlight arrangement. Large focused pieces are scaled to the available top area and panel positions recalculate on resize and async build results.
- Validation: browser geometry checks passed at 390px, 768px, 900px, and 1440px; mobile recipe scrolling was confirmed (`scrollWidth` exceeded the viewport); no page errors. `node --check` and `git diff --check` passed.

### 2026-10-03 Items spotlight recipe positioning

- Fixed the desktop spotlight open pass from clearing the recipe/build panels' own inline coordinates, which left the craftable panel at the stylesheet default in the top-left corner. The recipe anchor now also accounts for the tooltip's right edge on narrower desktop widths so it does not overlap item details; mobile keeps the stacked sheet behavior.
- Validation: Playwright geometry checks at 1440px, 1920px, 1280px, 1080px, and 900px confirmed visible craftable panels stay within the viewport and do not overlap the tooltip where recipes are present; `node --check` passed for spotlight modules and `git diff --check` passed.

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

### 2026-10-02 History load round-picker cleanup

- Removed the board-level Create round scrubber that appeared beneath the board after loading a history run. The history selector’s preview round picker remains available before Load; the selected round is now left in the draft when the selector closes.

### 2026-10-02 Short desktop Create sizing

- Added a short-viewport desktop layout for Create (up to 1100px tall). The board stage now flexes into the available vertical space and scales the 9×7 board art to fit, while the two-row Parked tray remains visible below it.
- Tightened the flex chain with explicit full-height board column/editor sizing so the fixed navigation’s reserved space is included in the available height. A local 1920×1080 layout check measured Parked ending at the editor bottom rather than below the viewport.
- Matched desktop Create’s bottom frame clearance to the left/right frame inset. The Parked section now ends with the same visual border spacing instead of sitting against the bottom edge.

### 2026-10-02 Shared artwork CSP repair

- Added the shared `https://awerc.github.io` artwork host to `img-src` and `data:` to `font-src` on every page CSP so build previews and item sprites are not blocked.
- Preserved each page’s existing script policy. The browser-injected `FloatingAssistant` localhost message is extension diagnostic output, not a site request.

### 2026-10-02 Temporary Premium testing grant

- Granted `glitzi` a seven-day Premium entitlement through `2026-10-10T00:47:38Z` and confirmed the Discord Premium role is present. The entitlement will expire automatically unless renewed.

### 2026-10-02 History picker responsive refactor

- Claimed `js/pages/create/history-picker.js`, `js/pages/create/history-panel.css`, and the related Create history-picker markup/styles for a responsive, modular layout pass.
- Replaced fixed round-label, arrow, toggle, class-filter, history-row, stats, and action sizing with container-aware `clamp()` values. The round strip now flexes its slots to the available width instead of forcing a fixed desktop slot.
- Replaced the viewport-only history layout breakpoint with a picker-container query, so the list/preview split responds to the board column width on desktop and mobile. Selection and Load/Cancel behavior are unchanged.
- Verified the round controls at 293px, 520px, and 900px picker widths with no horizontal overflow; JavaScript syntax and targeted whitespace checks passed. The existing full browser history smoke remains blocked before the picker by the local onboarding/config state.

### 2026-10-02 Admin Sim Reports form styling

- Claimed `js/pages/admin/admin.css` and the Sim Reports presentation selectors for a forms-style visual alignment pass.
- Reused the admin form surface treatment for the Sim Reports KPI strip, report queue, expanded report details, empty/loading states, and filter rail: dark rewards gradient, gold edge, cream/gold text, recessed inputs, and form-style separators.
- Report filtering, expansion, and moderation actions are unchanged. Browser style smoke verified the dark panel, gold borders, form input, and cream report text; `git diff --check` passed.

### 2026-10-02 History picker layout regression

- Reclaimed `js/pages/create/history-panel.css` to correct the responsive picker breakpoint after the new container query stacked the run list and preview at a normal desktop board width.
- The picker now keeps its side-by-side list and board preview above a 34rem board width; only genuinely narrow boards use the stacked layout. This prevents the preview board from being compressed into a thin strip on desktop columns.
- Further capped the responsive round label, arrows, and visibility toggles. Style smoke confirmed no horizontal overflow, a 695px board stays two-column, and 520px/390px boards stack as intended; syntax and whitespace checks passed.

### 2026-10-02 Sim desktop responsive scaling

- Kept the desktop fight field at three columns for 1080px-wide and 1080px-tall desktop viewports; only phone widths now change it into the single-column composition.
- Added a compact desktop scale tier for the fight HUD, avatar figures, scrubber, center controls, columns, and navigation clearance. Full 1440p values remain capped at their existing size while 1080p gets vertical room back.
- Layout smoke confirmed side-by-side bags and an absolute two-card HUD at 1920x1080, 2560x1440, and 1080x900, with no horizontal overflow; the 390px mobile viewport still uses the one-column field.

### 2026-10-03 Parked diagnostic removal and Stone Golem repair

- Removed the temporary magenta Parked-section diagnostic outline from Create.
- Investigated Sim report `eeca47d8-b0fc-4e74-a72d-9cb880d465a0` (seed `2965184550`, build `bpbb-ratmancer-frjdz0`). All items in that board are already engine-backed; Stone Golem was the faulty port.
- Stone Golem now listens for a positive Regeneration gain at the earliest combat-start hook, consumes its 7-Regeneration threshold immediately, grants its catalog Block value (150), and switches to its 2.6-second activated cooldown. Added a harness unit regression for those values.
- Targeted syntax checks, focused activation check, and whitespace validation passed. The full harness reaches unrelated pre-existing parity/no-op failures after this unit passes; its generated report artifacts were not staged.

### 2026-10-03 Stone Golem event-path completion

- Completed the Stone Golem repair for the exact reported board (`bpbb-ratmancer-frjdz0`) and seed (`2965184550`). Healing Herbs had bypassed the simulator's shared buff-change bus, so Stone Golem never received its Regeneration threshold event.
- Stone Golem's granted Block now also uses that shared path, making the activation visible to the combat log/UI. The exact regression run records a `−7 regeneration` event and a `+195 block` event at 2.5 seconds; 195 is the board's buff-power-scaled result of Stone Golem's 150 base Block, followed by its 2.6-second activated cooldown.

### 2026-10-03 Combat-log causal ordering

- Claimed and updated `js/pages/sim/sim-events.js`, `js/pages/sim/engine/simulate.js`, `js/pages/sim/engine/buff-economy.js`, and `js/pages/sim/engine/buff-log.js` to make simultaneous reactive buff chains sort by cause before combat-start placement order.
- Stack grants now receive a shared event identity before listeners run. Grants and spends performed inside a listener automatically inherit the triggering event as parent/root provenance; duplicate port labels retain that provenance.
- Combat-start sorting now keeps an entire causal chain in the source item's batch, then orders its source before each reaction. The exact Stone Golem regression replay records Healing Herbsâ€™ Regeneration grant immediately before Stone Golem spends it and grants Block, without an item-specific ordering rule.

### 2026-10-03 Simulator 1:1 audit and guardrails

- Added `js/pages/sim/AGENTS.md` and `docs/sim/sim-1to1-audit.md` for durable simulator-specific source-of-truth, parity, combat-log, and regression rules. Existing Cursor-only rules are now consolidated into a repository-local rule set that applies to future Sim changes regardless of editor.
- Baseline audit: `sim-log-smoke` and coverage-honesty pass; source audits find 15 hook gaps, 82 shallow ports, and 45 heuristic call candidates that still require `.gd` review. `sim-noop-audit` currently fails its Puzzlebag T combat-start assertion and is recorded as the first actionable parity gate rather than hidden.

### 2026-10-03 Simulator execution roadmap

- Added `docs/sim/sim-1to1-execution-plan.md`: a one-shot-shippable, all-item audit and implementation plan covering source baselining, start-of-battle/lifecycle parity, port waves, logs/meters, paired-board validation, patch drift, and honest near-1:1 release gates. It starts by reconciling the current 553 catalog vs 452 extracted-script denominator before implementation waves.

### 2026-10-03 Simulator roadmap execution (in progress)

- Claimed `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `docs/sim/sim-1to1-execution-plan.md` to execute Package 0: generate a source-versioned, one-row-per-catalog-item fidelity ledger and correct the roadmap's provisional denominator from the actual catalog data.
- Claimed `scripts/sim-noop-audit.mjs` for Package 1's first gate: repair its false failure by recognizing `onPreCombatStart` as the simulator equivalent of the game bag's `onPrepare`, while retaining the source/coverage assertions.
- Claimed `js/pages/sim/engine/simulate.js` and new `docs/sim/sim-combat-lifecycle.md` for Package 2's source-backed lifecycle trace and the first confirmed global ordering repairs (cooldown arm before `onPreCombatStart`, then a distinct post-combat-start pass).
- Claimed `js/pages/sim/engine/gem-sockets.js` and `scripts/sim-socket-split-smoke.mjs` to align socketed-gem preparation and combat-start work with `Items/Item.gd`: gem preparation must run before cooldown arming, and gem combat-start effects before the host item's combat-start hook.
- Claimed the `ScriptHandler` declaration in `js/pages/sim/engine/scripts/handlers.js` to record the newly exercised `onPostCombatStart` lifecycle hook.
- Claimed `scripts/audit-sim-gd-parity.mjs` to make its source-hook audit recognize `onPostCombatStart` as its own simulator lifecycle hook instead of treating an earlier start hook as a substitute.

### 2026-10-03 Simulator roadmap execution - Package 0 complete, Package 1/2 started

- Completed Package 0's generated `assets/data/sim-fidelity-ledger.json` and its `--check` gate: exactly 519 catalog rows, with source hashes and explicit 351 source-ported, 92 port-present/incomplete, 49 source-unresolved, 26 source-justified non-combat, and one deferred row. These statuses are not 1:1 claims.
- Corrected the Puzzlebag T noop-audit lifecycle mapping without weakening source/coverage checks; the full noop audit now passes. Package 1 remains open because the source audit has 16 hook candidates, 82 shallow ports, 40 catalog call-review candidates, and 21 duplicate registrations that need individual classification.
- Added the source-backed start-of-battle trace, cooldown-before-pre-hook ordering, a distinct post-combat-start pass, and correct socketed-gem phase ordering. The socket smoke now proves Topaz modifies the initial armed cooldown and Coal's combat-start block combines with its host opening effect.
- Corrected the source audit to require a real simulator `onPostCombatStart` hook for game `onPostCombatStart`. This surfaced the existing Power of the Moon gap instead of silently accepting its earlier `onCombatStart` approximation. Package 2 remains open pending the shared two-sided lifecycle fixture and source-led fatigue/time-advance model.

### 2026-10-03 Second simulator gap-audit plan (in progress)

- Claimed new `docs/sim/sim-1to1-gap-audit-plan.md` to document a second, non-duplicative audit plan for simulator risks not fully covered by the original item/lifecycle roadmap: core timing/RNG, data fidelity, UI/export consistency, harness quality, unsupported modes, and retained live evidence.

### 2026-10-03 Second simulator gap-audit plan complete

- Added `docs/sim/sim-1to1-gap-audit-plan.md`, a source-led second-pass plan that does not duplicate the first catalog/port roadmap. It covers the still-unclosed system risks: scheduler/timer semantics, random-stream ownership, complete Character lifecycle, two-sided/dynamic-board behavior, canonical event projection, shared state invariants, data/inheritance/patch drift, evidence-grade live captures, mutation/property testing, and user-visible truthfulness.
- The plan records current evidence boundaries: the simulator's fixed 0.05-second scheduler, Mulberry32 plus selective balanced RNG, optional SimEvent causality fields, partial paired-board/cross-board coverage, simulator-derived fixture bands, and the source audit's remaining 16 hooks/82 shallow ports/40 call candidates/21 duplicate registrations. These are audit targets, not unverified bug claims.

### 2026-10-03 Second-gap audit Package A (in progress)

- Claimed `scripts/build-sim-system-surface.mjs`, `assets/data/sim-system-surface.json`, and `docs/sim/sim-system-surface-audit.md` for Package A: a generated, source-hash-checked map of the shared combat surface (core lifecycle, character, stack, event/log/snapshot, timer, base item/gem/card) to simulator owners and explicit unresolved states.

### 2026-10-03 Second-gap audit Package B (in progress)

- Claimed `scripts/sim-scheduler-audit.mjs` and `assets/data/sim-scheduler-audit.json` for a source-backed scheduler baseline: combat delay, fatigue warning/first-damage cadence, and timer-advance semantics. This audit will report unproven clocks instead of treating the fixed simulator step as Godot-timer proof.

### 2026-10-03 Second-gap audit baseline execution

- Package A baseline is generated and checkable: `sim-system-surface.json` now tracks 21 shared systems, their simulator owners, source-file/function-body hashes, EventTypes, referenced signals/log constants, and a full inventory of the selected source files. Current extract inventory: 1,439 functions, 90 reviewed and 1,349 explicitly unreviewed. Its full exit gate remains open; no parity label was granted.
- Package B's source-settled fatigue baseline is generated and checkable: it verifies the extracted 14-second warning, 17-second first damage, and one-second subsequent cadence against an engine run. It explicitly reports unresolved same-time ordering, general timer cancel/re-entry, visual warning projection, and the missing `CombatTimer.advanceTime` equivalent. Power of the Moon therefore remains open.
- Next step: classify the shared-source inventory by combat relevance, then build the Package B boundary/tie suite and retain live captures where the extract cannot settle behavior. Do not treat either generated audit as a full 1:1 certification.

### 2026-10-03 Roadmap Package 1 hook-gap triage (in progress)

- Claimed `scripts/audit-sim-gd-parity.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `docs/sim/sim-1to1-execution-plan.md` to add source-backed owner/evidence dispositions for every existing hook-audit result. The target is auditable triage only: confirmed behavior gaps stay open rather than being hidden by hook aliases.

### 2026-10-03 Roadmap Package 1 complete

- Re-ran all baseline gates: noop, log smoke, coverage honesty, source-hook, and source-call audits pass at their intended assertion level. The ledger regenerates and passes `--check`.
- Every one of the 16 raw hook differences now has a machine-readable source evidence, owner, and disposition. The new `node scripts/audit-sim-gd-parity.mjs --require-triage` gate passes only with zero untriaged and zero stale entries; the ledger records zero untriaged lifecycle-hook gaps.
- Results: 3 inherited bases (`bow`, `card`, `weapon`), 3 visual-only hooks, 7 equivalent implementations, and 3 confirmed gaps left visible for later packages: Power of the Moon timer advance, Wand of Dissonance prepare-time effect-damage factor, and Rib Saw Blade enemy-weapon purge setup. The 45 call-review candidates, 21 duplicate registrations, and 82 shallow ports are still intentionally open outside Package 1's exit gate.

### 2026-10-03 Roadmap Package 2 lifecycle fixture

- Added the optional, test-only `captureLifecycle` trace to `simulateEngine`; it records the shared start lifecycle by phase, side, item, and placement without becoming combat data or changing a fight.
- Added `scripts/sim-lifecycle-smoke.mjs`: a fixed, two-sided board proves player-before-opponent batches, prepare/socket/cooldown/pre/start/post order, Topaz-before-first-cooldown behavior, one start consume per side, and a same-timestamp Healing Herbs → Stone Golem spend → Block causal chain with a shared root and nested depth.
- Updated `docs/sim/sim-combat-lifecycle.md` with the extract-backed trace, simulator entry points, and exact fixture assertions. Package 2 is checked off in `docs/sim/sim-1to1-execution-plan.md`.
- The three explicit Package 1 gaps remain unresolved, including `PoweroftheMoon.gd`'s item-specific timer advance; the generic post-start pass and its trace are not presented as a port of that behavior.
- Validation: lifecycle, socket split, versus-board, and log smokes pass; source-hook triage and fidelity-ledger checks pass.

### 2026-10-03 Roadmap Package 3 event-contract conformance

- Added `conformSimEvents`: the Combat Log, damage meter, scrubber, and debug JSON now consume the same non-mutating CombatEvent-like projection with stable IDs, parent/root/depth, timestamp, side, source/placement, target, and phase. Unknown source fields remain explicitly null rather than invented.
- Fixed two projection defects found by the corpus: `DrainStamina` now renders and records its absolute spend in the Stamina meter, and a terminal `fight_end` consistently uses the source-style Round won/lost result when outcome data is available.
- Added `scripts/sim-event-contract-smoke.mjs` and `docs/sim/sim-event-contract.md`. The corpus covers both sides, causal stacks, critical/block/effect/miss damage, Vampirism/Regeneration, stamina, consumed activation, debuff, cooldown, charge, death/outcome, meters, HUD snapshots, and JSON export. Charge intentionally remains an export/scrubber transport record rather than an invented log or meter row.
- Package 3 is checked off in `docs/sim/sim-1to1-execution-plan.md`. This does not claim all item ports or source EventTypes are fully supported; the three known Package 1 item gaps remain visible.

### 2026-10-03 FreeLLMAPI Cursor tunnel (external infrastructure)

- Configured and tested the separate `C:\Users\Justin\FreeLLMAPI` installation without changing BPBWebsite application code. The local dashboard/API is healthy on `127.0.0.1:3001`.
- Installed `cloudflared` v2026.2.0 and added the ignored local startup helper `start-cloudflare-quick-tunnel.ps1`. The active Quick Tunnel is temporary and changes hostname when restarted; a named Cloudflare Tunnel is still required for a stable production hostname.
- Authenticated public smoke tests passed for `/v1/models`, `auto` chat routing, `z-ai/glm-5.3` (served through the current GLM alias), `/v1/responses`, tool calls, and an SSE stream ending in `[DONE]`. Invalid and missing public credentials return 401.
- Cursor setup remains manual: enter the FreeLLMAPI unified key in Cursor's OpenAI API key field and use the active public `/v1` URL. Cursor UI Chat/Agent behavior was not automated; Quick Tunnel uptime is not production-grade.

### 2026-10-03 FreeLLMAPI named tunnel paused

- Stopped the pending Cloudflare browser-login flow at the user's request; no Cloudflare certificate, named-tunnel config, Windows tunnel service, or DNS route was created. FreeLLMAPI remains healthy on `127.0.0.1:3001`.
- Researched no-domain alternatives without installing or changing infrastructure. Tailscale Funnel is the leading candidate for a stable `ts.net` HTTPS hostname on its free plans; zrok reserved public names are a second candidate; ngrok's account-assigned free dev domain is a third candidate with tighter quotas. None of the free options found publishes a dedicated SSE guarantee, so a live SSE test is required before selection. Cloudflare Quick Tunnel is unsuitable for stable Cursor use because its hostname is temporary and Cloudflare documents SSE as unsupported.

### 2026-10-03 FreeLLMAPI permanent named tunnel

- Cloudflare Registrar zone `bpbbuilds.com` is active on Cloudflare nameservers. Created named tunnel `cursor-freellmapi` and scoped the only ingress route to `ai.bpbbuilds.com` → `http://127.0.0.1:3001`; no root-domain route or BPBWebsite application file was changed.
- Installed the Windows `Cloudflared` service as Automatic with recovery restart actions and secured the copied tunnel credential under `C:\Cloudflared`; four Cloudflare connector sessions are registered. The old Quick Tunnel is not running or scheduled for startup.
- Added a `FreeLLMAPI` logon Scheduled Task using `start-freellmapi.ps1 -NoBrowser`; the script parses cleanly and the task last ran successfully. No reboot was performed.
- Public acceptance through `https://ai.bpbbuilds.com` passed: missing/invalid key 401; authenticated `/v1/models` (258 models, `auto` and `nvidia-glm-5.3`); `auto` chat; Responses API; tool calling; SSE with `[DONE]`; and direct `z-ai/glm-5.3` served by the GLM route. Updated the separate `C:\Users\Justin\FreeLLMAPI\SETUP.md` with Cursor values and service/startup details.

### 2026-10-03 Custom-domain / share infrastructure claim (in progress)

- Codex owns the new Cloudflare share-preview infrastructure/docs paths for this task. The existing GitHub Pages repository, Discord Gateway bot, and `ai.bpbbuilds.com` tunnel remain protected; no Cursor-owned paths are being edited.

### 2026-10-03 Custom-domain / share infrastructure baseline

- GitHub Pages API now has the custom domain `bpbbuilds.com` on `bpbbuilds/bpbbuilds.github.io` (legacy `main` branch source); GitHub created the source `CNAME` file. HTTPS enforcement remains off until DNS points at Pages.
- Added and dry-run-tested `infra/cloudflare/share-worker/`, then deployed Worker `bpbbuilds-share-preview` with only the `share.bpbbuilds.com/*` route. Its Supabase publishable key is a Wrangler secret; no service key or provider credential is stored in the repo. A local smoke test covers browser redirect, crawler metadata, HTML escaping, and invalid-slug rejection.
- Cloudflare DNS edit scope is not present in the Wrangler OAuth session. Apex Pages A records, `www` CNAME, and the proxied `share` Worker DNS record therefore remain a manual Cloudflare-dashboard step. No `discord.bpbbuilds.com` Worker was created: the existing slash-command bot is a persistent Discord Gateway process and does not require an inbound HTTP interaction endpoint. `ai.bpbbuilds.com` was not modified.
- Updated bot link fallbacks and checkout/portal fallback URLs to `https://bpbbuilds.com`, refreshed the legal-page dates, and documented the exact DNS/domain and share-preview operations in `docs/features/custom-domain.md` and `docs/features/shared-build-embeds.md`. These repo edits are intentionally uncommitted because the worktree contains unrelated user changes.
- Blocker/next step: after the user adds the three DNS groups, verify apex/`www`/`share`, enable GitHub Pages HTTPS enforcement, and run public domain/share crawler tests. Do not mark this task complete before those checks pass.

### 2026-10-03 Custom-domain DNS verification

- The user added the requested records. Public resolver checks now show all four GitHub Pages apex A records, `www CNAME bpbbuilds.github.io`, proxied `share` Cloudflare IPs, and the unchanged `ai` Cloudflare IPs.
- Live `share.bpbbuilds.com` checks pass: nonexistent slug 404, normal browser 302 to `https://bpbbuilds.com/builds/view/?slug=...`, and Discordbot 200 metadata HTML with escaped build fields and an OG image. Apex HTTP serves the GitHub Pages site; `www` returns a 301 to the apex.
- GitHub Pages HTTPS certificate was still provisioning after a one-minute poll; `https_enforced` remains false and must be enabled after GitHub issues the certificate. The local Windows process list currently shows `npm run bot:watch`/`bot/watch.js`, with no bot Scheduled Task or Windows service; current Discord Gateway uptime therefore depends on Justin's computer and that process staying alive.

### 2026-10-03 Power of the Moon import claim (in progress)

- Codex owns the simulator paths needed to restore and source-port Power of the Moon: `js/pages/sim/engine/fatigue.js`, `js/pages/sim/engine/simulate.js`, `js/pages/sim/engine/vs-board.js`, `js/pages/sim/engine/scripts/handlers.js`, `js/pages/sim/engine/scripts/ports-threshold.js`, the focused Power Moon smoke test, and this handoff. The unrelated dirty Wave D and foe-browser files remain protected.

### 2026-10-03 Power of the Moon import complete

- Restored the damaged threshold-port module to the repository baseline, then corrected `power_of_the_moon` from the prior approximate cooldown behavior to the source-backed passive: prepare-time Moon Armor/Shield listener scope, post-combat-start fatigue-only timer advance (`p1/time`), fatigue-start percentage max-health grant (`p3/maxhealth`), Moon Armor's `p2/blind` application, and Moon Shield's one-debuff reflect stack. It no longer runs a fabricated cooldown loop or grants max health on every Moon activation.
- Added the mutable fatigue threshold to the shared scheduler and passed it through the per-piece context; the timer advance does not shift ordinary item cooldowns. Added `onPrepare` to the lifecycle contract and execute it in the existing prepare pass before cooldown arming.
- Added `scripts/sim-power-moon-smoke.mjs`. It passes source-linked handler guardrails and deterministic timer tests (single and additive advances, clamp, and no-op after fatigue starts). Touched modules pass `node --check`.
- Full simulator ESM/lifecycle import remains blocked by the unrelated pre-existing syntax corruption in dirty `js/pages/sim/engine/scripts/ports-wave-d-unique.js` (`10| useMana`); that file was not restored or included in this task so another agent's Wave D work is preserved. The Power Moon handler itself parses cleanly and the focused smoke passes.

### 2026-10-03 Admin cosmetics publish claim (in progress)

- Codex owns `js/pages/admin/tab-cosmetics.js`, `js/pages/admin/api.js`, and this handoff for the publish-session refresh fix. Supabase profile `smojowastaken` / Discord `524654511722332181` already has `is_owner = true`; the server-side owner gate will remain unchanged.

### 2026-10-03 Admin cosmetics publish fix complete

- The publish click now resolves the current owner-authenticated JWT immediately before submitting, instead of reusing the Admin shell's older token after a Supabase refresh. This removes the false “only owners can submit” state without weakening the Edge Function owner check.
- Verified the live profile row and Auth user mapping: `smojowastaken` is Discord `524654511722332181`, profile `is_owner` is already true, and it maps to the expected Discord Auth account. `tab-cosmetics.js` and `api.js` pass `node --check`; the change is ready to publish.
-
### 2026-10-04 Discord channel reconciliation complete

- Codex owns the bot channel/category reconciliation paths (`bot/channel-reconcile.js`, `bot/layout.js`, the bot channel sync modules, and their focused tests/docs) for this task. The goal is restart-safe, name/type-aware reuse when local state files are missing or stale; existing Discord resources will not be deleted automatically.
- Added `ensureGuildChannel`, which validates saved IDs, reuses exact type/name matches from Discord when state is missing or stale, selects a deterministic existing match, and fails closed instead of creating a duplicate when the guild listing fails. Applied it to managed categories, text channels, and the past-events forum; Website Stats category reconciliation now uses the same helper.
- Added `scripts/bot-channel-reconcile-smoke.mjs`; it covers saved-ID reuse, stale-ID recovery, existing-name reuse, creation, and fail-closed lookup errors. All touched bot modules pass `node --check` and import smoke. The user authorized cleanup: 11 newer exact-name/type duplicates were deleted, the state-referenced originals were kept, and a fresh guild listing reports zero duplicate groups. Changes remain uncommitted pending the user's deployment/push decision.

### 2026-10-04 Discord rules channel deployment follow-up (in progress)

- Codex owns the pending bot channel-reconciliation changes and this handoff for the duplicate-channel report. The supplied Rules channel ID `1555345682678943829` is the canonical existing resource; the fix must prefer it when the runtime state file is missing or points at a duplicate, while preserving the no-automatic-deletion rule.

### 2026-10-04 Discord rules channel deployment follow-up complete

- The bot now prefers Rules channel `1555345682678943829` on every sync, validates that it belongs to the configured guild and has the expected type/name, and only falls back to exact-name discovery before creation. This repairs deployments with missing/stale `bot/data` state and prevents an old duplicate ID from becoming authoritative.
- Published the previously pending restart-safe reconciliation changes for categories, managed channels, forums, and Website Stats counters. Existing duplicates are not deleted by the runtime.
- Validation: channel reconciliation smoke (saved-ID reuse, stale-ID recovery, exact-name reuse, creation, and fail-closed lookup), syntax checks for all touched bot modules, and Rules module import passed. Changes are ready for Northflank redeploy; no Discord resources were deleted in this task.

### 2026-10-04 Cosmetic submission queue diagnosis

- Traced the user-facing submit flow in `js/pages/u/blob/submit-cosmetic-modal.js` and `js/shared/cosmetic-upload-modal.js`: it only logs the payload in the browser and displays “saved locally for now”; it does not call Supabase, upload Storage, or create a submission row.
- The Admin Cosmetics “Review submissions” panel in `js/pages/admin/tab-cosmetics.js` is currently placeholder markup with static empty states for pending/approved/rejected; no submissions table or approval action is wired.
- Owner status is not the cause: the player flow uses the same local-only path for every signed-in user. `cosmetic_drops` is reserved for owner-uploaded catalog drafts/published cosmetics via `admin-builds`, not player submissions.
- Blocker/next step: implement a real authenticated player-submissions table/Storage path plus owner review actions if the queue is required. No product code was changed for this diagnosis.

### 2026-10-04 Cosmetic submission queue claim (in progress)

- Codex owns the cosmetic submission workflow for this task: `js/pages/u/blob/submit-cosmetic-modal.js`, `js/pages/admin/api.js`, `js/pages/admin/tab-cosmetics.js`, `supabase/functions/cosmetic-submissions/`, `supabase/config.toml`, the new cosmetic-submission migration/detail documentation, affected legal pages, and this handoff. The existing official-catalog `admin-builds` pipeline remains owner-gated and will not be weakened.
- Codex also owns the associated public endpoint entries in `js/shared/config.js`, `js/shared/config.example.js`, and `scripts/write-config.mjs` for this task. The publishable Supabase key remains the only browser-visible credential.

### 2026-10-04 Cosmetic submission queue complete

- Applied `20261004000000_cosmetic_submissions.sql` to the linked Supabase project and deployed `cosmetic-submissions`. It creates the private `cosmetic_submissions` table and `cosmetic-submissions` Storage bucket, extends the server-only rate-limit allow-list, and grants no direct browser table/object access.
- Player submits now require a valid Discord JWT, PNG/WebP magic bytes, bounded metadata and a 2 MB image, and have a three-per-24-hour account limit. Artist credit comes from the server-side profile, not the browser.
- The Admin Cosmetics pending/approved/rejected queue is live. Only a fresh verified-owner JWT can list, approve, or reject. Approval copies the asset to public `cosmetic-assets`, creates a published Starter `cosmetic_drops` row, and leaves the existing bot announcement flow intact; rejection stays private.
- Validation: all touched browser modules pass `node --check`; Supabase accepted the migration/function deployment; unauthenticated Edge calls and direct `cosmetic_submissions` REST reads both return 401. A full signed-in submit/owner-approve UI smoke still requires the owner to exercise it in the browser after the Pages deploy.

### 2026-10-04 Cosmetic tooltip audit and publish (in progress)

- Audited every cosmetic-tooltip entry point: Blob wardrobe, Inventory, Premium comparison, and Admin Cosmetics all use `bindCosmeticTooltips` / `cosmeticToTooltipItem` in `js/pages/u/blob/cosmetic-tooltip.js`. Catalog normalization preserves both `artist` and `owner`; the static catalog, public catalog Edge Function, owner drafts, and approved player-submission path all supply artist data.
- The local tooltip change correctly removes the cosmetic-ID line and renders `Created by: <artist>` (falling back to owner only when artist is absent), but it is an unpushed working-tree change. The public site still serves the older tooltip containing `Cosmetic ID`, so this task is publishing that focused renderer change only.

### 2026-10-04 Cosmetic tooltip audit and publish complete

- Published the shared renderer in commit `c5d3320` (`Show cosmetic artist credit in tooltips`). A deterministic renderer assertion confirms no `Cosmetic ID` line, artist-first `Created by`, and no owner leakage when an artist exists.
- GitHub Pages deployment for `c5d3320` completed successfully. Public verification of `https://bpbbuilds.com/js/pages/u/blob/cosmetic-tooltip.js` confirms `Cosmetic ID` is absent and `Created by:` is present.

### 2026-10-04 Cosmetic tooltip value restoration claim (in progress)

- Codex owns `js/pages/u/blob/catalog.js`, the focused tooltip-value validation, and this handoff for this task. Audit found the shared tooltip renderer already supports a gold worth row, but the public `cosmetic-catalog` response has `cost: null` for both current rows; remote merge currently overwrites a bundled numeric fallback such as Premium Crown's `0` with that null. The fix will preserve a known numeric bundled value when live catalog metadata omits it, without inventing values for server-only cosmetics.

### 2026-10-04 Cosmetic tooltip value restoration complete

- Cosmetics now always normalize missing cost metadata to `0`, the catalog's established “not buyable/sellable” value, so every cosmetic tooltip renders the gold value row. A real server-assigned numeric value continues to win unchanged.
- Live catalog merges now preserve bundled artist, owner, date, and numeric value when an older server catalog row leaves them blank/null. This restores both Premium Crown's `0` gold value and its `Created by` credit without fabricating metadata for new server-only cosmetics.
- Validation: `node --check` passes and an isolated module assertion confirms zero-value fallback plus artist/owner retention.

### 2026-10-04 Premium Crown rarity change claim (in progress)

- Codex owns the Premium Crown catalog metadata for this task: `assets/data/blob-cosmetics.json`, the new Supabase rarity migration, and this handoff. The change is metadata-only; no entitlement, grant, inventory, or tooltip behavior is being altered.

### 2026-10-04 Premium Crown rarity change complete

- Updated the bundled Premium Crown rarity to `Unique` and applied `20261004010000_premium_crown_unique.sql` to Supabase.
- Live `cosmetic-catalog` verification returns `premium_crown.rarity = Unique`; grants, ownership, value, artist, and inventory behavior were unchanged.

### 2026-10-04 Cosmetic tooltip item-only preview claim (in progress)

- Codex owns `js/pages/u/blob/fit-item-icon.js`, `js/pages/u/blob/cosmetic-tooltip.js`, the focused preview smoke check, and this handoff for this task. The wardrobe/equip renderer remains unchanged: blob-aligned full-canvas images are still required there; only tooltip previews will be cropped to the cosmetic's visible pixels.
- Audit found the existing crop helper fails for Supabase-hosted cosmetic images because it does not request anonymous CORS access before drawing to a canvas. That makes remote Cool Shades fall back to its full blob-aligned canvas while same-origin Premium Crown already appears item-only. The fix will enable CORS-safe loading for remote images and refresh an active tooltip when its asynchronous crop becomes available.

### 2026-10-04 Cosmetic tooltip item-only preview complete

- `cropSrcToContent` now requests anonymous CORS access for HTTP(S) cosmetic assets before canvas inspection, so Supabase-hosted uploads can be cropped instead of falling back to their blob-aligned source canvas.
- Tooltip crop warming now refreshes an active hover when the asynchronous crop finishes. This makes the first hover converge to the item-only preview, while later uploads receive the same behavior automatically. Wardrobe/equip previews remain unchanged and continue using their full blob-aligned images.
- Browser smoke verification against the live Cool Shades asset produced a cropped 28x8 PNG from its 128x128 source canvas; Premium Crown also produced a cropped item-only preview. Both touched modules pass `node --check`.

### 2026-10-04 Original cosmetic owner tooltip credit claim (in progress)

- Codex owns `js/pages/u/blob/cosmetic-tooltip.js` and this handoff for this focused renderer change. The existing catalog `owner` field is the original uploader/owner metadata, while `artist` is the creator credit; the tooltip will show both when they are different and avoid duplicating the same name.

### 2026-10-04 Original cosmetic owner tooltip credit complete

- Cosmetic tooltips now render `Created by: <artist>` plus `Original owner: <owner>` whenever catalog owner metadata exists. The owner line is preserved even when the creator and owner are the same, so provenance is never hidden; rows without owner metadata keep the existing artist credit.
- The public catalog response supplies owner metadata for Cool Shades, and the bundled Premium Crown metadata supplies it as well. `cosmetic-tooltip.js` passes `node --check` and a focused renderer assertion confirms both lines are included and escaped by the existing tooltip renderer.

### 2026-10-04 Cosmetic catalog workflow and admin grid claim (in progress)

- Codex owns the cosmetic catalog/admin paths for this batch: `assets/data/blob-cosmetics.json`, `assets/blob/cosmetics/cool-shades.png`, `js/pages/admin/tab-cosmetics.js`, `js/pages/admin/admin.css`, `js/pages/admin/api.js`, `js/shared/cosmetic-upload-modal.js`, `js/shared/cosmetic-upload-modal.css`, `supabase/functions/admin-builds/`, `supabase/functions/cosmetic-submissions/`, the catalog migration, and this handoff.
- The requested workflow is: approval copies player art into the owner-visible catalog as `published = false`; an owner can edit metadata/acquisition before publishing; only `published = true` rows reach the public catalog and Discord announcement. Cool Shades will be Founding-only in both static fallback and live database metadata. Premium Crown's existing `Unique` rarity remains unchanged.

### 2026-10-04 Cosmetic catalog workflow and admin grid complete

- Added Cool Shades to the tracked static catalog/art assets as a Founding-only Unique cosmetic and applied the live database update (`20261004020000_cool_shades_founding.sql`). Public catalog verification returns `cool_shades.grant = founding` and `starter = false`; Premium Crown remains Unique.
- Player submission approval now creates an unpublished catalog draft. The public catalog Edge Function and Discord bot continue to consume only `published = true` rows, so approval no longer announces or exposes the cosmetic through the live wardrobe until the owner publishes it.
- Added owner-only draft editing for name, slot, acquisition grant, rarity, artist, original owner, value, description, and optional replacement art. Publishing is server-validated and only allowed for an existing unpublished draft; direct unauthenticated admin/submission calls still return 401.
- Replaced the Admin Cosmetics Live catalog line list with an inventory-style responsive grid, added Draft/Published state and Edit controls, and matched the catalog/queue surfaces to the existing dark gold-edged admin form treatment. Browser modal smoke confirmed metadata-only draft edits submit without requiring a replacement image.
- Validation: browser module smoke, `node --check` for all touched JS modules, JSON parse, `git diff --check`, Supabase migration push, and deployment of `admin-builds` and `cosmetic-submissions` completed successfully.

### 2026-10-04 Admin tab navigation race claim (in progress)

- Codex owns `js/pages/admin/shell.js` and this handoff to prevent stale asynchronous tab mounts from committing into the currently selected Admin tab. Existing cosmetic auth context changes in `shell.js` will be preserved.

### 2026-10-04 Admin tab navigation race complete

- Admin stage mounts now use a fresh stage element for each tab request. The previous stage is detached before its async loader runs, so a slower Overview/Reports/etc. request can only finish in its detached node and cannot overwrite the newer tab's live content.
- Reload, unauthorized, and panel-driven tab-change callbacks are scoped to the latest request as well; stale requests cannot trigger a second repaint after the user has switched tabs.
- Preserved the existing cosmetic upload auth context change in `shell.js`. Validation: `node --check js/pages/admin/shell.js` and `git diff --check` pass.

### 2026-10-04 Wave D syntax repair claim (in progress)

- Codex owns `js/pages/sim/engine/scripts/ports-wave-d-unique.js` and this handoff to repair the malformed uncommitted Wave D module that blocks the Events/Simulator page at parse time. Existing simulator behavior will be restored from the last valid complete registry rather than replaced with a partial workaround.

### 2026-10-04 Wave D syntax repair complete

- Restored the complete ten-handler Wave D registry and removed the accidental source-line prefixes/partial rewrite that caused `Unexpected number` at the `useMana` import. No event-page behavior was changed beyond making the existing valid module loadable.
- Validation: `node --check`, a real ESM import with all ten registry entries, `node scripts/sim-wave-d-smoke.mjs`, and `git diff --check` pass.

### 2026-10-04 Wand of Dissonance and Rib Saw Blade port claim (in progress)

- Codex owns `js/pages/sim/engine/scripts/ports-wave-d-unique.js`, `js/pages/sim/engine/scripts/ports-ap-perm.js`, the focused item smoke, the simulator validation note/backlog status for these two rows, and this handoff. The source-led work will cover Wand of Dissonance's prepare-time effect factor and effect-damage lifecycle, plus Rib Saw Blade's retained opponent-weapon purge and on-hit bonus. Existing unrelated simulator work remains protected.

### 2026-10-04 Wand of Dissonance and Rib Saw Blade port complete

- Wand of Dissonance now runs its source `onPrepare` behavior against the affected Dark items, applying the spell double-factor to the owner's effect damage. Its cooldown chain uses the source health gate, base descriptor damage, effect-damage scaling, max-stack random selection among Mana/Lucky/Regeneration, and causal parent IDs for the health → effect → buff chain. Self-health costs have a dedicated Combat Log sentence and are excluded from Damage Dealt totals.
- Rib Saw Blade now snapshots only the opposing empowerable weapons during `onPrepare`, purges only removable `addBonusDamage` damage on a hit, and adds its own removable hit bonus. Base and permanent/catalog damage are preserved. Katana's inherited Rib Saw prepare behavior now uses the same target snapshot.
- Added `scripts/sim-wand-rib-smoke.mjs`, registered it in the continuous simulator audit, and updated the source parity hook map to recognize the simulator's explicit `onPrepare` lifecycle. The two backlog rows and validation disclosure are marked complete.
- Validation: focused Wand/Rib smoke (including both player/opponent Wand paths and Katana inheritance), `node scripts/sim-wave-d-smoke.mjs`, `node scripts/sim-log-smoke.mjs`, full `node scripts/sim-continuous-audit.mjs --check` (14/14), syntax checks, and ledger regeneration/check all pass. No live game capture was available; source extract behavior is the authority for these ports.

### 2026-10-04 Ace of Spades and Armored Courage Puppy source-resolution claim (in progress)

- Codex owns the source-resolution and simulator-port paths for `ace_of_spades` and `armored_courage_puppy`: the exact extracted item scripts and inherited bases are read-only evidence, while any implementation work is limited to the corresponding simulator script module(s), a focused regression smoke, `scripts/sim-continuous-audit.mjs` registration if needed, the fidelity ledger/backlog, and this handoff.
- The audit will resolve each GDScript inheritance chain and lifecycle hook before changing coverage status. Existing unrelated simulator and worktree changes remain protected; no source extracts, shared package files, or other item ports will be rewritten.

### 2026-10-04 Ace of Spades and Armored Courage Puppy source-resolution complete

- Resolved `AceofSpades.gd` → `Card.gd` and `Exclusive/ArmoredCouragePuppy.gd` → `Exclusive/CouragePuppy.gd` in the simulator inventory. The ledger now records direct/inherited hooks, source helper methods, and Armored Puppy’s `CanTriggerItems`/`CanTriggerSpikes` setup flags; both rows are source-ported with deep coverage and no lifecycle gaps.
- Corrected Ace of Spades to grant one actor crit token per reveal (with the source odd-chain Lucky/Spikes secondary), reset card reveal state during prepare, emit HUD stat updates, and consume crit tokens as guaranteed next-attack criticals. Armored Courage Puppy now suppresses spikes and item-listener reactions on its strike, matching its extracted `DamageSource` flag removal; its focused smoke also runs the inherited linked-pet bonus through the real engine.
- Added `scripts/sim-ace-puppy-smoke.mjs` and registered it in the continuous audit. It covers source inheritance metadata, card-chain/secondary behavior, token consumption, and Armored Puppy damage flags.
- Updated the two backlog rows and regenerated the fidelity ledger/baseline. Validation: focused smoke, `node scripts/sim-continuous-audit.mjs --check` (15/15), ledger `--check`, patch-drift check, syntax/import checks, and touched-path diff checks pass. A repository-wide `git diff --check` still reports pre-existing whitespace in unrelated dirty bot/docs files; no such whitespace was introduced in the touched simulator paths. No live game capture was available; extracted source remains the authority for these rows.

### 2026-10-04 disabled screenshot UI removal complete

- Removed the disabled screenshot/media button and its onboarding event/options from the Create page. The desktop `history.db` loader remains available; mobile onboarding no longer leaves an empty upload block behind. Screenshot detector code, assets, feature flag, and paused server path were intentionally preserved.
- Removed `Screenshot to build` from the shared Premium comparison, updated the Premium offer copy, and removed the same stale feature from the Discord Premium announcement.
- Validation: `node --check` passes for the touched Create, Premium, and bot modules; targeted `git diff --check` passes; repository search finds no remaining `Screenshot to build` Premium copy or removed media UI selectors. No commit or push was requested.

### 2026-10-04 admin-selected event winners complete

- Added a manual winner panel to the Admin Events desk only when that event has Voting turned off. Owners can select a verified entry, replace the selection with another entry, or clear it; vote-enabled events never render these controls.
- Added private `event_winners` persistence. The deployed owner-only `admin-builds` actions validate the owner session, a bounded event slug, and that the selected build is an entry for that same event before upserting. The table has RLS enabled with no anon/authenticated grants; it records the selected build, timestamp, and verified selecting owner.
- Applied migration `20261004030000_event_winners.sql` to the linked project and deployed `admin-builds`. Validation: JavaScript syntax checks, targeted diff check, remote migration dry run (up to date), deployed unauthenticated winner-write rejection (`401`), and anonymous direct-table read rejection (`401`/permission denied) all pass. The user-facing admin control still needs the normal site GitHub Pages commit/publish before it appears live; no commit or push was requested.
- Reviewed and updated About, Terms, and Privacy for the owner-selected no-vote event result record; their October 4, 2026 dates remain current.

### 2026-10-04 public event winner display claim (in progress)

- Codex owns the public event winner display paths for this task: `js/pages/events/detail-tabs.js`, `js/pages/events/event-features.js`, `js/pages/events/event-detail.js`, the new public winner client module and event CSS additions, `js/pages/admin/event-winner.css`, the read-only `event-winner` Edge Function/config entries, `docs/pages/events/launch-event.md`, and this handoff. The existing private winner table and owner-only write endpoint remain unchanged.

### 2026-10-04 public event winner display complete

- Added a Winner tab to no-vote event details. It loads a read-only, slug-validated `event-winner` function and shows the selected public build, creator avatar/blob, selection date, and a link to the full build; private or unreleased entries remain hidden.
- Added the public function/config route without granting browser access to `event_winners` or exposing `selected_by`; the endpoint only returns a result after the selected build is `is_public = true`. Deployed `event-winner` and verified the live endpoint returns a safe `{ winner: null }` response for `highest-dps` before a public winner exists.
- Added the admin winner stylesheet link and event-page cache bump. Validation: touched JavaScript syntax checks, source assertions, `git diff --cached --check`, live Edge Function smoke, and secret-pattern scan passed. Published in commit `3bd68b9` on `main`; the owner-authenticated selection path still needs the owner to exercise it in the browser after Pages deploy.

### 2026-10-04 blob walk-names claim (in progress)

- Codex owns `js/pages/overlay/blobs.js`, `js/pages/overlay/blobs.css`, the focused overlay smoke check, and this handoff for repairing the Walk Names browser-source view. The existing row/low/pop/walk/grid/float behavior remains unchanged.

### 2026-10-04 blob walk-names complete

- Walk Names now uses the same absolute walking/turning animation as Walk while retaining each player's caption. Captions are raised into the transparent frame instead of being clipped below the viewport, and reduced-motion selectors cover both walking variants.
- Validation: JavaScript syntax checks, CSS/source assertions, and targeted `git diff --check` pass. Published in commit `d04e38e` on `main`; no database or profile behavior changed.

### 2026-10-04 seamless blob cast loop claim (in progress)

- Codex owns `js/pages/overlay/blobs.js`, `js/pages/overlay/blobs.css`, the focused overlay animation validation, and this handoff for making animated blob cast views safe for seamless video loops. The existing view selection, profile loading, captions, and reduced-motion behavior remain protected.

### 2026-10-04 seamless blob cast loop complete

- Float and Walk/Walk Names overlay views now loop cleanly for video capture. Float uses a closed bob cycle with stable negative phase offsets; walkers enter from beyond the left edge and leave beyond the right edge, so the animation reset occurs while they are invisible instead of visibly teleporting or flipping at the boundary. Reduced-motion positioning and existing captions remain unchanged.
- Validation: `node --check js/pages/overlay/blobs.js`, focused CSS/source assertions, and staged `git diff --check` pass. Published in commit `7e7d97c` on `main`; no database, profile, or website behavior changed.

### 2026-10-04 blob cast video export claim (in progress)

- Codex owns `js/pages/overlay/blob-video.js`, `js/pages/overlay/blobs.js`, `js/pages/admin/tab-overlay.js`, `js/pages/admin/admin.css`, `admin/index.html`, focused overlay export validation, and this handoff for adding one-loop transparent WebM downloads beside the view controls. Existing browser-source URLs and live overlay rendering remain protected.

### 2026-10-04 blob cast video export complete

- Added a download icon beside every Blob Cast view. Each action renders the current cast to a transparent 2560×1440 canvas and downloads a VP9 WebM loop; Pop/Walk/Walk Names/Float use their animation duration, while static Row/Low/Grid views use a one-second loop. The renderer preserves blob cosmetics and Walk Names captions without recording the admin iframe or adding a background.
- Added VP9 capability detection, progress/error status, accessible labels, disabled-state feedback, and a cache-busted Admin stylesheet. Validation: touched-module syntax checks, staged diff checks, and focused export/source assertions pass. A browser with VP9 MediaRecorder support is required for transparent WebM export. Published in commit `75a26e5` on `main`.

### 2026-10-04 blob walk caption orientation claim (in progress)

- Codex owns `js/pages/overlay/blobs.css`, `js/pages/overlay/blob-video.js`, focused overlay animation validation, and this handoff for keeping Walk Names captions upright when a walker turns at an edge. The existing seamless loop, caption placement, and video export behavior remain protected.

### 2026-10-04 blob walk caption orientation complete

- Walk and Walk Names now turn only while outside the visible frame. The animated walker exposes its facing direction through a CSS variable, and Walk Names captions apply the synchronized counter-scale so names remain readable instead of mirroring. The transparent video renderer follows the same back-and-forth path and blob facing state.
- Validation: `node --check js/pages/overlay/blob-video.js`, focused CSS/source assertions, and staged `git diff --check` pass. Published in commit `a58d50d` on `main`.

### 2026-10-04 blob cast walk animation restore claim (in progress)

- Codex owns `overlay/blobs/index.html`, `js/pages/overlay/blobs.css`, the focused overlay check, and this handoff for restoring the current Walk and Walk Names animation in the Admin Blob Cast preview and browser-source URL. The existing transparent layout, view controls, caption orientation, and reduced-motion preference behavior remain unchanged.

### 2026-10-04 blob cast walk animation restore complete

- The overlay source already contained the Walk and Walk Names pace/step animations, but its fixed asset URLs still used an old cache stamp. Updated the overlay CSS and module stamps so the Admin iframe and copied browser-source URL fetch the current walk animation instead of retaining an older cached overlay asset.
- Validation: overlay module syntax checks, a headless-browser computed-style check for both `blob-cast-walk` and `blob-cast-step`, and targeted `git diff --check` passed. No database or profile behavior changed; no commit or push was requested.

### 2026-10-04 Premiere-compatible blob cast transparency claim (in progress)

- Codex owns `js/pages/overlay/blob-video.js`, `js/pages/admin/tab-overlay.js`, `js/pages/admin/admin.css`, `admin/index.html`, the focused export validation, and this handoff for giving Blob Cast downloads a Premiere-compatible transparent export path. Existing WebM downloads, alpha canvas rendering, view timing, and browser-source overlay behavior remain protected.

### 2026-10-04 Premiere-compatible blob cast transparency complete

- Confirmed that the existing VP9 WebM canvas capture declares `AlphaMode=1`; the black rectangle in Premiere is its WebM alpha-import limitation, not a painted canvas background.
- Kept the compact WebM arrow for browser/OBS use and added a clearly labelled PNG action beside every Blob Cast view. It writes the exact one-loop, 2560×1440, 30 fps RGBA PNG sequence into a user-selected `bpb-blob-cast-<view>-png-sequence` folder without retaining the full sequence in memory. The folder contains an import README; Premiere should import the first file as a 30 fps Image Sequence, which preserves transparency.
- Added the required Admin cache stamps so the updated control/module/CSS load immediately. Validation: touched JavaScript syntax checks, a headless VP9 alpha-mode capture check, static export/control assertions, and targeted `git diff --check` passed. No database or profile behavior changed; no commit or push was requested.

### 2026-10-04 event winner tab visibility claim (in progress)

- Codex owns `js/pages/events/event-features.js`, `js/pages/events/event-winner.js`, `js/pages/events/catalog.js`, focused event-tab validation, and this handoff for hiding the public Winner tab until a public winner result exists. Existing owner selection, private winner persistence, and winner rendering remain protected.

### 2026-10-04 event winner tab visibility complete

- Event details now query the public winner endpoint before adding the Winner rail tab. Until a public winning build is returned, the tab is omitted; once a result exists, the detail view refreshes and exposes the existing winner card. Voting events remain unaffected, and private/unpublished selections stay hidden by the endpoint contract.
- Validation: event-module syntax checks and focused diff checks pass. Published in commit `2f0decf` on `main`.

### 2026-10-04 history item recovery claim (in progress)

- Codex owns the history decode catalog builder/data, history decoder, history run list/preview/apply paths, event history submission validation, a focused history recovery check, and this handoff for the missing-item investigation.
- Scope: preserve unreleased-item policy while allowing history.db items that are absent from the live catalog to decode and render.
- Next step: add a catalog fallback and regression checks after confirming the exact game/catalog gap.

### 2026-10-04 history item recovery complete

- Traced the history.db path from bit decoding through run rows, preview grid, draft apply, and event submission. The generated catalog was stale: it omitted game gid `331` (`book_of_ice_new`) and did not include the current gid `518` mapping for `time_pendant`; the live DB intentionally excludes the unreleased Book of Ice row, so the decoder silently dropped it.
- Rebuilt `assets/data/history-decode-catalog.json` from the current game extract and added a `historyOnly` fallback for game items absent from the published layout. History flows now hydrate those fallback records into the runtime map before list/search/preview/apply/submit, without adding them to the normal Items catalog or bypassing publish validation. Unknown gids are now reported instead of silently disappearing.
- Added `scripts/test-history-catalog-recovery.mjs`, covering the game-only fallback, gid 331 synthetic bit-frame decode, and runtime map hydration. Validation: catalog regeneration, focused recovery check, history-picker Playwright smoke, touched-module syntax checks, and targeted diff checks pass. No secrets or database rows were changed.

### 2026-10-04 admin event entry previews and schedule draft claim (in progress)

- Codex owns `js/pages/admin/event-desk.js`, `js/pages/admin/admin.css`, `js/pages/builds/board-thumbs.js`, `supabase/functions/admin-builds/index.ts`, `js/pages/events/event-drafts.js`, `js/pages/events/catalog-data.js`, `scripts/test-event-schedule-draft.mjs`, and this handoff for this task.
- Scope: render submitted board previews in the owner event desk (including baked stills from older entries) and propagate edited event schedule fields into live status/countdowns. No public authorization or winner persistence changes are in scope.

### 2026-10-04 admin event entry previews and schedule draft complete

- The Admin Events detail desk now renders each submitted build's board from its stored placements, with a baked `board_still_path` fallback for older entries that have no placement rows. The owner-gated `admin-builds` function returns the placements and still path; it was redeployed after the change.
- Event-form edits now flow through the catalog/list/featured/detail event paths before live status and countdown calculation, so changing an entry-close date immediately changes Accepting entries/Judging/Ended state and its timer target.
- Validation: focused schedule-draft recovery test, JavaScript syntax checks for all touched modules, targeted `git diff --check`, and Supabase `admin-builds` deployment passed. Published in commit `c52fcd0`; the GitHub Pages site still needs its normal Pages build to serve the browser changes.

### 2026-10-04 cosmetic original-owner context claim (in progress)

- Codex owns `js/pages/u/blob/cosmetic-tooltip.js`, `js/pages/u/blob/wardrobe.js`, `js/pages/u/tab-inventory.js`, and this handoff for this focused tooltip-context change.
- Scope: keep creator/artist metadata available everywhere, but render `Original owner` only for user-owned inventory/equipped cosmetic views. Catalog, Admin Cosmetics, Premium comparison, and event prize views remain catalog-only and omit ownership provenance.

### 2026-10-04 cosmetic original-owner context complete

- Cosmetic tooltip rendering now defaults to catalog-safe metadata: Admin Cosmetics, Premium comparison, and event prize/catalog views show creator details but omit `Original owner`. The profile Inventory and Blob wardrobe explicitly enable the ownership line for the user-owned/equipped context.
- No ownership data model or catalog values changed; this only prevents catalog-level pages from implying that their rows are owned instances.
- Validation: owner-context renderer assertion, `node --check` for all touched modules, and targeted `git diff --check` passed. Changes are local and ready for the normal Pages commit/publish; no push was requested.

### 2026-10-04 official cosmetic publication-state claim (in progress)

- Codex owns `js/pages/admin/tab-cosmetics.js` and this handoff for repairing the Admin Cosmetics Published/Draft indicator.
- Scope: trust the authoritative `published` flag returned by the owner catalog and treat bundled official fallback rows as published until a live owner row explicitly marks them as drafts. No cosmetic grants, database rows, or publish authorization rules will be weakened.

### 2026-10-04 official cosmetic publication-state complete

- Confirmed the live public catalog already returns both `premium_crown` (`grant: premium`) and `cool_shades` (`grant: founding`) as published rows. The Admin indicator was relying only on a separate published-ID request, so a failed/stale response made valid catalog items appear as drafts.
- Admin Cosmetics now trusts the owner catalog's explicit `published` field and treats bundled official fallback rows as published unless a live row explicitly marks them as drafts. This keeps the Publish action disabled for both official cosmetics while preserving draft handling for new uploads/submissions.
- Validation: `node --check js/pages/admin/tab-cosmetics.js`, targeted diff check, and live public `cosmetic-catalog` verification passed. Published in the next commit; existing unrelated worktree changes remain untouched.

### 2026-10-04 event judging entry gate and dynamic schedule claim (in progress)

- Codex owns `js/pages/events/event-detail.js`, `js/pages/events/enter-wizard.js`, `js/pages/events/event-drafts.js`, `js/pages/events/events.css`, `scripts/test-event-schedule-draft.mjs`, and this handoff for this event lifecycle fix.
- Scope: hide the Enter event CTA and refuse the onboarding/submit path once the live event schedule reaches judging, and render the Overview Schedule section from `event.schedule` rather than fixed prose. Admin session-draft behavior remains unchanged.

### 2026-10-04 event judging entry gate and dynamic schedule complete

- The public event detail now removes the Enter event button once entries are closed, shows a judging/closed status message, and the wizard refuses both late opens and a submit if the schedule crosses into judging while it is open.
- Overview Schedule facts now render from the normalized event schedule, including admin-edited entry-close/end dates, instead of the original hard-coded catalog dates.
- Validation: schedule/status regression test, entry-open gate assertions, JavaScript syntax checks, and targeted whitespace checks passed. Published in the next commit; existing unrelated worktree changes remain untouched.

### 2026-10-04 held event build avatar claim (in progress)

- Codex owns `js/pages/builds/feed.js`, the focused held-entry avatar regression check, and this handoff for restoring profile/blob data on the Builds feed's owner-only event entries.
- Scope: make the private event-entry query hydrate the same Discord avatar/blob loadout fields as public build rows. No visibility, RLS, or event release behavior changes are in scope.

### 2026-10-04 held event build avatar complete

- The Builds feed's owner-only held-entry query now selects the author profile relation (`discord_id`, `display_name`, `avatar_url`, and `equipped_avatar`), so the existing face renderer can show the user's Discord picture or blob instead of falling back to initials.
- Validation: `node --check js/pages/builds/feed.js` and targeted `git diff --check` pass. No visibility, RLS, event-release, or database behavior changed. No commit/push was made.

### 2026-10-04 simulator held-build privacy claim (in progress)

- Codex owns `js/pages/sim/foe/sim-build-browser.js`, `js/pages/sim/shell/board-load.js`, `js/pages/sim/foe/sim-build-browser.css`, focused simulator privacy checks, and this handoff for allowing an entrant to use their own held event build without exposing it to other simulator users.
- Scope: add owner-only held entries to the picker with a private indicator and make direct simulator slug loading follow Supabase/RLS ownership. Public-build behavior and event release timing remain unchanged.

### 2026-10-04 simulator held-build privacy complete

- The simulator build picker continues to load public builds for everyone, and now adds the signed-in author's `event_held` entries through an author-scoped query. Those cards show `Only visible to you`; private non-event builds are not added to the picker.
- Direct `?oppSlug=` loading now tries the public row first, then the current author's own row. Supabase RLS remains the authorization boundary, so another user cannot load a held entry by guessing its slug.
- Validation: simulator/browser-loader syntax checks, targeted source privacy assertions, and `git diff --check` pass. The existing Playwright picker audit could not reach the simulator HUD within 30 seconds in this environment, so no browser screenshot smoke result is claimed. No database or event schedule behavior changed. No commit/push was made.

### 2026-10-04 admin winner desk UX claim (in progress)

- Codex owns `js/pages/admin/event-desk.js`, `js/pages/admin/event-winner.css`, `admin/index.html`, and this handoff for repairing the manual event-winner selection interaction and aligning its module with the existing admin form visual system.
- Scope: preserve the owner-only winner API and authorization, remove selection-state flicker, expose clear saving/error/selected states accessibly, and make the winner controls responsive and form-styled. No backend, RLS, event lifecycle, or unrelated admin behavior changes are in scope.

### 2026-10-04 admin winner desk UX complete

- The no-vote Events desk now renders a form-style manual judging well with an explicit state badge, live status, accessible busy/error state, and a responsive clear action. Selected entries receive a highlighted row and winner badge; winner/view actions remain usable on narrow panels.
- Winner selection and clearing now repaint once before saving and once after the request settles, removing the previous intermediate repaint/flicker that made the module appear broken while preserving the existing owner-only `set_event_winner`/`clear_event_winner` API path.
- Validation: `node --check js/pages/admin/event-desk.js`, focused source/CSS assertions, cache-bust verification, and targeted `git diff --check` passed. No backend, RLS, event lifecycle, or unrelated admin behavior changed. No commit/push was made.

### 2026-10-04 Badger Rune and Bagtacular simulator port claim (in progress)

- Codex owns `js/pages/sim/engine/damage.js`, `js/pages/sim/engine/gem-sockets.js`, `js/pages/sim/engine/pieces.js`, `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/scripts/ports-ao-skills.js`, `js/pages/sim/engine/scripts/ports-ak-bags.js`, `js/pages/sim/engine/scripts/ports-consumable.js`, `js/pages/sim/engine/scripts/ports.js`, `scripts/extract-sim-item-inventory.mjs`, the focused Badger/Bagtacular regression script, the generated simulator inventory/ledger artifacts, the simulator port backlog/validation notes, and this handoff for this task.
- Scope: resolve the authoritative `Exclusive/BadgerRune.gd` and `Exclusive/Bagtacular.gd` source records, align Badger Rune's mode-specific prepare/attack/pre-damage behavior and Bagtacular's bag modifier lifecycle, add player/opponent regression coverage, and update the backlog only after the source and runtime audits pass. No unrelated simulator ports or website behavior are in scope.

### 2026-10-04 Badger Rune and Bagtacular simulator port complete

- Source inventory now records the exact `Exclusive/BadgerRune.gd` and `Exclusive/Bagtacular.gd` inheritance/method surfaces. Badger Rune is ported for inventory stamina reduction, socketed weapon hit-speed growth, and battle-rage armor flat reduction at the `pre_take_damage` phase. Bagtacular is represented as a presence-only global modifier with the source values for Fanny Pack speed, Stamina Sack regeneration, Potion Belt buffs, and Protective Purse block; it no longer emits a fabricated activation.
- Added `scripts/sim-badger-bagtacular-smoke.mjs` covering source records, loose/socketed gems, both actor sides, bag modifier deltas, and absence of a standalone Bagtacular activation. Checked both backlog rows and added the source/evidence notes to `docs/sim/sim-validation.md`; regenerated the simulator inventory and fidelity ledger artifacts.
- Validation: focused smoke passed; all touched-module syntax checks and targeted whitespace checks passed; GDScript parity audit passed with zero untriaged/stale hook gaps; fidelity ledger check passed. The broader continuous audit is 15/16 because the existing worktree still has an unacknowledged patch-drift baseline covering 24 source-script changes (including unrelated prior work); that baseline was not rewritten here. No commit or push was made.

### 2026-10-04 Book of Ice New and Chipped Amethyst simulator port claim (in progress)

- Codex owns `js/pages/sim/engine/scripts/ports-ao-spells.js`, `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/gem-sockets.js`, `scripts/extract-sim-item-inventory.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the focused Book/Amethyst regression script, generated simulator inventory/ledger artifacts, the simulator port backlog/validation notes, and this handoff for this task.
- Scope: resolve the scene-to-script source aliases for `BookofIceNew.tscn` and `ChippedAmethyst.tscn`, verify inherited Book of Ice and Amethyst behavior, correct any lifecycle/causal ordering gaps, add player/opponent regression coverage, and update the backlog only after source/runtime audits pass. No other gem tiers or unrelated spell ports are in scope.

### 2026-10-04 Book of Ice New and Chipped Amethyst simulator port complete

- Source inventory now resolves `BookofIceNew.tscn` → `Exclusive/BookofIce.gd` and `ChippedAmethyst.tscn` → `Gems/Amethyst.gd`, including their inherited `Item`/`Gem` surfaces. The fidelity ledger now records the scene aliases and both rows are source-ported/deep with no lifecycle or call-audit gaps.
- Book of Ice ports now run linked-spell speed in `onPrepare` before the first cooldown arm, preserve the mana gate, apply Cold with source attribution, and activate after the effect (including insufficient-mana and opponent paths). Chipped Amethyst preserves inherited inventory cleanse-before-activation ordering and socketed weapon/armor behavior for both sides.
- Added `scripts/sim-book-amethyst-smoke.mjs`, checked both backlog rows, and documented the source/evidence closure in `docs/sim/sim-validation.md`. Focused Book/Amethyst, loose-gem, and prior Badger/Bagtacular smokes passed; syntax and whitespace checks passed; GDScript hook and call audits plus ledger check passed. The broader continuous audit remains 15/16 because patch drift is still unacknowledged for a 26-row wave (24 pre-existing rows plus these two); the baseline was not rewritten. No commit or push was made.

### 2026-10-04 Chipped gem, Darkest Lotus, and Elephant Rune simulator port claim (in progress)

- Codex owns `js/pages/sim/engine/scripts/ports-an-gems.js`, the narrow family module for the requested gem/rune handlers, `scripts/extract-sim-item-inventory.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the focused regression script, generated simulator inventory/ledger artifacts, the simulator port backlog/validation notes, and this handoff for this task.
- Scope: audit `chipped_emerald`, `chipped_ruby`, `chipped_sapphire`, `chipped_topaz`, `darkest_lotus`, and `elephant_rune` against the authoritative scene/script sources, correct only source-proven lifecycle or event gaps, add player/opponent regression coverage, and update the backlog only after audits pass. No unrelated simulator or website paths are in scope.

### 2026-10-04 Chipped gem, Darkest Lotus, and Elephant Rune simulator port complete

- Source inventory now resolves all six requested rows, including the Chipped
  gem scene aliases, `DarkestLotus.tscn`, and `Exclusive/ElephantRune.tscn`.
  The fidelity ledger records all six as deep, source-ported handlers with no
  lifecycle or call-review candidates.
- Loose Chipped Emerald/Ruby/Sapphire inventory effects now preserve source
  effect/consume order and opponent-side event attribution. Chipped Topaz uses
  the source `prepareInventory` stamina-regeneration phase. Shared socket
  handling covers the four gem prepare modes and Elephant Rune's weapon stun,
  while Elephant armor debuff resistance is timed to `dur_resist` and expires.
- Darkest Lotus now follows the Card trigger order: next-card state, then
  chain-scaled mana and hostile buff removal, then activation. The shared
  socket call audit now includes `gem-sockets.js` for Gem source-call evidence;
  the extractor also records the Elephant lifecycle methods without duplicating
  Ace of Spades overrides.
- Added `scripts/sim-chipped-gems-lotus-elephant-smoke.mjs` with player and
  opponent, inventory and socket, state, causal-order, and timed-resistance
  assertions. Checked all six backlog rows and documented the evidence in
  `docs/sim/sim-validation.md`.
- Validation passed: focused family smoke, loose-gem, Book/Amethyst,
  Badger/Bagtacular, Ace/Puppy, socket split, two-board, and event-contract
  smokes; syntax checks; GDScript parity (`untriagedHookGaps: 0`); call audit;
  and `sim-fidelity-ledger.mjs --check`. The broader continuous audit is
  15/16 because the existing worktree still has an unacknowledged patch-drift
  baseline across prior source changes; it was not rewritten here. No commit
  or push was made.

### 2026-10-04 admin winner module mount and form styling claim (in progress)

- Codex owns `js/pages/admin/event-desk.js`, `js/pages/admin/event-winner.css`,
  `admin/index.html`, `js/shared/confirm-dialog.css`,
  `supabase/functions/event-winner/index.ts`, `supabase/config.toml`,
  `events/index.html`, and this handoff for
  repairing the Select Winner action's module target, unstyled controls, and
  public winner-result refresh.
- Scope: keep winner selection owner-gated and preserve the existing winner API;
  ensure the judging UI mounts inside the event detail module, styles all
  controls with the admin form system, and keeps the public Events winner
  rendering path separate. Authorization, RLS, and winner persistence remain
  unchanged; only the public read response gains a privacy-safe pending state.

### 2026-10-04 admin winner module mount and form styling complete

- The admin confirmation layer now loads its shared form CSS and sits above
  the event desk modal, so Select winner/Clear winner confirmations no longer
  render behind the admin module as unstyled page controls. The admin and
  Events entry scripts received fresh cache-bust stamps.
- The public winner endpoint now acknowledges a selected winner while the
  event entry is still held private, without returning the entrant/build
  identity. The Events detail adds the Winner tab for that acknowledged result
  and shows a pending-publication state; once SQL visibility releases the
  entry, the existing face/build card renders normally.
- Validation: admin/events JavaScript syntax checks, static source assertions,
  targeted `git diff --check`, and winner-module cache-bust checks passed. The
  Supabase Edge Function source/config was updated but not deployed from this
  workspace; the next Supabase deploy must include `event-winner` before the
  pending Winner tab can appear live. No commit or push was made.

### 2026-10-04 glitzi and freeq_45422 premium entitlement reset complete

- Cleared only the two requested profiles' website entitlement fields: both
  now have `plan = free` and `premium_until = null`; their founding slots were
  already null and were left untouched. Existing Stripe customer metadata was
  preserved; the matching customer had no active subscriptions.
- Reconciled both Discord members against the free plan, removing the Premium
  and Founding roles where present. Both members were found in the guild and
  the role sync succeeded.
- Verification: both profiles remain founding-eligible, the founding promo is
  started/open, and the founding counter remains `1 / 10`. No product files,
  migrations, or deployment configuration were changed.

### 2026-10-04 flawed and flawless gem simulator port claim (in progress)

- Codex owns `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/gem-sockets.js`, `scripts/extract-sim-item-inventory.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the focused flawed/flawless gem regression script, generated simulator inventory/ledger artifacts, the simulator port backlog/validation notes, and this handoff for this source-port task.
- Scope: resolve `flawed_*` and `flawless_*` gem scene aliases/inheritance, port every source-proven inventory and socket lifecycle for both sides, add focused state/event/UI regressions, and update the ledger/backlog only after the required audits pass. No unrelated simulator or website behavior is in scope.

### 2026-10-04 flawed and flawless gem simulator port complete (partial by source constraint)

- Source records and explicit runtime handlers now cover `flawed_amethyst`, `flawed_emerald`, `flawed_ruby`, `flawless_amethyst`, `flawless_emerald`, `flawless_ruby`, and `flawless_topaz`. Their focused smoke verifies source aliases, parameters, inventory order, supported socket modes, event order, HUD stat output, and the Emerald opponent path.
- `flawed_sapphire` and `flawless_sapphire` are source-resolved but intentionally remain incomplete. `Gems/Sapphire.gd` needs a shared `pre_deal_damage_late` dispatch to make the host strike spectral before damage; the existing after-hit approximation cannot be marked faithful. The ledger, backlog, and validation notes retain this named shared-engine follow-up.
- Validation: focused smoke, module syntax checks, GDScript hook audit with zero untriaged gaps, call audit, ledger regeneration/check, and targeted whitespace check passed. Continuous audit is 15/16 only because the existing patch-drift baseline has not yet acknowledged this 42-item source review wave; it was not rewritten. No commit/push was made.

### 2026-10-04 Goobling, card, and next gem simulator wave claim (in progress)

- Codex owns `js/pages/sim/engine/scripts/ports-am-goobert.js`, `js/pages/sim/engine/scripts/ports-ao-cards.js`, `js/pages/sim/engine/scripts/ports-an-gems.js`, `scripts/extract-sim-item-inventory.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, focused smoke coverage, generated simulator inventory/ledger artifacts, the simulator port backlog/validation notes, and this handoff for `goobling`, `holo_fire_lizard`, `joker`, `perfect_*`, and `regular_amethyst`.
- Scope: resolve source aliases/inheritance, validate or repair the exact named source lifecycle, preserve unresolved shared-core dependencies, and add focused evidence before changing any backlog state. No unrelated simulator or website behavior is in scope.

### 2026-10-04 Goobling, card, and next gem simulator wave complete (partial by source constraint)

- Goobling, Holo Fire Lizard, Perfect Amethyst/Emerald/Ruby/Topaz, and Regular Amethyst are source-resolved and source-ported with explicit handler/source ownership. Holo's factor -> effect damage -> Heat -> activation order and Joker's pair/triplet branches have focused regression coverage.
- Joker remains incomplete for its direct quadruple `doRevealEffect()` calls because the engine only provides state-changing `Card.trigger`; Perfect Sapphire remains incomplete for the existing `pre_deal_damage_late` spectral socket gap. Both are retained as named source constraints in the ledger/backlog/validation notes.
- Validation: focused gem and Goobling/card smoke tests, changed-module syntax checks, source audits, ledger regeneration/check, and `git diff --check` passed. Published in commit `6e58f32` (`Port simulator gem and card source waves`).

### 2026-10-04 home loading skeleton claim (in progress)

- Codex owns `js/pages/home/index.js` and this handoff for the home loading-state timing repair.
- Scope: mount the existing page-shaped promo, class, items, and build-vault loading content immediately so the home page does not leave below-fold sections blank while deferred work waits. No visual redesign, data query, or shared stylesheet changes are in scope.

### 2026-10-04 home loading skeleton complete

- Home now mounts its existing page-shaped promo catalog/board, class rail, item orbit, and build-vault placeholders immediately after navigation boot instead of waiting up to 900ms for idle time. Async item/build hydration still runs through the same sections; only the previously blank loading interval was removed.
- Validation: `node --check js/pages/home/index.js` and targeted `git diff --check` passed. No commit/push was requested.

### 2026-10-04 cross-browser root scrollbar claim (in progress)

- Codex owns `css/theme.css` and this handoff for the root scrollbar compatibility repair.
- Scope: provide the established BPB gold/brown scrollbar on WebKit roots and a Firefox/non-WebKit standards fallback, without changing existing specialized internal scrollers or their dimensions.

### 2026-10-04 cross-browser root scrollbar complete

- `css/theme.css` now gives every page root the established 16px BPB gold/brown framed scrollbar in Chromium/Safari. Browsers without `::-webkit-scrollbar` receive the closest standards-supported gold/brown fallback through `scrollbar-color`.
- The home page retains its larger image-based scrollbar in WebKit. Its standard scrollbar value is now `auto` there, avoiding Chromium/Windows replacing it with native arrow chrome; its Firefox fallback keeps the branded palette.
- Validation: targeted CSS review and `git diff --check` passed. No commit/push was requested.

### 2026-10-04 Items catalog scroll-performance claim (in progress)

- Codex owns `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/item-virtual.js`, `js/pages/items/catalog/index.js`, and this handoff for the Items catalog scroll-performance repair.
- Scope: keep the catalog’s native compositor scroll path smooth by reducing scroll-time DOM/layout work and avoiding repeated entrance animation/reflow while the viewport is moving. Preserve catalog placement, filtering, tooltip, live-art, and spotlight behavior. No website-wide scrollbar or unrelated page changes are in scope.

### 2026-10-04 Items catalog scroll-performance complete

- The Itemiary pool now reuses the visible placement slice rather than scanning it twice per paint, defers virtualization paints until a short scroll settle (with a bounded long-fling refresh), and disables entrance/reflow animation during active scrubbing. The standalone Items catalog uses a wider prefetch band so fast wheel/trackpad movement keeps populated cells on-screen; the shared grid default is unchanged for other surfaces.
- Validation: `node --check` passed for `js/shared/backpack-grid/item-pool.js`, `js/pages/items/catalog/index.js`, and `js/shared/backpack-grid/item-virtual.js`; `git diff --check` passed. Local Playwright smoke loaded `/items/`, scrolled the full catalog, confirmed populated cells at the bottom and during fast wheel movement, and reduced observed scroll long tasks from repeated per-frame work to three to five sampled long tasks in the final run. No commit/push was requested.

### 2026-10-04 Items desktop filter-density claim (in progress)

- Codex owns `js/pages/items/catalog.css` and this handoff for the desktop Items filter-panel viewport repair.
- Scope: keep the existing 1440p filter composition, scale the desktop rail to the available viewport height on shorter desktop screens, and remove only the desktop rail’s internal scrollbar. Mobile/tablet drawer behavior and the catalog grid remain unchanged.

### 2026-10-04 Items desktop filter-density complete

- The desktop filter rail now uses a viewport-height-aware density scale above the existing 1240px desktop breakpoint. At 1440p it remains unchanged; at 1080p and shorter desktop heights the same filter composition scales as one unit and clips no controls, so the rail no longer creates an internal scrollbar. The mobile/tablet drawer keeps its existing scroll behavior.
- Validation: local Playwright checks at 2560×1440, 1920×1080, 1600×900, and 1366×768 confirmed the desktop rail has no overflow scrollbar and remains fully within its viewport slot; 1024×768 remained on the mobile drawer path. `git diff --check` passed. No commit/push was requested.
### 2026-10-04 Builds desktop density claim (in progress)

- Codex owns `js/pages/builds/builds.css` and this handoff for the desktop Builds viewport repair.
- Scope: preserve the existing 1440p Builds composition, scale desktop-only content for shorter/lower-resolution desktop viewports, and remove the filter rail's internal scrollbar without changing mobile behavior or feed data/interaction logic.

### 2026-10-04 Builds desktop density complete

- The desktop Builds filter rail now uses a viewport-height-aware scale above the 1240px desktop breakpoint. Its existing scroll behavior remains available to the layout, but the scaled controls fit their rail at 1920×1080, 1600×900, 1440×900, and 1366×768, so the filter no longer presents an internal scrollbar from the full control stack. The mobile/tablet fixed drawer remains unchanged.
- On wide, shorter desktop viewports (1501px and wider), the feed list uses the same density approach so board cards, metadata, and action controls shrink in proportion to the available height while the 2560×1440 reference remains unchanged. Grid view was checked at 1920×1080 and 1600×900 for right-edge clipping.
- Validation: Playwright loaded `/builds/` at 2560×1440, 1920×1080, 1600×900, 1440×900, 1366×768, and 1024×768 with no page errors; filter descendants stayed inside their rails at desktop sizes, and the mobile drawer path remained active at 1024px. `git diff --check` and the existing Builds CSS review remain clean. No commit/push was requested.

### 2026-10-04 Create catalog tooltip boundary claim (in progress)

- Codex owns `js/shared/tooltip-hover.js` and this handoff for the create-catalog hover tooltip boundary repair.
- Scope: keep the existing over-filters placement and tooltip scale, but clamp the floating card to the viewport's horizontal safe area so its right edge cannot be clipped on 1080p and other desktop widths. No catalog, board, or mobile layout changes are in scope.

### 2026-10-04 Create catalog tooltip boundary complete

- `placeOverFilters()` now measures the rendered card after scaling and clamps its left coordinate to the viewport safe area (`8px` on either side). The create catalog keeps the existing rail-relative placement when there is room, but shifts the card left when the rail is near the right edge.
- Validation: Playwright hovered a real create-catalog item at 1920×1080, 2560×1440, 1440×900, and 1366×768; every tooltip right edge stayed at least 8px inside the viewport, with no page errors. The change is shared placement logic used by the existing item catalog tooltip and does not alter mobile drawer/catalog layout. `git diff --check` passed. No commit/push was requested.

### 2026-10-04 Create parked rail and desktop build panel claim (in progress)

- Codex owns `js/pages/create/create.css` and this handoff for the create-page parked-tray and Filter|Build rail layout repair.
- Scope: reduce the desktop Parked strip to a one-row horizontal carousel, let the desktop rail use the catalog's full height, density-scale its panel contents for narrower desktop widths, and hide/disable the fixed sell chest only while the rail is hovered or focused. The mobile two-row parked carousel, catalog behavior, and drag/state logic remain unchanged.

### 2026-10-04 Create parked rail and desktop build panel complete

- Desktop Parked is now a compact one-row horizontal carousel with themed scrolling, preserving all existing parked stacks and leaving the mobile two-row touch strip unchanged.
- The desktop Filter|Build rail now fills the catalog's usable height instead of stopping above the fixed sell chest. Its panel contents scale responsively (including the shorter 1366x768 case) so controls stay inside the rail; the Build panel remains independently scrollable for its full item groups.
- While the rail is hovered or focused, the fixed sell chest fades out and is removed from hit testing, preventing accidental drops while the expanded Filter|Build area is active. Moving focus away restores it.
- Validation: local Playwright checks at 2560x1440, 1920x1080, 1600x900, 1440x900, and 1366x768 showed matching catalog/rail floors, no Filter-panel descendant clipping, one desktop Parked row, and no page errors. 1024x768 and 390x844 retained the mobile two-row Parked layout. `git diff --check` passed. No commit/push was requested.

### 2026-10-04 Events signature scrollbar claim (in progress)

- Codex owns `js/pages/events/events.css` and this handoff for the Events scrollbar styling repair.
- Scope: apply the existing image-based signature scrollbar to the Events document and the detail page's How-to-join scroller, with a standards fallback. No event content or interaction behavior is in scope.

### 2026-10-04 Events signature scrollbar complete

- Events now uses the same image-based track/thumb as the home page for the document scrollbar and the scrollable How-to-join panel. Non-WebKit browsers receive the matching gold/brown `scrollbar-color` fallback; mobile's non-scrolling How-to-join layout is unchanged.
- Validation: Playwright loaded the Events detail page at 1440x900, 1920x1080, and 390x844 with no page errors. Both the root and How-to-join scrollbar pseudo-elements resolved to the signature track/thumb assets. `git diff --check` passed.
- Pushed in commit `bd47bcb` (`Apply signature scrollbars and responsive page polish`).

### 2026-10-04 Create sell chest and parked empty-state correction claim (in progress)

- Codex owns `js/pages/create/create.css` and this handoff for the follow-up create rail correction.
- Scope: restore the Filter|Build rail's clearance above the fixed sell chest, remove the hover/focus hide state, and center the desktop Parked empty-state label without changing the carousel or drag behavior.

### 2026-10-04 Create sell chest and parked empty-state correction complete

- The sell chest is now continuously visible again; the Filter|Build rail ends above its reserved clearance, so scrolling the rail cannot run underneath or trigger the chest. The previous hover/focus opacity and pointer-event override was removed.
- Desktop Parked's “Drop items here to stash” message is centered across the entire carousel tray. The desktop one-row carousel and mobile two-row layout remain intact.
- Validation: Playwright checks at 1920x1080, 1440x900, 1366x768, and 390x844 confirmed the chest remains visible, build-panel wheel scrolling still advances normally, the desktop rail stops before the chest, the empty label is centered, and no page errors occurred. No commit/push was requested.

### 2026-10-04 Create desktop nav breathing-room claim (in progress)

- Codex owns `js/pages/create/create.css` and this handoff for the create-page navigation spacing adjustment.
- Scope: reduce only the desktop Create nav's bottom padding so its measured spacer gives the workspace more vertical room. Mobile/tablet navigation and shared nav behavior remain unchanged.

### 2026-10-04 Create desktop nav breathing-room complete

- Desktop Create now uses a smaller bottom nav pad (`3.8rem`, `3.2rem` through 1366px), and the existing measured nav spacer follows it automatically. The workspace starts about 29px higher on 1440p/1080p-sized desktops and about 18px higher at 1366x768.
- Validation: Playwright checks at 2560x1440, 1920x1080, 1440x900, and 1366x768 confirmed the reduced nav/spacer and expanded workspace; 1024x768 and 390x844 retained the original mobile nav height. No page errors occurred. No commit/push was requested.

### 2026-10-04 Create nested-scroll cursor sync claim (in progress)

- Codex owns `js/shared/game-cursor.js` and this handoff for the Create Filter|Build cursor-follow repair.
- Scope: resample the game hand after nested panel scroll events so a stationary mouse over Filter|Build keeps the same visible cursor/follower state as the catalog. Drag placement and cursor artwork remain unchanged.

### 2026-10-04 Create nested-scroll cursor sync complete

- The game cursor now remembers the last mouse position and re-evaluates the element under that position whenever any nested scroller fires a scroll event. This keeps the full hand synchronized over the Filter|Build panel without requiring a fresh pointer move; the existing catalog behavior is preserved.
- Validation: `node --check js/shared/game-cursor.js`; Playwright scrolled the Create Build panel with the pointer held stationary, confirmed the nested scroll event path fired and the full cursor follower remained active, and recorded no page errors. No commit/push was requested.

### 2026-10-04 Joker and Sapphire shared combat-lifecycle claim (in progress)

- Codex owns `js/pages/sim/engine/actor-stats.js`, `js/pages/sim/engine/damage.js`, `js/pages/sim/engine/simulate.js`, `js/pages/sim/engine/combat-activate.js`, `js/pages/sim/engine/scripts/handlers.js`, `js/pages/sim/engine/gem-sockets.js`, `js/pages/sim/engine/scripts/ports-ao-cards.js`, focused simulator smoke coverage, generated simulator ledger/backlog artifacts, simulator validation notes, and this handoff for `joker`, `perfect_sapphire`, and `flawless_sapphire`.
- Scope: add the exact source-order `pre_deal_damage_late` lifecycle dispatch, use it to make socketed Sapphire attacks spectral before Block, and add a direct `Card.doRevealEffect()`-only Joker dispatch that never changes the selected card's reveal or cooldown state. Preserve existing inventory, pair/triplet, and normal Card.trigger paths; no unrelated simulator or website behavior is in scope.

### 2026-10-04 Joker and Sapphire shared combat-lifecycle complete

- `damage.js` now exposes the canonical late pre-deal phase after defender reductions and before Block, passes the live damage source to handlers, and preserves late-handler damage edits. The scheduler and both normal attack paths forward that phase; socketed Sapphire uses it to make the current host strike spectral, then awards Mana/Cold only for the resulting hit.
- All source Card ports now separate `doRevealEffect()` behavior from `Card.trigger`. Joker's quadruple branch picks non-Joker prior cards using the source removal rule, invokes only their reveal effect, and leaves their reveal/cooldown state untouched while preserving their activation events. Its pair branch now grants/consumes actual CritResist stacks instead of outbound Crit tokens. `joker`, `perfect_sapphire`, `flawless_sapphire`, and the identically unblocked `flawed_sapphire` are now source-ported in the generated ledger/backlog.
- Added `scripts/sim-joker-sapphire-smoke.mjs`: direct reveal-state/cooldown and activation-order coverage for Joker; both-side Perfect/Flawless Sapphire spectral 999-Block checks; and a scheduled `simulateEngine` route check. Syntax checks, focused new/adjacent gem/card smokes, ledger regeneration/check, hook triage, call audit, combat-log smoke, and `git diff --check` passed.
- `sim-continuous-audit --check --family sim-joker-sapphire-smoke` reached 15/16: every check except patch drift passed. The remaining failure is the pre-existing unacknowledged 49-row source-review baseline; it was intentionally not overwritten because this task did not re-review the other rows. No commit/push was requested.

### 2026-10-04 Regular gems and Resistor/Reverse claim (in progress)

- Codex owns the narrow simulator handler/registry paths for `regular_emerald`, `regular_ruby`, `regular_sapphire`, `regular_topaz`, `resistor`, and `reverse`, plus focused regression coverage, generated simulator ledger/backlog artifacts, simulator validation notes, and this handoff while this claim is active.
- Scope: trace each exact extracted lifecycle and parameters, reuse shared gem/socket and card/charge helpers where they are source-equivalent, and leave any shared-engine gap explicitly incomplete rather than approximating behavior. No unrelated simulator or website behavior is in scope.

### 2026-10-04 Regular gems and Resistor/Reverse complete

- Source inventory now resolves the Regular Emerald/Ruby/Sapphire/Topaz scene aliases and Resistor's charge hook. Existing shared Gem socket lifecycle plus explicit per-item inventory handlers cover the extracted source behavior.
- Resistor grants Heat below `heatt` with a VFX-only mini activation; the threshold/failure path has no state or combat-log effect. Reverse now grants Reflect stacks (not a percentage chance) and performs the source duplicate-gated random buff steal.
- Added `scripts/sim-regular-gems-resistor-reverse-smoke.mjs`; both-side inventory, socket, charge, and card regressions pass. Updated the source backlog, validation notes, generated inventory/ledger artifacts, and parity hook map.
- Validation: changed-module syntax checks, focused smoke, adjacent gem/card smokes, `npm run sim-log-smoke`, parity/call audits, ledger check, and `git diff --check` pass. `sim-continuous-audit --check --family sim-regular-gems-resistor-reverse-smoke` reaches 15/16: only the repository's pre-existing patch-drift baseline fails (54 source rows are currently reported against a stale baseline); it was not overwritten without reviewing unrelated rows. No commit/push was requested.

### 2026-10-04 Shortbow, Skull, potion, ring, and Fool claim (in progress)

- Codex owns the narrow simulator source-alias/registry paths for `shortbow`, `skull`, `stable_recombobulator`, `strong_heroic_potion`, `strong_mana_potion`, `superior_ring`, and `the_fool`, plus focused regression coverage, generated simulator inventory/ledger artifacts, simulator validation notes, the simulator port backlog, and this handoff while this claim is active.
- Scope: resolve each scene's inherited script, verify the existing weapon/gem/gadget/potion/ring/card handlers against the extracted lifecycle and parameters, correct only source-backed deltas, and leave any shared-engine gap explicitly incomplete rather than approximating it. No unrelated simulator or website behavior is in scope.

### 2026-10-04 Shortbow, Skull, potion, ring, and Fool complete

- Added exact scene aliases for Shortbow/Skull/Stable Recombobulator/Strong Heroic Potion/Strong Mana Potion/Superior Ring/The Fool. The source rows now resolve to their inherited `Weapon.gd`, `Skull.gd`, `Recombobulator.gd`, `HeroicPotion.gd`, `ManaPotion.gd`, `MagicRing.gd`, and `TheFool.gd` scripts.
- Corrected Skull armor sockets to apply its source debuff-resistance chance to poison, blind, and cold as well as crit resistance; corrected Superior Ring's opponent-low trigger to ignore misses; corrected The Fool to buff only its own `deck.cards`; and removed the unsupported Strong Heroic p3 Lucky grant because its scene inherits HeroicPotion.gd, which only consumes p1/p2.
- Added `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs` with both-side weapon, gem inventory/socket, recombobulator, potion, ring trigger, and deck-local card regressions. Updated the backlog, validation notes, generated inventory/ledger, and parity/call reports.
- Validation: changed-module syntax checks, focused/adjacent simulator smokes, `npm run sim-log-smoke`, parity/call audits, ledger check, and `git diff --check` pass. `sim-continuous-audit --check --family sim-shortbow-skull-potions-ring-fool-smoke` reaches 15/16; only the repository's pre-existing patch-drift baseline fails (59 source rows are currently reported against a stale baseline), and it was not overwritten without reviewing unrelated rows. No commit/push was requested.

### 2026-10-04 The Lovers, Tiger Rune, Unstable Recombobulator, Whetstone II, and White Eyes Blue Dragon claim (in progress)

- Codex owns the narrow simulator source-alias/registry paths for `the_lovers`, `tiger_rune`, `unstable_recombobulator`, `whetstone2`, and `white_eyes_blue_dragon`, plus focused regression coverage, generated simulator ledger/backlog artifacts, simulator validation notes, the simulator port backlog, and this handoff while this claim is active.
- Scope: resolve each exact extracted scene/script and lifecycle, verify existing card/gem/gadget/weapon handlers against source behavior on both sides, correct only source-backed deltas, and leave any shared-engine gap explicitly incomplete rather than approximating behavior. No unrelated simulator or website behavior is in scope.

### 2026-10-04 The Lovers, Tiger Rune, Unstable Recombobulator, Whetstone2, and White-Eyes Blue Dragon complete

- Resolved `Exclusive/UnstableRecombobulator.tscn` → `Exclusive/Recombobulator.gd` and `Exclusive/Whetstone2.tscn` → `Whetstone.gd` scene aliases. The Lovers and White-Eyes Blue Dragon remain on their exact card scripts; Tiger Rune remains on `Exclusive/TigerRune.gd`.
- Corrected Tiger Rune from the unused `buffChance` field to the simulator's `buffAmpChance` surface, preserved source prepare ordering, and kept a literal `tigerRunePort` for source/call audits. Existing card/recombobulator/whetstone handlers now have focused coverage.
- Added `scripts/sim-lovers-tiger-unstable-whetstone-white-eyes-smoke.mjs` with both-side The Lovers, White-Eyes Blue Dragon, Unstable Recombobulator, Whetstone2, and Tiger Rune (loose/armor-socket/weapon-socket) regressions. Updated backlog, validation notes, inventory, ledger, and parity/call reports.
- Validation: syntax checks, focused and adjacent simulator smokes, `npm run sim-log-smoke`, parity audit, call audit, ledger check, and `git diff --check` pass. Continuous audit reached 15/16; every check except the repository's pre-existing patch-drift baseline passed (61 source rows remain against a stale baseline), so the baseline was not overwritten without reviewing unrelated rows. No commit/push was requested.

### 2026-10-04 Axe, Bewitchment, Blood Amulet, Bloody Dagger, Broccoli, and Broccotree claim (in progress)

- Codex owns the narrow simulator source-alias/handler paths for `axe`, `bewitchment`, `blood_amulet`, `bloody_dagger`, `broccoli`, and `broccotree`, plus focused regression coverage, generated simulator inventory/ledger artifacts, simulator validation notes, the simulator port backlog, and this handoff while this claim is active.
- Scope: resolve each exact extracted script/scene and lifecycle, verify inherited weapon/dagger/food behavior and item-specific parameters on both board owners, correct only source-backed deltas, and leave any shared-engine gap explicitly incomplete rather than approximating behavior. No unrelated simulator or website behavior is in scope.

### 2026-10-04 Axe, Bewitchment, Blood Amulet, Bloody Dagger, Broccoli, and Broccotree complete

- Added exact scene aliases for all six rows and source-backed handler corrections. Bewitchment now caches source type counts during prepare, respects the Mana gate, uses random least-debuff selection, and applies per-type chance bonuses. Broccoli now applies inherited Food preparation speed; Broccotree uses its source `onPrepare` override/base stamina rate; Bloody Dagger resets its cap at prepare.
- Added `scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs`; both-side state/lifecycle regressions pass. Updated the backlog, validation notes, generated inventory/ledger, and parity/call reports.
- Validation: focused/adjacent smokes, `npm run sim-log-smoke`, syntax checks, parity/call audits, ledger check, and `git diff --check` pass. Continuous audit reached 15/16; only the pre-existing 61-row patch-drift baseline fails and was not overwritten without reviewing unrelated rows. No commit/push was requested.

### 2026-10-04 Burning Banner, Burning Coal, Burning Sword, Burning Torch, Carrot Goobert, Cauldron, Chainsaw, Charge Splitter, Chili Pepper, and Coil claim (in progress)

- Codex owns the narrow simulator source-alias/handler paths for `burning_banner`, `burning_coal`, `burning_sword`, `burning_torch`, `carrot_goobert`, `cauldron`, `chainsaw`, `charge_splitter`, `chili_pepper`, and `coil`, plus focused regression coverage, generated simulator inventory/ledger/parity artifacts, simulator validation notes, the simulator port backlog, and this handoff while this claim is active.
- Scope: resolve exact extracted scripts/scenes and inherited lifecycles, verify heat/charge/weapon/pet/food behavior on both board owners, correct only source-backed deltas, and leave shared-engine gaps explicitly incomplete rather than approximating behavior. No unrelated simulator or website behavior is in scope.

### 2026-10-04 Burning Banner, Burning Coal, Burning Sword, Burning Torch, Carrot Goobert, Cauldron, Chainsaw, Charge Splitter, Chili Pepper, and Coil complete

- Added exact scene aliases and source-backed lifecycle ports for all ten rows. Burning Banner/Sword/Cauldron/Charge Splitter/Carrot/Coil now initialize in `onPrepare`; Carrot uses inherited Goobert peer activations; Chainsaw uses source fractional buff remove/steal in early pre-deal; Charge Splitter uses both source charge paths; Chili activation order and Burning Coal socket modes match source.
- Added `scripts/sim-burning-heat-charge-smoke.mjs` with both-side lifecycle/state/activation checks. Updated backlog, validation notes, generated inventory/ledger/parity artifacts, and parity/call reports.
- Validation: focused/adjacent smokes, `npm run sim-log-smoke`, syntax checks, ledger check, and `git diff --check` pass; parity/call reports regenerate with zero untriaged gaps. Continuous audit reached 14/16 because the existing patch-drift baseline and three stale hook-triage entries fail; neither baseline nor unrelated triage was overwritten. No commit/push was requested.

### 2026-10-05 Crossblades through Dragon Set claim (in progress)

- Codex owns the narrow simulator handler/registry paths for `crossblades`, `cursed_hair_comb`, `dark_lantern`, `darksaber`, `death_lotus`, `deer_totem`, `djinn_lamp`, `doom_cap`, `double_axe`, `draconic_orb`, `dragon_knight`, and `dragon_set`, plus focused regression coverage, generated simulator inventory/ledger/parity artifacts, simulator validation notes, the simulator port backlog, and this handoff while this claim is active.
- Scope: trace each extracted source lifecycle and effect call, correct only source-backed deltas (including Dragon Knight's percent cooldown advance and Dark Lantern's effect-damage path), prove both board owners, and leave any shared-engine ambiguity explicitly incomplete rather than approximating it. No unrelated simulator or website behavior is in scope.

### 2026-10-05 Crossblades through Dragon Set complete

- Added the AQ source-port wave for `crossblades`, `cursed_hair_comb`,
  `dark_lantern`, `darksaber`, `death_lotus`, `deer_totem`, `djinn_lamp`,
  `doom_cap`, `double_axe`, `draconic_orb`, `dragon_knight`, and `dragon_set`.
  Source lifecycle ordering now covers prepare-time listeners, Rage cooldown
  locks, Dark Lantern reincarnation/effect damage, Dragon Knight inherited
  Reflect/Heat and percent cooldown advance, and Dragon Set full-set lifesteal.
- Added `scripts/sim-crossblades-dragon-wave-smoke.mjs` with both-side,
  source-order assertions for all twelve rows. The parity inventory/backlog/
  fidelity ledger and `docs/sim/sim-validation.md` now identify this as the AQ
  source-port wave.
- Validation passed: changed-module syntax checks, AQ smoke, adjacent AP/gem/
  potion smokes, Rib Saw regression, `npm run sim-log-smoke`, parity/call
  audits, ledger check, and `git diff --check`. Continuous audit ran the AQ
  family successfully but remains non-zero on the repository's pre-existing
  61-row patch-drift baseline and four stale hook-triage entries; those
  unrelated baselines were not overwritten. No commit/push was requested.

### 2026-10-05 Emerald Whelp through Gingerbread Man claim (in progress)

- Codex owns the narrow simulator source-alias/handler paths for `emerald_whelp`,
  `energy_conversion`, `everburning`, `fanfare`, `flame_badge`, `flame_whip`,
  `flute`, `fly_agaric`, `fortunas_kiss`, and `gingerbread_man`, plus focused
  regression coverage, generated simulator ledger/parity artifacts, simulator
  validation notes, the simulator port backlog, and this handoff while this
  claim is active.
- Scope: trace each exact extracted lifecycle and inherited script, correct only
  source-backed deltas (including activation ordering, resource gates, and
  listener reset/side semantics), prove both board owners, and leave shared
  engine ambiguity explicitly incomplete rather than approximating behavior.
  No unrelated simulator or website behavior is in scope.

### 2026-10-05 Emerald Whelp through Gingerbread Man complete

- Completed the AR source-port wave for `emerald_whelp`, `energy_conversion`,
  `everburning`, `fanfare`, `flame_badge`, `flame_whip`, `flute`, `fly_agaric`,
  `fortunas_kiss`, and `gingerbread_man`. Prepare-time listeners/stats now run
  in the engine's prepare phase, including inherited Food.prepare link speed
  for Fly Agaric and Gingerbread Man; effects and consume/activation ordering follow
  the extracted `.gd` scripts, including Fanfare's opponent Mana/Stamina drain
  and Fortuna's `canModifyChance` target filter.
- Corrected the shared early damage surface so `DamageResult.damage` is rolled
  before `onPreDealDamage_early`; Flame Whip now spends Spikes and adds its
  unrounded bonus only after a successful hit, preserving Spikes on misses.
  Added source-shaped stamina-drain logging and temporary max-health gain
  projection (including MaxHealthGain amplification) for these paths.
- Added `scripts/sim-emerald-ginger-wave-smoke.mjs`, asserting source aliases,
  handler registration, state, event ordering, and both board owners. Updated
  `docs/sim/sim-validation.md`, `docs/sim/sim-port-wave-backlog.md`, and the
  generated simulator inventory/parity/fidelity artifacts with the AR wave.
- Validation passed: AR smoke, AP milestone smoke, core-leftover smoke,
  Crossblades/Dragon, Burning heat/charge, Goobling/Joker/Sapphire smokes,
  `npm run sim-log-smoke`, changed-module syntax checks, and `git diff --check`.
  The continuous audit remains 14/16 because the existing 61-row patch-drift
  baseline and four stale hook-triage entries are unrelated; no baseline or
  unrelated triage was overwritten. No commit/push was requested.

### 2026-10-05 Halberd through Null Blade claim (in progress)

- Codex owns the narrow simulator source-alias/handler paths for `halberd`,
  `heart_container`, `hero_sword`, `ice_armor`, `just_stats`, `laboratory`,
  `leaf_badge`, `level_up`, `light_flower`, `lucky_bow`, `lucky_clover`,
  `magic_torch`, `mananana`, `molten_dagger`, `molten_spear2`, `moon_armor`,
  `more_stats`, and `null_blade`, plus focused regression coverage, generated
  simulator ledger/parity artifacts, simulator validation notes, the simulator
  port backlog, and this handoff while this claim is active.
- Scope: trace each exact extracted lifecycle and inheritance chain, correct
  only source-backed deltas with both-board evidence, and leave any shared
  engine uncertainty explicitly incomplete rather than approximating behavior.
  No unrelated simulator or website behavior is in scope.

### 2026-10-05 Halberd through Null Blade complete

- Completed the AS source-port wave for `halberd`, `heart_container`,
  `hero_sword`, `ice_armor`, `just_stats`, `laboratory`, `leaf_badge`,
  `level_up`, `light_flower`, `lucky_bow`, `lucky_clover`, `magic_torch`,
  `mananana`, `molten_dagger`, `molten_spear2`, `moon_armor`, `more_stats`,
  and `null_blade`.
- Corrected prepare/pre-combat lifecycle work, late Block removal, source
  effect-before-activation order, inherited Food preparation speed, and
  early current-hit plus permanent damage behavior. Removed Magic Torch's
  obsolete duplicate handler registration; the audit now reports 19 remaining
  pre-existing duplicate registrations.
- Added `scripts/sim-halberd-null-blade-wave-smoke.mjs` with both-side source
  alias, lifecycle, state, damage, target, and event-order assertions. Updated
  the simulator backlog, validation notes, parity inventory, and fidelity
  ledger (452 source-ported, 39 runtime-incomplete rows).
- Validation passed: AS and adjacent AR source-port smokes, AP milestone and
  combat-log smokes, syntax checks, parity/call audits, fidelity-ledger check,
  and `git diff --check`. Continuous audit runs the AS family successfully but
  remains 14/16 because the repository has a 61-row patch-drift baseline and
  four stale hook-triage entries; neither unrelated baseline was overwritten.
  No commit/push was requested.

### 2026-10-05 Pan through Pot claim (in progress)

- Codex owns the narrow simulator source-alias/handler paths for `pan`,
  `phoenix`, `piggy_of_riches`, `piggybank`, `poison_dagger`,
  `poison_grenade`, `poison_shortbow`, and `pot`, plus focused regression
  coverage, generated simulator ledger/parity artifacts, simulator validation
  notes, the simulator port backlog, and this handoff while this claim is
  active.
- Scope: trace each exact extracted lifecycle and inheritance chain, correct
  only source-backed deltas with both-board evidence, and leave any shared
  engine uncertainty explicitly incomplete rather than approximating behavior.
  No unrelated simulator or website behavior is in scope.

### 2026-10-05 Pan through Pot complete

- Completed the AT source-port wave for `pan`, `phoenix`, `piggy_of_riches`,
  `piggybank`, `poison_dagger`, `poison_grenade`, `poison_shortbow`, and
  `pot`. Phoenix, Poison Grenade, and Pot now install their source listeners
  during prepare; Poison Dagger also covers the inherited Dagger stun attack.
- Added `scripts/sim-pan-pot-wave-smoke.mjs` with exact source aliases,
  lifecycle, state, activation order, and both-board assertions. Updated the
  backlog, validation notes, parity inventory, and fidelity ledger (460
  source-ported, 31 runtime-incomplete rows).
- Validation passed: changed-module syntax checks, AT and adjacent AS smokes,
  combat-log smoke, ledger check, and `git diff --check`. The continuous audit
  runs the AT family successfully but remains non-zero on pre-existing
  patch-drift/hook-triage findings; those unrelated baselines were not
  overwritten. No commit/push was requested.

### 2026-10-05 Power of the Moon through Scale claim (in progress)

- Codex owns the narrow simulator source-alias/handler paths for
  `power_of_the_moon`, `pumpkin`, `puzzlebag_l`, `ruby_chonk`, `ruby_egg`,
  `ruby_whelp`, `sapphire_whelp`, and `scale`, plus focused regression
  coverage, generated simulator ledger/parity artifacts, simulator validation
  notes, the simulator port backlog, and this handoff while this claim is
  active.
- Scope: trace each exact extracted lifecycle and inheritance chain, correct
  only source-backed deltas with both-board evidence, and leave any shared
  engine uncertainty explicitly incomplete rather than approximating behavior.
  No unrelated simulator or website behavior is in scope.

### 2026-10-05 Create Build-tab priority drop repair claim (in progress)

- Codex owns `js/pages/create/meta-drops.js`, `js/pages/create/drag-session.js`, `js/pages/create/drag-pointers.js`, `js/pages/create/create.css`, and this handoff for repairing manual item drops onto Why it works, Needs, Wants, and Good to have. Scope is limited to restoring the existing priority/mention drop behavior without changing history-lock, board placement, park, sell, or catalog rules.

### 2026-10-05 Create Build-tab priority drop repair complete

- Removed the redundant pointer-only meta-drop preflight. Drag release now delegates directly to the existing held-sprite-aware `tryCommitDrop`, which is the authoritative resolver for Why it works, Needs, Wants, and Good to have. Removed the unused session callback; `meta-drops.js` and `create.css` were inspected but unchanged.
- Validation: a Playwright drag flow placed a Leather Bag and Wooden Sword, added the Sword mention to Why it works, then moved that board item through Needs, Wants, and Good to have; each target accepted it with no page errors. Both changed modules pass `node --check` and `git diff --check`.

### 2026-10-05 Discord channel-creation lockout claim (in progress)

- Codex owns `bot/channel-reconcile.js`, `bot/stats.js`, `scripts/bot-channel-reconcile-smoke.mjs`, and this handoff for stopping recurring bot-created Discord channel/category duplicates. Scope is reuse and update of existing channels only; the bot will not create or delete Discord channels/categories, while its existing messages, roles, stats renames, and layout updates remain intact.

### 2026-10-05 Discord channel-creation lockout complete

- Channel reconciliation is now reuse-only: a missing category/channel logs and aborts that sync instead of POSTing a new Discord resource. Website Stats no longer bypasses that rule for its two periodic voice counters. Existing channels still receive bot messages, role handling, stat renames, and layout updates; the bot never creates or deletes channels/categories.
- Validation: the reconciliation smoke now asserts a missing target performs no POST; it passes. Changed bot modules and layout parse cleanly, the complete bot source has no guild-channel POST route, and targeted `git diff --check` passes. No local `bot:watch` process was running at the audit; deploy/restart the active bot service to apply this lockout.

### 2026-10-05 Discord duplicate channel cleanup complete

- Read the live guild and bot state references before mutation. Deleted 41 unreferenced, exact type/name duplicate channels/categories created by the bot; canonical state-referenced resources were preserved, and child channels were deleted before their duplicate categories.
- Live verification after deletion reports 25 remaining guild channels and zero duplicate type/name groups. The code-level creation lockout remains required on the active bot service to prevent recurrence.

### 2026-10-05 Discord Builds forum image repair claim (in progress)

- Codex owns `bot/announce.js`, `bot/announce-author.js`, the existing build-thumbnail repair path, and this handoff for replacing fragile external board-image embeds with Discord-hosted build attachments. Scope includes repairing the current bot-posted Builds forum messages after the attachment path is verified; build visibility, forum structure, and website Storage policy remain unchanged.

### 2026-10-05 Discord Builds forum image repair complete

- New build forum posts now embed `attachment://build.png` and upload the generated board PNG directly to Discord, avoiding unreliable external-image proxying. The generated image sample was 5.8 MB, within Discord's 10 MB upload limit.
- Repaired all 18 existing bot-posted Build forum threads in place: each now has a Discord-hosted `build.png` attachment and no external embed image URL. Seven boards were rebuilt from their current placements; the remaining eleven reused their verified hosted PNG before being attached. Live verification reports `{ posts: 18, attached: 18, external: 0 }`. `node --check` and targeted diff validation pass. Deploy/restart the active bot service to apply the new-post path.

### 2026-10-05 Discord bot deploy and Builds forum repost complete

- Committed and pushed the Discord fixes as `e3a1c8b` (`Fix Discord build images and channel duplication`) to `main`, which is the configured Northflank service deployment trigger. Northflank status is not available from this workspace, so service health was not asserted locally.
- Deleted exactly 18 bot-tracked Builds forum threads, then re-ran the current publish source. It returned 11 current publishable builds and recreated those 11 threads. Each replacement embed resolves to a Discord CDN `build.png` URL; no external Supabase image URLs remain in the recreated set.

### 2026-10-05 Main-channel Discord links claim (in progress)

- Codex owns `bot/welcome.js` and this handoff while tracing the main-channel message whose channel hyperlinks resolve as Unknown. Scope is limited to resolving live channel IDs and repairing the bot-owned message; no channel/category creation, deletion, or layout changes are authorized.

### 2026-10-05 Main-channel Discord links complete

- The bot-owned welcome guide contained seven stale IDs from deleted duplicate channels. Its sync was also crashing before it could repair them because `LOGO` was undefined. Restored the existing relative logo asset constant, refreshed the live guide, and verified all 16 Discord channel mentions resolve to live guild channels with zero Unknown links.
- Pushed `2403f8a` (`Fix Discord welcome channel links`) to `main`, triggering the configured Northflank deployment path. `node --check bot/welcome.js` and targeted `git diff --check` pass.

### 2026-10-05 Information message deduplication claim (in progress)

- Codex owns `bot/rules.js`, `bot/news.js`, `bot/premium.js`, `bot/quest.js`, and this handoff while retaining the original bot messages in Information and removing only newer duplicates. Scope includes a minimal restart-safe original-message preference; no channel/category mutation is authorized.

### 2026-10-05 Information message deduplication complete

- Preserved the original Rules, Announcements, Premium, and Quest bot messages and deleted exactly four newer duplicate bot messages. Live verification confirms each affected Information channel now contains only its original bot post.
- The four sync modules now prefer their original message IDs, so a stale persistent state cannot replace them with duplicates at the next restart. Pushed `93467d2` (`Keep original information messages`) to `main`; syntax and targeted diff checks pass.

### 2026-10-05 Discord Builds blob creator icon claim (in progress)

- Codex owns `bot/announce-author.js`, `bot/announce-icon.js`, and this handoff while repairing broken generated blob creator icons in the Builds forum. Scope is limited to storing generated blob PNGs in existing public bot image Storage and refreshing affected bot posts; Discord avatars and board images are unchanged.

### 2026-10-05 Discord Builds blob creator icon complete

- Root cause: generated blob icons were written to private `board-stills` but embedded through its public URL, which returned HTTP 400. The existing Discord avatars returned HTTP 200.
- Generated blob icons now use the existing public `discord-builds` bucket. The key version changed to refresh cached blob credits; all four affected forum posts were updated and verified as `image/png` through their live embed URLs. Pushed `b7cb96e` (`Fix Discord build blob icons`) to `main`; syntax and diff checks pass.

### 2026-10-05 Events featured layout claim (in progress)

- Codex owns `js/pages/events/events.css` and this handoff while aligning the Events featured event banner/details proportions with the Home featured-build card. Scope is desktop layout only; event content, mobile stacking, and shared theme files remain unchanged.

### 2026-10-05 Events featured layout complete

- Matched the desktop Events featured card to the Home featured-build proportion: the banner lane is now `1.5fr` versus the details lane at `0.72fr`; the details sheet is vertically centered at 90% of banner height and scrolls only if content exceeds it. The existing mobile stacked layout resets to automatic height.
- Pushed `42493ab` (`Match featured event layout to home`) to `main`. Targeted diff validation passes.

### 2026-10-05 Events featured layout correction

- Reverted the over-compressed banner/details ratio and fixed 90% details height after it squashed event copy. The featured event is back to its balanced `1.35fr` banner / `1fr` details layout with its existing overlap styling intact.
- Pushed `b1bcc42` (`Restore featured event detail space`) to `main`; targeted diff validation passes.

### 2026-10-05 Admin event banner upload claim (in progress)

- Codex owns `js/pages/admin/event-form-markup.js`, `js/pages/admin/event-form.js`, `js/pages/admin/api.js`, `js/pages/admin/tab-events.js`, `js/pages/events/event-card.js`, `js/pages/events/event-drafts.js`, `supabase/functions/admin-builds/index.ts`, the three legal pages, and this handoff while repairing missing uploads from the owner Event editor. Scope is owner-authenticated event image upload to existing public Storage plus a rendered fallback for a missing image; event data remains browser-session draft state.

### 2026-10-05 Admin event banner upload complete

- Root cause: the Event editor saved the selected image filename into its browser-session draft without uploading its bytes, so the public page requested a nonexistent file and returned 404. Event image selections now become bounded data URLs and are sent only to the existing owner-gated `admin-builds` function, which writes a unique public `discord-builds/event-assets/<slug>/...` object and returns its URL.
- Deployed the updated `admin-builds` Edge Function to project `xklkysmakrmgtiztsqug` and pushed site changes as `b183a6c` (`Fix admin event image uploads`). Legal pages were updated for the new owner-uploaded public event art. Existing missing filenames cannot be recovered; reselect and save the banner once to upload it.

### 2026-10-05 Discord build attachment and thumbnail claim (in progress)

- Codex owns `bot/announce.js`, `bot/announce-author.js`, and this handoff while ensuring new Builds forum posts show the board only inside the embed and generated blob creators appear as the embed thumbnail. Scope excludes channel/category resources and existing unrelated Discord layout.

### 2026-10-05 Discord build attachment and thumbnail complete

- Root cause: new forum-thread payloads declared the uploaded board twice: once as the embed's `attachment://build.png` and again as a normal message attachment. New posts now rely on the multipart file for the embed reference alone, so the board is not rendered as a second loose image.
- Blob creator credits use a refreshed key and explicitly assign the hosted blob URL to the embed thumbnail. Refreshed all four current blob-authored posts live and verified each thumbnail URL returns an image. Pushed `8dc585d` (`Keep Discord build image in embed`) to `main`, triggering the configured deployment path; both bot files pass `node --check` and the targeted regression check.

### 2026-10-05 Admin event image upload transport claim (in progress)

- Codex owns `js/pages/admin/event-form-markup.js`, `js/pages/admin/api.js`, `js/pages/admin/tab-events.js`, `supabase/functions/admin-builds/index.ts`, and this handoff while moving owner event image bytes off the Edge Function JSON request limit. Scope remains owner-authenticated uploads to the existing public `discord-builds` bucket; no event-data model or access expansion is authorized.

### 2026-10-05 Admin event image upload transport complete

- The owner-gated Edge Function now mints a signed upload URL after validating only the event slug, asset kind, and allowed image MIME type. The browser uploads the already-bounded image directly to the existing `discord-builds` bucket, so image bytes no longer cross the Edge Function JSON limit.
- Deployed `admin-builds` to project `xklkysmakrmgtiztsqug`. Changed browser modules pass `node --check`; the deployed simulator release's focused smokes and `git diff --check` pass. The full continuous simulator audit remains 13/15 only because its pre-existing 61-row patch-drift baseline and four stale hook-triage entries are intentionally unacknowledged.
- Release commit `ed43204` (`Ship local simulator and create fixes`) is pushed to `main`; GitHub Pages verification found the Create CSS and priority-drop fix live, and the Northflank bot build completed successfully.

### 2026-10-05 Pumpkin through Scale simulator wave claim (in progress)

- Codex owns the narrow simulator handler paths for `pumpkin`, `puzzlebag_l`, `ruby_chonk`, `ruby_egg`, `ruby_whelp`, `sapphire_whelp`, and `scale`; their focused regression, generated ledger/backlog artifacts, simulator validation notes, and this handoff. Scope is source-backed lifecycle and event-order completion on both boards; no unrelated simulator systems or commercial 1:1 claim is authorized.

### 2026-10-05 Pumpkin through Scale simulator wave complete

- Source-ported Pumpkin, Puzzlebag L, Ruby Chonk/Egg/Whelp, Sapphire Whelp, and Scale. Corrections move source prepare/pre-combat work to its actual lifecycle (including Pumpkin fatigue, Puzzlebag cargo amp, Ruby Chonk heat state, Ruby Whelp reflect, and Scale gold speed); Ruby Egg now exposes its source cooldown path.
- Added `scripts/sim-pumpkin-scale-wave-smoke.mjs`, regenerated parity/ledger artifacts, and moved the ledger from 460 to 467 source-ported rows (24 incomplete remain). Focused smoke, syntax checks, ledger check, and diff check pass. Full audit remains 13/15 because of the existing 61-row patch-drift baseline; its hook-triage report now identifies the next concrete lifecycle work as Twine, Steel Goobert, and Vampiric Gloves.

### 2026-10-05 lifecycle-hook closure wave claim (in progress)

- Codex owns the narrow simulator paths for `twine`, `steel_goobert`, and `vampiric_gloves`, their focused regression, generated ledger/backlog artifacts, simulator validation notes, and this handoff. Scope is closing the explicit source `onPrepare` gaps with cached affected-item behavior; no unrelated port wave is in scope.

### 2026-10-05 lifecycle-hook closure wave complete

- Twine now caches only its source primary activation listeners and its secondary chance count during prepare; Steel Goobert caches secondary empowerable weapons; Vampiric Gloves initializes its source active state before combat. The source audit now reports zero item-level lifecycle-hook gaps.
- Added `scripts/sim-lifecycle-hook-closure-smoke.mjs`, regenerated the fidelity ledger, and moved it to 470 source-ported rows with 21 incomplete runtime ports remaining. The next item wave starts with Serpent Staff through Wisp; generic Bow/Card/Weapon base classes remain shared-engine work.

### 2026-10-06 final simulator runtime backlog claim (in progress)

- Codex owns the 21 explicit runtime-port rows (`axe` through `wisp`) in their existing narrow simulator handler modules, the focused source-port smoke checks, `scripts/build-sim-parity-inventory.mjs`, generated simulator ledger/backlog artifacts, and this handoff. Scope is faithful completion of source-backed item handlers only; shared generic base classes remain out of scope.

### 2026-10-06 final simulator runtime backlog complete

- Completed all 21 runtime rows: 491 source-ported and zero runtime-incomplete rows. Source review corrected Serpent Staff and Shepherd's Crook prepare timing, Stone's late Block removal, Thorn Bow/Ukulele/Wisp prepare state, and Ultima's prepared affected-type snapshot; the remaining reviewed handlers already matched their source paths.
- Added `scripts/sim-final-runtime-backlog-smoke.mjs`, regenerated the parity inventory and fidelity ledger, and updated the backlog. Targeted syntax checks, the new smoke, ledger check, and diff check pass. The audit now leaves only one source-unresolved row, one deferred supported-mode gap, and 44 call-review candidates—not incomplete runtime ports.

### 2026-10-06 Time Melting star and lifecycle claim (in progress)

- Codex owns `js/shared/backpack-grid/item-pieces.js`, `js/shared/backpack-grid/rarity-hover.js`, `js/pages/sim/engine/scripts/ports-wave-b.js`, a focused Time Melting regression, and this handoff while correcting Time Melting's duration-only star predicate and source prepare timing. Scope is the extracted `hasInventoryDuration()` rule (`descriptor.hasParam("dur")`) only.

### 2026-10-06 Time Melting star and lifecycle complete

- Root cause: board-item DOM omitted the source `hasInventoryDuration()` fact, so Time Melting’s valid `dur` targets failed the same CanAffect predicate used to light stars. Board pieces now stamp that fact, and the shared predicate also recognizes simulator item params.
- Time Melting now modifies only source `dur` during prepare, then grants Heat at combat start. Added `scripts/sim-time-melting-smoke.mjs`; focused smoke, syntax checks, ledger check, and diff check pass.

### 2026-10-06 simulator 100-percent coverage roadmap claim (in progress)

- Codex owns `docs/sim/sim-100-coverage-todo.md` and this handoff while converting the latest fidelity-ledger audit into an ordered, verifiable completion checklist. This is documentation only; it does not claim unimplemented work as complete.

### 2026-10-06 simulator 100-percent coverage roadmap complete

- Added `docs/sim/sim-100-coverage-todo.md`: an ordered, evidence-first path from the current 491 source-ported rows through unresolved/deferred classifications, shared systems, static-call review, fixture/live validation, and an explicit 100-percent release gate.
- Verified and checked off the ledger gate: `node scripts/build-sim-fidelity-ledger.mjs --check` returns `OK sim-fidelity-ledger: 519 catalog rows`.
- Verified and checked off the focused-smoke gate: final backlog, Time Melting, lifecycle, Pumpkin-through-Scale, Axe/Broccoli, and Wand/Rib smoke scripts all pass.

### 2026-10-06 Flawed Topaz and Chess Board resolution claim (in progress)

- Codex owns the extracted inventory alias for `flawed_topaz`, its explicit gem smoke coverage, the Chess Board supported-mode classification and audit smoke, the generated inventory/parity/ledger artifacts, `docs/sim/sim-100-coverage-todo.md`, and this handoff. Scope is resolving the missing Topaz scene inheritance and replacing Chess Board's ambiguous deferred label with an explicit simulator-supported boundary; full chess movement AI is not being claimed.

### 2026-10-06 Flawed Topaz and Chess Board resolution complete

- Added the missing `FlawedTopaz.tscn` scene alias to the extracted inventory; it now resolves to inherited `Gems/Topaz.gd` with `prepareInventory`, `prepareWeapon`, and `prepareArmor`, and the ledger moved from 1 unresolved row to 0.
- Reclassified Chess Board from `deferred` to an explicit `unsupported_mode`: placement and cooldown visibility remain supported, while in-combat ChessPiece movement/capture AI is documented as outside the simulator's supported mode. Added `scripts/sim-flawed-topaz-chess-boundary-smoke.mjs`; focused smoke, noop audit, syntax checks, ledger check, and final-backlog smoke pass. Current ledger: 492 source-ported, 0 unresolved, 0 deferred, 1 explicit unsupported mode.

### 2026-10-06 no-combat source audit claim (in progress)

- Codex owns the 26-row no-combat source audit, `scripts/sim-no-combat-source-audit.mjs`, `assets/data/sim-intentional-noops.json`, `docs/sim/sim-100-coverage-todo.md`, and this handoff while verifying every listed shop/wearable and ChessPiece source has no independent combat cooldown and recording the board-owned capture-effect boundary.

### 2026-10-06 no-combat source audit complete

- Audited all 14 shop/wearable rows against their extracted sources: direct scripts contain no independent `doCooldownEffect` or `onCombatStart`, and each reason is recorded in `assets/data/sim-intentional-noops.json`; catalog-only rows have explicit inventory evidence.
- Audited all 12 ChessPiece rows: each extends `ChessPiece`, has no independent cooldown, and only exposes board-invoked capture/elimination effects. Added `scripts/sim-no-combat-source-audit.mjs`; source audit, noop audit, Flawed Topaz/Chess boundary smoke, ledger check, and diff check pass.
- The roadmap's final unresolved/deferred/no-combat classification gate is now checked off: 0 unresolved, 0 deferred, and 26 individually evidenced no-combat rows.

### 2026-10-06 shared Weapon engine claim (in progress)

- Codex owns the shared simulator Weapon surface, its focused smoke test, the simulator coverage roadmap, and this handoff while making the extracted `Weapon.gd` lifecycle explicit: stamina gate, attack/damage result, activation, and inherited Item hooks. Scope is shared engine behavior only; Bow/Card systems and item-specific ports remain separate roadmap items.

### 2026-10-06 shared Weapon engine complete

- Registered the extracted `weapon` base with the shared `weaponStrike` surface. It now spends stamina before striking, returns the source hit result, then logs activation in `Weapon.gd.attack()` order.
- Weapon pieces now route their inherited prepare, pre-combat-start, and combat-start hooks through the same explicit surface. The generic base is no longer a handlerless parity row; the audit now has 12 no-handler base/support rows, two hook gaps (`bow`, `card`), and zero untriaged hook gaps.
- Added `scripts/sim-weapon-base-smoke.mjs`, covering source method shape, both board sides, starvation, attack-before-activation order, and inherited lifecycle calls. Focused weapon, final-backlog, noop, and ledger checks pass.

### 2026-10-06 shared Bow engine claim (in progress)

- Codex owns the shared simulator Bow prepare surface, the Bow-derived handler paths (`bow_and_arrow`, `lucky_bow`, `poison_bow`, `thorn_bow`), its focused smoke test, the simulator coverage roadmap, and this handoff. Scope is the source Bow target selection and attacked-listener lifecycle only; Card and unrelated weapon work remain separate.

### 2026-10-06 shared Bow engine complete

- Added the explicit `Bow.gd` prepare surface: it selects and caches the first affected weapon in star-cell order, then attaches the attacked listener before combat-start effects.
- Moved Bow and Arrow, Poison Bow, and Thorn Bow listeners into prepare. Lucky Bow now correctly arms its extra strike from the prepared weapon's critical hit (and does not fire when its stamina gate fails).
- Registered the `bow` base handler and added `scripts/sim-bow-base-smoke.mjs`, which covers first-target selection and all four derived Bow paths. Focused Bow, Shortbow, Wave C, final-backlog, and ledger checks pass; the parity audit now has one hook gap: `card`.

### 2026-10-06 shared Card engine claim (in progress)

- Codex owns shared Card simulator work: `js/pages/sim/engine/scripts/card-chain.js`, `js/pages/sim/engine/scripts/ports-ao-cards.js`, its handler registration/audit wiring if needed, its focused smoke, and the matching simulator TODO entry.

### 2026-10-06 shared Card engine complete

- Added the explicit Card lifecycle: reset reveal state during prepare, deactivate every card before combat, and start the next card before deactivating/revealing the current one.
- Routed every card port through the shared trigger helper, registered the `card` base handler, and removed the resolved Card hook-audit triage.
- Added `scripts/sim-card-base-smoke.mjs`; it proves star-chain order and reveal/trigger/deactivation order.

### 2026-10-06 support-class decision claim (in progress)

- Codex owns the support-class decision record, its focused source-evidence audit, and the matching simulator TODO entry for `dragonegg`, `chesspiece`, `forestfriend`, `goldcounter`, `rotationspring`, `food`, `gemsocket`, `itempushzone`, `socketsnode`, and `bagborder`.

### 2026-10-06 support-class decisions complete

- Documented every extracted support class in `docs/sim/sim-base-support-classes.md`: Food, ForestFriend, and socketed combat behavior are supported; DragonEgg is shop progression with derived egg ports; ChessPiece remains the existing explicit board-AI boundary; the rest are UI/render/title-screen support.
- Added `scripts/sim-base-support-classes-audit.mjs` to pin the source evidence and the relevant derived ports.

### 2026-10-06 hook-gap cleanup claim (in progress)

- Codex owns the strict hook-gap audit cleanup and its matching simulator TODO/handoff update. Scope is removing obsolete triage records only; no unrelated port behavior is being changed.

### 2026-10-06 hook-gap cleanup complete

- Removed all stale hook-triage suppressions now that the raw GDScript-to-JS audit is zero-gap. Strict `audit-sim-gd-parity.mjs --require-triage` now passes with zero raw, untriaged, and stale gaps.

### 2026-10-06 effect-damage candidate claim (in progress)

- Codex owns the seven effect-damage candidate ports and focused smoke: `amulet_of_darkness`, `demonic_flask`, `ice_dragon`, `lightning_potion`, `snowcake`, `sun_shield`, and `thors_hammer`, plus the matching simulator TODO entry.

### 2026-10-06 effect-damage candidates complete

- Routed the seven listed effect-only proc paths through shared `dealEffectDamage`, marked effect damage in the source result, fixed Amulet of Darkness to react to incoming effect damage, and changed Ice Dragon to reduce only the opponent effect-damage factor. Sun Shield now retains normal effect-damage block behavior.
- Added `scripts/sim-effect-damage-candidates-smoke.mjs`; syntax checks, candidate smoke, final-runtime smoke, Wave C smoke, strict parity audit, fidelity ledger check, and `git diff --check` all pass.
- Next step: continue with the remaining unchecked simulator fidelity candidates in `docs/sim/sim-100-coverage-todo.md`.

### 2026-10-06 gem and socket candidate claim (in progress)

- Codex owns the five gem/socket candidate ports and focused smoke: `regular_emerald`, `regular_ruby`, `regular_sapphire`, `regular_topaz`, and `wisp`, plus the matching simulator TODO entry.

### 2026-10-06 gem and socket candidates complete

- Confirmed the four Regular gem inventory/socket paths against their inherited `Gem` sources and existing regression. Added Wisp armor socket cooldown support: its timer now grants source `maxhealth` temporary health once in the simulator loop; Wisp inventory and weapon paths are covered too.
- Added `scripts/sim-gem-socket-candidates-smoke.mjs`; candidate, regular-gem, flawed/flawless-gem, chipped-gem, final-backlog, syntax, strict parity, ledger, and diff checks pass.
- Next step: continue with the remaining unchecked simulator fidelity candidates in `docs/sim/sim-100-coverage-todo.md`.

### 2026-10-06 resource/stack/consumable candidate claim (in progress)

- Codex owns the twelve resource, stack, and consumable candidate ports and focused smoke: `arcane_boots`, `heart_shield`, `piercing_arrow`, `platin_customer_card`, `scissorswords`, `spell_scroll_ice`, `staff_of_unhealing`, `stone`, `stone_golem`, `stone_shoes`, `winged_boots`, and `yggdrasil_leaf`, plus the matching simulator TODO entry.

### 2026-10-06 resource/stack/consumable candidates complete

- Completed the twelve requested paths. Arcane Boots now uses timed linked speed; Heart Shield applies healing amplification, consumes the regeneration threshold, grants max health, and handles its activated ranged/effect block path; Piercing Arrow strips Block in the late critical-hit phase; Platinum Customer Card grants pre-combat reflect stacks to affected Legendary/Godly items; Scissorswords retains Lightsaber weapon inheritance plus blind/luck/regeneration branches; Ice Scroll removes cold only on a lethal hit; Staff of Unhealing expires its temporary Unhealing on engine ticks; Stone uses one-ammo weapon flow and consumes after its throw; Stone Golem registers from prepare and counts only Bag of Stones; Stone Shoes restores timed typed/effect reduction; Winged Boots logs its threshold activation; Yggdrasil Leaf filters Nature links and reacts to used mana thresholds.
- Added `scripts/sim-resource-stack-consumable-candidates-smoke.mjs`; syntax checks, candidate smoke, Wave A-D smoke, and final runtime backlog smoke pass. The simulator tick surface now supports the small number of source timers that need expiry, and attack damage applies actor typed melee/ranged factors.
- Updated `docs/sim/sim-100-coverage-todo.md`; next step is the remaining unchecked damage/stat mutation candidates.

### 2026-10-06 duplicate handler canonicalization complete

- Added `CANONICAL_DUPLICATE_HANDLERS` in `js/pages/sim/engine/scripts/ports.js` for all 19 audited duplicate IDs; runtime behavior remains unchanged and the declared objects match the actual last-spread winners.
- Added `scripts/sim-duplicate-handler-alias-smoke.mjs`; it reruns the strict parity audit and verifies the exact 19 duplicate IDs, canonical object identity, and handler IDs.
- Focused smoke, strict parity audit, no-op audit, fidelity ledger check, syntax checks, Wave A-D smoke, final runtime backlog smoke, and `git diff --check` pass.
- Next step: continue with the remaining unchecked simulator fidelity candidates.

### 2026-10-06 damage/stat mutation candidate claim (in progress)

- Codex owns the seven damage/stat mutation candidate ports and focused smoke: `cupcake_staff`, `dancing_dragon`, `magic_mirror`, `rainbow_goobert`, `rainbow_goobert_adventurer`, `rainbow_goobert_engineer`, and `rainbow_goobert_pyromancer`, plus the matching simulator TODO entry.

### 2026-10-06 damage/stat mutation candidates complete

- Added shared `changeVaryingDamage` mutation support and fractional buff-change tracking for Cupcake Staff and Dancing Dragon; both now bind during prepare and retain source damage values such as +0.2 and +0.5 per stack.
- Corrected Cold Mirror to use the catalog Holy-item reflect increment and proportional capped buff multiplication through the shared `multiplyBuffsLimit` helper.
- Verified Rainbow Goobert, Adventurer, Engineer, and Pyromancer block/heal/buff/debuff/stamina and linked-weapon damage mutations.
- Added `scripts/sim-damage-stat-mutation-smoke.mjs`; focused smoke, source-call audit, strict parity audit, ledger check, syntax checks, no-op audit, Wave A-D smoke, final runtime backlog smoke, and `git diff --check` pass.
- Next step: continue with the remaining unchecked simulator fidelity candidates.

### 2026-10-06 chess call paths claim (in progress)

- Codex owns the board-owned ChessPiece capture/elimination surface for `black_bishop`, `black_king`, `black_knight`, `black_pawn`, `black_queen`, `black_rook`, `white_bishop`, `white_king`, `white_knight`, `white_pawn`, `white_queen`, and `white_rook`, plus its focused smoke, simulator roadmap entry, generated parity/ledger artifacts, and this handoff.
- Scope is source-backed capture, elimination, king notification, and timed effect behavior. Chess Board movement AI remains the documented unsupported simulator mode.

### 2026-10-06 chess call paths complete

- Added explicit handlers for all 12 ChessPiece rows and board-owned `dispatchChessCapture` / `dispatchChessElimination` dispatch. Capture effects, elimination effects, king-wide capture notifications, temporary black-rook crit changes, and white-rook timed resistance now have source-backed simulator behavior; Chess Board movement/capture selection remains the existing unsupported-mode boundary.
- Added `scripts/sim-chess-call-paths-smoke.mjs`; it passes all 12 handlers and effect paths. The call audit drops the reviewed chess candidates, the generated ledger remains at 492 source-ported / 26 no-combat / 0 unresolved / 0 deferred, and the roadmap item is checked off.

### 2026-10-06 ring configuration claim (in progress)

- Codex owns the HistoryDB ring payload decoder/round-trip, create-page ring info-button editor, configured ring tooltip/simulator plumbing, focused ring smoke test, and this handoff. Scope is Magic Ring and Superior Ring trigger/effect choices with the extracted 6-bit-per-effect rules; unrelated item editing remains separate.

### 2026-10-06 ring configuration complete

- HistoryDB decoding now preserves Magic Ring (2 effects / 12 bits) and Superior Ring (3 effects / 18 bits) as validated trigger + stack rows while retaining the raw integer for game-compatible export. Draft/history round-trips and the Python author-history exporter preserve the same payload.
- Create now paints an accessible `i` control on placed rings. It opens a compact filter-panel-style editor with the four source triggers, ten source stacks, exact ring effect counts, amount preview, Cancel/Save, keyboard Escape, and outside-click close. Dragging ignores the control, and edits on attached history use the existing history-unlock flow.
- Create and sim tooltips show configured generated effects. The simulator consumes persisted ring rows instead of rerolling them; unconfigured/manual rings keep the existing seeded random fallback. Published placements now carry validated ring instance JSON through the submit function and `build_placements.instance` migration.
- Added `js/shared/ring-config.js` and `scripts/sim-ring-config-smoke.mjs`; focused ring smoke, HistoryDB catalog recovery, source ring smoke, placement-instance/playback/empty/vs-board smokes, syntax checks, strict parity audit, no-op audit, ledger check, and diff check were run. The existing placement-instance smoke still has its unrelated stale `history max stamina` expectation failure; no ring test fails.
- Owned paths: `js/shared/ring-config.js`, `js/pages/create/ring-editor.js`, create/sim ring plumbing, ring HistoryDB/export helpers, submit-build ring validation, placement-instance migration, and this handoff. Next step: deploy the new Supabase migration/function before relying on published ring configurations.

### 2026-10-07 todo checkbox formatting

- Converted the plain-text entries under `### added by me` in `docs/todo.md`, including the plugin list, into unchecked Markdown task items. Existing completion states were preserved; no product code changed.

### 2026-10-07 Time Melting stun-duration audit complete

- Extracted source confirms `TimeMelting.gd` calls `Item.hasInventoryDuration()`, which is `descriptor.hasParam("dur")`; stun fields (`dur_stun`, `dur_stunself`, and related params) are intentionally outside that predicate. The simulator and star-slot highlighting remain source-faithful, so no stun-duration code change was made. Tooltip sizing remains paused pending user approval of its bounded design.

### 2026-10-07 Create build-info empty-board guard claim (in progress)

- Codex owns the create Build-tab drag/mention guard and focused smoke for preventing item-derived Build Info edits while the board has no placements. Plain text metadata editing remains available; once an item is placed, existing skill, tier, and item-mention behavior remains unchanged.

### 2026-10-07 Create build-info empty-board guard complete

- Added a shared `hasBoardItems` guard for Build Info item-derived edits. Empty boards now reject catalog/board item mentions, skill-slot arming and drops, and tier assignments; title, notes text, class, tags, rank, and other plain metadata remain editable.
- The notes hint explains the empty-board requirement and returns to the existing history/OP copy after the first placement.
- Added `scripts/create-meta-drop-guard-smoke.mjs`; focused smoke, module syntax checks, and `git diff --check` pass.

### 2026-10-07 Responsive visual-change rule complete

- Added a shared `AGENTS.md` rule requiring every visual change to account for supported viewport sizes, using 1440p as the desktop reference and verifying 1080p/short desktop, narrow desktop or tablet, and mobile unless explicitly excluded.
- The rule prefers fluid/clamped sizing and intentional breakpoints and requires deliberate exceptions to be recorded in the owning handoff or page rule.
- Checked off the matching item in `docs/todo.md`; documentation-only change, no product code or runtime behavior changed.

### 2026-10-07 Personal build filters claim (in progress)

- Codex owns the authenticated visibility of `Liked` and `My builds` controls across the Builds feed, profile Builds tab, simulator build browser, and event-detail “View my entry” link, plus the focused regression smoke and this handoff.
- Anonymous users must not see or activate personal filters or event-entry links; existing public build browsing and vote controls remain unchanged.

### 2026-10-07 Personal build filters complete

- The shared Builds filter rail now hides the personal filter group until an authenticated profile is available. Signed-out transitions clear both `liked` and `mine` state, strip stale personal query filters, and prevent anonymous liked filtering in the shared row predicate.
- Applied the gate to `/builds/`, profile Builds, and the simulator public-build picker. Event detail only renders “View my entry” after profile auth resolves and removes it on sign-out.
- Added `scripts/build-personal-filter-visibility-smoke.mjs`; focused smoke, changed-module syntax checks, anonymous `/builds/` browser smoke at 1080p/1440p/mobile, anonymous event-detail browser smoke, and `git diff --check` pass. The existing simulator picker audit timed out before opening its HUD in this environment, so it was not used as evidence for this change.
- Next step: continue with the next unchecked product TODO.

### 2026-10-07 Anonymous vote sign-in claim (in progress)

- Codex owns the shared build vote gate, reusable vote-intent continuation, confirm-dialog styling on feed/build/history pages, focused vote-auth smoke, and this handoff.
- Anonymous upvote/downvote attempts must show the existing confirm preset, launch Discord sign-in only after confirmation, and resume the exact requested direction after OAuth; signed-in vote behavior remains unchanged.

### 2026-10-07 Anonymous vote sign-in complete

- `bindBuildVote` now checks for an authenticated session before changing optimistic score or local vote state. Anonymous upvote/downvote clicks open the shared parchment `confirmDialog`; confirmation stores only a short-lived build slug/direction intent and launches Discord OAuth on the current page.
- Returning OAuth sessions consume that intent and replay the exact direction through the normal signed vote path. Legacy local vote resync is also session-gated, so anonymous page loads do not send vote requests.
- Loaded `confirm-dialog.css` on `/builds/`, build view/history, and profile pages where vote controls render. Added `js/pages/build/vote-intent.js` and `scripts/build-vote-auth-smoke.mjs`; intent smoke, standalone anonymous-dialog browser smoke, OAuth-return continuation browser smoke, changed-module syntax checks, and `git diff --check` pass.
- Updated the matching `docs/todo.md` item and refreshed the vote/auth documentation plus About, Terms, and Privacy descriptions/dates for the sign-in requirement. Server-side vote authorization remains enforced by the existing JWT check.

### 2026-10-07 Create default bag action claim (in progress)

- Codex owns the Create toolbar default-bag action, its confirmation/parked-item flow, icon styling, focused smoke, matching todo checkbox, and this handoff.
- Scope: confirm before replacing an occupied board, preserve current placements in Parked through the existing cap, then place the source-shaped 9x7 default layout (Leather Bags in the interior, Stamina Sacks on the top and left edges). Existing Clear behavior remains unchanged.

### 2026-10-07 Create default bag action complete

- Added the Create toolbar button and matching parchment/gold bag-plus icon. It is available before the first placement while the existing onboarding overlay remains focused on the board.
- Confirmed replacements move the current board into Parked, refuse the action if the existing Parked unique-item cap cannot preserve them, clear attached history through the existing unlock flow, and place 12 Leather Bags plus 5 Stamina Sacks covering the 9x7 board (top and left edges).
- Added `js/pages/create/default-bag.js`, `scripts/create-default-bag-smoke.mjs`, and `scripts/create-default-bag-browser-smoke.mjs`; the smokes cover cancel/no mutation, confirmation, parked preservation, exact layout, replacement placement, and responsive toolbar visibility at 1440, 1080, narrow, and mobile widths. Module syntax checks, both focused smokes, and `git diff --check` pass.
- Checked off the matching `docs/todo.md` item. No authentication, upload, storage, or legal-page behavior changed.

### 2026-10-07 Premium offer visual treatment claim (in progress)

- Codex owns the shared Premium offer popup shell styling and its responsive visual smoke in `js/shared/premium-offer.css` and this handoff.
- Scope is the full popup surface: reset-button-inspired Patch3 panel, restrained gold/rainbow accents, and matching controls; copy, entitlement flows, checkout, and sign-in behavior remain unchanged.

### 2026-10-07 Premium offer visual treatment complete

- Restyled the entire Premium offer surface with the reset dialog’s Patch3 panel, dimmed/blurred backdrop, gold-border controls, restrained meter/rule accents, and a low-intensity rainbow halo retained for the premium feel. Copy and all sign-in, claim, checkout, and billing behavior are unchanged.
- Added `scripts/premium-offer-style-smoke.mjs`; it verifies the panel and CTA treatment plus no overflow at 1440, 1080, narrow, and mobile widths. Syntax checks, the focused style smoke, and `git diff --check` pass.

### 2026-10-07 Game cursor performance claim (in progress)

- Codex owns the shared game cursor runtime and cursor CSS, plus its focused responsive/edge smoke and this handoff.
- Scope is pointer rendering only: coalesce movement work with `requestAnimationFrame`, cache cursor ownership, keep the follower stable at viewport edges/footer, scale desktop art by viewport width, and leave mobile/text cursors native. Drag behavior and cursor artwork remain unchanged.

### 2026-10-07 Game cursor performance complete

- `game-cursor.js` now coalesces pointer/scroll/resize updates into one animation-frame pass, caches per-element cursor ownership, and keeps the full follower active at footer and viewport edges so it no longer swaps/disappears there.
- Desktop follower art scales from the 1440px viewport reference down to compact desktop widths; mobile/touch and text-editing surfaces retain native cursors. Existing pressed/drag cursor kinds and YouTube handling remain unchanged.
- Added `scripts/game-cursor-smoke.mjs`; it verifies edge stability, 1440→1080 scaling, native text input, and mobile behavior. Syntax checks, the focused smoke, and `git diff --check` pass.
- Checked off the matching `docs/todo.md` item. No authentication, upload, storage, or legal-page behavior changed.

### 2026-10-07 Responsive tooltip scale claim (in progress)

- Codex owns the shared desktop tooltip scale helper, item/cosmetic placement, build/event tip placement, deterministic scale smoke, matching todo checkbox, and this handoff.
- Scope: use 1440px as the desktop reference, apply the bounded viewport ratio before each existing edge/rail fit, and preserve current mobile behavior.

### 2026-10-07 Responsive tooltip scale complete

- Added `desktopTooltipScale()` with a 1440px reference, a 0.72 compact-desktop floor, and the existing mobile cutoff. Shared item/cosmetic placement now applies that bound before viewport/rail fitting; build previews and event tags use the same scale before their existing placement math.
- Added `scripts/tooltip-scale-smoke.mjs`; it verifies 1440, 1080, narrow desktop, mobile, invalid-width, and wide-desktop cases. Changed-module syntax checks, the focused smoke, and `git diff --check` pass.
- Checked off the matching `docs/todo.md` item. No authentication, upload, storage, or legal-page behavior changed.

### 2026-10-07 Ring configuration deployment complete

- The previously implemented HistoryDB ring configuration is now live end to end: applied remote migration `20261006000000_placement_instance.sql` and deployed the ring-validating `submit-build` function.
- `supabase migration list` shows the placement-instance migration applied remotely; the ring configuration smoke still passes. No new product-code changes were made in this approval follow-up.

### 2026-10-07 Premium offer interaction lock claim (in progress)

- Codex owns the shared Premium offer page lock, its focused browser smoke, and the matching TODO checkbox.
- While the offer is open, all other document body siblings must be inert and pointer-blocked regardless of their local z-index; the offer layer and its controls remain interactive, and each sibling's prior inert state must be restored on close.

### 2026-10-07 All-build essentials validation claim (in progress)

- Codex owns the Create client/server submit checks, Build-tab guidance, focused validation smoke, legal-page review, and matching TODO checkbox.
- Every submitted build must contain at least one board placement in each of Needs, Wants, and Good to have; OP-only note/tag rules remain unchanged.

### 2026-10-07 Premium offer interaction lock complete

- The shared Premium offer now marks every other `body` child inert while open and restores each prior inert state on close. A CSS pointer-events fallback blocks legacy/high-z-index page layers, while the offer layer remains interactive.
- Added `scripts/premium-offer-lock-smoke.mjs`; it verifies sibling locking, focus containment, restoration, and close behavior. The existing responsive Premium style smoke also passes.
- Checked off the Premium interaction, Premium visual treatment, empty-board Build Info guard, and OP essentials TODO entries that were already implemented. No authentication, upload, storage, or legal-page behavior changed.

### 2026-10-07 All-build essentials validation complete

- Moved the Needs/Wants/Good-to-have requirement out of the OP-only branch: browser validation and the deployed `submit-build` function now reject every submitted build missing any tier; OP-only Theory and 30-character note rules remain unchanged.
- Updated Create guidance, `docs/pages/create-submit.md`, About, Terms, and Privacy descriptions, and added `scripts/create-submit-essentials-smoke.mjs` covering ordinary and OP submissions. Focused smoke, changed-module syntax checks, `submit-build` deployment, and `git diff --check` pass.

### 2026-10-07 Forgotten-approval audit

- Reviewed both handoffs and the recent TODO entries. The only concrete approval-blocked behavior was the Premium interaction lock; the all-build essentials rule was implemented as a related stale requirement and is now corrected/deployed. Remaining unchecked items are separate backlog ideas, intentional simulator/screenshot constraints, or manual infrastructure steps rather than forgotten approvals.

### 2026-10-07 Home cursor lag claim (in progress)

- Codex owns the shared game-cursor runtime/CSS, the focused Home cursor performance smoke, and this handoff.
- Scope: remove the page-wide cursor-style invalidation that makes Home lag while preserving desktop follower art, semantic cursor kinds, text inputs, and native mobile behavior. The Amplitude `ERR_BLOCKED_BY_CLIENT` messages are browser-extension telemetry failures and are out of product scope.

### 2026-10-07 Home cursor lag complete

- Replaced the `html.bpb-live-cursor *` page-wide `cursor: none` rule with a reversible inline hide on just the element beneath the game-cursor follower. Cursor kind lookup now reads the original target style without toggling root classes; pressed cursor kinds remain stable through a drag.
- The focused cursor smoke now verifies local hiding/restoration, 1440/1080/tablet/mobile behavior, edge stability, and native text input. In a clean Home browser with 3,632 elements, 100 live-cursor state flips dropped from about 2.4 seconds to about 8 ms. No auth, uploads, storage, or legal-page behavior changed.

### 2026-10-07 Home cursor lag follow-up claim (in progress)

- Codex owns the Home promo catalog's live-art performance boundary, the shared live-art mount guard, focused Home smoke, and this handoff.
- Root-cause evidence: Home's decorative catalog starts continuous potion/holo canvas work. With that animation loop disabled in a clean 1440p profile, slow animation callbacks fell from 200 to 23 over five seconds. Scope is to keep that display static without changing live art on interactive boards.

### 2026-10-07 Home cursor lag follow-up complete

- Home's promotional catalog now explicitly opts out of live item art. Its item sprites remain visible, but it no longer mounts the continuous potion/holo canvas animation that competed with pointer rendering.
- Added `scripts/home-live-art-performance-smoke.mjs`; the failing-before-fix smoke confirms the Home catalog is static and has zero mounted live-art instances. A clean five-second Home profile now reports zero promo live-art mounts and 24 slow animation callbacks, down from 200. Create and simulator boards remain outside this opt-out.

### 2026-10-07 Native cursor rollback claim (in progress)

- Codex owns the shared custom-cursor entry points and focused native-cursor smoke.
- Scope: remove the global game cursor stylesheet import and navigation runtime import so every page uses the browser/OS cursor again. Cursor art files and unused variable declarations remain available for a future opt-in redesign.

### 2026-10-07 Native cursor rollback complete

- Removed the global `cursor.css` import from `css/theme.css` and the `game-cursor.js` import from shared navigation. Pages now use the browser/OS cursor; cursor assets and the runtime remain dormant for a future opt-in redesign.
- Added `scripts/native-cursor-smoke.mjs`; it verifies the native HTML cursor, no follower element, and no live-cursor class. The smoke and changed-module syntax/diff checks pass.

### 2026-10-08 HistoryDB ring import repair claim (in progress)

- Codex owns the HistoryDB ring-payload decode/normalization boundary, Create draft preservation, focused regression smoke, and this handoff.
- Root cause: decoded ring `instance.persistent` data is dropped by top-level draft normalization, and zero is a valid game ring bit payload that was discarded as if no payload existed. Scope: preserve the exact imported effect rows through Create without changing manual ring editing rules.

### 2026-10-08 HistoryDB ring import repair complete

- Create draft normalization now retains each placement's `instance` payload, so imported ring configurations survive Create load/restore. History decoding records every ring's fixed-width payload, including the valid zero-bit all-default configuration; the ring helper now distinguishes an absent manual configuration from a persisted zero.
- Added `scripts/history-ring-create-smoke.mjs`. It performs the HistoryDB encode/decode and Create-draft restore path, asserting exact imported Magic Ring effects and zero-bit default effects. Focused ring smokes and syntax/diff checks pass.

### 2026-10-08 Ring editor affordance placement claim (in progress)

- Codex owns the Create ring configuration overlay, its locked-board visibility, focused responsive browser smoke, and this handoff.
- Scope: anchor the existing ring info control at the placed ring's visual top-right without inheriting rotation, reuse the Submit-tab info-button treatment, and omit it while attached HistoryDB keeps the board locked.

### 2026-10-08 Ring editor affordance placement complete

- The Magic Ring and Superior Ring editor button now uses the same `cr-submit-info` treatment as Create's Submit info control. It remains a sibling of the rotating sprite, so it stays screen-top-right through every rotation.
- HistoryDB-locked boards hide the button; the editor additionally rejects a stale click while locked. Added `scripts/create-ring-editor-affordance-smoke.mjs`, covering all four rotations at 1440, 1080, narrow desktop, and mobile, plus locked visibility and stale-click prevention.

### 2026-10-08 Imported ring tooltip investigation claim (in progress)

- Codex owns the Create board tooltip's imported-ring effect display, focused regression coverage, and this handoff.
- Reported symptom: a HistoryDB-loaded ring retains its cooldown but its configured effects are absent from the Create tooltip. Investigation is tracing the persisted placement through the board-live tooltip adapter and shared renderer.

### 2026-10-08 Imported ring tooltip repair complete

- Root cause was the shared `framesFromHistoryRun` conversion used by the History picker: it discarded each placement's `instance` payload before the selected frame reached the Create draft. The tooltip adapter and renderer were already able to show retained effects.
- Round frames now preserve `instance`, so imported Magic Ring and Superior Ring effects survive the picker-to-Create path. Added `scripts/history-ring-picker-smoke.mjs`, which exercises the real browser frame converter and asserts the persisted ring effects remain intact.

### 2026-10-08 Parked ring configuration claim (in progress)

- Codex owns the Create Parked-entry/drag transfer of placement instances, focused regression coverage, and this handoff.
- Reported symptom: a manually configured ring loses its saved effects after moving Board → Parked → Board. Investigation is tracing instance payloads through the Parked conversion and drag commit path.

### 2026-10-08 Simulator duration-to-stun audit corrected

- The original source extraction was stale for current game behavior. Live-game confirmation plus the current catalog establish that Puzzlebag of Endurance (+30%) and Time Melting (+55%) extend Hammer's `dur_stun` from 0.5s; the same duration system is not limited to generic `dur`.
- Current simulator bug: Time Melting and Endurance mutate only `params.dur`, while Hammer and other duration-bearing stun effects read `dur_stun` / `dur_stunself`; a direct runtime probe still produces Hammer's unmodified 0.5s stun inside Endurance. The prior assertion that only Black Queen is affected was removed rather than preserved as a false regression claim.
- Follow-up mapping: Puzzlebag of Ruin is `puzzlebag_z` (debuff duplication); Puzzlebag of Endurance is `puzzlebag_j` (duration). Ruin's full duplication fidelity remains a separate simulator gap because its recorded `debuffAmpChance` is not centrally consumed.

### 2026-10-08 Parked ring configuration repair complete

- Root cause: the Parked entry format and Parked-to-board drag seed discarded placement `instance`, which holds configured ring effects. The shared placement rebuild also omitted that payload.
- Parked entries, saved-draft normalization, Parked drag state, and board placement rebuilds now retain `instance`; cargo flattening follows the same rule. Added `scripts/ring-parked-roundtrip-smoke.mjs` covering configured ring Board → Parked → saved draft → Board restoration.
### 2026-10-10 Builds view footer floor complete

- The dedicated Builds view now expands its scaled desktop body to the full viewport before applying the 2560x1440 desktop scale, so the slim footer reaches the bottom at both 1920x1080 and 2560x1440 instead of leaving a scaled-page gap below it.
- The footer host sits beneath the screen-frame overlay on desktop. The frame covers the footer's lower clearance while the slim footer content remains visible above the bottom rim; mobile footer behavior is unchanged.
- Playwright checks at 2560x1440, 1920x1080, and 390x844 confirm no page-height gap or horizontal overflow was introduced.

### 2026-10-10 browser tooling setup complete

- Playwright was already installed and locked in the project at `1.62.1`; no duplicate package, test runner, or production dependency was added. Added `scripts/browser-smoke.mjs` for targeted navigation, console/page-error, failed-request, HTTP-status, viewport, and optional screenshot checks.
- Added project Cursor MCP configuration in `.cursor/mcp.json`, a Windows-safe launcher in `scripts/start-chrome-devtools-mcp.mjs`, the always-applied Cursor browser rule `.cursor/rules/browser-tools.mdc`, and the workflow guide `docs/testing/browser-tools.md`.
- Added the same launcher to the personal Codex MCP configuration at `C:\Users\justi\.codex\config.toml`; that machine-level file is intentionally not committed. The launcher prefers installed Google Chrome, uses an isolated profile, disables MCP usage statistics and CrUX lookups, and redacts network headers. It falls back to Playwright's installed Chrome for Testing binary when stable Chrome is unavailable.
- Verification: Chrome DevTools MCP initialize/tools-list/new-page handshake passed through the launcher with 30 tools, including navigation, snapshot, console, network, and screenshot tools. MCP opened the local site, evaluated page state, navigated to `/builds/`, read console/network state, and captured a screenshot successfully. Playwright smoke passed at 390x844, 1920x1080, and 2560x1440 with HTTP 200, no console errors, page errors, or failed requests. Chrome 155 is now installed; no secrets or production configuration were changed.

### 2026-10-11 Builds view desktop scaling correction complete

- Reworked the dedicated `/builds/view/` desktop scaling so `--build-desktop-scale` zooms only `.build-layout`, following the Items page's viewport-shell pattern. The shared nav, screen frame, background, and slim footer now retain their normal viewport sizing instead of being body-zoomed; mobile remains on the existing stacked layout.
- Removed the fixed desktop frame-edge overrides and body min-height compensation from `js/pages/build/index.js`/`build.css`; nav spacer height now follows the actual unscaled nav height.
- Verification: Playwright screenshots and geometry checks passed at 2560x1440, 1920x1080, and 390x844. At 1920x1080 the page uses body zoom `1`, build scale `0.75`, footer bottom `1080`, and no horizontal overflow. All three viewports reported no console errors, page errors, or failed requests. `node --check js/pages/build/index.js` and `git diff --check` pass.

### 2026-10-11 shared nav density and Builds top-gap correction complete

- The fixed desktop navigation shell now scales from the 2560x1440 reference using the same viewport-density logic as the Builds composition. The in-flow `#site-nav-space` follows the transformed shell's visual bottom, so content no longer waits through the old full-size nav height. The existing <=1100px mobile header and drawer remain unscaled.
- Reduced `.build-main` top padding from `2.25rem` to `0.75rem` so the Builds content starts closer to the nav and gains vertical room. The 2560x1440 reference nav remains unchanged.
- Verification: Playwright checks passed at Builds 2560x1440, 1920x1080, 1600x900, and 390x844, plus Items 1920x1080. Desktop scale values were 1, 0.75, and 0.625 respectively; footer bottoms matched the viewport, horizontal scroll stayed at viewport width, and all checks reported no console errors, page errors, or failed requests. CLI snapshot verification also passed.

### 2026-10-11 custom cursor temporarily disabled

- Replaced all image-backed game cursor variables in `css/cursor.css` with native browser cursor values and removed the global `game-cursor.js` initializer from `js/shared/nav.js`. The cursor follower and YouTube cursor overlay no longer initialize, so pages no longer request `/assets/cursors/*.png`.
- Verification: `node --check js/shared/nav.js` passed and a source scan found no active custom-cursor asset or initializer references.

### 2026-10-11 Chrome DevTools MCP launcher correction

- The project `chrome-devtools` MCP server was configured and exposed but passed a Chrome path with spaces as a split option, causing Chrome DevTools MCP to see only `C:\\Program`. Updated `scripts/start-chrome-devtools-mcp.mjs` to pass a single `--executablePath=<path>` argument through the Windows `cmd.exe` relay.
- Google Chrome exists at `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`; the new launcher passes `node --check`. An audit attempt needs an agent/MCP-server restart before it can use the corrected launcher because the existing server process retains the old arguments. See `docs/pages/home/performance.md` for the measured-status boundary and rerun plan.

### 2026-10-11 home performance audit complete

- The restarted Chrome DevTools MCP completed cache-bypassed production traces at `https://bpbbuilds.com/`: desktop LCP 824 ms / CLS 0.17; constrained mobile (390x844, Fast 3G, 4x CPU) LCP 3,658 ms / CLS 0.18. No console messages, failed requests, or CrUX field data were present; INP was not measured because no interaction was exercised.
- Findings and prioritized recommendations are recorded in `docs/pages/home/performance.md`: make the JavaScript-injected low-priority nav-logo LCP resource HTML-discoverable, correct CLS/skeleton shifts, right-size images (Chrome estimates 2.8 MB savings), defer the broad initial module graph, remove forced reflows, and improve repeat-visit cache lifetimes. The report also distinguishes directly measured delays from planning estimates (including bandwidth-equivalent upper bounds); it is an audit result, not a product-code claim.
- Follow-up scroll trace in the same constrained mobile profile confirms the reported scroll lag: 944 ms total forced reflow work during a 3.6-second top-to-bottom-to-top scroll, with 6,185 DOM elements after scrolling. The principal paths are home promo assembly, backpack-grid render, potion live-art, combat-sky scroll work, and nav scroll-logo work; the report now makes scrolling the first remediation priority.
- Reorganized `docs/pages/home/performance.md` into ten evidence-backed findings and a 12-step implementation sequence. Each step includes rationale plus a traceable success criterion; estimated byte/time impacts are marked as planning estimates, not additive guarantees.

### 2026-10-11 home scroll-performance implementation complete

- Implemented steps 1-3 from the home performance plan in `js/pages/home/`: cache combat-sky scroll range per resize rather than per scroll frame; pause the promo loop outside a 400px viewport margin; freeze promo potion/holo art after its first paint; and defer class, item-explorer, and build-vault mounting until each section is within a 700px viewport margin.
- Validation: syntax checks pass for every edited module. A local Chrome mobile smoke/scroll trace at 390x844, Fast 3G, 4x CPU had no console errors and reported about 1,794 DOM elements after scrolling. The production 6,185-element / 944 ms forced-reflow baseline is not directly comparable to this local run, so the production trace remains the deployment verification.

### 2026-10-11 sim hybrid desktop stage claim (in progress)

- Codex owns `js/pages/sim/sim.css`, `js/pages/sim/controls/sim-round-picker.js`, and this handoff for applying the 2560x1440-to-short-desktop hybrid stage treatment to the simulator fight field.
- Scope: keep the three-column desktop sim and phone stack unchanged, preserve readable page chrome, and scale only the fixed backpack artwork stage to the available desktop height. Combat behavior, board coordinates, HUD semantics, and round/video interactions remain unchanged.

### 2026-10-11 sim hybrid desktop stage complete

- `simBagStageHtml()` now gives every sim backpack the same media-stage wrapper, so boards without history/video also receive the responsive stage without changing round-picker behavior.
- Desktop simulator boards keep the 2560×1440 reference stage at 720×560, scale only the fixed 45rem×35rem backpack artwork by the available stage height, and leave scrubber controls, center controls, avatars, side rails, HUD, navigation, and footer at their normal readable sizes. The <=720px one-column mobile layout remains unchanged.
- Validation: `node --check js/pages/sim/controls/sim-round-picker.js`, `node scripts/sim-playback-smoke.mjs`, `node scripts/sim-empty-state-smoke.mjs`, and `git diff --check` pass. Chrome DevTools MCP representative-stage checks measured transform 1.0 at 2560×1440, 0.75 at 1920×1080, and 0.533 at 1366×768; the 390px mobile path retained `transform: none`. Local browser smoke at 2560×1440, 1920×1080, and 390×844 reported no console/page/request errors. The local static server could not load a Supabase board slug, so a populated live-board screenshot remains a follow-up verification item.

### 2026-10-11 sim compact-stage sizing follow-up claim (in progress)

- Codex owns `js/pages/sim/sim.css`, `js/pages/sim/hud/sim-avatars.css`, `js/pages/sim/controls/sim-round-picker.js`, and this handoff while correcting the first hybrid pass's undersized 1080p backpack and avatar presentation. Scope remains visual density only; simulator behavior and mobile layout are unchanged.

### 2026-10-11 sim compact-stage sizing follow-up complete

- Corrected the short-desktop visual density: at the browser's 1920×1080 window the local board stage now measures 720×493 (~88% of the authored 720×560 canvas) rather than the undersized ~65% first-pass result. The 2560×1440 composition still caps at the authored canvas size. Compact desktop avatars now use bounded responsive sizes (class art tops at 216px at 1920×1080) while the phone-only rules stay unchanged.
- Browser geometry verification found no main-axis overflow at 1920×1080 or 1366×768. `node scripts/sim-playback-smoke.mjs`, `node scripts/sim-empty-state-smoke.mjs`, `node --check js/pages/sim/controls/sim-round-picker.js`, and `git diff --check` all pass.

### 2026-10-11 home performance plan steps 4-6 claim (in progress)

- Codex owns `index.html`, `js/shared/skeleton.css`, `js/pages/home/home-promo-band.css`, `js/pages/home/home-items-explore.js`, `js/pages/home/home-class-showcase.js`, `docs/pages/home/performance.md`, and this handoff for items 4-6 of the documented home performance plan. Scope: HTML-discoverable home LCP logo, stable/composited skeleton presentation, and use of the existing home-appropriate WebP item thumbnails; no data model, asset-generation, or visual redesign work.

### 2026-10-11 home performance plan steps 4-6 complete

- Step 4: Home preloads the full navigation wordmark and includes that same dimensioned, `fetchpriority="high"` image in the parser-visible navigation shell. The normal navigation replacement reuses it after scripts load.
- Step 5: shared skeleton shimmer now animates a transform-only pseudo-element; the short-lived home pending-sprite placeholder is static. Both preserve their existing layout reservation and reduced-motion behavior.
- Step 6: home item-orbit and class starting-bag previews now load the existing 1x WebP derivatives, falling back to a source PNG only when needed. Local constrained-mobile Chrome verification loaded those WebPs successfully with no console messages. The signed remote board-still derivative pipeline is explicitly still pending; the performance report records that remaining scope rather than claiming the full 2.8 MB audit estimate.
- Validation: `node --check js/pages/home/home-items-explore.js`, `node --check js/pages/home/home-class-showcase.js`, and `git diff --check` pass. The implementation is local-only until deployed, so LCP/CLS and byte savings need the documented production trace before they are treated as measured results.

### 2026-10-11 home performance plan steps 7-9 claim (in progress)

- Codex owns `js/pages/home/index.js`, `js/pages/home/home-promo-assemble.js`, `js/pages/home/home-class-showcase.js`, `js/pages/home/home-items-explore.js`, `js/pages/home/home-builds-vault.js`, `js/shared/board-still/index.js`, `js/shared/nav/session.js`, `docs/pages/home/performance.md`, and this handoff for items 7-9. Scope: defer off-screen media/module work on Home and lazy-load payment actions from the shared navigation only on user intent; retain the existing Home visuals, navigation, tooltips, and auth behavior.

### 2026-10-11 home performance plan steps 7-9 complete

- Below-fold Home media now uses native lazy loading/asynchronous decoding with layout dimensions: class portraits, item-orbit and bag thumbnails, vault art, and rendered board stills. Existing section geometry remains in CSS.
- The Home entry dynamically imports class showcase, item explorer, and vault modules only when near the viewport. Deferred observers mount sequentially, so empty section hosts cannot collapse together and trigger every import at startup. Local fresh-load verification had only the class module mounted at the initial viewport; item explorer and vault mounted in order after scrolling.
- Removed the Home promo's import of Create collision/editor dependencies by retaining only its local fixed grid constants and bag discriminator. The shared nav now imports Premium-offer and Stripe-portal logic only when their respective controls are clicked. A fresh local page reported those payment modules plus Create collision and board-thumb modules absent at startup.
- Validation: `node --check` passes for all seven edited JavaScript modules and `git diff --check` passes. Local Chrome confirmed lazy board-still image properties and no runtime errors; production performance numbers remain an after-deploy trace task.

### 2026-10-11 home performance plan steps 10-12 claim (in progress)

- Codex owns `js/pages/home/combat-sky/index.js`, `js/pages/home/featured-stage.js`, `js/shared/nav/scroll-logo.js`, `index.html`, `docs/pages/home/performance.md`, and this handoff for steps 10-12 plus a fresh local Chrome load/scroll audit. Scope: reduce first-view geometry work without changing Home presentation, remove the unused YouTube connection hint, and document/cache-deployment requirements accurately. No service worker or broad asset-pipeline change is authorized without an explicit deployment plan.

### 2026-10-11 home performance plan steps 10-12 complete

- Startup geometry work now avoids a synchronous combat-sky document-height read during boot, batches later range updates, avoids a featured-track `offsetHeight` flush, and skips duplicate nav-spacer writes. The combat-sky hill became the local LCP candidate after earlier optimizations. A trial plain-image preload could not be reused by its CSS mask-image request, so it was removed; the report records the parser-visible-image/refactor follow-up rather than claiming that LCP as solved.
- Removed the unused `www.youtube.com` preconnect while retaining the `i.ytimg.com` hint used by featured thumbnails. The local document check confirmed the removed preconnect.
- Bare GitHub Pages cannot deliver repo-configured immutable cache headers. The existing `npm run stamp-assets` workflow plus a Cloudflare/comparable edge cache rule is the supported implementation path; no service worker was added because its stale-content lifecycle is a separate product decision.
- Fresh Chrome DevTools local audit at 390x844 / Fast 3G / 4x CPU measured LCP 3,829 ms (with a 3,454 ms combat-sky hill discovery delay), CLS 0.18, and a 50 ms largest layout update on cache-bypassed reload. A 3.6-second scripted scroll recorded 1,634 ms overlapping forced-reflow work and 1,972 maximum elements; potion drawing, backpack-grid render, nav scroll read, and combat sky remain the top lag paths. These local figures are explicitly non-comparable to the earlier production trace and the report preserves that distinction.
- Validation: `node --check` passes for combat sky, featured stage, and nav scroll-logo; `git diff --check` passes. Chrome logged no runtime errors, but did retain the existing issue for seven lazy-loaded images without explicit dimensions.

### 2026-10-11 home background option 1 claim (in progress)

- Codex owns `js/pages/home/combat-sky/index.js`, `js/pages/home/combat-sky.css`, `docs/pages/home/performance.md`, and this handoff while implementing the report's first background optimization: a fixed compact-device/reduced-motion fallback with no scroll-linked combat-sky updates. Desktop full scrub behavior remains in scope unchanged; this package will be committed and pushed as requested.

### 2026-10-11 home background option 1 complete

- Compact viewports (`<=767px`), reduced-motion/reduced-data users, Save-Data connections, and devices reporting two or fewer logical cores now receive one fixed `T_REDUCED` combat-sky frame. The fallback performs no scroll-linked `applyTime` updates, disables windmill rotation, and releases animation-only `will-change` hints; resize still updates stage scale. Desktop retains the full scroll-scrubbed sky.
- The performance report now documents the implementation boundary, expected trade-offs, and the follow-up trace needed to measure the reduction against the 1,634 ms local forced-reflow baseline. Existing scene assets remain unchanged; responsive background derivatives are a separate option.
- Chrome verification: at 390x844 the sky had `combat-sky--static`, windmill animation `none`, and an unchanged `--sky-y` before/after a full scroll; at 1920x1080 the static class was absent and `combat-sky-spin` remained active. No runtime errors appeared; the existing seven-image-dimensions issue remains.
- Validation: `node --check js/pages/home/combat-sky/index.js` and `git diff --check` pass.

### 2026-10-11 home background option 2 claim (in progress)

- Codex owns `js/pages/home/combat-sky/index.js`, `js/pages/home/combat-sky.css`, `docs/pages/home/performance.md`, and this handoff while implementing coarse stepped combat-sky updates for the full desktop path. Scope: quantize scroll progress into 2.5% buckets, transition only positional/opacity properties between buckets, preserve option 1's static compact-device fallback, and push the scoped Home performance package.

### 2026-10-11 home background option 2 complete

- Desktop combat-sky scroll progress now advances in 40 buckets (2.5% each). Tint/color writes happen once when a bucket changes; positional and opacity properties use a 120 ms CSS transition. Compact/reduced-motion/data/low-core devices continue to bypass the animated path through option 1.
- Chrome verification at 390x844 confirmed the static fallback remained active and the sky position stayed fixed after scrolling. At 1920x1080 the static class was absent, stepped mode was active, and a 1% scroll retained the initial sky frame while 3% and 8% moved to new bucket values. No runtime errors appeared; the existing seven-image-dimensions issue remains.
- Validation: `node --check js/pages/home/combat-sky/index.js` and `git diff --check` pass. The performance report records the follow-up frame-pacing/self-time trace required before claiming a measured reduction.
### 2026-10-13 Admin Builds view shadow consistency complete

- Codex-owned `js/pages/admin/admin.css` now applies one scoped, fluid `--admin-build-card-shadow` to every build card under Compact, Card, and Grid view containers. The late rule intentionally follows the Patch3 reset, so all three views receive the same inset edge and responsive outer depth without changing layout, actions, or breakpoints.
- Added `scripts/admin-builds-shadow-smoke.mjs` for selector/token/view coverage and `scripts/admin-builds-shadow-browser-smoke.mjs` for computed-style checks at 1440, 1080, 768, and 390px. All three views report the same non-empty shadow and no horizontal overflow at every viewport.
- Verification: focused static and Edge browser shadow smokes, existing `node scripts/admin-builds-views-smoke.mjs`, both new script syntax checks, and scoped `git diff --check` pass. No blockers or behavior changes.
### 2026-10-13 Home scrollbar parity complete

- `css/theme.css` now leaves Home on the same 16px gold/brown root scrollbar as the Builds feed at desktop widths. At the shared `1240px` breakpoint and below, Home switches to the same image-based track/thumb rules and Firefox palette as Builds; Home's overflow behavior remains unchanged.
- Added `scripts/home-scrollbar-smoke.mjs` for static rule coverage and `scripts/home-scrollbar-browser-smoke.mjs` for computed Home/Builds parity at 1440, 1080, 768, and 390px. No horizontal overflow was introduced.
- Verification: both scrollbar smokes, both new script syntax checks, and scoped `git diff --check` pass. No page behavior or asset changes beyond scrollbar styling.
### 2026-10-13 Public Builds view shadow parity complete

- `js/pages/builds/builds.css` now gives the Card, Compact, and Grid content wrappers the same Patch3 surface token, masked shade layer, and stacking boundary. The existing card layout and all view-specific sizing/actions remain unchanged; only the missing Compact/Grid content surface was filled in.
- Added `scripts/builds-view-shadow-smoke.mjs` for shared-selector and markup coverage and `scripts/builds-view-shadow-browser-smoke.mjs` for computed surface checks at 1440, 1080, 768, and 390px. All three view surfaces report the same non-transparent shade and no horizontal overflow.
- Verification: focused static and Edge browser smokes, both new script syntax checks, and scoped `git diff --check` pass. The earlier Admin Builds-only shadow change remains untouched.
### 2026-10-13 Build view density hybrid complete

- `js/pages/build/index.js` no longer applies the 2560Ã—1440 reference `zoom` that made a 1440px-wide desktop composition render at roughly 56% density. `js/pages/build/build.css` now uses a fluid desktop hybrid: side rails clamp from 13rem to 28rem while the central build stage stays at the readable 45rem/720px width whenever the viewport can support it. The <=1100px stacked/tablet/mobile layout remains unchanged, and horizontal overflow stays clipped at the page boundary.
- Added `scripts/build-view-density-smoke.mjs`; it verifies stage density and no horizontal overflow at 1440Ã—900, 1920Ã—1080, 2560Ã—1440, 1080Ã—720, 768Ã—900, and 390Ã—844. The pre-change smoke failed at 1440Ã—900 with a 442.7px stage; the new layout passes with a 720px stage. JS syntax checks, the header layout smoke, title-clearance smoke, and scoped `git diff --check` pass.

### 2026-10-13 Build view header alignment complete

- `js/pages/build/page.js` now renders the build title and authenticity/event tags as a left-aligned identity block, moves the already-bound up/down vote control into a right-aligned header slot, and leaves round navigation/share/remix controls in their existing panel. Vote behavior and anonymous sign-in gating are unchanged.
- `js/pages/build/build.css` gives the header a responsive two-column grid, stacks tags beneath the title, and prevents overflow at desktop, short desktop, tablet, and mobile widths.
- Added `scripts/build-view-header-layout-smoke.mjs`; it verifies source wiring plus title/tag/vote geometry at 2560Ã—1440, 1920Ã—1080, 1440Ã—900, 768Ã—900, and 390Ã—844. `node --check`, the header smoke, the title-clearance smoke, and scoped `git diff --check` pass.

### 2026-10-13 Brainstorming skill removal complete

- Removed the user-level `C:\Users\Justin\.agents\skills\brainstorming` directory at the user’s explicit request. No repository/product files or other skills were changed.
- Verification: the target directory no longer exists; the remaining `C:\Users\Justin\.agents\skills` directory is still present.

### 2026-10-13 Build view title spacing complete

- `js/pages/build/build.css` now gives the build title header a responsive `clamp()` bottom gap so first-row item art that intentionally overhangs the board cannot paint over the title. The rule covers the 2560Ã—1440 reference, short desktop, tablet, and mobile layouts without changing board coordinates or shared pages.
- Added `scripts/build-view-title-spacing-smoke.mjs`. It models the observed 14px board-art overhang and passes at 2560Ã—1440, 1920Ã—1080, 1440Ã—900, 768Ã—900, and 390Ã—844; the pre-change smoke failed at the reference viewport. `node --check`, the focused smoke, and scoped `git diff --check` pass.

### 2026-10-13 Chrome/Edge DevTools MCP availability complete

- Verified the existing `chrome-devtools` MCP is active with page, console, network, CSS, screenshot, and performance inspection tools. Chrome Stable (`155.0.8059.40`) and Edge Stable (`154.0.4258.62`) are installed locally.
- Added a separate `edge-devtools` MCP profile to `C:\Users\Justin\.codex\config.toml`, launching the existing `chrome-devtools-mcp@latest` server against Edge Stable via `--executablePath`. The TOML parses successfully; the new server becomes available after the next Codex restart/session. Microsoft’s Chromium/CDP compatibility means no separate Edge skill or server download is required.
### 2026-10-13 Home board-animation performance lab (in progress)

- Codex owns `admin/performance/pages/home/sections/build-creator-animation/index.html`, `js/pages/admin/build-creator-animation-test.js`, `js/pages/admin/build-creator-animation-test.css`, and the focused smoke check for this isolated owner-only preview. Scope: expose the existing Home board-building animation without site nav/footer, add centered launcher/style controls, and verify responsive geometry at desktop, tablet, and mobile widths. Existing Home production surfaces and shared nav/footer remain out of scope.

### 2026-10-13 Home board-animation performance lab complete

- Added the owner-gated, `noindex` performance lab at `admin/performance/pages/home/sections/build-creator-animation/index.html`. It has no site nav/footer markup and reuses the real Home board-building animation, while keeping the existing compatibility preview at `admin/test/home/sections/buildCreatorAnimation/` intact.
- Extended `js/pages/admin/build-creator-animation-test.js` with two centered control groups: launcher presets (`Catalog`, `Chest preset`, `Creator wave`) and presentation styles (`Home skin`, `Performance`, `Wireframe`). The style controls only change the isolated preview wrapper; production Home markup and behavior are unchanged.
- Added responsive toolbar and style-variant rules in `js/pages/admin/build-creator-animation-test.css`, with deliberate coverage for desktop, short desktop, tablet, and mobile widths.
- Added `scripts/admin-home-build-creator-performance-smoke.mjs` and `scripts/admin-home-build-creator-performance-browser-smoke.mjs`. Both pass; the browser smoke reports centered controls, a non-collapsed preview, no horizontal overflow, and the expected wireframe filter at 1440, 1080, 768, and 390px. Node syntax checks and scoped `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Footer preset gallery and Home footer repair (in progress)

- Codex owns `js/shared/footer.js`, the isolated footer performance-lab page/controller/styles, `js/pages/home/index.js`, `index.html` Home asset versioning, the Home footer style boundary, and focused footer preset smoke checks. Scope: formalize the existing regular/slim footer variants as reusable presets, expose a no-nav/no-footer admin preview that switches between them, and repair the Home footer without changing unrelated page variants or shared nav behavior.

### 2026-10-13 Footer preset gallery and Home footer repair complete

- `js/shared/footer.js` now exposes canonical `FOOTER_PRESETS.regular` and `FOOTER_PRESETS.slim` entries. `initFooter({ preset })` is the reusable API; existing `variant: 'default' | 'slim'` calls remain compatible. Home now explicitly mounts `preset: 'regular'`, with a cache-busted module URL.
- Added the owner-gated, no-nav/no-footer gallery at `admin/performance/pages/shared/footer/index.html`. Its centered controls switch the live preview between Regular and Slim without duplicating footer markup; the two existing compositions are now first-class presets.
- Home footer paint is repaired in `js/pages/home/home-builds-vault.css`: it has an opaque leather gradient, an isolated stacking context, and a stable layer above the fixed combat sky. The Home stylesheet reference is cache-busted in `index.html`.
- Added `scripts/admin-footer-presets-smoke.mjs`, `scripts/admin-footer-presets-browser-smoke.mjs`, and `scripts/home-footer-browser-smoke.mjs`. All pass at 1440, 1080, 768, and 390px with centered controls, distinct regular/slim styling, no horizontal overflow, and a visible isolated Home footer. Node syntax checks and scoped `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Home Player info animation preset (in progress)

- Codex owns `admin/test/home/sections/buildCreatorAnimation/index.html`, `admin/performance/pages/home/sections/build-creator-animation/index.html`, `js/pages/admin/build-creator-animation-test.js`, `js/pages/home/home-promo-band.js`, `js/pages/home/home-promo-band.css`, `js/pages/home/home-promo-assemble.js`, `js/pages/home/home-promo-caption.js`, `js/shared/backpack-grid/render.js`, the isolated animation-lab cache versioning, and focused Player info smoke checks.
- Scope: add a Player info launcher to the existing owner-only Home animation lab; remove the catalog only for that launcher; reveal bags first and remaining items second with the shared placed-board appear motion; preserve the existing Catalog, Chest preset, and Creator wave launchers.

### 2026-10-13 Home Player info animation preset complete

- Added the `Player info` launcher to both the owner-only Home animation lab routes. Its layout keeps the board and CTA presentation, removes the catalog entirely, and renders player identity/build count in the left information column; both route documents are cache-busted to the new controller/style versions.
- Player mode now paints every bag first, waits for the shared placed-board appear motion, then paints the remaining items with the same appear motion. A scoped `appearNewOnly` option prevents bags from replaying when the second wave is painted; existing launchers keep their prior behavior.
- Added `scripts/admin-home-player-info-animation-smoke.mjs` and `scripts/admin-home-player-info-animation-browser-smoke.mjs`. Verification passed for static wiring, JavaScript syntax, the existing animation-lab smokes, and Player info geometry/no-overflow at 1440, 1080, 768, and 390px. No blockers; no push was requested.

### 2026-10-13 Admin animation-lab CSP/config mismatch (in progress)

- Codex owns `js/shared/supabase.js`, `js/shared/auth.js`, `js/shared/entitlements.js`, `js/shared/discord-join.js`, `js/pages/admin/api.js`, `js/pages/admin/build-creator-animation-test.js`, `js/pages/home/home-promo-assemble.js`, `js/pages/home/home-promo-catalog.js`, `js/pages/events/event-gallery-sync.js`, `admin/test/home/sections/buildCreatorAnimation/index.html`, `admin/performance/pages/home/sections/build-creator-animation/index.html`, and focused CSP/config smoke checks while resolving stale Supabase-origin requests on the animation-lab routes.
- Scope: force a fresh generated config module for browser sessions, keep the CSP restricted to the configured Supabase origin, and verify allowed/blocked origin behavior without changing authentication or server authorization.

### 2026-10-13 Admin animation-lab CSP/config mismatch complete

- Corrected the performance animation and shared-footer test pages from the stale invalid `…tsquq.supabase.co` CSP origin to the generated project origin `…tsqug.supabase.co`. The animation compatibility page was already aligned; no wildcard or broad external-origin allowance was added.
- `js/shared/supabase.js` now cache-busts the generated config module, and the animation-lab auth/API, event-sync, catalog, Discord-join, and Supabase imports use the same versioned graph so a deployed test route cannot retain an older Supabase project origin after a config correction.
- Added `scripts/admin-test-csp-smoke.mjs` and `scripts/admin-test-csp-browser-smoke.mjs`. Static CSP/config checks and Edge verification pass: the configured origin returns a network response (401 without credentials, not CSP-blocked), while the stale origin is blocked by policy. No auth/RLS/server behavior changed; no push was requested.

### 2026-10-13 Player info panel chrome removal (in progress)

- Codex owns `js/pages/home/home-promo-band.css` and the focused Player info responsive smoke for this visual adjustment.
- Scope: remove the outer parchment background, frame/border, and shadow only from the Player info preset; Catalog, Chest preset, Creator wave, and shared production Home promo chrome remain unchanged.

### 2026-10-13 Player info panel chrome removal complete

- The Player info card is now transparent with no parchment image, frame pseudo-element, border, or shadow. Other animation presets and production Home promo variants retain their existing chrome.
- The responsive Player info browser smoke now checks computed background, border, shadow, board geometry, catalog absence, and horizontal overflow at 1440, 1080, 768, and 390px. Static wiring, browser smoke, and `git diff --check` pass. No push was requested.

### 2026-10-13 Player info bag/fabric wave choreography (in progress)

- Codex owns `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/item-pieces.js`, `js/shared/backpack-grid/render.js`, `js/pages/home/home-promo-assemble.js`, and the focused Player info animation smoke checks for this scoped visual behavior.
- Scope: keep bag capacity cells mounted while the second item wave paints, and give only the Player info preset a top-left diagonal reveal order for bags and items. Other placed-board and catalog animations retain their existing order and timing.

### 2026-10-13 Player info bag/fabric wave choreography complete

- Added the shared `orderAppearEntries` helper and passed a scoped `appearOrder: 'diagonal'` only to Player Info. Bag sprites, item sprites, and their FilledSlot capacity cells now sweep from the top-left toward the opposite corner; regular placed boards and Itemiary surfaces retain reading order.
- Added a `preserveBagFabric` update option. Player Info keeps the existing FilledSlot DOM and its in-flight animation when the second item wave arrives, instead of rebuilding the fabric and making the squares disappear/reappear. The Home-only fabric fade is disabled for this preset so it cannot override the shared per-cell stagger; other presets retain their existing fade.
- Added `scripts/admin-home-player-info-wave-smoke.mjs` for deterministic diagonal/reading-order coverage and `scripts/admin-home-player-info-wave-browser-smoke.mjs` for DOM-node reuse, retained capacity cells, shared delays, and second-wave item animation. The expanded Player Info static smoke, Node syntax checks, responsive Edge smoke at 1440/1080/768/390px, existing animation-lab smokes, runtime wave smoke, and `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Player info count treatment (in progress)

- Codex owns `js/pages/home/home-promo-caption.js`, `js/pages/home/home-promo-band.css`, and the focused Player Info responsive smoke for this visual adjustment.
- Scope: remove the Player Info kicker and present the build count in the same masked dark stat treatment as the build-info rail, with the `Builds` label above the number. Existing Creator and Home info surfaces remain unchanged.

### 2026-10-13 Player info count treatment complete

- Player Info no longer renders the `Player info` kicker. Its build count now uses the shared Patch3 dark stat shade and places `Builds` above the numeric count; the reusable Creator template keeps its original label-first/number-first defaults unless explicitly configured.
- Added focused static assertions and responsive Edge checks for kicker absence, masked stat shade, label order, board geometry, catalog absence, and no horizontal overflow at 1440, 1080, 768, and 390px. Player Info syntax, static smoke, browser smoke, and `git diff --check` pass. No push was requested.

### 2026-10-13 Player info tag removal (in progress)

- Codex owns `js/pages/home/home-promo-assemble.js`, `js/pages/home/home-promo-caption.js`, and the focused Player Info responsive smoke for this scoped presentation change.
- Scope: keep build tags on the standard Home/Creator/Chest/Catalog presentations while removing the bottom board-tags section only from Player Info.

### 2026-10-13 Player info tag removal complete

- Player Info now suppresses and clears the bottom board-tags section, with a scoped CSS fallback so it cannot occupy visual space. Standard Home, Creator, Chest, and Catalog presentations retain their existing board tags.
- Added static wiring coverage and responsive Edge checks for tag absence alongside the existing Player Info kicker/count, board geometry, catalog absence, and overflow checks at 1440, 1080, 768, and 390px. Focused smoke, syntax, and `git diff --check` pass. No push was requested.

### 2026-10-13 Player info identity sizing (in progress)

- Codex owns `js/pages/home/home-promo-band.css` and the focused Player Info responsive smoke for this scoped visual adjustment.
- Scope: enlarge only the Player Info profile/blob, creator name, and build title with fluid desktop/tablet/mobile bounds; shared Creator and normal Home promo typography remains unchanged.

### 2026-10-13 Player info identity sizing complete

- Player Info now uses a fluid 12.5rem–15rem profile surface, larger creator-name typography, and larger build-title typography. The overrides are scoped to `.home-promo--player-info`, so other presentations retain their existing sizes.
- Extended the responsive Edge smoke to assert profile width, name size, title size, no kicker, count treatment, tag absence, board geometry, catalog absence, and no overflow at 1440, 1080, 768, and 390px. Focused static smoke, browser smoke, syntax, and `git diff --check` pass. No push was requested.

### 2026-10-13 Player info top-right wave ordering (in progress)

- Codex owns `js/shared/backpack-grid/appear-order.js`, `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/item-pieces.js`, `js/shared/backpack-grid/render.js`, `js/pages/home/home-promo-assemble.js`, and the focused Player Info wave smoke.
- Scope: change only the Player Info reveal order to a top-right-origin diagonal sweep while preserving the existing top-left diagonal and reading orders everywhere else.

### 2026-10-13 Player info top-right wave ordering complete

- Player Info now passes a scoped `diagonal-top-right` order through the placed-grid, bag-fabric, and item-wave layers. It starts at the board's top-right and advances through anti-diagonal wave bands; the existing top-left diagonal and reading orders remain unchanged for other surfaces.
- Added deterministic coverage for the new order and an explicit Player Info wiring assertion. Focused wave/runtime smokes, Player Info static/responsive smokes, existing animation-lab and synergy smokes, JavaScript syntax checks, and `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Player info bag-cell fade (in progress)

- Codex owns `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/item-pieces.js`, `js/shared/backpack-grid/render.js`, and the focused Player Info wave smoke for this scoped visual adjustment.
- Scope: make each Player Info FilledSlot capacity cell fade in with its corresponding bag, reusing the existing catalog-style fabric animation timing while preserving cell-node reuse during the item wave.

### 2026-10-13 Player info bag-cell fade complete

- Player Info FilledSlot capacity cells now use the existing catalog-style opacity fade, with the shared per-cell delay that the corresponding bag uses. The change is scoped to Player Info; other placed boards retain their scale-pop fabric animation, and reduced-motion still disables the animation safely.
- Extended the Player Info static and browser smokes to assert the scoped fade animation, matched bag/cell delay, retained fabric nodes, and second-wave item animation. Responsive checks at 1440, 1080, 768, and 390px, syntax checks, synergy smoke, and `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Player info random creator rotation (in progress)

- Codex owns `js/pages/home/home-promo-selection.js`, `js/pages/home/home-promo-assemble.js`, and the focused Player Info build-selection smoke.
- Scope: randomize the Player Info build sequence while excluding the immediately previous creator whenever another creator is available; other Home promo launchers retain their existing order.

### 2026-10-13 Player info random creator rotation complete

- Added `js/pages/home/home-promo-selection.js`, which randomizes each Player Info cycle and filters out the previous creator whenever another creator remains. The last creator is carried across cycle boundaries, so a feed cannot show the same creator twice consecutively; single-creator feeds gracefully fall back to their remaining builds.
- Wired the selector only into Player Info; Catalog, Chest, and Creator launchers retain their existing feed order. Added deterministic selection coverage and extended the Player Info static smoke. Responsive Player Info/browser smokes, animation-lab and synergy regressions, syntax checks, and `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Player info hover pause and build link (in progress)

- Codex owns `js/pages/home/home-promo-activity.js`, `js/pages/home/home-promo-band.js`, `js/pages/home/home-promo-caption.js`, and the focused Player Info activity/link smokes.
- Scope: pause Player Info rotation while the pointer is over its section and verify the displayed board link targets that build's `/builds/view/` page; other promo launchers retain their current activity behavior.

### 2026-10-13 Player info hover pause and build link complete

- Added the shared `createPromoActivity` state gate. Player Info now pauses its build loop on pointer enter and releases the loop on pointer leave, while the existing viewport visibility pause remains intact; Catalog, Chest, and Creator launchers are unchanged.
- The displayed board remains an anchor whose href is refreshed from the active build slug, so clicking the board opens that build's `/builds/view/` page. Added activity/static coverage and verified Player Info responsive/browser smokes, wave and animation regressions, synergy smoke, syntax checks, and `git diff --check`. No blockers; no push was requested.

### 2026-10-13 Player info visible diagonal wave (in progress)

- Codex owns `js/pages/home/home-promo-assemble.js`, `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/item-pieces.js`, and the focused Player Info wave smokes.
- Scope: restore the Player Info bag/item order to a top-left-to-bottom-right diagonal and increase only its visual stagger so adjacent bags/items are perceptibly sequenced; other board surfaces retain their existing timing and order.

### 2026-10-13 Player info visible diagonal wave complete

- Player Info now passes the shared `diagonal` top-left-to-bottom-right order, and its bag/item animation receives a scoped 45ms per-entry stagger. Capacity cells and item sprites now visibly progress through the board instead of appearing together; other placed-board surfaces retain the default 2ms stagger.
- Extended the browser wave smoke to assert `0/45/90/135ms` fabric delays and later item delays. Player Info wave/static/responsive smokes, animation-lab and synergy regressions, syntax checks, and `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Player info hover freeze (in progress)

- Codex owns `js/pages/home/home-promo-activity.js`, `js/pages/home/home-promo-band.js`, `js/pages/home/home-promo-band.css`, `js/pages/home/home-promo-assemble.js`, and the focused activity/wave smokes.
- Scope: freeze an already-running Player Info wave and its hold/depart timers while hovered, then resume the same build when the pointer leaves; viewport pausing and other promo launchers remain unchanged.

### 2026-10-13 Player info hover freeze complete

- Player Info now toggles a scoped paused state on hover, which applies `animation-play-state: paused` to the active board wave. Its wave, hold, and departure timers now use the activity subscription, so hovering freezes progress instead of merely delaying the next build; leaving resumes from the same point.
- Extended the activity smoke for state notifications and verified Player Info wave/static/responsive/browser checks, animation-lab and synergy regressions, syntax checks, and `git diff --check`. No blockers; no push was requested.

### 2026-10-13 Player info performance audit (in progress)

- Codex owns the new audit document `docs/performance/home-player-info-performance-audit.md` and its evidence notes.
- Scope: inspect the Player Info animation section's fetch/query path, sprite decoding/cache lifecycle, DOM/pool/fabric work, animation/paint scheduling, hover/viewport lifecycle, and responsive cost without changing visual behavior or production code.

### 2026-10-13 Player info performance audit complete

- Added `docs/performance/home-player-info-performance-audit.md`, a static/code-evidence audit of the Player Info animation section with local sample measurements, bottleneck severity, visual-safe fixes, a prioritized P0/P1/P2 plan, and a Chrome/Edge trace acceptance plan.
- Highest-risk findings are unbounded Player Info sprite retention/late decode, repeated build normalization and pooled-board/fabric passes, duplicate hidden-author face hydration, per-author creator-count requests, repeated static-extra parsing, and resize/viewport scheduling opportunities. No product code or visual behavior was changed for this audit.
- Verified the new document and handoff with `git diff --check`; existing Player Info focused smokes and syntax checks were already passing before the audit. No blockers; no push was requested.

### 2026-10-13 Player info sprite cache stability (in progress)

- Codex owns `js/pages/home/home-promo-sprite-cache.js`, the Player Info sprite-cache wiring in `js/pages/home/home-promo-assemble.js`, and the focused repeated-cycle cache smoke.
- Scope: bound decoded sprite retention to the active/next build window, warm the next Player Info build before its first paint, and verify cache bounds/order without changing animation visuals or other promo launcher behavior.

### 2026-10-13 Player info sprite cache stability complete

- Added `js/pages/home/home-promo-sprite-cache.js`, a configurable two-build/192-entry decoded-image cache with build-source tracking, LRU touch order, hard trimming, and warm-state introspection.
- Player Info now warms its initial next build before the first board paint and warms each subsequent next build before that build's first visible wave; older random-cycle sprites are pruned. Non-Player promo paths retain their existing background prefetch behavior.
- Added `scripts/home-promo-sprite-cache-smoke.mjs`, which exercises 20 repeated rotations and asserts the entry/build bounds, current/next retention order, next-build warm state before paint, and eviction. Player Info animation/wave/activity smokes, responsive browser checks, syntax checks, and `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Player info P1 CPU/DOM reduction (in progress)

- Codex owns the Player Info normalization and paint paths in `js/pages/home/home-promo-assemble.js`, `js/pages/home/home-promo-caption.js`, `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/render.js`, and any small focused helper/smoke files needed for this slice.
- Scope: memoize normalized build data and sprite URL sets, reuse unchanged Player Info bag/fabric work, skip hidden-caption hydration, guard asynchronous counts to the active build, cache parsed asset extras, and coalesce/defer placed-board resize paints during Player Info waves without changing visuals or other surfaces.

### 2026-10-13 Player info P1 CPU/DOM reduction complete

- Memoized each build's mapped placements, ordered placements, bag subset, item map, and sprite URL set against the parsed extras object; static asset extras now share a module-level promise cache across Home mounts.
- Added a pre-cell-expansion bag-fabric signature so Player Info's second wave reuses unchanged FilledSlot nodes, skipped hidden caption face hydration, deferred creator-count queries, and guarded count application with an active build token.
- Added an rAF-coalesced `setResizePaused()` gate to placed grids; Player Info holds the gate across the bag/item/depart sequence and releases one deferred resize paint afterward. Existing non-Player grids keep their normal behavior.
- Added `scripts/home-promo-p1-performance-smoke.mjs`. Sprite-cache, P1, Player Info animation/wave/activity, responsive browser, syntax, and `git diff --check` verification all pass. No blockers; no push was requested.

### 2026-10-13 Player info P2 scheduling/layer polish (in progress)

- Codex owns the Player Info viewport activation in `js/pages/home/home-promo-band.js`, the performance audit updates, and the new measured P2 smoke.
- Scope: measure the viewport lead and animation/layer properties, tune the preactivation margin without changing the visible wave, and only replace the bag fade selectors if a representative profile shows them as visible work.

### 2026-10-13 Player info P2 scheduling/layer polish complete

- Tuned the Home promo activity observer from a 400px lead to the measured 240px lead. The P2 browser smoke verifies the new near-viewport activation boundary and that the former farther boundary no longer activates.
- Added `scripts/home-promo-p2-performance-smoke.mjs`, which probes a representative 66-item board, records DevTools performance counters, verifies transform/opacity animation names and no new Player Info `will-change`, and benchmarks the bag selector scan.
- The local selector benchmark was ~6.3ms for 5,000 two-selector passes (~0.0013ms/pass), so the scan was not visible enough to justify extra cached-node bookkeeping; it remains intentionally unchanged and covered by the regression probe. P2 smoke, prior sprite/P1/animation/wave/activity/browser checks, syntax checks, and `git diff --check` pass. No blockers; no push was requested.

### 2026-10-13 Player info final optimization handoff (in progress)

- Codex owns the new consolidated report `docs/performance/home-player-info-performance-optimization.md`.
- Scope: document the completed P0/P1/P2 runtime-cost work, measured evidence, visual invariants, verification commands, and the remaining production-device profiling checklist without changing product code.

### 2026-10-13 Player info final optimization handoff complete

- Added `docs/performance/home-player-info-performance-optimization.md` as the consolidated handoff for the completed P0/P1/P2 work. It states the required purpose—improve runtime cost without changing visible composition, timing, ordering, or responsive appearance—then records implementation, measurements, invariants, verification, and remaining production profiling.
- This documentation-only turn changed no product code. Verified the report and handoff with `git diff --check`; no blockers and no push requested.

### 2026-10-13 Resize gate scope correction (in progress)

- Codex owns the resize-gate declarations in `js/shared/backpack-grid/render.js` and the regression assertion in `scripts/home-promo-p1-performance-smoke.mjs`.
- Scope: fix the reported `resizePaused is not defined` runtime error by keeping the gate state in `mountPlacedGrid`, where its observer and Player Info control live; packed grids must remain unaffected.

### 2026-10-13 Resize gate scope correction complete

- Moved `resizePaused`, `resizePending`, and `resizeRaf` from the packed-grid scope into `mountPlacedGrid`, eliminating the observer and `setResizePaused()` ReferenceErrors while preserving the placed-grid coalescing behavior.
- Added a regression assertion that the gate state is absent from packed grids and present in the placed-grid scope. Player Info/P0/P1/P2 smokes, responsive browser checks, syntax checks, and `git diff --check` pass. The auth eligibility notice and font preload messages remain non-fatal warnings outside this fix; no blockers and no push requested.

### 2026-10-13 Build view vote layout (in progress)

- Codex owns `js/pages/build/build.css` and the focused `scripts/build-view-header-layout-smoke.mjs` regression for this scoped visual adjustment.
- Scope: keep the build-view header's vote control aligned to the right and full-height, but place the upvote button to the left of the score and the downvote button to its right at every supported desktop/tablet/mobile test width.

### 2026-10-13 Build view vote layout complete

- The build-view header vote control now remains right-aligned and full-height while rendering as upvote, score, downvote from left to right. The scoped CSS preserves the lower round vote controls and other pages.
- Updated the header-layout smoke to verify horizontal ordering, centered alignment, score placement, icon sizing, and no overflow at 2560, 1920, 1440, 768, and 390px. The focused layout, density, title-spacing, pointer, syntax, and `git diff --check` checks pass. No push was requested.

### 2026-10-13 Build view tag row (in progress)

- Codex owns the build-view tag-row rule in `js/pages/build/build.css` and the corresponding header-layout smoke assertion.
- Scope: keep build tags on one horizontal row beside one another at supported widths, with a contained horizontal overflow path on narrow screens so the page itself does not overflow.

### 2026-10-13 Build view tag row complete

- Build-view tags now use a single non-wrapping horizontal row. Tag children keep their intrinsic widths, and any narrow-screen overflow is contained within the tag row with the scrollbar visually suppressed; the page remains overflow-free.
- Extended the header-layout smoke to verify `nowrap`, one-row geometry, and no page overflow at 2560, 1920, 1440, 768, and 390px. Focused layout, density, title-spacing, pointer, syntax, and `git diff --check` checks pass. No push was requested.

### 2026-10-13 Home section-owned skeletons (in progress)

- Codex owns `index.html`, the Home section-owned skeleton smoke fixtures, and the now-unused `js/pages/home/home-section-skeleton.css` placeholder layer for this scoped loading-state adjustment.
- Scope: remove duplicate page-shell skeleton markup so each Home section module owns its own loading surface and dismissal, while retaining the existing deferred section mounts and responsive section skeleton styles.

### 2026-10-13 Home section-owned skeletons complete

- Removed the duplicate Home page-shell skeleton wrappers and stylesheet. The Home document now keeps empty section hosts; Featured, Promo, Hero, Items, and Vault modules render and dismiss their own section-level skeletons when mounted. Deferred mounting and the single-surface nav skeleton remain unchanged.
- Updated the static and responsive browser smokes to verify module-owned skeleton selectors, one surface per section, positive responsive geometry, and no horizontal overflow at 1440, 1080, 768, and 390px. Home skeleton smokes, syntax checks, and `git diff --check` pass. No push was requested.

### 2026-10-13 Featured description item mentions (in progress)

- Codex owns `js/pages/home/featured-stage.js` and the focused Featured description mention smoke for this bug fix.
- Scope: resolve serialized build item mentions in the Featured carousel description to the same item sprite chips used by the Build view, without changing unrelated Home descriptions or content escaping.

### 2026-10-13 Featured description item mentions complete

- Fixed the data-path mismatch: current builds store their description in `notes`, while Featured was selecting/rendering only legacy `blurb`. Featured now selects `notes`, prefers it with a `blurb` fallback, extracts its serialized `[[item_id]]` references, fetches only those item rows plus sprite metadata, and renders shared escaped sprite chips.
- Added `js/pages/home/featured-mentions.js`, scoped chip styling, and static/runtime smokes covering item id, image source, escaping, notes-first fallback, and no-mention lookup avoidance. Featured syntax, mention smokes, Home skeleton smokes, responsive skeleton coverage, and `git diff --check` pass. No push was requested.

### 2026-10-14 Vault Hunters tooltip motion audit (in progress)

- Codex owns `js/shared/tooltip-hover.js`, `js/shared/tooltip-motion.js`, `js/shared/tooltip.css`, the focused tooltip transition smokes, and the new tooltip audit note.
- Scope: compare the Vault Hunters gear hover lifecycle with our shared tooltip host, fix descendant pointer churn and anchor-to-anchor fade timing without changing tooltip content, placement, scale, or responsive behavior, and verify desktop/tablet/mobile plus reduced-motion states.

### 2026-10-14 Vault Hunters tooltip motion audit complete

- Audited the Vault Hunters gear/loadout surface and reproduced its Tippy fade: per-card poppers use `animation: "fade"`, `data-animation="fade"`, and a `0.3s` opacity/transform/visibility transition. Added the evidence and implementation notes to `docs/performance/tooltip-motion-audit.md`.
- Fixed the local shared host so bubbling descendant `pointerover` events do not re-render the same anchor or restart its fade. Anchor changes retain the shared crossfade, and the cadence now matches the audited 300ms reference; reduced-motion remains motionless.
- Added a nested-descendant regression to the browser smoke and verified enter, switch, exit, responsive (1440/1080/tablet/mobile), and reduced-motion behavior. Tooltip transition/static, scale, parity, syntax, and `git diff --check` checks pass. No blockers; no push was requested.

### 2026-10-14 Discord /item command (in progress)

- Codex owns `bot/commands/item.js`, `bot/item-tooltip.js`, `bot/commands/index.js`, `bot/watch.js`, the bot image asset list in `bot/Dockerfile`, the focused `/item` smoke, and this handoff.
- Scope: add an autocomplete-backed `/item` lookup, render the item icon as the embed thumbnail, render a tooltip-style PNG as the large embed image, include the requested combat/catalog/effect fields, and link the public-build count to the existing `q=[[item_id]]` Builds filter. No browser secrets or service-role credentials will be exposed.

### 2026-10-14 Discord /item command complete

- Added the registered `/item` slash command with name/ID autocomplete, exact-or-name catalog lookup through the server-side Supabase service-role path, and safe “not found” handling.
- Added the requested embed details: item icon thumbnail, generated tooltip image, damage, stamina, accuracy, cooldown, cost, rarity, class, category, effect/type tags, and a deduplicated public-build count linking to the existing `q=[[item_id]]` Builds filter.
- Added server-side PNG rendering using the existing item sprites, tooltip frames, and tooltip fonts. Docker now packages the frame/divider/font assets needed by the command. Autocomplete and command execution are routed by the persistent watcher.
- Added `scripts/discord-item-command-smoke.mjs`; it passes static registration/asset checks and runtime embed/link assertions. `node --check` passes for all touched bot modules; command registry import and an actual canvas icon/tooltip render smoke also pass. Guild command registration completed successfully with 5 commands. No secrets were added and no push was requested.

### 2026-10-14 Builds empty-state typography (in progress)

- Codex owns the Builds feed empty-state rule in `js/pages/builds/builds.css`, the focused style smoke, and this handoff.
- Scope: make “No builds match these filters.” use the shared outlined white display-label treatment used by navigation, with fluid sizing across desktop, tablet, and mobile.

### 2026-10-14 Builds empty-state typography complete

- Updated `.builds-feed__empty` to use the shared display font, white label fill, outlined label stroke, larger clamped typography, and responsive spacing.
- Added `scripts/builds-empty-state-style-smoke.mjs`. Static smoke, syntax checks, `git diff --check`, and a Playwright viewport probe pass at 1440, 1080, 768, and 390px. No blockers.
- Committed and pushed with the current bot, tooltip, Home, and Builds work as commit `48cec4a`. Local scratch files containing test credentials, database operations, summaries, and temporary screenshots were intentionally left untracked and were not pushed.

### 2026-10-14 Home static Night background (in progress)

- Codex owns the Home combat-sky mode in `js/pages/home/combat-sky/index.js`, its CSS, the admin background-preview call site, related Home background documentation, and the focused background smokes.
- Scope: keep the Home page at the established Night preset while preserving only the windmill blade animation; the admin background preview retains explicit scroll mode.

### 2026-10-14 Home static Night background complete

- Home now paints the existing Night preset (`25.8`) once, pins the moon to the same Night-preview placement, and attaches no scroll listener. The windmill blades remain CSS-animated, with reduced-motion still honored.
- Scroll-scrub behavior remains available only through `initCombatSky({ mode: 'scroll' })` for the owner admin background preview. Product homepage/theme docs now describe the fixed Night scene and animated windmill.
- `scripts/home-background-mode-smoke.mjs` and `_audit-combat-sky.mjs` cover the static frame, opt-in admin scroll mode, unchanged sky after scroll, and active windmill animation. Both pass with module syntax checks and `git diff --check`.

### 2026-10-14 Home build title/icon overlap (in progress)

- Codex owns the build-animation title surface in `js/pages/home/home-promo-band.css`, its caption markup in `js/pages/home/home-promo-caption.js`, and the focused long-title regression smoke for this task.
- Scope: reserve a responsive icon slot so long build titles wrap/truncate without colliding with the class icon, while keeping the title visually centered across desktop, short desktop, tablet, and mobile widths.

### 2026-10-14 Home build title/icon overlap complete

- Replaced the create-promo title row's absolute icon overlay with a responsive three-column grid: equal icon slots keep the title centered while reserving room for the class mark. Titles now wrap naturally and remain clamped to the existing two-line Player Info treatment without horizontal overflow.
- Added `scripts/home-promo-long-title-smoke.mjs` covering 1440, 1080, tablet, and mobile widths; updated `scripts/home-promo-title-surface-smoke.mjs` for the reserved-slot contract. Both pass, as do the Player Info animation smokes and JS syntax checks. No legal or security surfaces changed.

### 2026-10-14 Builds view textured surfaces (in progress)

- Codex owns the public Builds view surfaces in `js/pages/builds/builds.css`, their focused surface smokes, and this handoff.
- Scope: remove listing separator lines and the current Patch3 shadow layer from card, compact, and grid views; apply the existing dark textured background and the Home build-animation card radius consistently across supported desktop, tablet, and mobile widths.

### 2026-10-14 Builds view textured surfaces complete

- Card, compact, and grid listing wrappers now use `bg-dark-textured.webp`, `border-radius: 1.5rem` (matching the Home build-animation card), and no box shadow/Patch3 overlay. Listing and grid separator borders are removed, including skeleton listing separators.
- Updated `scripts/builds-view-shadow-smoke.mjs` and its browser smoke to assert the shared texture, 24px radius, no shadow layer, no separator borders, and zero horizontal overflow at 1440, 1080, 768, and 390px. Build density, header layout, title-spacing, syntax, and `git diff --check` checks pass. No legal or security surfaces changed.

### 2026-10-14 Builds card header surface complete

- Card view now paints the dark textured rounded surface on the outer `.builds-post`, covering the avatar, author, title, tags, vote controls, board, details, and actions together. Its inner body is transparent so the texture continues behind the complete card; compact and grid retain their own textured content wrappers.
- Extended the Builds surface smokes to assert the card parent surface, transparent card body, shared 24px radius, no shadows/separators, and responsive no-overflow behavior. Existing Builds density/header/title checks and syntax validation pass. No legal or security surfaces changed.

### 2026-10-14 Builds card info tiles (in progress)

- Codex owns the card-view Class/Rank/Sub/Gold tile treatment in `js/pages/builds/builds.css`, its focused surface smoke, and this handoff.
- Scope: replace the faded Patch3 tile overlays with the same dark radial hero-card surface, border, and rounded corners used by the Home hero cards. Compact and grid views do not contain these card-only info tiles.

### 2026-10-14 Builds card info tiles complete

- Class, Rank, Sub, and Gold tiles now use the Home hero-card treatment: `radial-gradient(circle at top center, #2a2420, #14110f)`, the matching `#3a322c` edge, and a 1.5rem radius. The former faded Patch3 overlay is removed.
- Added `scripts/builds-card-info-surface-smoke.mjs` for computed-style coverage at 1440, 1080, 768, and 390px. Builds surface, density, header, title-spacing, syntax, and `git diff --check` checks pass. No legal or security surfaces changed.

### 2026-10-14 Tooltip switch flash (in progress)

- Codex owns the shared tooltip transition contract in `js/shared/tooltip.css` and its transition smokes for this task.
- Scope: remove the replacement-card flash when moving directly from one tooltip anchor to another, while preserving the existing enter/exit fades, custom build/event tooltip behavior, and reduced-motion handling.

### 2026-10-14 Tooltip switch flash complete

- Root cause: anchor switching replaced the tooltip content before starting a `1 → 0 → 1` animation, so the new card was briefly visible, faded out, and appeared again. The switch animation now starts at opacity 0 and fades the replacement card in once.
- Updated `scripts/tooltip-transition-smoke.mjs` and `scripts/tooltip-transition-browser-smoke.mjs` to assert no initial replacement flash, one clean switch fade, custom tooltip parity, responsive 1440/1080/tablet/mobile behavior, and reduced-motion support. Tooltip scale/parity audits and JS syntax checks pass. No legal or security surfaces changed.

### 2026-10-14 Home Player Info description item icons (in progress)

- Codex owns the Home Player Info description rendering paths in `js/pages/home/home-promo-caption.js`, `js/pages/home/home-promo-assemble.js`, the scoped icon styling in `js/pages/home/home-promo-band.css`, any small shared Home helper required by that renderer, the focused regression smoke, and this handoff.
- Scope: make serialized item mentions in the Home build-animation description render their item icons using the existing catalog sprite metadata, without changing description text, escaping, tooltip behavior, or other Home/Builds surfaces.

### 2026-10-14 Home Player Info description item icons complete

- Home promo queries now include the current `notes` field and prefer it over legacy `blurb`, matching the Build view description source. Serialized `[[item_id]]` mentions are rendered through the shared escaped mention renderer, with board placements and a single targeted catalog lookup covering mentions for items no longer on the board.
- Added responsive Home promo mention styling and focused static, runtime, and Playwright smokes. Verification passed at 1440, 1080, tablet, and mobile widths, including icon source/dimensions, current-notes precedence, no overflow, Home Player Info wave/fabric, activity/selection, production audit, syntax, and `git diff --check`. No legal or security surfaces changed.

### 2026-10-14 Discord `/item` autocomplete loading failure (in progress)

- Codex owns `bot/commands/item.js`, `bot/watch.js`, the focused autocomplete regression smoke, and this handoff for this bug.
- Scope: trace the Discord 3-second autocomplete response path, make item suggestions available from a bounded startup cache with a safe network fallback, and preserve the existing `/item` execution/embed behavior. No browser secrets or service-role credentials will be exposed.

### 2026-10-14 Discord `/item` runtime readiness follow-up (in progress)

- Codex owns `bot/commands/item.js`, `bot/commands/index.js`, `bot/watch.js`, the focused `/item` readiness/autocomplete smoke, and this handoff.
- Scope: guarantee a bounded autocomplete acknowledgement even when the startup catalog request is unavailable, and keep the deployed interaction route and command registry sourced from the same handler map so `/item` cannot fall through to the generic not-ready reply. Existing item lookup/embed behavior and server-side credentials remain unchanged.

### 2026-10-14 Discord `/item` runtime readiness follow-up complete

- Autocomplete now has a 2.2-second response deadline. A slow or failed cold catalog request returns a valid empty choice list before Discord expires the interaction, while the in-flight warm/fallback request can populate the cache for the next keystroke. Warmed name/ID filtering remains local and exact/name `/item` lookup is unchanged.
- Exported the canonical command-handler lookup and added parity coverage so every registered slash command, including `/item`, has a live handler. The watcher now reconciles the guild command registry from that same canonical list at Gateway readiness, eliminating stale command definitions after a deployment.
- Added `scripts/discord-item-readiness-smoke.mjs`; it covers delayed and failed autocomplete acknowledgement, command/handler parity, and startup guild command synchronization. Focused `/item`, `/commands`, `/inv`, syntax, and `git diff --check` verification pass. `npm run bot:commands` registered all 6 current guild commands successfully. No secrets, legal, or security surfaces changed.

### 2026-10-14 Discord `/item` autocomplete loading failure complete

- Root cause: every Discord keystroke waited on an uncached Supabase REST request with no timeout. A slow or transient network response could miss Discord's three-second autocomplete acknowledgement window and show “Loading options failed.”
- Added a bounded 1,000-row name/ID catalog cache warmed when the Discord client becomes ready, local filtering for each keystroke, an 1.8-second abortable REST fallback, and safe response parsing. Existing item lookup, build counts, and embed rendering are unchanged.
- Added a timing/filter regression smoke and extended the `/item` static smoke. Warmed autocomplete responds locally in ~1ms after a ~371ms catalog warm-up in this environment; command, syntax, and `git diff --check` verification pass. No secrets, legal, or security surfaces changed.

### 2026-10-14 Discord `/inv` inventory grid (in progress)

- Codex owns `bot/commands/inv.js`, the focused inventory-grid smoke, and this handoff for this feature.
- Scope: replace the one-cosmetic-per-page image with a paginated 3×3 grid, preserve server-side ownership filtering and Previous/Next controls, and include readable per-page item labels without exposing private profile data.

### 2026-10-14 Discord `/inv` inventory grid complete

- `/inv` now renders nine owned cosmetics per page in a 3×3 composite PNG grid, with each cell showing the blob base plus its cosmetic overlay. Page descriptions list every visible item with slot and rarity, and Previous/Next now paginate by grid page rather than individual item.
- Ownership rules, owner access, profile lookup, and user-scoped button IDs remain unchanged. Added `scripts/discord-inventory-grid-smoke.mjs`; grid pagination, PNG dimensions, embed attachment, navigation, existing `/item` smokes, bot syntax, and `git diff --check` all pass. No secrets, legal, or security surfaces changed.

### 2026-10-14 Discord `/commands` help embed (in progress)

- Codex owns the bot command registry/help handler files, focused smoke, and this handoff for this task.
- Scope: add a registered `/commands` command whose embed is generated from the canonical command definitions and includes every available command with a concise description. No existing command behavior or secrets change.

### 2026-10-14 Discord `/commands` help embed complete

- Added `bot/commands/commands.js` with the `/commands` definition, a data-driven `commandsEmbed`, and an ephemeral interaction handler.
- Registered `/commands` in `bot/commands/index.js`; the embed is built from that same canonical registry, so every deployed command gets one `/name` field with its current description.
- Added `scripts/discord-commands-help-smoke.mjs`, including coverage that every registered command appears in the embed. The focused smoke, existing `/item` command/autocomplete smokes, `/inv` grid smoke, bot syntax checks, and `git diff --check` pass. No legal, security, or browser surfaces changed.

### 2026-10-14 Home Player Info Create CTA (in progress)

- Codex owns `js/pages/home/home-promo-band.css`, the Home promo CTA markup/renderer if needed, the focused responsive smoke, and this handoff for this task.
- Scope: restyle the existing build-animation Create action as a real CSS/Tailwind-style rounded pill matching the red event-banner treatment with an inset gold outline. Preserve its route, accessible label, animation, and responsive behavior.

### 2026-10-14 Home Player Info Create CTA complete

- Replaced the raster `ui-btn-crimson.png` background on the build-animation Create link with a responsive CSS pill: crimson gradient, dark outer edge, inset gold rim, hover/active/focus states, and the existing backpack icon/route retained.
- The CTA uses clamped sizing and mobile overrides so the pill remains readable at 1440, 1080, tablet, and mobile widths. Added `scripts/home-promo-create-cta-smoke.mjs`; the focused CTA/browser checks, long-title/title-surface/player-info smokes, syntax check, and `git diff --check` pass. No legal or security surfaces changed.
### 2026-10-14 Items page performance audit (in progress)

- Codex owns `docs/performance/items-page-performance-audit.md` for this audit and its evidence only; no product code is being changed.
- Scope: section-by-section load, filtering, catalog scrolling/virtualization, tooltips/live art, spotlight interactions, and responsive/shared chrome. Report will contain measured pain points, ranked fixes, acceptance checks, and explicit not-checked items.

### 2026-10-14 Items page performance audit complete

- Added `docs/performance/items-page-performance-audit.md` with a section-by-section audit of bootstrap/shared chrome, catalog data/first paint, filters/search, virtualization/scrolling, sprites/tooltips/live art, spotlight, responsive CSS, and wheel forwarding.
- The report records local Chromium evidence at 1440×900 plus a 4× CPU profile: ~1.07 s catalog readiness, ~596–878 ms filter interactions under throttle, scroll frame gaps up to ~66.7 ms, long tasks around 59/92/65 ms, and the warm pool growing to all 518 item nodes.
- Ranked P0/P1/P2 fixes focus on decoupling filter/scroll geometry from sprite decode, immediate rAF window updates, bounded DOM/sprite LRU, smaller adaptive overscan, normalized filter/pack caches, deferred shared chrome/live art, and explicit publish-ready acceptance checks. No product code or legal/security surfaces changed.

### 2026-10-14 Shared item shadow images (in progress)

- Codex owns `js/shared/backpack-grid/item-pieces.js`, `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/backpack-grid.css`, the focused shadow regression smoke, and this handoff for this task.
- Scope: remove duplicate item silhouette image requests from the shared item renderer and use a CSS alpha-based drop shadow with the existing game offset/opacity, preserving item rotation, bags, hover states, tooltip/spotlight behavior, and responsive sizing.

### 2026-10-14 Shared item shadow images complete

- `createItemEl()` no longer emits a second shadow `<img>` or shadow spin. A `bpb-bg__item--no-shadow` marker preserves explicit opt-outs; normal items use the shared sprite alpha for the shadow.
- Shared backpack-grid CSS now paints the game-equivalent 5/80-cell SE silhouette with `drop-shadow`, compensates local offsets for all four faces, keeps bags at the softer 0.45/0.75px treatment, and preserves affected/hover states. Itemiary, boards, simulator, spotlight, and responsive surfaces therefore decode one art image per item.
- Added `scripts/item-shadow-smoke.mjs`; it checks the renderer has no duplicate shadow image, verifies normal/affected/no-shadow CSS behavior in Chromium, and confirms no duplicate shadow image is mounted. Focused shadow, bag-synergy, duration-hover, ring-editor, simulator-visual, syntax, and `git diff --check` checks pass. The existing `_audit-itemiary-virtual` and `_audit-item-anims` live checks still have unrelated environment/legacy assertions (pool-size and simulated-board selector timeouts); no legal or security surfaces changed.

### 2026-10-14 Items page P0 performance fixes (in progress)

- Codex owns `js/pages/items/index.js`, `js/shared/nav.js`, `js/pages/items/catalog/index.js`, `js/shared/backpack-grid/item-pieces.js`, `js/shared/backpack-grid/item-pool.js`, `docs/performance/items-page-performance-audit.md`, the focused P0 smoke, and this handoff for this task.
- Scope: overlap catalog bootstrap with non-critical navigation decoration after access is granted, and make filter geometry/count updates immediate while item sprites warm progressively off the blocking paint path. Preserve access gating, composition, animation timing, and responsive layout.

### 2026-10-14 Items page P0 performance fixes complete

- Items catalog initialization now starts from `initNav(..., { onAccessGranted })` immediately after the shared access gate resolves; nav decoration and image waits remain independent. A fallback prevents duplicate initialization if the callback cannot start.
- Filter interactions compute the filtered result once for the immediate count and the next animation-frame paint. Itemiary sprite warming is non-blocking and progressive, with an active paint-generation guard so stale decode work cannot unhide a reused node.
- Checked the first two P0 entries in `docs/performance/items-page-performance-audit.md`; no markup, dimensions, styling, access behavior, or responsive breakpoints changed.
- Added `scripts/items-p0-performance-smoke.mjs`: static bootstrap/paint contracts plus a Chromium delayed-sprite test (fast item clears while slow item remains pending, then both complete). The focused smoke, shared item-shadow smoke, syntax checks, and `git diff --check` pass. The existing `_audit-itemiary-virtual.mjs` still reports its pre-existing `mid-scroll DOM exploded 518` pool-cap assertion; that is the separate unchecked P0 pool/LRU item.

### 2026-10-14 Items page P0 scroll/pool fixes (in progress)

- Codex owns `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/item-virtual.js` if needed, `scripts/items-p0-performance-smoke.mjs`, `docs/performance/items-page-performance-audit.md`, and this handoff for this task.
- Scope: replace delayed scroll-only window refresh with an immediate passive-scroll rAF plus trailing catch-up, and bound Itemiary parked DOM/sprite entries with an LRU while retaining the current visible window. Preserve composition, spacing, item order, and responsive behavior.

### 2026-10-14 Items page P0 scroll/pool fixes complete

- Itemiary scroll now queues a passive next-frame virtual-window paint immediately, while the 64 ms settle and 320 ms fling timers remain as trailing catch-up passes. The scroll path still suppresses entrance-wave layout work.
- Added a configurable `poolCap` with a 480-entry default. Visible entries stay pinned; the least-recent parked entries are recycled with `recycleEntry()`, releasing DOM, sprite `src`, and live-art resources. LRU recency is updated only for painted entries, so normal visual ordering and composition are unchanged.
- Marked P0 items 3 and 4 complete in `docs/performance/items-page-performance-audit.md`. Extended `scripts/items-p0-performance-smoke.mjs` with a next-frame scroll assertion and a 1,200-item bounded-pool browser cycle. The focused smoke passes (initial 152 nodes, post-scroll 304, cap 480); syntax and diff checks pass. The legacy `_audit-itemiary-virtual.mjs` has no page errors but still expects the old `<400` mid-scroll total while the current 24em overscan mounts 449 visible entries; that threshold belongs to the remaining overscan item and is intentionally not changed here.

### 2026-10-14 Items page P0 overscan/filter cache fixes (in progress)

- Codex owns `js/pages/items/catalog/index.js`, `js/pages/items/catalog-filters.js`, `js/shared/backpack-grid/item-pool.js`, `scripts/items-p0-performance-smoke.mjs`, `docs/performance/items-page-performance-audit.md`, and this handoff for this task.
- Scope: replace the fixed Itemiary 24em overscan with a measured viewport-relative band, and normalize/cache filter metadata/results by state signature while preserving the exact default layout, item ordering, visual composition, and responsive behavior.

### 2026-10-14 Items page P0 overscan/filter cache fixes complete

- Replaced the Items catalog's fixed 24em prefetch band with a measured adaptive 6–14em band based on viewport rows and scroll velocity. Other backpack-grid callers retain their existing defaults; item order, cell dimensions, and visible art composition are unchanged.
- Added one normalized filter index per catalog data generation (lowercased names, class masks, type/stack/category memberships, rarity/origin flags) and a bounded 64-entry filter-result cache keyed by the complete filter state signature. Initialization, count updates, filter paints, and responsive repaints now reuse the same result instead of rescanning the catalog.
- Tuned the shared Itemiary pool default to 384 entries so the reduced overscan has a small reserve without retaining the full library. The focused P0 smoke, broad Itemiary virtual audit, syntax checks, and `git diff --check` pass. No legal/security surfaces changed.

### 2026-10-14 Items page P1 layout/bounds caching (in progress)

- Codex owns `js/shared/backpack-grid/item-pool.js`, `js/shared/backpack-grid/item-virtual.js`, `scripts/items-p0-performance-smoke.mjs`, `docs/performance/items-page-performance-audit.md`, and this handoff for this task.
- Scope: cache packed layouts by the complete filter/group/flow/column signature while preserving the default placed layout, and index cached placement bounds by row so viewport queries do not scan every placement. Visual composition, order, dimensions, and responsive behavior must remain unchanged.

### 2026-10-14 Items page P1 layout/bounds caching complete

- Added a bounded 24-entry packed-layout LRU keyed by flow, axis limit, compact mode, grouping values, item order, and normalized item bounds. The default placed/library layout path remains untouched.
- Added one row index of cached placement bounds per layout. `placementsNearViewport()` now queries only intersecting rows, then applies the existing horizontal/vertical checks and restores placement order exactly.
- Extended `scripts/items-p0-performance-smoke.mjs` with static cache contracts and a browser equivalence check proving indexed viewport results match the prior full scan. Syntax, focused smoke, and `git diff --check` pass. No legal/security surfaces changed.

### 2026-10-14 Items page P1 live-art/spotlight deferral (in progress)

- Codex owns `js/shared/item-live-art/index.js`, `js/shared/item-live-art/item-live-art.css`, `js/pages/items/spotlight.js`, `js/pages/items/spotlight-builds.js`, `scripts/items-p1-performance-smoke.mjs`, `docs/performance/items-page-performance-audit.md`, and this handoff for this task.
- Scope: keep catalog live-art work static until an item is focused, pause the shared live-art scheduler and CSS animation when the document is hidden, and defer spotlight runtime/art activation plus recipe/build detail work until the spotlight has opened. Preserve the existing rendered composition and interaction behavior.

### 2026-10-14 Items page P1 live-art/spotlight deferral complete

- Itemiary live art keeps the same first painted frame but does not maintain an idle catalog RAF. Hover/focus and spotlight entries opt into active animation; hidden documents pause both the JS scheduler and CSS glow/flicker timelines.
- Spotlight keeps its existing geometry and immediate tooltip, defers live-art mounting plus recipe/build detail work to the next frame, and bounds completed build-detail results with a 24-entry LRU cache.
- Added `scripts/items-p1-performance-smoke.mjs` for visibility, focus activation, spotlight deferral, build-cache, and audit-checkbox contracts. Syntax, focused P1 smoke, existing Items P0 smoke, Itemiary virtual audit, and `git diff --check` pass. No legal/security surfaces changed.

### 2026-10-14 Builds page content padding (in progress)

- Codex owns `js/pages/builds/builds.css`, `scripts/builds-surface-padding-smoke.mjs`, and this handoff for this task.
- Scope: add responsive breathing room inside the public Builds page's textured card, compact, and grid surfaces without changing content order, board dimensions, or responsive breakpoints.

### 2026-10-14 Builds page content padding complete

- Added clamped surface inset tokens to the public Builds card, compact, and grid wrappers so textured backgrounds have more breathing room while scaling fluidly from desktop through mobile.
- Added `scripts/builds-surface-padding-smoke.mjs`; it covers all three views with static contracts and a 1440px browser computed-style check. The focused smoke, textured-surface/card-info/view-density/header/title/share/pointer smokes, and `git diff --check` pass. No legal or security surfaces changed.

### 2026-10-14 Builds card-view spacing (in progress)

- Codex owns `js/pages/builds/builds.css`, `scripts/builds-surface-padding-smoke.mjs`, and this handoff for this task.
- Scope: add a responsive vertical gap between public Builds card-view entries only; compact and grid view spacing remain unchanged.

### 2026-10-14 Builds card-view spacing complete

- Added a clamped card-list row gap so each textured build surface has a visible seam at desktop, short desktop, tablet, and mobile widths; compact and grid lists retain their existing spacing.
- Extended `scripts/builds-surface-padding-smoke.mjs` with static and browser assertions for the card gap. Focused Builds surface/shadow/density smokes and `git diff --check` pass. No legal or security surfaces changed.

### 2026-10-14 Create BagBorder game-style audit (in progress)

- Codex owns `js/pages/create/create.css`, `js/shared/backpack-grid/item-pieces.js`, the Create bag-synergy browser smoke, extracted BagBorder assets under `assets/icons/grid/bag-borders/`, and this handoff for this task.
- Source evidence: `tools/game-extract-full/Items/Tiles/BagBorder.gd` uses the Border texture as a Sprite, applies the scene tint, brightens to `1.3` at rest and `2.5` over an occupied hovered cell, and hides the border when the held item is incompatible. Bag scenes override the texture/tint for shaped bags such as Puzzlebag, Potion Belt, Storage Coffin, and Toolbox.
- Scope: replace Create's dashed cell outline with the extracted texture/mask and source-derived tint/brightness while preserving the existing compatibility predicate, hover state, fabric fallback, and responsive board geometry.

### 2026-10-14 Create BagBorder game-style audit complete

- Create now mounts the extracted BagBorder texture for every rendered bag, maps shape-specific game border assets/tints, and uses the game brightness states (`1.3` compatible, `2.5` hovered). Compatible placed bags temporarily sit above the shared FilledSlot fabric so the complete border remains visible while still below gear sprites; non-compatible bags remain hidden.
- Removed the dashed per-cell outline and added asset/source/browser assertions to `scripts/create-bag-synergy-browser-smoke.mjs`. Create synergy, duration-hover, ring-affordance, syntax, and `git diff --check` checks pass. No legal or security surfaces changed.

### 2026-10-14 History rank edit reverted

- The earlier mistaken edit to `runData.rank` was reverted from `history.db.codex-backup-20261014`; the active `history.db` now matches the original byte-for-byte. The mistaken version is preserved as `history.db.codex-mistaken-edit-20261014`.

### 2026-10-14 Hero rank edit complete

- Codex owns the active save files `full\backpack.save` and `full\backpack.ba` for this one-off edit; no product paths changed.
- Updated only the current-season `rating3` hero dictionary: Ranger 15, Reaper 20, Berserker 25, Pyromancer 30, Mage 35, Adventurer 40, Engineer 45 Platinum progress (raw ratings 132, 136, 140, 144, 148, 152, 156). Match history rows and unrelated save fields were preserved.
- Created rollback copies `backpack.save.codex-before-hero-edit-20261014` and `backpack.ba.codex-before-hero-edit-20261014`. Both active saves match, their checksums verify, and blockers are none. Next step: relaunch Backpack Battles and confirm the hero ranks.

### 2026-10-14 Hero save fallback sync and history restore complete

- The full save already had valid `rating3` values, but the game was evidently loading a fallback/legacy save and initializing current-season ratings to zero. Synced the same hero-only `rating3` values into the fallback save variants, with separate `codex-hero-sync-20261014` rollback copies; every edited save parses and its checksum verifies.
- A later check found the active `history.db` had been rewritten empty (0 runs / 0 rounds). Restored it byte-for-byte from `history.db.codex-backup-20261014` (688 runs / 6,310 rounds) and preserved the empty file as `history.db.codex-empty-after-save-20261014`. No product paths changed. Blockers: none. Next step: fully quit Backpack Battles, then relaunch it so it reloads the synchronized save.

### 2026-10-14 Hero-rank/history follow-up

- After the user reported Bronze 0 ranks and no history again, the Steam-ID full profile was inspected with Backpack Battles closed. Its live `history.db` had been recreated empty despite valid schema; the original was restored once more byte-for-byte from `history.db.codex-backup-20261014`, verified as 688 `runData` rows and 6,310 `roundData` rows with `PRAGMA integrity_check = ok`. The just-replaced empty database is preserved as `history.db.codex-empty-after-user-report-20261014`.
- The active `full\\backpack.save` and `full\\backpack.ba` both parse as version 1.1.9, carry the correct Steam ID, contain the intended `rating3` values (132, 136, 140, 144, 148, 152, 156), and their stored Godot MD5-based checksums exactly recompute. The cause of the game UI still showing Bronze 0 is not yet established; do not overwrite the valid active saves again without tracing the loaded runtime state.

### 2026-10-14 Godot checksum root cause fixed

- Root cause: the earlier non-Godot serializer wrote a checksum that matched raw encoded bytes but did **not** match `Util.hashDictionary()` after Godot deserialized the nested dictionaries. On each launch the game therefore cleared `persistent` in memory, producing Bronze 0 and triggering the history database recreation branch.
- Rebuilt `full\\backpack.save` and `full\\backpack.ba` from the unmodified pre-edit save using the bundled Backpack Battles Godot 3.6 runtime and its exact `var2bytes`/MD5/checksum flow, then set only `rating3` to Ranger 132, Reaper 136, Berserker 140, Pyromancer 144, Mage 148, Adventurer 152, Engineer 156. Godot itself now verifies both checksums; the invalid copies are preserved as `*.codex-invalid-checksum-20261014`.
- Restored `full\\history.db` after rebuilding the valid saves. Final checks: 688 `runData`, 6,310 `roundData`, `PRAGMA integrity_check = ok`. No product paths changed. Next step: launch the game normally and confirm; its previous reset branch should no longer execute.

### 2026-10-14 Platinum threshold correction

- Corrected the league mapping after the user confirmed the prior values displayed as Gold: Gold is 120–200, while Platinum is 200–300. Rewrote only `rating3` with Godot’s serializer/checksum flow to Ranger 215 (Platinum 15), Reaper 220 (20), Berserker 225 (25), Pyromancer 230 (30), Mage 235 (35), Adventurer 240 (40), and Engineer 245 (45).
- Both active files (`full\\backpack.save` and `full\\backpack.ba`) now pass Godot checksum verification. Preserved the prior valid Gold-rank copies as `*.codex-gold-ranks-20261014`; no history data was changed.

### 2026-10-14 Grandma rank update

- Per user request, set all seven active `rating3` hero values to raw 550 (Grandma 0) using Godotâ€™s serializer/checksum flow. Both active save files verify with Godot; prior Platinum copies are preserved as `*.codex-before-grandma-20261014`.
- Updated only the ten most recent `runData` records by `time DESC, runID DESC` (run IDs 4029 through 4020) to rank 550. The pre-update database is preserved as `history.db.codex-before-grandma-recent10-20261014`; history now has 690 runs / 6,310 rounds and passes `PRAGMA integrity_check`.

### 2026-10-14 Platinum rank reversion

- Reverted active hero `rating3` values to Platinum 15/20/25/30/35/40/45 (raw 215/220/225/230/235/240/245) with Godot checksum verification for both live save files.
- Reverted the history ranks changed to Grandma to the matching character's Platinum value. During the edit, new run 4030 appeared and became part of the current ten most recent records; it was set to its Pyromancer Platinum 30 value, and displaced prior edited run 4020 was explicitly restored to Ranger Platinum 15. The 11 affected current/prior-recent runs now have class-matched Platinum values. Database backup: `history.db.codex-before-platinum-revert-20261014`; integrity check passes.

### 2026-10-15 Simulator item parity batch

- Codex owns the focused simulator ports/tests for Armored Power Puppy, Armored Wisdom Puppy, Artifact Stone Cold, Artifact Stone Death, the fidelity evidence entries, generated audit artifacts, and this handoff.
- Verified and checked Armored Power Puppy, Armored Wisdom Puppy, Artifact Stone Cold, and Artifact Stone Death from extracted Godot source using focused two-sided regressions. Repairs include preparation-phase inherited hooks, empowerable/damage-capable target filtering, fatigue-difference crit scaling, Cold/Block/Fatigue effects, and stone ammo behavior.
- Focused tests, JavaScript syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation

- Codex owns the focused simulator ports/tests for Automanaton, Axe, Badger Rune, Badger Spirit, Bag of Giving, Bag of Stones, Bagtacular, Banana, Battery, and Bazooka, their fidelity evidence entries, generated audit artifacts, and this handoff.
- Checked all ten items from extracted Godot source. Repairs include owner-scoped Badger Rune stamina, preparation-time Badger Spirit and Bag of Stones behavior, Bag of Giving class-item activation, Banana temporary-cap stamina and owner-side events, Battery owner-side charge events, and Bazooka preparation/parameter/Block/Lucky-resistance parity. Bagtacular was already correct and received retained regression evidence.
- Focused tests, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation 2

- Codex owns the focused simulator ports/tests for Berserker Bag, Bewitchment, Big Bloodthorne, Bionic Armor, and Bismuth Cube, their fidelity evidence entries, generated audit artifacts, and this handoff. Changed port paths include `js/pages/sim/engine/scripts/ports-ak-bags.js`, `battle-rage.js`, `ports-outliers-board.js`, `ports-threshold.js`, and `ports-an-gadgets.js`.
- Checked all five items from extracted Godot source. Repairs include owner-scoped Berserker Rage events, Bewitchment retained source regression evidence, Big Bloodthorne inherited Greatsword preparation plus varying-damage and early-hit conversion, Bionic Armor preparation-time stamina/heal/Block listeners and owner events, and Bismuth Cube preparation-time target caching, strict thresholds, capped advances, and mini-activation events.
- Focused tests (`scripts/sim-berserker-bag-smoke.mjs`, `scripts/sim-axe-bewitchment-blood-broccoli-smoke.mjs`, `scripts/sim-big-bloodthorne-smoke.mjs`, `scripts/sim-bionic-armor-smoke.mjs`, and `scripts/sim-bismuth-cube-smoke.mjs`), syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation 3

- Codex owns the focused simulator-audit verdict rule/test, chess evidence entries, generated dashboard, and this handoff.
- Checked Black Bishop, Black King, Black Knight, Black Pawn, Black Queen, and Black Rook against the extracted ChessPiece sources. The retained `scripts/sim-chess-call-paths-smoke.mjs` passes all 12 chess handlers and covers each Black capture/elimination mechanic; all six now show `verified_1to1`.
- Updated the dashboard contract so a no-independent-combat item can earn a green check when it has complete source-backed proof; unproven no-combat items remain neutral and unsupported items remain gaps. Dashboard contract test, chess smoke, dashboard regeneration/`--check`, and `git diff --check` pass. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation 4

- Codex owns the focused simulator ports/tests for Battery, Boomerang, Bow and Arrow, Bowl of Treats, Brass Knuckles, Box of Prosperity, Box of Riches, Book of Basics, Book of Darkness, Book of Ice, Book of Ice New, Book of Light, and Book of Nature; their fidelity evidence entries, generated audit artifacts, and this handoff. Changed port paths include `js/pages/sim/engine/scripts/ports-mech.js`, `ports-wave-c-onhit.js`, `ports-al-weapons.js` test coverage, `ports-ai-a.js`, `ports-ao-spells.js`, and `ports-mana.js`.
- Checked all listed items against extracted Godot source. Repairs include Battery combat-start charge lifecycle, Boomerang early-hit handling and side attribution, Bowl preparation and activation ordering, Brass Knuckles actual Battle Rage listeners and exact stun duration, Book lifecycle/event ordering and Book of Basics preparation, plus explicit shop-only handling proof for both Box items. Bow and Arrow received source assertions and opponent-side coverage.
- Focused tests (`scripts/sim-battery-smoke.mjs`, `sim-boomerang-smoke.mjs`, `sim-bow-base-smoke.mjs`, `sim-bowl-of-treats-smoke.mjs`, `sim-brass-knuckles-smoke.mjs`, `sim-box-shop-no-combat-smoke.mjs`, and `sim-books-smoke.mjs`) plus the existing Broccoli/Blood smoke pass. Syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, all listed dashboard verdict checks, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation 5

- Codex owns the focused simulator ports/tests for Broom, Burning Blade, Burning Banner, Burning Coal, Burning Spikes, Burning Sword, and Burning Torch; their fidelity evidence entries, generated audit artifacts, and this handoff. Changed port paths include `js/pages/sim/engine/scripts/ports.js`, `ports-ap-onhit.js`, `ports-heat.js`, and `ports-wave-b.js`.
- Checked the listed items against extracted Godot source. Repairs include Broom preparation-time miss listeners and side attribution, Burning Blade inherited Burning Sword preparation/Heat-bank behavior and early-hit conversion, and Burning Spikes preparation-time linked threshold listening, combat-start grants, activation, and side attribution. Burning Banner, Burning Coal, Burning Sword, and Burning Torch retained their existing source-backed combined regression.
- Focused tests (`scripts/sim-broom-smoke.mjs`, `sim-burning-blade-smoke.mjs`, `sim-burning-spikes-smoke.mjs`, and `sim-burning-heat-charge-smoke.mjs`), syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, all listed dashboard verdict checks, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation 6

- Codex owns the focused simulator ports/tests for Busted Blade, Buy the Holy Light, Cap of Brilliance, Carrot, Carrot Goobert, Cat Spirit, Cauldron, Chain Whip, Charge Splitter, Cheese, Cheese Goobert, and Chili Pepper; their fidelity evidence entries, generated audit artifacts, and this handoff. Changed port paths include `ports-al-weapons.js`, `ports-ao-skills.js`, `ports-wave-b.js`, `ports-luck.js`, `ports-am-pets.js`, `ports-buff.js`, and `ports-wave-c-onhit.js`.
- Checked the listed items against extracted Godot source. Repairs include Busted Blade preparation/rage listener restoration, Buy the Holy Light lamp exception, Cap of Brilliance inherited Leather Helm lifecycle, Carrot/Cat Spirit effect ordering, Chain Whip early-hit and purge ownership, Cheese effect ordering, and corrected Band Z fixtures so Carrot Goobert includes its linked food and Poison Bow includes its linked weapon dependency.
- Focused tests (`scripts/sim-busted-buy-cap-smoke.mjs`, `sim-carrot-cat-chain-cheese-smoke.mjs`, `sim-band-z-smoke.mjs`, `sim-band-y-smoke.mjs`, `sim-burning-heat-charge-smoke.mjs`, `sim-chipped-gems-lotus-elephant-smoke.mjs`, `sim-wave-c-smoke.mjs`, and `sim-wave-d-smoke.mjs`), syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, all listed dashboard verdict checks, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation 7

- Codex owns the focused simulator ports/tests for Chipped Amethyst, Chipped Emerald, Chipped Ruby, Chipped Sapphire, Chipped Topaz, Chrome Cube, and Claws of Attack; their fidelity evidence entries, generated audit artifacts, and this handoff. Changed port paths include `ports-an-gadgets.js` and `ports-wave-c-scale.js`.
- Checked all seven items against extracted Godot source. Repairs include Chipped Amethyst inherited source coverage, Chrome Cube `onPrepare` target caching, exact below-threshold health comparison, canonical `character_damaged` boolean handling, linked cooldown advance, and Claws of Attack `onPrepare`/`onPreDealDamage_early` timing with duplicate-callback protection. Added `scripts/sim-chipped-chrome-claws-smoke.mjs`; extended `scripts/sim-chipped-gems-lotus-elephant-smoke.mjs` for Chipped Amethyst.
- Focused chipped/chrome/claws and Wave C smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, all seven dashboard verdict checks, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation 8

- Codex owns the focused simulator ports/tests for Cog, Cog Badge, Coins, and Con-Trap-Tron; their fidelity evidence entries, generated audit artifacts, and this handoff. Changed port paths include `ports-outliers-board.js` and `ports-an-gadgets.js`.
- Checked the four items against extracted Godot source. Repairs include Cog Badge's source 14-cell charge geometry, activation-before-charge ordering, `charge_emitted` signal, speed-per-tile scheduling, and non-consuming cooldown shutdown; Con-Trap-Tron now reuses the first linked cooldown target cached during `onPrepare`. Coins received retained currency/no-combat source evidence.
- Focused tests (`scripts/sim-cog-con-trap-smoke.mjs` and `scripts/sim-no-combat-source-audit.mjs`), syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, all four dashboard verdict checks, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed.

### 2026-10-15 Simulator item parity continuation 9

- Codex owns the focused simulator ports/tests for Corrupted Armor, Corrupted Crystal, Courage Puppy, Critical Poison, and Critwood Staff; their fidelity evidence entries, generated audit artifacts, and this handoff. Changed port paths include `actor.js`, `buff-economy.js`, `gem-sockets.js`, `piece-stats.js`, `simulate.js`, `ports-outliers-board.js`, `ports-aura.js`, `ports-am-pets.js`, `ports-ao-skills.js`, and `ports-wave-c-mana.js`.
- Checked all five items against extracted Godot source. Repairs include Corrupted Armor dynamic Holy-to-Dark links, linked debuff cleanse protection, cleanse-and-transfer ordering, and source attribution; Corrupted Crystal reversible weapon threshold damage, armor debuff counting/mini-activation, and fatigue-source damage; Courage Puppy preparation-time Pet damage; Critical Poison preparation-time linked weapon accumulation and poison crit chance; and Critwood Staff preparation/early-hit Mana, additive crit window, timed removal, and p2 damage mutation. Added focused smokes `scripts/sim-corrupted-armor-crystal-smoke.mjs`, `scripts/sim-courage-puppy-smoke.mjs`, and `scripts/sim-critical-poison-critwood-smoke.mjs`.
- Focused smokes, related Band Y/Z/Wave C/Acorn regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, all five dashboard verdict checks, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Crossblades.

### 2026-10-15 Simulator item parity continuation 10

- Codex owns the focused Crossblades source regression, its fidelity evidence entry, generated audit artifacts, and this handoff.
- Crossblades passed source-backed coverage for primary empowerable-item damage, secondary cooldown-item speed, combat-start activation, and hit-only self damage/speed growth. Added `scripts/sim-crossblades-smoke.mjs`; no product-port change was required because the existing handler already matched the extracted hooks and filters.
- The focused smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` dashboard assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Crow.

### 2026-10-15 Simulator item parity continuation 11

- Codex owns the focused Crow source regression, its fidelity evidence entry, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/buff-economy.js` and `js/pages/sim/engine/scripts/ports-ai-c.js`.
- Crow now matches the extracted prepare-time initialization and applies speed plus all-debuff amplification to every affected cooldown or debuff-inflicting item, including cooldown-less Poison Ivy; the shared grant path carries debuff amplification into target resistance resolution. Added `scripts/sim-crow-smoke.mjs`.
- Crow, Band Y, and Cog/Con-Trap smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, dashboard verdict assertions, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Crown.

### 2026-10-15 Simulator item parity continuation 12

- Codex owns the focused Crown and Cthulhu source regressions, their fidelity evidence entries, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-d-goobert.js`, `js/pages/sim/engine/scripts/ports-skill.js`, `js/pages/sim/engine/simulate.js`, `scripts/sim-crown-smoke.mjs`, `scripts/sim-cthulhu-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Crown now follows source `onPrepare` mana/invulnerability signal wiring, vulnerability gating, once-per-fight expiry state, cleanse protection, and cleanse/heal/activation ordering. Cthulhu now follows source preparation-time Food/Dark targeting, linked Food dynamic Dark add/remove, shared `stealLife` damage/heal semantics, activation ordering, and linked Food cooldown triggering.
- Focused Crown/Cthulhu/Crow smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, both dashboard `verified_1to1` assertions, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Cubert.

### 2026-10-15 Simulator item parity continuation 13

- Codex owns the focused Cubert source regression, its fidelity evidence entry, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-pets.js`, `scripts/sim-cubert-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Cubert now follows source `onPrepare` timing, separate primary/secondary activated-item listeners, independent chance rolls, Regeneration threshold conversion to Empower, mini-activation projections, and cooldown grant-before-activation ordering.
- The Cubert/Cthulhu/Crown smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, all three dashboard `verified_1to1` assertions, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Cupcake.

### 2026-10-15 Simulator item parity continuation 14

- Codex owns the focused Cupcake-family source regression, its fidelity evidence entries, generated audit artifacts, and this handoff. Changed paths include `ports-consumable.js`, `ports-wave-c-mana.js`, `ports-wave-d-goobert.js`, `ports-wave-d-weapons.js`, `scripts/sim-cupcake-family-smoke.mjs`, `scripts/sim-ag-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Checked Cupcake, Cupcake Dragon, Cupcake Goobert, and Cupcake Staff against extracted Godot source. Repairs include source-timed preparation hooks, Goobert heal/buff/activation ordering and event attribution, Dragon Food-link speed plus early-hit buff transfer, Staff early-hit mana spending and buff scaling, and retained source-backed evidence for all four.
- Focused Cupcake/Cubert/Cthulhu/Crown/AG/Wave D/parity smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, all seven dashboard `verified_1to1` assertions, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Cursed Dagger.

### 2026-10-15 Simulator item parity continuation 15

- Codex owns the focused Cursed Dagger source regression, its fidelity evidence entry, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-scale.js`, `scripts/sim-cursed-dagger-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Cursed Dagger now matches source `onPrepare` opponent-debuff listener registration, early successful-hit random debuff infliction, linked damage-item crit scaling, and weapon-only accuracy scaling with reversible debuff deltas.
- The focused Cursed Dagger and Wave C smokes, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` dashboard assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Cursed Hair Comb.

### 2026-10-15 Simulator item parity continuation 16

- Codex owns the focused Cursed Hair Comb source regression, its fidelity evidence entry, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-start.js`, `scripts/sim-cursed-hair-comb-smoke.mjs`, `scripts/sim-crossblades-dragon-wave-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Cursed Hair Comb now maps the source `attacked` listener to `item_attacked`, while preserving empowered-weapon filtering, secondary Vampiric lifesteal scaling, healing-efficiency preparation, miss handling, and combat-start Vampirism/activation.
- Focused Cursed Hair Comb/Crossblades regressions, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, both Cursed-item `verified_1to1` assertions, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Customer Card.

### 2026-10-15 Simulator item parity continuation 17

- Codex reviewed Customer Card against `tools/game-extract-full/Items/CustomerCard.gd`. Its only hook is shop-only `onCalcTradeChance`, so it is correctly classified as `no_independent_combat`; no combat simulator handler or parity repair is appropriate.
- The existing 26-row no-combat source audit passes. No product code or fidelity evidence changed for this item. No legal/security surfaces changed. Next step: review Dagger.

### 2026-10-15 Simulator item parity continuation 18

- Codex owns the focused Dagger source regression, its fidelity evidence entry, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-al-weapons.js`, `scripts/sim-dagger-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dagger now registers its opponent-stun listener during source preparation and performs the inherited extra attack only for opponent stuns, without a second stamina cost or activation event.
- Focused Dagger/Wave C smokes, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the Dagger/Cursed-item `verified_1to1` assertions, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Daggerang.

### 2026-10-15 Simulator item parity continuation 19

- Codex owns the focused Daggerang source regression, its fidelity evidence entry, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-onhit.js`, `scripts/sim-daggerang-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Daggerang now carries inherited Dagger preparation/stun attacks and performs its own source-timed early-hit stamina-factor reduction and chance-gated random buff steal, with miss filtering and side-correct projections.
- Focused Daggerang/Dagger/Wave C smokes, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the Daggerang `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dancing Dragon.

### 2026-10-15 Simulator item parity continuation 20

- Codex owns the focused Dancing Dragon source regression, its fidelity evidence entry, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-aura.js`, `scripts/sim-dancing-dragon-smoke.mjs`, and `scripts/sim-damage-stat-mutation-smoke.mjs`.
- Dancing Dragon now retains source Magic-only targeting, preparation-time Heat/Lucky listeners, reversible varying-damage and debuff-resistance deltas, and separate Heat/Lucky start projections without a duplicate aggregate buff event. The stale shared Cupcake Staff fixture was updated to call its source `onPrepare` hook.
- Focused Dancing Dragon/damage-stat/Wave B smokes, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the Dancing Dragon `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dark Lantern.

### 2026-10-15 Simulator item parity continuation 21

- Codex owns the Dark Lantern fidelity evidence entry, generated audit artifacts, and this handoff. No new product-port change was required; existing lifecycle implementation and regressions were reviewed.
- Dark Lantern source parity is covered for preparation-time listeners, exact combat-start health loss, High-priority lethal reincarnation, invulnerability and used-state transitions, Fire multiplicity damage, Dark debuff infliction, single-use behavior, and cross-item ordering. Evidence is retained in `scripts/sim-phoenix-lantern-smoke.mjs`.
- Phoenix/Lantern, threshold, invulnerability-VFX, used-visual, syntax, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dark Ritual.

### 2026-10-15 Simulator item parity continuation 22

- Codex owns the Dark Ritual fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-skill.js`, `scripts/sim-dark-ritual-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dark Ritual now reads the source `vampirism` parameter instead of the incorrect `vamp` key/fallback, preserves zero-valued source parameters, and is covered for Dark-only speed targeting, exact debuff/vampirism cooldown effects, activation, consumption, and source shop-hook audit.
- Dark Ritual smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Darkest Lotus.

### 2026-10-15 Simulator item parity continuation 23

- Codex owns the Darkest Lotus focused source regression, fidelity evidence entry, generated audit artifacts, and this handoff. No product-port change was required.
- Darkest Lotus source parity is covered for zero-based chain-position Mana scaling, opponent-only random buff removal, next-card arming, reveal/deactivation lifecycle, and post-effect activation order. Evidence is retained in `scripts/sim-darkest-lotus-smoke.mjs`.
- Darkest Lotus smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Darksaber.

### 2026-10-15 Simulator item parity continuation 24

- Codex owns the Darksaber fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-onhit.js`, `scripts/sim-darksaber-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Darksaber now preserves source zero-valued Mana/Blind parameters, while covering opponent-debuff varying-damage listeners, reversible debuff deltas, pre-damage Mana spending, and Blind infliction on both hit and miss.
- Darksaber smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Death Lotus.

### 2026-10-15 Simulator item parity continuation 25

- Codex owns the Death Lotus fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-mana.js`, `scripts/sim-death-lotus-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Death Lotus now preserves source zero-valued Mana, buff-removal, and Lucky-threshold parameters, while covering Dark-only preparation speed, Mana grant, opponent buff removal, Lucky threshold/spend, fractional Stamina grant, and activation order.
- Death Lotus smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Death Scythe.

### 2026-10-15 Simulator item parity continuation 26

- Codex owns the Death Scythe fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-al-weapons.js`, `scripts/sim-death-scythe-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Death Scythe now registers its source listener during preparation, resets state before combat, empowers only linked Poison-producing items, and waits for a post-prepare opponent Poison change before adding the exact crit chance. Existing Poison no longer triggers prematurely.
- Death Scythe smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Deck of Cards.

### 2026-10-15 Simulator item parity continuation 27

- Codex owns the Deck of Cards fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-cards.js`, `scripts/sim-deck-of-cards-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Deck of Cards now resets the chain gate and card activation counter during preparation, uses the precomputed card chain, arms the first card only once per source combat start, and preserves zero Lucky values.
- Deck of Cards smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Deer Totem.

### 2026-10-15 Simulator item parity continuation 28

- Codex owns the Deer Totem focused source regression, fidelity evidence entry, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-mana.js`, `scripts/sim-deer-totem-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Deer Totem now preserves source zero-valued heal/Mana parameters while covering Nature-only preparation resistance and Battle Rage duration, pre-combat cooldown deactivation, rage start/end cooldown gating, exact cooldown effect, and source lifecycle ordering.
- Deer Totem smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Demonic Flask.

### 2026-10-15 Simulator item parity continuation 29

- Codex owns the Demonic Flask fidelity repair, linked-potion trigger support, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-potions.js`, `js/pages/sim/engine/scripts/ports-consumable.js`, `js/pages/sim/engine/scripts/ports-ai-a.js`, `js/pages/sim/engine/scripts/ports-util.js`, `js/pages/sim/engine/simulate.js`, `scripts/sim-demonic-flask-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Demonic Flask now uses source-order fractional debuff scaling with `ceil`, listens only to canonical opponent damage events, triggers the first linked Potion without consuming it, and preserves zero-damage outcomes. Strong Demonic Flask now expires its healing-efficiency reduction at the source duration; the simulator keeps ticking that timer after the Flask is consumed. Existing Potion target ports expose non-consuming trigger callbacks where their effects are already represented.
- Demonic Flask smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Devouring Sphere.

### 2026-10-15 Simulator item parity continuation 30

- Codex owns the Devouring Sphere fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-heat.js`, `scripts/sim-devouring-sphere-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Devouring Sphere now binds Cold/Blind listeners during preparation and applies every stack delta to item speed, preserves source Vampirism/lifesteal/damage parameters including zero values, routes the effect through the canonical effect-damage and lifesteal pipeline, and logs activation after the effect chain. It no longer invents a combat-start activation or waits until cooldown to notice status changes.
- Devouring Sphere smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dig Deeper.

### 2026-10-15 Simulator item parity continuation 31

- Codex owns the Dig Deeper fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-skill.js`, `scripts/sim-dig-deeper-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dig Deeper now preserves the source Blind parameter, including zero, while covering the combat-start grant and source global Shovel/Robodog targeting audit. The simulator no longer invents a Blind stack when the source parameter is zero.
- Dig Deeper smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Divine Potion.

### 2026-10-15 Simulator item parity continuation 32

- Codex owns the Divine Potion fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-potions.js`, `scripts/sim-divine-potion-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Divine Potion now preserves zero threshold/cleanse/buff parameters and triggers the first linked Potion without consuming it, while covering preparation-time debuff threshold, random cleanse, Strong random buffs, and source consumption behavior.
- Divine Potion smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Djinn Lamp.

### 2026-10-15 Simulator item parity continuation 33

- Codex owns the Djinn Lamp fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-mana.js`, `scripts/sim-djinn-lamp-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Djinn Lamp now follows the source’s positive-change-only signals, ignores unrelated buffs and the legacy damage alias, preserves exact P1/P2/P3 values including zero, spends all four resources plus the health cost only at the five-part threshold, and retains source cooldown tie-breaking.
- Djinn Lamp smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Doom Cap.

### 2026-10-15 Simulator item parity continuation 34

- Codex owns the Doom Cap fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-cold.js`, `scripts/sim-doom-cap-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Doom Cap now preserves inherited Food preparation speed, source integer/truncation behavior for poison, exact healing-efficiency reduction including zero values, and source effect-before-activation ordering.
- Doom Cap smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Double Axe.

### 2026-10-15 Simulator item parity continuation 35

- Codex owns the Double Axe fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-perm.js`, `scripts/sim-double-axe-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Double Axe now applies P1/P2 to the current hit, ignores misses and opponent Rage events, preserves the source’s pre-Rage extra-attack ordering before setting the Rage flag, and keeps zero bonuses zero.
- Double Axe smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Double Rainbow.

### 2026-10-15 Simulator item parity continuation 36

- Codex owns the Double Rainbow fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-e.js`, `scripts/sim-double-rainbow-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Double Rainbow now applies source links during preparation, filters primary targets to `gainsBuffs`, preserves Holy secondary speed and zero chance/speed values, and records the random buff before activation.
- Double Rainbow smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Draconic Orb.

### 2026-10-15 Simulator item parity continuation 37

- Codex owns the Draconic Orb fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-heat.js`, `scripts/sim-draconic-orb-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Draconic Orb now listens to the source owner Heat-change signal, catches direct stack gains, ignores negative/opponent Heat, grants Crit tokens once at the exact threshold, and preserves exact typed Spike-removal/Heat-conversion parameters including zero values.
- Draconic Orb smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dragon Claws.

### 2026-10-15 Simulator item parity continuation 38

- Codex owns the Dragon Claws fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-armor.js`, `scripts/sim-dragon-claws-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dragon Claws now applies Poison resistance during preparation, responds only to the owner’s Battle Rage start/end signals, restores speed on Rage end, uses static `hasCooldown` links even when runtime cooldowns are deactivated, and preserves exact chance/speed values.
- Dragon Claws smoke, syntax check, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dragon Knight.
### 2026-10-15 Simulator item parity continuation 39

- Codex owns the Dragon Knight fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-skill.js`, `scripts/sim-dragon-knight-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dragon Knight now mirrors `canActivate()` peer wiring for linked no-cooldown items, ignores activation events before source preparation, preserves inherited Ruby Whelp Reflect/Heat lifecycle behavior, heals only on hit, advances the armed cooldown by the exact source percentage, and preserves zero typed parameters.
- Dragon Knight smoke plus the adjacent Crossblades/Dragon Set regression, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dragon Set.
### 2026-10-15 Simulator item parity continuation 40

- Codex owns the Dragon Set fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-heat.js`, `scripts/sim-dragon-set-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dragon Set now defers cooldown deactivation to source `preCombatStart`, filters Battle Rage start/end to the owning character, honors non-lifesteal damage-source events, preserves exact Heat including zero, keeps complete-set Heat-scaled lifesteal capped by source `max`, and retains Heat-before-activation ordering.
- Dragon Set smoke plus the adjacent Crossblades/Dragon Knight/Dragon Set regression, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dragonscale Armor.
### 2026-10-15 Simulator item parity continuation 41

- Codex owns the Dragonscale Armor fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-armor.js`, `scripts/sim-dragonscale-armor-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dragonscale Armor now wires its source `onPrepare` hook, responds only to the owner’s Battle Rage, grants the catalog Block before activation, applies direct P1 damage resistance at Rage start, reverses that exact resistance at Rage end, and preserves zero resistance.
- Dragonscale Armor smoke plus the adjacent Dragon Set/Dragon Knight regression, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dragonskin Boots.
### 2026-10-15 Simulator item parity continuation 42

- Codex owns the Dragonskin Boots fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-armor.js`, `scripts/sim-dragonskin-boots-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dragonskin Boots now mirrors source preparation-time Cold resistance, owner-only Battle Rage cleanse/Empower/Block behavior, exact P1/P2 values, catalog Block grants, and zero chance/typed values.
- Dragonskin Boots smoke plus adjacent Dragon-family regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Dual Wielding.
### 2026-10-15 Simulator item parity continuation 43

- Codex owns the Dual Wielding fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-skills.js`, `scripts/sim-dual-wielding-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Dual Wielding now mirrors source preparation-time mutation, exact-two weapon activation, base-stamina eligibility, exclusion of non-weapons and zero-base-stamina weapons, active-state projection, and zero typed values.
- Dual Wielding smoke plus visual/adjacent regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Eat-o-matic.
### 2026-10-15 Simulator item parity continuation 44

- Codex owns the Eat-o-matic fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-gadgets.js`, `scripts/sim-eat-o-matic-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Eat-o-matic now mirrors source primary-food preparation speed, all-other-food collection, no arbitrary primary fallback, slow/fast arm state transitions, exact first/final charge gating with reversal, and zero typed values.
- Eat-o-matic smoke plus charge-path/adjacent regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Echoing Battlecry.
### 2026-10-15 Simulator item parity continuation 45

- Codex owns the Echoing Battlecry fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-skill.js`, `scripts/sim-echoing-battlecry-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Echoing Battlecry now mirrors source start-of-battle eligibility, preparation-time speed scaling, shuffled replay queue, full `repeatCombatStart` pre/start/post lifecycle, final `onAfterEffectFinished` consumption, and zero typed speed.
- Echoing Battlecry smoke plus the adjacent Band-Y regression, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Eggscalibur.
+
### 2026-10-15 Simulator item parity continuation 46

- Codex owns the Eggscalibur fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-mana.js`, `scripts/sim-eggscalibur-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Eggscalibur now preserves the source `getP2()` mana cost, including typed zero, while retaining hit-only activation, Food-only affected-item filtering, randomized linked-food cooldown effects, and insufficient-mana behavior.
- Eggscalibur smoke plus adjacent visual/Eat-o-matic/Echoing Battlecry regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Electric Torch.
+
### 2026-10-15 Simulator item parity continuation 47

- Codex owns the Electric Torch fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-heat.js`, `scripts/sim-electric-torch-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Electric Torch now mirrors source preparation-time state reset, static `hasCooldown` targeting, exact charge speed apply/reversal and re-arm behavior, typed Blind duration/amount, and consume-after-effect lifecycle without fabricated minimum values.
- Electric Torch smoke plus charge/visual regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Elephant Rune.
+
### 2026-10-15 Simulator item parity continuation 48

- Codex owns the Elephant Rune fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/scripts/ports-ap-start.js`, `scripts/sim-elephant-rune-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Elephant Rune now mirrors source inventory combat-start `giveMaxHealth`, including temporary max-health amplification and typed zero behavior, then consumes with the expected activation and max-health event metadata.
- Elephant Rune smoke plus loose-gem/socket regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Emerald.
### 2026-10-15 Simulator item parity continuation 49

- Codex owns the Emerald Egg fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-eggs.js`, `scripts/sim-emerald-egg-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Emerald Egg now mirrors source `doCooldownEffect` ordering, grants the exact typed Lucky amount including zero, repeats the effect on cooldown, and activates after the grant at combat start and cooldown.
- Emerald Egg smoke plus adjacent egg/whelp/gem regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Emerald Whelp.
### 2026-10-15 Simulator item parity continuation 50

- Codex owns the Emerald Whelp fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-start.js`, `scripts/sim-emerald-whelp-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Emerald Whelp now mirrors source combat-start Lucky, hit-only early Poison, inherited Weapon strike ordering, and exact typed zero Lucky/Poison values.
- Emerald Whelp smoke plus adjacent Emerald/Whelp/gem regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Employee Uniform.
### 2026-10-15 Simulator item parity continuation 51

- Codex reviewed Employee Uniform as the next catalog row. Its source only overrides shop `onCalcTradeChance`; it has no independent combat hook, and the simulator’s intentional shop noop matches that scope. No product code change was needed.
- The no-combat source audit and noop audit pass for all 26 intentional no-combat rows, including Employee Uniform. No legal/security surfaces changed. Next step: review Enchanted Weapons.
### 2026-10-15 Simulator item parity continuation 52

- Codex owns the Enchanted Weapons fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports.js`, `scripts/sim-enchanted-weapons-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Enchanted Weapons now runs source logic during preparation, uses the extracted `hasAttackEffect` rule instead of broad target heuristics, preserves exact chance including zero, truncates `buffs` like Godot `int()`, grants least buffs before activation, and still activates when the count is zero.
- Enchanted Weapons smoke plus spotlight/adjacent regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Energy Conversion.
### 2026-10-15 Simulator item parity continuation 53

- Codex owns the Energy Conversion fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-heat.js`, `scripts/sim-energy-conversion-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Energy Conversion now preserves source Food-only preparation targeting, exact stamina starvation, integer-truncated Heat/threshold/random-buff parameters, Heat exclusion from random buffs, activation ordering, and typed zero values.
- Energy Conversion smoke plus adjacent Emerald/Whelp/Enchanted/Electric regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Engineer Bag 2.
### 2026-10-15 Simulator item parity continuation 54

- Codex reviewed Engineer Bag 2 as a shop-only/no-combat catalog row. Corrected `assets/data/sim-intentional-noops.json` to retain its existing source file and exact shop-hook rationale, and added `scripts/sim-engineer-bag-2-smoke.mjs`.
- Engineer Bag 2 source/noop smoke plus no-combat/noop audits and ledger/dashboard regeneration/check pass. Dashboard remains `no_independent_combat` by design because the source has no independent combat hook; no legal/security surfaces changed. Next step: review Engineer Box.
### 2026-10-15 Simulator item parity continuation 55

- Codex owns the Engineer Box fidelity repair, charge-emitter interface repairs, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/charge-delivery.js`, `js/pages/sim/engine/scripts/ports-ak-bags.js`, `js/pages/sim/engine/scripts/ports-ai-d.js`, `js/pages/sim/engine/scripts/ports-an-gadgets.js`, `js/pages/sim/engine/scripts/ports-ap-lucky.js`, `js/pages/sim/engine/scripts/ports-mana.js`, `js/pages/sim/engine/scripts/ports-outliers-board.js`, `js/pages/sim/engine/scripts/ports-wave-d-weapons.js`, `scripts/sim-engineer-box-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Engineer Box now mirrors source preparation-time `has_method("emitCharge")` target filtering, queue/FIFO timer restart, combat-end cleanup, real signal timestamps, exact speed-factor re-emission, and all seven source charge emitters (Battery, Charge Splitter, Cog Badge, Con-Trap-Tron, Generator, Lightning Staff, and Mana Crystal). The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Engineer Box smoke plus AQ/Battery/charge/stat/Cog-Con-Trap/parity regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Everburning.
### 2026-10-15 Simulator item parity continuation 56

- Codex owns the Everburning fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-heat.js`, `scripts/sim-everburning-smoke.mjs`, and `scripts/build-sim-fidelity-ledger.mjs`.
- Everburning now scopes Flame counting and Burning Sword/Blade stamina changes to the owning inventory and preserves the source’s exact Heat-per-Flame value, including fractional and zero values, before consume-after-effect.
- Everburning smoke plus Emerald/Ginger wave, Dragon Set, Burning Blade, and Burning Heat/Charge regressions, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Evil Cap.
### 2026-10-15 Simulator item parity continuation 57

- Codex owns the Evil Cap fidelity repair, focused source/lifecycle regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-hard.js`, `scripts/sim-evil-cap-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Evil Cap now mirrors source preparation-time opponent healing-efficiency reduction, pre-combat timed damage resistance, one-time opponent buff-nullify chance, exact typed zero values, buff timer state/expiration, and Helmet activation projection. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Evil Cap and Band-Y smoke, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Evil Hat.
### 2026-10-15 Simulator item parity continuation 58

- Codex owns the Evil Hat fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-c.js`, `scripts/sim-evil-hat-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Evil Hat now mirrors source preparation-time Unhealing and owner-filtered debuff/opponent-buff listeners, exact Dark secondary count, damage-capable primary crit targets, exact random-buff counts and ordering, typed zero values, and Pet activation projection. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Evil Hat plus Evil Cap/Band-Y/buff smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Extra Angy.
### 2026-10-15 Simulator item parity continuation 59

- Codex owns the Extra Angy fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-hard.js`, `scripts/sim-extra-angy-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Extra Angy now mirrors source preparation-time owner Battle Rage listeners, pre-combat cooldown deactivation, owner-only Rage event filtering, unlock/re-arm after Rage end, exact captured-duration scaling including zero, and consume-after-Rage ordering. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Extra Angy plus Evil Cap/Evil Hat/Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap and 19 pre-existing duplicate registrations; no new untriaged gap was added. No legal/security surfaces changed. Next step: review Extra Bags.
### 2026-10-15 Simulator item parity continuation 60

- Codex owns the Extra Bags fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-skills.js`, `scripts/sim-extra-bags-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Extra Bags now mirrors source primary cooldown targeting, secondary empty-slot counting inside bag cells, preparation-time speed scaling, non-cooldown exclusion, and engine snapshot behavior. Its source-only shop sales/weight hooks are retained in the automated source audit because the simulator is combat-scoped. The dashboard row is `verified_1to_1` with source/automated evidence; no live verification is required.
- Extra Bags plus Extra Angy/Evil Cap/Evil Hat/Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Falcon Blade.
### 2026-10-15 Simulator item parity continuation 61

- Codex owns the Falcon Blade fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports.js`, `scripts/sim-falcon-blade-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Falcon Blade now mirrors source cooldown-link speed targeting, preserves the mandatory combat-start activation when speed is typed zero, spends stamina once per cooldown, performs two damage calls, and emits two post-hit activations with hit labels. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Falcon Blade plus Extra Bags/Band-Y/bow/damage-mutation smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review False Life.
### 2026-10-15 Simulator item parity continuation 62

- Codex owns the False Life fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `scripts/sim-false-life-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- False Life now mirrors source preparation-time max-health gain and overheal listener setup, Dark-only affected-item counting, `getP_m`-style modified heal parameters including typed zero, overheal-to-max-health conversion, and source heal-before-activation ordering. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- False Life plus Extra Bags/Falcon/Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Fancy Fencing Rapier.
### 2026-10-15 Simulator item parity continuation 63

- Codex owns the Fancy Fencing Rapier fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-scale.js`, `scripts/sim-fancy-fencing-rapier-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Fancy Fencing Rapier now mirrors source hit/miss Lucky flow, `int()`-truncated Lucky thresholds, zero-threshold success, exact damage bonus values, weapon strike wiring, and engine hit/miss behavior. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Fancy Fencing Rapier plus False Life/Wave-C/Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to_1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Fanfare.
### 2026-10-15 Simulator item parity continuation 64

- Codex owns the Fanfare fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-mana.js`, `scripts/sim-fanfare-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Fanfare now mirrors source all-item preparation speed, no-repeat three-choice selection, raw zero-capable Empower/Mana/Stamina parameters, partial opponent Mana removal, and source effect-before-activation ordering. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Fanfare plus Fancy Fencing Rapier/False Life/Wave-C/Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Fanny Pack.
### 2026-10-15 Simulator item parity continuation 65

- Codex owns the Fanny Pack fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports.js`, `scripts/sim-fanny-pack-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Fanny Pack now mirrors the source descriptor-level `hasCooldown()` filter and bag exclusion, preserves exact speed values including typed zero, scopes Bagtacular to the owning inventory side, and keeps bag activation animation-only rather than fabricating a combat-log activation. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Fanny Pack plus Badger/Bagtacular, spotlight, Band-Y, and Wave-C smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Fedora.
### 2026-10-15 Simulator item parity continuation 66

- Codex owns the Fedora fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-luck.js`, `scripts/sim-fedora-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Fedora now mirrors source preparation-time secondary chance modification, primary-only Nature/Treasure Lucky counting with exact treasure-source detection, `int()` truncation and typed zero parameters, full non-Lucky buff theft, and steal-before-activation ordering. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Fedora plus Carrot/Cat/Chain/Cheese, spotlight, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Fire Pit.
### 2026-10-15 Simulator item parity continuation 67

- Codex owns the Fire Pit fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b.js`, `scripts/sim-fire-pit-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Fire Pit now mirrors source `onPreCombatStart`, named modified `maxhealth` values without simulator rounding/clamping, Fire-only affected-item filtering, source `getTypeMultiplicity` behavior for Phoenix/Molten fire values, current/max HP updates, and bag activation projection. Its source-only shop generation hook is retained in the automated source audit because the simulator is combat-scoped. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Fire Pit and Phoenix/Lantern smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Fire Shelly.
### 2026-10-15 Simulator item parity continuation 68

- Codex owns the Fire Shelly fidelity repair, inherited-lifecycle regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `js/pages/sim/engine/scripts/ports-am-pets.js`, `js/pages/sim/engine/buff-economy.js`, `scripts/sim-fire-shelly-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Fire Shelly now mirrors inherited Shelly preparation-time Potion-only speed and debuff-protection behavior, Fire heat before the parent cleanse/heal, exact integer heat/cleanse parameters, modified healing, source negative-protection cleanse clamping, and effect-before-activation ordering. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Fire Shelly, Fire Pit, Phoenix/Lantern, Carrot/Cat/Chain/Cheese, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Flame.
### 2026-10-15 Simulator item parity continuation 69

- Codex reviewed Flame as an existing dedicated port and added `scripts/sim-flame-smoke.mjs`; the generated evidence entry is in `scripts/build-sim-fidelity-ledger.mjs` with regenerated `assets/data/sim-fidelity-ledger.json` and `assets/data/sim-audit-dashboard.json`.
- Flame matches source combat-start `giveHeat(1)` followed by `Item.consume()` → activation, one-shot exhaustion, and no cooldown reactivation. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flame, Everburning, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Flame Badge.
### 2026-10-15 Simulator item parity continuation 70

- Codex owns the Flame Badge fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-start.js`, `scripts/sim-flame-badge-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flame Badge now mirrors source `giveHeat(getP1())` amplification-before-rounding, combat-start `consume()` activation, and one-shot exhaustion; its shop/class hooks remain source-retained because the simulator is combat-scoped. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flame Badge, Emerald/Ginger, AR buff-log, Flame, Everburning, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Flame Whip.
### 2026-10-15 Simulator item parity continuation 71

- Codex owns the Flame Whip fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-onhit.js`, `scripts/sim-flame-whip-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flame Whip now mirrors source hit-only Spikes spending, `int()`-truncated Spikes/Heat parameters including zero thresholds, exact float bonus damage, Heat grant, and inherited weapon/stamina integration. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flame Whip, Emerald/Ginger, Everburning, Bow, damage/stat mutation, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Flawed Amethyst.
### 2026-10-15 Simulator item parity continuation 72

- Codex owns the Flawed Amethyst/inherited Amethyst socket fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/gem-sockets.js`, `scripts/sim-flawed-amethyst-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flawed Amethyst now mirrors inherited inventory cleansing, successful weapon-hit buff removal with source `int()` truncation, and `GemPower * healReduction` armor healing reduction while retaining the base GemPower of 1 when no modifier is present. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flawed Amethyst plus flawed/flawless, Regular Amethyst, Chipped Gems/Lotus/Elephant, Book/Amethyst, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the existing baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 call-review candidates; no legal/security surfaces changed. Next step: review Flawed Emerald.
### 2026-10-15 Simulator item parity continuation 73

- Codex owns the Flawed Emerald/inherited Emerald inventory and socket fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/gem-sockets.js`, `scripts/sim-flawed-emerald-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flawed Emerald now mirrors source raw `getP3()` regeneration and raw `getP1()` weapon poison amounts through the shared buff-power/rounding path, plus inherited `GemPower * getP2()` armor poison resistance with the base GemPower default of 1. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flawed Emerald plus flawed/flawless, Regular Amethyst, Chipped Gems/Lotus/Elephant, Emerald/Ginger, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Flawed Ruby.
### 2026-10-15 Simulator item parity continuation 74

- Codex owns the Flawed Ruby/inherited Ruby inventory and socket fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/gem-sockets.js`, `scripts/sim-flawed-ruby-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flawed Ruby now mirrors source raw `getP3()` stealLife damage, modified `getP_m("lifesteal_factor")`, modified weapon `getP_m("lifesteal_weapon")` healing with source ceiling, and inherited `GemPower * getP2()` armor healing efficiency. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flawed Ruby plus flawed/flawless, Regular Emerald/Ruby/Sapphire/Topaz, Chipped Gems/Lotus/Elephant, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Flawed Sapphire.
### 2026-10-15 Simulator item parity continuation 75

- Codex owns the Flawed Sapphire/inherited Sapphire inventory and socket fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/gem-sockets.js`, `scripts/sim-flawed-sapphire-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flawed Sapphire now mirrors source raw `getP5()` Cold and spectral-hit Mana/Cold amounts, spectral pre-hit gating, `int(getP2())` Mana thresholds, and `getGemPower() * block` before final Block rounding. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flawed Sapphire plus flawed/flawless, Regular Emerald/Ruby/Sapphire/Topaz, Chipped Gems/Lotus/Elephant, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Flawless Amethyst.
### 2026-10-15 Simulator item parity continuation 76

- Codex owns the Flawless Amethyst explicit tier-alias verification, focused source regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-flawless-amethyst-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flawless Amethyst is independently verified against inherited `Amethyst.gd`: inventory cleanse/activation, source `int()` weapon buff removal, and `GemPower`-scaled armor healing reduction all pass. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flawless Amethyst plus Flawed Amethyst, alias, Regular Amethyst, Book/Amethyst, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Flawless Emerald.
### 2026-10-15 Simulator item parity continuation 77

- Codex owns the Flawless Emerald explicit tier-alias verification, focused source regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-flawless-emerald-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flawless Emerald is independently verified against inherited `Emerald.gd` with actual tier values: inventory regeneration, weapon poison, and `GemPower * getP2()` armor poison resistance all pass. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flawless Emerald plus Flawed Emerald, alias, Regular Emerald/Ruby/Sapphire/Topaz, Chipped Gems/Lotus/Elephant, Emerald/Ginger, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Flawless Ruby.
### 2026-10-15 Simulator item parity continuation 78

- Codex owns the Flawless Ruby explicit tier-alias verification, focused source regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-flawless-ruby-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flawless Ruby is independently verified against inherited `Ruby.gd` with actual tier values: inventory stealLife damage/heal ordering and amounts, source-ceiled weapon lifesteal, and `GemPower * getP2()` armor healing efficiency all pass. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flawless Ruby plus Flawed Ruby, alias, Regular Emerald/Ruby/Sapphire/Topaz, Chipped Gems/Lotus/Elephant, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Flawless Sapphire.
### 2026-10-15 Simulator item parity continuation 79

- Codex owns the Flawless Sapphire explicit tier-alias verification, focused source regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-flawless-sapphire-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Flawless Sapphire is independently verified against inherited `Sapphire.gd` with actual tier values: inventory Cold, spectral weapon Mana/Cold, and armor threshold/p3/GemPower Block conversion all pass. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Flawless Sapphire plus Flawed Sapphire, alias, Regular Emerald/Ruby/Sapphire/Topaz, Chipped Gems/Lotus/Elephant, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Perfect Amethyst.
### 2026-10-15 Simulator item parity continuation 80

- Codex owns the Perfect Amethyst explicit Godly tier-alias verification, focused source regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-perfect-amethyst-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Perfect Amethyst is independently verified against inherited `Amethyst.gd`: inventory cleanse, source p2 two-buff weapon removal, and `GemPower`-scaled armor healing reduction all pass. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Perfect Amethyst plus Flawed/Flawless Amethyst, alias, Regular Amethyst, Book/Amethyst, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Perfect Emerald.
### 2026-10-15 Simulator item parity continuation 81

- Codex owns the Perfect Emerald explicit Godly tier-alias verification, focused source regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-perfect-emerald-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Perfect Emerald is independently verified against inherited `Emerald.gd` with actual tier values: inventory regeneration, weapon poison, and `GemPower * getP2()` armor poison resistance all pass. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- Perfect Emerald plus Flawed/Flawless Emerald, alias, Regular Emerald/Ruby/Sapphire/Topaz, Chipped Gems/Lotus/Elephant, Emerald/Ginger, and Band-Y smokes, syntax checks, source parity/call audits, ledger/dashboard regeneration and `--check`, the `verified_1to1` assertion, and `git diff --check` pass. The global audit remains at the established baseline: one triaged Ruby Egg lifecycle gap, 0 untriaged gaps, 19 pre-existing duplicate registrations, and 13 ledger call-review candidates; no legal/security surfaces changed. Next step: review Perfect Ruby.

### 2026-10-15 Simulator item parity continuation 108

- Codex owns the Pot fidelity verification, focused source regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-pot-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Pot is verified against `Pot.gd`: separate Potion/Food targeting, combined speed scaling, linked-potion healing, Heat/Regeneration cooldown effects, and consume-after-effect ordering pass. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.

### 2026-10-15 Simulator item parity continuation 109

- Codex owns the Power of the Moon fidelity repair, focused source regressions, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-threshold.js`, `scripts/sim-power-moon-handler-smoke.mjs`, `scripts/sim-power-moon-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Power of the Moon now registers fatigue during prepare, uses the shared temporary max-health/activation path, records Reflect stacks through the simulator stat-event path, and retains linked Moon Armor/Moon Shield filtering. Focused source/handler and fatigue smokes pass; the dashboard row is `verified_1to1` with source/automated evidence and a source audit for shop hooks; no live verification is required.
- The source parity gate passes with the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Power Puppy.

### 2026-10-15 Simulator item parity continuation 110

- Codex owns the Power Puppy fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-pets.js`, `scripts/sim-power-puppy-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Power Puppy now mirrors source prepare-time Pet-only speed setup, rotating Lucky/Regeneration/Empower choices, exact source amounts including zero, and grant-before-activation ordering. Power Puppy and inherited Armored Power Puppy smokes pass; the dashboard row is `verified_1to1` with source/automated evidence and no live verification required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Present.

### 2026-10-15 Simulator item parity continuation 111

- Codex owns the Present fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-buff.js`, `scripts/sim-present-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Present now mirrors source random-buff count handling, including zero, and logs activation after the buff grant. The focused Present and broader buff smokes pass; the dashboard row is `verified_1to1` with source/automated evidence and a source audit for the shop-entry gift hook. No live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Prismatic Sword.

### 2026-10-15 Simulator item parity continuation 112

- Codex owns the Prismatic Sword fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-d-weapons.js`, `scripts/sim-prismatic-sword-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Prismatic Sword now mirrors source prepare-time type counts, fractional Holy bonus damage, configured chance2 Dark debuff proc, late lifesteal from `damageRes.damage`, and miss/no-Vampiric guards. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Prismatic Wand.

### 2026-10-15 Simulator item parity continuation 113

- Codex owns the Prismatic Wand fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-luck.js`, `scripts/sim-prismatic-wand-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Prismatic Wand now mirrors source all-buff grants, zero-safe integer thresholds, highest Mana/Lucky/Regeneration pool consumption, exact Empower amount, and activation-after-effects ordering. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Protective Purse.

### 2026-10-15 Simulator item parity continuation 114

- Codex owns the Protective Purse fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-consumable.js`, `scripts/sim-protective-purse-smoke.mjs`, `scripts/sim-badger-bagtacular-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Protective Purse now mirrors the source Bag block descriptor, the named Bagtacular block bonus (30 total in the regression), zero-safe handling, and the source activation event. Protective Purse, Bagtacular, and Wave A smokes pass; the dashboard row is `verified_1to1` with source/automated evidence and no live verification required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Pumpkin.

### 2026-10-15 Simulator item parity continuation 115

- Codex owns the Pumpkin fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-basic.js`, `scripts/sim-pumpkin-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Pumpkin now mirrors the source Food throw lifecycle, prepare-time fatigue listener, exact Heat amount including zero, hit-only chance stun through `onDealtDamage`, and fatigue activation ordering. Pumpkin, the lifecycle wave, and AP smoke pass; the dashboard row is `verified_1to1` with source/automated evidence and no live verification required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Puzzle Badge.

### 2026-10-15 Simulator item parity continuation 116

- Codex owns the Puzzle Badge fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-outliers-board.js`, `scripts/sim-puzzle-badge-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Puzzle Badge now mirrors source cooldown-only target filtering, prepare-time speed reduction, exact speed+speed2 pulse, consumption lifecycle, and source puzzle-bag metadata. The dashboard row is `verified_1to1` with source/automated evidence; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Puzzlebag J.

### 2026-10-15 Simulator item parity continuation 117

- Codex owns the Puzzlebag J fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-bags.js`, `scripts/sim-puzzlebag-j-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Puzzlebag J now mirrors the source duration predicate through the shared `hasInventoryDuration` rule, applies the exact named `bonusdur` multiplier during prepare, leaves missing `bonusdur` at zero, and preserves duration scaling/exclusion behavior. Focused source/handler and full duration-effects smokes pass; the dashboard row is `verified_1to1` with source/automated evidence and no live verification required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Puzzlebag L.

### 2026-10-15 Simulator item parity continuation 118

- Codex owns the Puzzlebag L fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-start.js`, `scripts/sim-puzzlebag-l-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Puzzlebag L now mirrors the source heal/lifesteal target predicate, additive `changeHealAmp` stacking, exact named `healamp`/`maxhealth` behavior without fabricated fallback values, max-health-before-activation ordering, and non-healing exclusions. Focused source/handler, Puzzlebag J, duration, and noop smokes pass; the dashboard row is `verified_1to1` with source/automated evidence and no live verification required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Puzzlebag S.

### 2026-10-15 Simulator item parity continuation 119

- Codex owns the Puzzlebag S fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-bags.js`, `scripts/sim-puzzlebag-s-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Puzzlebag S now mirrors source prepare-time lifecycle, exact catalog `getChance()` amplification, `gainsBuffs()`-only cargo filtering, and additive all-buff chance modifiers. Puzzlebag S/L/J, duration, noop, syntax, source parity/call audits, ledger/dashboard checks, and the `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Puzzlebag T.

### 2026-10-15 Simulator item parity continuation 120

- Codex owns the Puzzlebag T fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-bags.js`, `scripts/sim-puzzlebag-t-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Puzzlebag T now mirrors source prepare-time `usesBuffs()` targeting, exact named refund parameter behavior, fractional per-buff accrual with source rounding, affected-origin filtering, and miniActivate-only refund projection. Puzzlebag T/S/L/J, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Puzzlebag Z.

### 2026-10-15 Simulator item parity continuation 121

- Codex owns the Puzzlebag Z fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-bags.js`, `scripts/sim-puzzlebag-z-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Puzzlebag Z now mirrors source prepare-time lifecycle, exact catalog `getChance()` amplification, `inflictsDebuffs()`-only cargo filtering, and additive all-debuff chance modifiers. Puzzlebag Z/T/S/L/J, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Puzzlebox.

### 2026-10-15 Simulator item parity continuation 122

- Codex owns the Puzzlebox fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-outliers-board.js`, `scripts/sim-puzzlebox-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Puzzlebox now mirrors the source prepare-time cooldown-only target filter, exact named `speed`/`speed2` modifiers, zero-safe missing parameters, and consume-after-effect lifecycle. Focused source/handler, Puzzlebag group, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertion all pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rainbow Badge.

### 2026-10-15 Simulator item parity continuation 123

- Codex owns the Rainbow Badge fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-outliers.js`, `scripts/sim-rainbow-badge-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Badge now mirrors the source `Game.getBuffs()` loop (Lucky through Heat), one-stack grants, and post-effect consume/activation ordering. The source `onAddToInventory`/`onRemoveFromInventory` hooks only refresh the game shop class pool; they do not change combat behavior or simulator item class data. Focused source/handler, Puzzlebox, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rainbow Goobert.

### 2026-10-15 Simulator item parity continuation 124

- Codex owns the Rainbow Goobert fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-goobert.js`, `scripts/sim-rainbow-goobert-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Goobert now mirrors the runtime-winning peer-trigger port: Goobert’s 9 affected-item activation threshold, catalog Block/Heal values, exact P3/P4/P5 effects, `canActivate`-filtered weapon empowerment, and post-effect activation order. Focused source/handler, Rainbow Badge, Puzzlebox, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rainbow Goobert Adventurer.

### 2026-10-15 Simulator item parity continuation 125

- Codex owns the Rainbow Goobert Adventurer fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-goobert.js`, `scripts/sim-rainbow-goobert-adventurer-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Goobert Adventurer now mirrors the shared Goobert peer threshold and post-effect activation, catalog Block/Heal values, exact P3 Vampirism, P4 Regeneration, P5 Blind, P6 weapon empowerment, and zero-safe named/indexed parameters. Focused source/handler, base Rainbow Goobert, Rainbow Badge, Puzzlebox, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rainbow Goobert Berserker.

### 2026-10-15 Simulator item parity continuation 126

- Codex owns the Rainbow Goobert Berserker fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-aura.js`, `scripts/sim-rainbow-goobert-berserker-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Goobert Berserker now mirrors the source Goobert peer threshold and post-effect activation, catalog Block/max-health values, exact P3 Vampirism, P4 random buffs, named Blind, P5 weapon empowerment, and zero-safe optional parameters. Focused source/handler, Rainbow Goobert family, Rainbow Badge, Puzzlebox, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review the next item alphabetically after Rainbow Goobert Berserker.

### 2026-10-15 Simulator item parity continuation 127

- Codex owns the Rainbow Goobert Engineer fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-goobert.js`, `scripts/sim-rainbow-goobert-engineer-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Goobert Engineer now mirrors the source Goobert peer threshold and post-effect activation, exact Block/Heal/Stamina/Vampirism/Regeneration/Blind/dambonus values and order, native stamina capping, weapon-only empowerment, and zero-safe named/indexed parameters. Focused source/handler, Berserker, Adventurer, base Rainbow Goobert, Rainbow Badge, Puzzlebox, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rainbow Goobert Mage.

### 2026-10-15 Simulator item parity continuation 128

- Codex owns the Rainbow Goobert Mage fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-d-goobert.js`, `scripts/sim-rainbow-goobert-mage-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Goobert Mage now mirrors the source Goobert peer threshold and prepare lifecycle, exact Block/Heal/P3 Vampirism/P4 most-held buffs/P5 Blind/P6 weapon empowerment, zero-safe parameters, and post-effect activation order. Focused source/handler, Engineer, Berserker, Adventurer, base Rainbow Goobert, Rainbow Badge, Puzzlebox, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rainbow Goobert Ranger.

### 2026-10-15 Simulator item parity continuation 129

- Codex owns the Rainbow Goobert Ranger fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-d-goobert.js`, `scripts/sim-rainbow-goobert-ranger-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Goobert Ranger now mirrors the source Goobert peer threshold and prepare lifecycle, exact Block/Heal/P3 Vampirism/P4 Empower/P5 Blind/P6 weapon empowerment, zero-safe parameters, and post-effect activation order. Focused source/handler, Mage, Engineer, Berserker, Adventurer, base Rainbow Goobert, Rainbow Badge, Puzzlebox, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rainbow Orb.

### 2026-10-15 Simulator item parity continuation 130

- Codex owns the Rainbow Orb fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-mana.js`, `scripts/sim-rainbow-orb-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Orb now mirrors the source Vampiric/Magic/Holy/Dark target predicate, exact Vampirism/Mana/healing-efficiency/random-debuff grants, default one-stack all-buff cooldown effect, zero-safe named/indexed parameters, owner-side activation, and effect-before-activation ordering. Focused source/handler, Rainbow Goobert family, Rainbow Badge, Puzzlebox, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rainbow Potion.

### 2026-10-15 Simulator item parity continuation 131

- Codex owns the Rainbow Potion fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-d-unique.js`, `scripts/sim-rainbow-potion-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rainbow Potion now mirrors source colored descriptor-distinct Book/Staff counts, exact named/indexed Mana/temporary-stamina/random-buff parameters, whole-inventory descriptor-distinct potion triggering, strict `usedBuffs > buffsNeeded` consumption, primary linked potion chaining, potion-empty signaling, and effect-before-activation ordering. Focused source/handler, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to_1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Random Loadout Bag.

### 2026-10-15 Simulator item parity continuation 132

- Codex reviewed Random Loadout Bag source scope and the simulator mapping. No product code changed: `RandomLoadoutBag.gd` contains shop/drop/loadout generation hooks only (`_ready`, `shopOpened`, and placement helpers), with no `onPrepare`, `onCombatStart`, or `doCooldownEffect` combat override. The existing simulator no-op mapping is therefore the correct supported-mode projection, and the dashboard remains `no_independent_combat` rather than falsely claiming a combat port.
- No legal/security surfaces changed. Next step: review Rat.

### 2026-10-15 Simulator item parity continuation 133

- Codex owns the Rat fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-pets.js`, `scripts/sim-rat-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rat now mirrors inherited Forest Friend Pet/Food speed scaling, descriptor minimum effect damage, source chance/chance2 rolls, exact zero-safe Poison/Blind parameters, damage-parented debuff grants, and post-effect activation ordering. Focused source/handler, noop, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to_1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rat Chef.

### 2026-10-15 Simulator item parity continuation 134

- Codex owns the Rat Chef fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-pet.js`, `scripts/sim-rat-chef-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rat Chef now mirrors the source food-only Regeneration aura, intentional override without Rat’s inherited speed, exact named/indexed stamina and Empower values, native stamina clamping, zero-safe missing parameters, explicit stamina/buff projections, and effect-before-activation ordering. Focused source/handler, Rat, syntax, source parity/call audits, ledger/dashboard checks, and `verified_1to_1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Recombobulator.

### 2026-10-15 Simulator item parity continuation 135

- Codex owns the Stable/Unstable Recombobulator fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-gadgets.js`, `scripts/sim-recombobulator-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Both variants now mirror the shared Recombobulator combat source: one random buff, one random debuff cleanse, and activation after both effects, with the source-facing Accessory activation projection. Focused source/handler regression, syntax, source parity/call audits, ledger/dashboard checks, and both `verified_1to_1` assertions pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Relic Case.

### 2026-10-15 Simulator item parity continuation 136

- Codex owns the Relic Case fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-f.js`, `scripts/sim-relic-case-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Relic Case now mirrors the source `Bag.getAffectedItemsInside()` plus `canApplyEffect()` weapon-only filter, exact named/indexed `bonusdam` and `stamina` parameters with zero-safe omission, signed stamina-factor reduction, canBeEmpowered damage-factor guard, and effect-before-activation ordering. The regression specifically excludes a damage-bearing non-weapon pet. Focused source/handler, syntax, source parity/call audits, ledger/dashboard checks, and the `verified_1to1` assertion pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Repeater.

### 2026-10-15 Simulator item parity continuation 137

- Codex owns the Repeater fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-d-board.js`, `scripts/sim-repeater-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Repeater now mirrors the source `hasStartofBattle` target filtering, complete `repeatCombatStart()` pre/main/post lifecycle (including weapon/card inherited wrappers), non-start target exclusion, and default `onAfterEffectFinished()` consume/deactivation after all repeated effects. Focused source/handler, syntax, source parity/call audits, ledger/dashboard checks, and the `verified_1to1` assertion pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Resistor.

### 2026-10-15 Simulator item parity continuation 138

- Codex owns the Resistor fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-hard.js`, `scripts/sim-resistor-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Resistor now mirrors the source charge threshold and exact named/indexed Heat parameters with zero-safe omission. It records the Heat grant only when positive and projects `miniActivate()` as non-metric info rather than a normal activation event. Threshold suppression, sparse/zero params, focused source/handler, syntax, source parity/call audits, ledger/dashboard checks, and the `verified_1to1` assertion pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Reverse.

### 2026-10-15 Simulator item parity continuation 139

- Codex owns the Reverse fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-cards.js`, `scripts/sim-reverse-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Reverse now mirrors the source card reflect/steal parameters through exact named/indexed lookups with zero-safe omission, the source deck duplicate gating for secondary steal, dummy-to-player buff direction, and reveal-before-activation ordering. Focused source/handler, syntax, source parity/call audits, ledger/dashboard checks, and the `verified_1to1` assertion pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rib Saw Blade.

### 2026-10-15 Simulator item parity continuation 140

- Codex owns the Rib Saw Blade fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-perm.js`, `js/pages/sim/engine/scripts/ports-ai-f.js` (inherited Katana snapshot), `scripts/sim-rib-saw-blade-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rib Saw Blade now mirrors the source prepare-time opponent `canBeEmpowered()` weapon snapshot, including Lifesteal weapons while excluding zero-damage weapons, non-weapons, and allies; hit-only removable damage purging; exact named/indexed `dam` and `bonusdam` parameters with zero-safe omission; and shared `weaponStrike` delegation. Focused source/handler, syntax, source parity/call audits, ledger/dashboard checks, and the `verified_1to_1` assertion pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Robodog.

### 2026-10-15 Simulator item parity continuation 141

- Codex owns the Robodog fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-c2.js`, `scripts/sim-robodog-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Robodog now mirrors source prepare/charge-state projection, reset-on-charge base cooldown, Lucky and Heat grants on every cooldown, uncharged-only cooldown growth, activation ordering, and zero-safe typed `luck`, `heat`, and `cdincrease` parameters. Focused source/handler, syntax, source parity/call audits, ledger/dashboard checks, and the `verified_1to_1` assertion pass; no live verification is required. The pre-existing non-runtime duplicate registration in `ports-mech.js` remains documented by the global audit; `ports.js` resolves the active handler from `ports-ai-c2.js`.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rope.

### 2026-10-15 Simulator item parity continuation 142

- Codex owns the Rope fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-accessories.js`, `scripts/sim-rope-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Rope now mirrors the source primary `canActivate()` trigger filter, last valid secondary `hasCooldown()` target selection, capped speed additions, source timer reset/expiration behavior, speed bookkeeping, `miniActivate()` non-metric projection, and zero-safe `speed`/`max`/`dur` parameters. Focused source/handler, syntax, source parity/call audits, ledger/dashboard checks, and the `verified_1to_1` assertion pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Rotation Spring.

### 2026-10-15 Simulator item parity continuation 143

- Codex reviewed Rotation Spring as the next extracted entry. It is a shared `Sprite` physics helper attached to item scenes, not a catalog item or independent combat actor; its source only updates inertial rotation and has no combat hooks. The existing `docs/sim/sim-base-support-classes.md` decision and `scripts/sim-base-support-classes-audit.mjs` source check therefore correctly classify it as visual-only/out of simulator scope, so no runtime port or dashboard item row is appropriate.
- No product behavior changed and no legal/security surfaces changed. The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. Next step: review Ruby Egg.

### 2026-10-15 Simulator item parity continuation 144

- Codex owns the Ruby Egg fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-eggs.js`, `scripts/sim-ruby-egg-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Ruby Egg now mirrors the source DragonEgg start-only lifecycle: exact integer-truncated `p1` Reflect and `p3` Heat parameters with zero-safe omission, Reflect during pre-combat, Heat during combat start, activation after Heat, and no recurring cooldown hook. The intentional source `doCooldownEffect` lifecycle gap remains triaged because the game calls it once from `onCombatStart(false)`. Focused regression, syntax, parity/call audits, ledger/dashboard checks, coverage-honesty, and the explicit `verified_1to1` assertion pass; no live verification is required.
- `npm test` is unavailable because `package.json` defines no test script. The extra `sim-engine-1to1-count` smoke remains at its pre-existing support-class baseline (eight visual/support classes without handlers and generic `dragonegg` mapping); this item’s required gates pass. No legal/security surfaces changed. The global audit remains at 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. Next step: review Ruby Whelp.

### 2026-10-15 Simulator item parity continuation 145

- Codex owns the Ruby Whelp fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-start.js`, `scripts/sim-ruby-whelp-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Ruby Whelp now mirrors the source Weapon start hooks: indexed `p2` Reflect and `p1` Heat lookups take precedence over named fields, missing parameters are zero-safe, Reflect uses the shared stat projection, Heat precedes start activation, and inherited cooldown attacks still delegate through `weaponStrike`. Focused regression, syntax, parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required.
- The global audit remains at the established baseline: 531 scanned items, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Sandbag.

### 2026-10-15 Simulator item parity continuation 146

- Codex owns the Sapphire Egg fidelity repair, focused source regression, lifecycle triage, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-eggs.js`, `scripts/sim-sapphire-egg-smoke.mjs`, `scripts/audit-sim-gd-parity.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Sapphire Egg now mirrors the source DragonEgg start-only lifecycle: exact `p1` Mana projection through the shared integer stack path, Mana-before-activation ordering, zero-safe omission, and no recurring cooldown hook. The source `doCooldownEffect` helper is intentionally triaged because the game invokes it once from `onCombatStart`; no live verification is required.
- Focused regression, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass. The global audit now reports 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Sapphire Whelp.

### 2026-10-15 Simulator item parity continuation 147

- Codex owns the Sapphire Whelp fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-start.js`, `scripts/sim-sapphire-whelp-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Sapphire Whelp now mirrors the source Weapon hooks: indexed `p1` start Mana, hit-only indexed `p2` Mana spend, insufficient-Mana gating, the computed/catalog Block amount through the shared grant path, one random non-Mana buff, and inherited cooldown strike delegation. Focused regression, syntax, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required.
- The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Scholar Bag.

### 2026-10-15 Simulator item parity continuation 148

- Codex owns the Scholar Bag fidelity repair, shared stack-protection support, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/actor.js`, `js/pages/sim/engine/buff-economy.js`, `js/pages/sim/engine/scripts/ports-util.js`, `js/pages/sim/engine/scripts/ports-wave-b.js`, `scripts/sim-scholar-bag-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Scholar Bag now mirrors the source prepare-time Mana-only cargo filter, item-local Mana amplification, Mana-only cleanse protection, named `mana` integer truncation with zero-safe fallback, Mana-before-activation ordering, and the source's explicit activation even though it has no cooldown. Passive bags remain non-activating by default; the explicit source call uses a forced activation projection.
- Focused regression, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Scissorswords.

### 2026-10-15 Simulator item parity continuation 149

- Codex owns the Scissorswords fidelity repair, focused source regression, shared candidate-smoke update, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-aura.js`, `scripts/sim-scissorswords-smoke.mjs`, `scripts/sim-resource-stack-consumable-candidates-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Scissorswords now mirrors the inherited Lightsaber prepare lifecycle, temporary Blind on both actors through its `inflict` override, Blind-driven varying damage, lucky-gated named bonus/regeneration hit behavior, miss Lucky behavior, source integer/float parameter semantics, source-only activation, and light-expiry retriggering. The live simulation clock is used for prepare-installed callbacks so combat-start effects do not expire at prepare time.
- Focused source/handler regression, the existing shared candidate smoke, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Work paused here at the user’s request.

### 2026-10-15 Simulator item parity continuation 150

- Codex owns the Seal the Deal fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-luck.js`, `scripts/sim-seal-the-deal-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Seal the Deal now mirrors the source trade chance/bonus projection, independent Regen-to-Vamp, Lucky-to-Spikes, and Mana-to-Empower conversions, named integer parameters with source indexed fallbacks, zero-safe grants, and activation-last ordering.
- Focused regression, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Serpent Staff.

### 2026-10-15 Simulator item parity continuation 151

- Codex owns the Serpent Staff fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-onhit.js`, `scripts/sim-serpent-staff-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Serpent Staff now mirrors source poison-resistance reduction, per-damage-effect Mana-use events, exact permanent damage, miss-preserved Mana-use queue entries, threshold poison accumulation, and integer-truncated poison threshold parameters. Explicit zero chance and no-Mana/no-event cases remain zero-safe.
- Focused regression, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Sewing Case.

### 2026-10-15 Simulator item parity continuation 152

- Codex owns the Sewing Case fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-bags.js`, `scripts/sim-sewing-case-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Sewing Case now mirrors the source prepare-time affected-cargo filter: crafted items qualify only when they have a cooldown or generate buffs; qualifying cargo receives the named speed bonus and every buff amplification chance. Explicit per-piece chance precedence, indexed speed fallback, and zero-safe behavior are covered.
- Focused source/handler regression, the existing bag-synergy smoke, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shaman Mask.

### 2026-10-15 Simulator item parity continuation 153

- Codex owns the Shaman Mask fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-buff.js`, `scripts/sim-shaman-mask-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Shaman Mask now mirrors the source socketed-gem Lucky count, integer-truncated `getP2()` threshold without a forced minimum, `getP3()` random-buff count including zero-threshold behavior, and activation after the Lucky spend and random grants. The focused fixture also rejects stale display-name-only gem counts.
- Focused source/handler regression, the shared buff smoke, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shell Totem.

### 2026-10-15 Simulator item parity continuation 154

- Codex owns the Shell Totem fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `scripts/sim-shell-totem-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Shell Totem now mirrors the source prepare-time Holy-target stamina reduction, fractional effective stamina use, named/indexed health and heal parameters, health-based Empower/heal branches, and activation only after successful stamina use. Starved activations now skip the effect and activation.
- Focused source/handler regression, the neighboring False Life smoke, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shelly.

### 2026-10-15 Simulator item parity continuation 155

- Codex owns the Shelly source/handler evidence regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-shelly-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`; the existing Shelly handler was validated without additional production changes.
- Shelly now has direct retained proof for Potion-only affected-item filtering, prepare-time Potion speed and debuff-protection changes, integer cleanse count, named heal behavior, and cleanse/heal-before-activation ordering. The inherited Fire Shelly regression also remains green.
- Focused direct and inherited regressions, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shepherd's Crook.

### 2026-10-15 Simulator item parity continuation 156

- Codex owns the Shepherd's Crook fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-aura.js`, `scripts/sim-shepherds-crook-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Shepherd's Crook now mirrors the source Empower-only damage aura, prepare-time buff protection, Blind/Cold resistance, named/indexed damage parameter, and damage-before-activation ordering. The handler now preserves explicit 0% instance chances instead of incorrectly falling back to catalog/default values.
- Focused source/handler regression, related Shelly regressions, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shield of Valor.

### 2026-10-15 Simulator item parity continuation 157

- Codex owns the Shield of Valor fidelity repair, shared Shield stamina correction, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-shields.js`, `scripts/sim-shield-of-valor-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Shield of Valor now mirrors the source prepare-time Block buff-power grant to linked blockers, indexed `p3` factor precedence, inherited Shield registration, indexed `p2` partial stamina drain, activation ordering, and explicit zero chance. The shared Shield callback now uses source `drainStamina()` semantics instead of a sufficient-stamina gate; existing Pine Protector and shield candidate regressions remain green.
- Focused source/handler and neighboring regressions, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shielded.

### 2026-10-15 Simulator item parity continuation 158

- Codex owns the Shielded fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-skills.js`, `scripts/sim-shielded-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Shielded now mirrors the source prepare-time lifecycle, Shield-only additive chance, cooldown-Armor speed filtering, effective chance projection, and source parameter handling. The source `onBought`/`onItemRoll`/`onItemRolled` shop-state hooks are retained in the focused source audit as outside the fixed combat simulator scope.
- Focused source/handler regression, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shiny Mantle.

### 2026-10-15 Simulator item parity continuation 159

- Codex owns the Shiny Mantle fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-hard.js`, `scripts/sim-shiny-mantle-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Shiny Mantle now mirrors the source prepare-time invulnerability listener, named integer Mana/Blind/max parameters, socketed-gem catalog-value duration factor, vulnerability/Mana gating, escalating Mana cost, Blind on invulnerability start, and after-effect finalization. The source shop reset hook remains outside the fixed combat simulator scope.
- Focused source/handler regression, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shiny Shell.

### 2026-10-15 Simulator item parity continuation 160

- Codex owns the Shiny Shell fidelity repair, focused source regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `scripts/sim-shiny-shell-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Shiny Shell now mirrors the source Holy-only affected-item count, modified named healing parameters, heal-before-activation ordering, and `onAfterEffectFinished()` consumption/deactivation. The stale food-consumption path was removed.
- Focused source/handler and neighboring Wave B regressions, syntax checks, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shortbow.

### 2026-10-15 Simulator item parity continuation 161

- Codex owns the Shortbow source/inherited-handler evidence regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-shortbow-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`; the existing `shortbow` port already matched the inherited Weapon behavior.
- Shortbow now has retained proof that its scene attaches `Weapon.gd`, whose source cooldown uses stamina before attack; the port delegates to `weaponStrike`, preserves the ranged hit and activation path, and skips attack/activation when stamina is insufficient.
- Focused source/runtime regression, syntax check, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Shovel.

### 2026-10-15 Simulator item parity continuation 162

- Codex owns the Shovel source/combat-handler evidence regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-shovel-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`; the existing `shovel` combat port already matched the source.
- Shovel now has retained proof for inherited Weapon stamina/attack behavior and its hit-only chance proc that grants 1 Blind. The source `onShopEntered()` dig/spawn path is explicitly retained as outside the fixed combat simulator scope.
- Focused source/runtime and neighboring on-hit regressions, syntax check, source parity/call audits, ledger/dashboard checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Skull.

### 2026-10-15 Simulator item parity continuation 163

- Codex owns the Skull and Skull Badge fidelity repairs, shared socketed-Gem correction, focused source/runtime regressions, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/gem-sockets.js`, `js/pages/sim/engine/scripts/ports-outliers.js`, `scripts/sim-skull-smoke.mjs`, `scripts/sim-skull-badge-smoke.mjs`, `scripts/sim-shortbow-skull-potions-ring-fool-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Skull now mirrors the source opponent `character_damaged` threshold trigger, modified heal, explicit zero-safe Empower, one-shot heal-before-activation order, socketed weapon buff theft, and GemPower-scaled socketed armor resistances. Skull Badge now applies its random debuff before activation; its Reaper shop relation hooks and three-column layout are retained as outside the fixed combat simulator scope. The older combined Shortbow/Skull regression now emits the canonical `character_damaged` event.
- Focused source/runtime and neighboring regressions, syntax checks, source parity/call audits, sequential ledger/dashboard builds and checks, and explicit `verified_1to1` assertions pass for both items; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Slice of Bread.

### 2026-10-15 Simulator item parity continuation 164

- Codex owns the Slice of Bread fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-consumable.js`, `scripts/sim-slice-of-bread-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Slice of Bread now mirrors the source fractional stamina threshold and grant, strict current-stamina comparison, placement parameter modifiers, actual clamped stamina event amount, and stamina-before-activation ordering. The source Food inheritance and inventory override are retained in the focused audit.
- Focused source/runtime and neighboring food regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Slice of Toast.

### 2026-10-15 Simulator item parity continuation 165

- Codex owns the Slice of Toast fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-regen.js`, `scripts/sim-slice-of-toast-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Slice of Toast now mirrors the source’s fractional stamina branch, placement parameter modifiers, actual clamped stamina grant, integer-truncated regeneration branch, and effect-before-activation ordering. The source Food inheritance and inventory override are retained in the focused audit.
- Focused source/runtime and neighboring food regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Slime Time.

### 2026-10-15 Simulator item parity continuation 166

- Codex owns the Slime Time fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-d-board.js`, `scripts/sim-slime-time-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Slime Time now mirrors the source same-inventory Goobert activation loop, filters out opposite-side pieces, and performs peer effects before its own activation. The source Goobling generation/save hook remains retained as outside the fixed combat simulator scope.
- Focused source/runtime and neighboring Repeater/Wave D/AG regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Sloth.

### 2026-10-15 Simulator item parity continuation 167

- Codex owns the Sloth fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-threshold.js`, `scripts/sim-sloth-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Sloth now mirrors source placement-modified cooldown-neighbor slow, percentage temporary max-health gain, trigger-driven awaken buffs/stun/consumption, non-awaken amulet buffs/stun, exact integer parameter conversion, duration scaling, and effect-before-activation ordering. Its state/UI shop hooks remain outside the fixed combat simulator scope.
- Focused source/runtime and neighboring Band Y/Robodog/board-cell regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Smelly Barrier.

### 2026-10-15 Simulator item parity continuation 168

- Codex owns the Smelly Barrier fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-skills.js`, `scripts/sim-smelly-barrier-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Smelly Barrier now mirrors source prepare-time registration, linked blocker filtering, Garlic block bonus, placement-modified integer parameters, exact block threshold remainder, source-equivalent poison rounding, and post-poison activation. Its persistence/shop hooks remain retained as outside the fixed combat simulator scope.
- Focused source/runtime and neighboring Shielded/Band Y/resource regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Smithing for Dummies.

### 2026-10-15 Simulator item parity continuation 169

- Codex owns the Smithing for Dummies fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-aura.js`, `scripts/sim-smithing-for-dummies-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Smithing for Dummies now mirrors the source crafted-weapon-only filter, placement-modified stamina reduction and flat damage, effect-before-activation ordering, and uses the extracted crafted-ID set when catalog metadata does not carry the crafted flag. Its Whetstone generation, persistence, and shop-roll hooks remain retained as outside the fixed combat simulator scope.
- Focused source/runtime and neighboring aura regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Snake.

### 2026-10-15 Simulator item parity continuation 170

- Codex owns the Snake fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-pets.js`, `scripts/sim-snake-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Snake now mirrors source Pet-only affected counting, the `character_lucky_changed` listener that scales opponent Poison cleanse protection, placement-modified temporary max health, source parameter values without forced minimums/rounding, Poison-before-activation cooldown order, and wrong-actor listener filtering.
- Focused source/runtime and neighboring pet regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Snow Stick.

### 2026-10-15 Simulator item parity continuation 171

- Codex owns the Snow Stick fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-onhit.js`, `scripts/sim-snow-stick-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Snow Stick now mirrors its inherited Weapon cooldown, source `onPreDealDamage_early` timing, hit-only opponent/self Cold grants, integer parameter conversion, and no forced minimum values. The existing simulator cold-resistance and inherited Weapon paths remain shared infrastructure.
- Focused source/runtime and neighboring Wave C/Weapon/on-hit regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Snowcake.

### 2026-10-15 Simulator item parity continuation 172

- Codex owns the Snowcake fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-cold.js`, `scripts/sim-snowcake-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Snowcake now mirrors Food cooldown order, source integer Cold and threshold parameters, threshold-gated effect-damage factor, catalog min-damage effect hit, opponent debuff resistance inputs, and activation after all effects. Its inherited Food lifecycle remains shared infrastructure.
- Focused source/runtime and neighboring Cold/Food regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Snowman.

### 2026-10-15 Simulator item parity continuation 173

- Codex owns the Snowman no-combat source evidence, generated audit artifacts, and this handoff. Changed paths include `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`; no combat handler was needed.
- Snowman is now explicitly evidenced as `no_independent_combat`: its source only replaces a dropped item with two Snowballs, and the existing no-combat audit verifies its absence of independent cooldown/combat hooks. Its drop/storage replacement remains outside the fixed combat simulator scope.
- The no-combat source audit, sequential ledger/dashboard builds and checks, and explicit dashboard assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Snowmaster.

### 2026-10-15 Simulator item parity continuation 174

- Codex owns the Snowmaster fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-pets.js`, `scripts/sim-snowmaster-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Snowmaster now mirrors source `onPrepare` Ice-only speed scaling, integer Cold/threshold/Empower parameters, threshold Empower-versus-Cold branching, player debuff cleanse, and activation after effects. The Cold resistance and shared pet lifecycle remain simulator infrastructure.
- Focused source/runtime and neighboring pet/Cold regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Solaris.

### 2026-10-15 Simulator item parity continuation 175

- Codex owns the Solaris fidelity repair, its focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-skills.js`, `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `scripts/sim-solaris-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Solaris now mirrors source `onPrepare` all-item Heat amplification, linked Sun Shield/Sun Armor signal filtering, exact chance/Heat/Block handling, shield-block Heat response, and visual-only `miniActivate` on Sun Armor `used_heat`. Sun Armor now emits `used_heat` after its spend/heal/cleanse effects and activates afterward, matching the source ordering.
- Focused Solaris, Wave B, Snowmaster, and Snake regressions, syntax checks, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The older effect-damage candidate smoke still has its pre-existing unrelated `amulet_of_darkness` handler assertion failure. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Spell Scroll Dark.

### 2026-10-15 Simulator item parity continuation 176

- Codex owns the Spell Scroll Dark fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-skill.js`, `scripts/sim-spell-scroll-dark-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Spell Scroll Dark now mirrors source secondary-Dark preparation speed, all affected-item speed grants during cooldown, self Blind grants, exact integer activation cap, and `onAfterEffectFinished()` consume-after-effects ordering. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Spell Scroll Dark, Band Y, and Books regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Spell Scroll Frostbolt.

### 2026-10-15 Simulator item parity continuation 177

- Codex owns the Spell Scroll Frostbolt fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b.js`, `scripts/sim-spell-scroll-frostbolt-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Spell Scroll Frostbolt now mirrors source linked-Ice max-use calculation, descriptor min-damage effect hits, integer Cold amount, placement-modified temporary Cold duration, and effect-before-consume/activation ordering. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Frostbolt, Wave B, resource/temporary-stack, and Spell Scroll Dark regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds and checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 12 call-review candidates. No legal/security surfaces changed. Next step: review Spell Scroll Ice.

### 2026-10-15 Simulator item parity continuation 178

- Codex owns the Spell Scroll Ice fidelity repair, late damage-phase bridge, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/damage.js`, `js/pages/sim/engine/scripts/ports-ao-spells.js`, `scripts/sim-spell-scroll-ice-smoke.mjs`, `scripts/sim-resource-stack-consumable-candidates-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Spell Scroll Ice now mirrors source linked Shield/activatable Armor filtering, activation Cold behavior, late pre-damage lethal-save timing, all-Cold-to-Block conversion before Block resolution, consume activation, and miniActivate projection. The shared damage pipeline now emits `pre_take_damage_late` at the matching phase.
- Focused Ice, existing resource-stack, crossblades, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit `verified_1to1` assertion pass; no live verification is required. The unrelated pre-existing damage/stat candidate smoke still assumes an `onCombatStart` hook for another handler. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 11 remaining call-review candidates. No legal/security surfaces changed. Next step: review Spell Scroll Light.

### 2026-10-15 Simulator item parity continuation 179

- Codex owns the Spell Scroll Light fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `scripts/sim-spell-scroll-light-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Spell Scroll Light now mirrors source Holy-only preparation speed, cleanse-before-heal gating, modified Heal parameter behavior, no heal while debuffs remain, and activation after all effects. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Spell Scroll Light, Books, Wave B, Ice, and Snowcake regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle helper gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 11 remaining call-review candidates. No legal/security surfaces changed. Next step: review Spell Scroll Nature.

### 2026-10-15 Simulator item parity continuation 180

- Codex owns the Spell Scroll Nature fidelity repair, shared stamina-event attribution, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/actor.js`, `js/pages/sim/engine/scripts/ports-ao-spells.js`, `scripts/sim-spell-scroll-nature-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Spell Scroll Nature now mirrors source linked stamina-user filtering, `onPrepare` listener setup, fractional stamina accumulation, repeated threshold processing, Mana-gated `useMana`, source Stamina grants, and activation after each successful proc. `stamina_used` now carries the active stamina-consuming piece so item listeners can apply the source signal to the correct linked item.
- Focused Nature, Books, resource/stack, and Band Y regressions, syntax checks, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit `verified_1to1` assertion pass; live verification is not required. The global audit remains at 531 scanned items, 2 intentional lifecycle hook gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 11 remaining call-review candidates. No legal/security surfaces changed. Next step: review the next catalog item after Spell Scroll Nature.

### 2026-10-15 Simulator item parity continuation 181

- Codex owns the Staff of Fire fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-mana.js`, `scripts/sim-staff-of-fire-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Staff of Fire now mirrors source `onPrepare` counter reset, early Heat/Mana gating in `onPreDealDamage_early`, integer parameter conversion, permanent damage growth, failed-resource behavior, and resource effects before inherited Weapon activation. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Staff of Fire, Wave C, and Serpent Staff regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle hook gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 11 remaining call-review candidates. No legal/security surfaces changed. Next step: review Staff of Unhealing.

### 2026-10-15 Simulator item parity continuation 182

- Codex owns the Staff of Unhealing fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `scripts/sim-staff-of-unhealing-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Staff of Unhealing now mirrors source prepare reset, stamina gating, exact Mana/modified heal and duration parameters, Mana-enabled temporary Unhealing, no-Mana fallback healing, timer expiry, and activation after all effects. Its retained source call review maps `useMana` to the simulator’s equivalent stack spend; dashboard verdict is `verified_1to1`, with live verification not required.
- Focused Staff of Unhealing, Wave B, Wave C, and Books regressions, syntax check, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle hook gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 10 remaining call-review candidates. No legal/security surfaces changed. Next step: review Stamina Sack.

### 2026-10-15 Simulator item parity continuation 183

- Codex owns the Stamina Sack source/runtime evidence regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-stamina-sack-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`; the existing Bag/max-stamina implementation required no code repair.
- Stamina Sack now has retained proof for its `Bag` inheritance, source inventory max-stamina hooks, simulator’s +1 maximum stamina per sack, Bagtacular-only preparation stamina regeneration, and no-Bagtacular baseline.
- Focused Stamina Sack, Badger/Bagtacular, default-bag, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit `verified_1to1` assertion pass; live verification is not required. The global audit remains at 531 scanned items, 2 intentional lifecycle hook gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 10 remaining call-review candidates. No legal/security surfaces changed. Next step: review Star of Courage.

### 2026-10-15 Simulator item parity continuation 184

- Codex owns the Star of Courage fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-accessories.js`, `scripts/sim-star-of-courage-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Star of Courage now mirrors source prepare-time behavior, applies its percentage reduction only to inventory weapons, and excludes pets and other damage-bearing non-weapons. The simulator’s shared stamina-cost projection preserves the source factor while presenting its established two-decimal cost value.
- Focused Star of Courage, Dual Wielding, Badger Rune, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit `verified_1to1` assertion pass; live verification is not required. The global audit remains at 531 scanned items, 2 intentional lifecycle hook gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 10 remaining call-review candidates. No legal/security surfaces changed. Next step: review Steel Dragon.

### 2026-10-15 Simulator item parity continuation 185

- Codex owns the Steel Dragon fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-aura.js`, `scripts/sim-steel-dragon-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Steel Dragon now mirrors source `canBeEmpowered() or canBlock()` target filtering, prepare-time Block buff power, pre-combat reflect stacks, affected-item combat-start damage, and `activate(null, false)` activation. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Steel Dragon, Wave B, Wave C, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle hook gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 10 remaining call-review candidates. No legal/security surfaces changed. Next step: review Stone Armor.

### 2026-10-15 Simulator item parity continuation 186

- Codex owns the Stone Armor fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-threshold.js`, `scripts/sim-stone-armor-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Stone Armor now mirrors source indexed parameter fallbacks, prepare-time stamina factor, combat-start Block plus activation, strict one-shot low-health conversion, and cooldown Spikes/Empower removal before activation. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Stone Armor, Wave D, Shell Totem, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle hook gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 10 remaining call-review candidates. No legal/security surfaces changed. Next step: review Stone Badge.

### 2026-10-15 Simulator item parity continuation 187

- Codex owns the Stone Badge fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-d.js`, `scripts/sim-stone-badge-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Stone Badge now mirrors source catalog-Block fallback, `giveBlock()` before `activate()`, and retained class-update/shop/discard hooks outside the fixed combat simulator scope. Its dashboard verdict is `verified_1to1`; live verification is not required. The existing duplicate legacy export remains documented by the global duplicate-registration audit; the AI-D port is the runtime winner.
- Focused Stone Badge, Wave D, Bag of Stones, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle hook gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 10 remaining call-review candidates. No legal/security surfaces changed. Next step: review Stone Gloves.

### 2026-10-15 Simulator item parity continuation 188

- Codex owns the Stone Gloves fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-aura.js`, `scripts/sim-stone-gloves-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Stone Gloves now mirrors source prepare-time weapon attack listener registration, weapon-only `canBeEmpowered()` filtering, combat-start speed reduction/damage factor plus activation, hit-gated Block grant, and `miniActivate` projection. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Stone Gloves, Wave B, shared Weapon, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged lifecycle gaps, 19 duplicate registrations, and 10 remaining call-review candidates. No legal/security surfaces changed. Next step: review Stone Shoes.

### 2026-10-15 Simulator item parity continuation 189

- Codex owns the Stone Shoes fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-armor.js`, `scripts/sim-stone-shoes-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Stone Shoes now mirrors the source’s strict `healthThreshold = p1 / 100 - 0.0001`, prepare-time damage listener, Lucky/Empower/Block activation, placement-modified `getP_m("dur")`, typed/effect damage reduction, consumption, and timeout restoration. The source `consume` call is explicitly reviewed against the simulator’s consumed-piece projection. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Stone Shoes and syntax checks pass; the source parity audit remains at 531 items with 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. The existing broad resource-candidate smoke still has its unrelated pre-existing Staff of Unhealing `onCombatStart` assumption. No legal/security surfaces changed. Next step: review Stone Skin Potion.

### 2026-10-15 Simulator item parity continuation 190

- Codex owns the Stone Skin Potion and Strong Stone Skin Potion fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-potions.js`, `scripts/sim-stone-skin-potion-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Both potion rows now mirror the source Block-change listener in `onPrepare`, threshold consumption, health-to-Block conversion, first affected-potion trigger, and activation. Strong Stone Skin Potion additionally mirrors temporary Spikes and placement-modified `getP_m("dur")`. Both dashboard rows are `verified_1to1`; live verification is not required.
- Focused potion, Wave A, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit assertions pass. The broad resource-candidate smoke still has its unrelated pre-existing Staff of Unhealing `onCombatStart` assumption. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Stoned.

### 2026-10-15 Simulator item parity continuation 191

- Codex owns the Stoned fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-skills.js`, `scripts/sim-stoned-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Stoned now mirrors source Stone-tag/Stone Golem filtering, prepare-time per-item attacked listeners, full hit-damage percentage-to-Block conversion, owner-side scoping, mini activation, and Block-change/character-damaged resistance transitions. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Stoned, Stone Gloves, Stone Skin Potion, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the explicit dashboard assertion pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Storage Coffin.

### 2026-10-15 Simulator item parity continuation 192

- Codex owns the Storage Coffin fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-bags.js`, `scripts/sim-storage-coffin-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Storage Coffin now mirrors the source `onPrepare` activated listener, `canActivate()` plus non-bag inside filtering, catalog chance roll, one Poison grant to the opponent, and the source bag activation/log behavior. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Storage Coffin, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and the focused regression pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Strong Demonic Flask.

### 2026-10-15 Simulator item parity continuation 193

- Codex owns the Strong Demonic Flask fidelity repair and explicit evidence row, focused regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-potions.js`, `scripts/sim-demonic-flask-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Strong Demonic Flask now applies the source placement-modified `getP_m("dur")` healing-reduction timer while retaining the dual health thresholds, debuff-scaled lifesteal, linked potion trigger, and healing-efficiency restoration. Both Demonic Flask rows are `verified_1to1`; live verification is not required.
- Focused Demonic Flask, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Strong Divine Potion.

### 2026-10-15 Simulator item parity continuation 194

- Codex owns the Strong Divine Potion explicit evidence row, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `scripts/sim-divine-potion-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Strong Divine Potion’s existing handler matches the extracted inherited debuff-threshold/consumption lifecycle, exact random cleanse and buff counts, zero-safe values, and non-consuming linked Potion trigger. Its dashboard verdict is now `verified_1to1`; live verification is not required.
- Focused Divine Potion, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Strong Health Potion.

### 2026-10-15 Simulator item parity continuation 195

- Codex owns the Health Potion and Strong Health Potion fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-consumable.js`, `scripts/sim-health-potion-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Both potion rows now mirror the source `character_damaged` preparation listener, strict below-threshold test including blocked hits, source-clamped Poison cleanse, placement-modified Health Potion healing, inherited linked-potion trigger ordering, consumption lifecycle, and Strong Health Potion Regeneration. Both dashboard rows are `verified_1to1`; live verification is not required.
- Focused Health Potion, Dark Lantern threshold, Divine Potion, Stone Skin Potion, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Strong Heroic Potion.

### 2026-10-15 Simulator item parity continuation 196

- Codex owns the Heroic Potion and Strong Heroic Potion fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-a.js`, `js/pages/sim/engine/scripts/ports-ak-potions.js`, `js/pages/sim/engine/scripts/ports-util.js`, `scripts/sim-heroic-potion-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Both potion rows now bind the source preparation-time stamina-starvation listener, use strict below-cost checks, empty before applying effects, preserve exact p1/p2 values including zero, trigger the first linked Potion without consuming it, and retain activation ordering. Both dashboard rows are `verified_1to1`; live verification is not required. The shared linked-potion helper now safely no-ops for contexts without a board graph.
- Focused Heroic Potion, the existing combined potion regression, Health Potion, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Strong Mana Potion.

### 2026-10-15 Simulator item parity continuation 197

- Codex owns the Mana Potion and Strong Mana Potion fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-potions.js`, `scripts/sim-mana-potion-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Both potion rows now mirror the source strict `p1 / 100 - 0.0001` health threshold, blocked-hit response, own item-originated mana-spend listener, exact Mana grant, linked-potion trigger ordering, and consumption. `giveMaxHealth()` now increases both max and current HP, and Strong Mana Potion applies placement-modified max health. Both dashboard rows are `verified_1to1`; live verification is not required.
- Focused Mana Potion, the existing combined potion regression, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Strong Pestilence Flask.

### 2026-10-15 Simulator item parity continuation 198

- Codex owns the Strong Pestilence Flask timer fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-potions.js`, `js/pages/sim/engine/simulate.js`, `scripts/sim-pestilence-flask-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Strong Pestilence Flask now uses raw source `getP3()` delay and `getP4()` delayed Poison values, runs its one-shot timer after the consumed potion leaves the board, and clears the timer on combat end. Its dashboard row is `verified_1to1`; live verification is not required. The existing Pestilence Flask row remains verified by the same regression.
- Focused Pestilence Flask, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Strong Stone Skin Potion.

### 2026-10-15 Simulator item parity continuation 199

- Codex owns the Vampiric Potion and Strong Vampiric Potion fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ak-potions.js`, `js/pages/sim/engine/simulate.js`, `scripts/sim-vampiric-potion-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Vampiric Potion now uses source `stealLife` effect damage, exact lifesteal/Vampirism parameters, strict dual health thresholds, and linked-potion ordering. Strong Vampiric Potion now grants temporary attack lifesteal instead of immediate normal-potion damage, heals from full qualifying attack damage, applies modified duration, filters misses/owner attacks, and clears at combat end. Both dashboard rows are `verified_1to1`; live verification is not required. The simulator keeps consumed timed-potion state ticking until expiry.
- Focused Vampiric Potion, Pestilence Flask, Demonic Flask, combined potion, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 scanned items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Sun Armor.

### 2026-10-15 Simulator item parity continuation 200

- Codex owns the Sun Armor fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `js/pages/sim/engine/scripts/ports-util.js`, `scripts/sim-solaris-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Sun Armor now mirrors source Fire/Holy targeting, adds dynamic Holy to linked Fire items, counts each linked Fire/Holy item once for combat-start Heat, uses catalog Block and raw source parameters, preserves Heat spend/heal/cleanse and `used_heat` ordering, and activates after its effect. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Solaris/Sun Armor, Wave B, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Sun Shield.

### 2026-10-15 Simulator item parity continuation 201

- Codex owns the Sun Shield fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-shields.js`, `scripts/sim-sun-shield-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Sun Shield now mirrors source `canBlock` targeting, preparation-time linked `gave_block` accumulation, exact threshold remainder and damage/bonus-tick state, visual-only mini activation, and the separate after-block stamina drain/activation path. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Sun Shield, Solaris, Shield of Valor, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Superior Ring.

### 2026-10-15 Simulator item parity continuation 202

- Codex owns the Superior Ring fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ring.js`, `scripts/sim-superior-ring-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Superior Ring now mirrors the source per-effect activation lifecycle: each configured Start/Every/low-health effect applies its scaled stack and produces its own activation, including shared-trigger effects and zero amounts. Persistent effect decoding and one-shot player/opponent low-health triggers remain covered. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Superior Ring, ring configuration/history creation, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Tesla Coil.

### 2026-10-15 Simulator item parity continuation 203

- Codex owns the Tesla Coil fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-mech.js`, `scripts/sim-tesla-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Tesla Coil now mirrors source preparation-time cooldown queue construction, star-target priority, cooldown-capable target retention before activation, charge mini-activation projection, source CD advance amount, queue-finished consumption, and cooldown stop/resume behavior while targets remain. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Tesla Coil, charge delivery/stat, Band Y, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review The Fool.

### 2026-10-15 Simulator item parity continuation 204

- Codex owns The Fool fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-cards.js`, `scripts/sim-the-fool-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- The Fool now mirrors source deck-scoped reveal speed, chain-position-zero secondary Empower, exact zero-safe Empower values, and reveal activation ordering. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused The Fool, Card base, Deck of Cards, combined card/potion/ring, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review The Lovers.

### 2026-10-15 Simulator item parity continuation 205

- Codex owns The Lovers fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ao-cards.js`, `scripts/sim-the-lovers-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- The Lovers now mirrors source even-chain healing efficiency and regeneration gates, effect damage plus placement-modified lifesteal, odd-chain damage-only behavior, zero-safe values, and reveal activation ordering. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused The Lovers, Card base, Deck of Cards, combined card/potion/ring/Fool, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Thorn Bow.

### 2026-10-15 Simulator item parity continuation 206

- Codex owns the Thorn Bow fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ap-basic.js`, `scripts/sim-thorn-bow-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Thorn Bow now mirrors source linked-weapon attack listening, combat-start Spikes, one Spike per attack effect, double-attack handling, temporary P2 bonus damage, post-strike cleanup, and zero-safe P1/P2 values. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Thorn Bow, shared Bow, combined card/potion/ring/Fool, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Thorn Elemental.

### 2026-10-15 Simulator item parity continuation 207

- Codex owns the Thorn Elemental and shared spike-mechanics fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/actor.js`, `js/pages/sim/engine/damage.js`, `js/pages/sim/engine/scripts/ports-ai-c2.js`, `scripts/sim-thorn-elemental-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Thorn Elemental now mirrors source Nature filtering, preparation-time effect/ranged Spike limits, Spike critical chance, exact cooldown Spike grant ordering, and zero-safe values. The shared damage resolver now applies effect/ranged Spike limits and critical Spike reflection. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Thorn Elemental, Burning Spikes, effect-damage candidate baseline, weapon/Bow, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. Two unrelated legacy smoke scripts still fail on their existing handler assumptions (`amulet_of_darkness` runtime-port assertion and an `onCombatStart` call on a prepare-only handler); they were not caused by this change. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Thorn Shortbow.

### 2026-10-15 Simulator item parity continuation 208

- Codex owns the Thorn Shortbow fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-onhit.js`, `scripts/sim-thorn-shortbow-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Thorn Shortbow now mirrors source on-hit gating, chance rolls, one-Spike grants, inherited weapon cooldown behavior, and a single combat-log projection without duplicate manual buff lines. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Thorn Shortbow, shared Bow/Weapon, Poison Shortbow, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Thorn Whip.

### 2026-10-15 Simulator item parity continuation 209

- Codex owns the Thorn Whip fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-scale.js`, `scripts/sim-thorn-whip-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Thorn Whip now mirrors source preparation-time Spike listener registration, early-hit Spike granting, positive and negative `changeVaryingDamage` updates, non-removable varying damage, inherited weapon cooldown, and single log projection. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Thorn Whip, shared Weapon, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertions pass. One unrelated legacy damage/stat smoke still calls `onCombatStart` on a handler that does not expose that hook; it is not caused by this change. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Thornbloom.

### 2026-10-15 Simulator item parity continuation 210

- Codex owns the Thornbloom fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-scale.js`, `scripts/sim-thornbloom-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Thornbloom now mirrors source preparation-time Spike/Empower listeners, early pre-deal hit ordering, chance-gated Empower, placement-modified `getP_m("maxhealth")`, non-removable varying damage, inherited weapon cooldown, and zero-safe parameters. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Thornbloom, Thorn Whip, shared Weapon, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit dashboard assertion pass. `git diff --check` exits cleanly with existing line-ending warnings. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 19 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Thornburst.

### 2026-10-15 Simulator item parity continuation 211

- Codex owns the Thornburst fidelity repair, focused source/runtime regression, duplicate-port cleanup, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-e.js`, `js/pages/sim/engine/scripts/ports-outliers.js`, `scripts/sim-thornburst-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Thornburst now mirrors source preparation-time activation/listener setup, raw zero-safe uses/Spike/speed parameters, placement-modified stun duration, Spike-to-speed gains and losses, effects-before-activation ordering, and final-use `onAfterEffectFinished` consume/lock behavior. Its dashboard verdict is `verified_1to1`; live verification is not required. The stale duplicate outlier registration was removed, reducing duplicate registrations by one.
- Focused Thornburst, Thornbloom, Thorn Whip, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertions, and `git diff --check` pass; the latter reports only existing line-ending warnings. The global audit is now 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Thors Hammer.

### 2026-10-15 Simulator item parity continuation 212

- Codex owns the Thors Hammer fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-c-onhit.js`, `scripts/sim-thors-hammer-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Thors Hammer now mirrors the source cached p2/p3/p4/p5 parameter slots, hit → chance stun → Mana gate → effect damage → temporary Blind order, placement-modified `getP_m("dur_stun")`/`getP_m("dur_blind")`, zero-cost Mana behavior, miss/insufficient-Mana gates, inherited weapon cooldown, and no phantom zero-value Blind log. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Thors Hammer, Thorn Shortbow, Thorn Whip, shared Weapon, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertions, and `git diff --check` pass; the latter reports only existing line-ending warnings. The global audit remains 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Thunder Drake.

### 2026-10-15 Simulator item parity continuation 213

- Codex owns the Thunder Drake fidelity repair, shared Lightning board-mark support, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-d-weapons.js`, `js/pages/sim/engine/board-graph.js`, `scripts/sim-thunder-drake-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, and `assets/data/sim-audit-dashboard.json`.
- Thunder Drake now mirrors source Lightning filtering (`hasCooldown` or `reactsToCharges`), preparation-time target/multiplicity caching, exact successful-hit threshold, first activation speed/charge behavior, active charge-left/re-delivery refresh, placement-modified timer duration, timer expiry cleanup, and zero-safe values. The board graph now exposes tertiary and Lightning shape marks to the existing canAffect rules. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Thunder Drake and neighboring Thorn/Thor regressions, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertion, and `git diff --check` pass; the latter reports only existing line-ending warnings. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Tiger Rune.

### 2026-10-15 Simulator item parity continuation 214

- Codex owns the Tiger Rune fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/gem-sockets.js`, `scripts/sim-tiger-rune-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.
- Tiger Rune now mirrors source inventory-wide all-buff amplification, weapon `pre_deal_damage_late` Vampirism gating, visual-only `miniActivate`, proportional buff-counter Block grants, Gem Power scaling, source parameter slots, remainder tracking, and zero-safe thresholds. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Tiger Rune, Badger Rune, tiered/chipped gem, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertion, and `git diff --check` pass; the latter reports only existing line-ending warnings. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Time Dilator.

### 2026-10-15 Simulator item parity continuation 215

- Codex owns the Time Dilator fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-outliers-board.js`, `scripts/sim-time-dilator-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.
- Time Dilator now mirrors source `onPrepare` timing before cooldown arming, both-board weapon slow, owner-inventory highest modified cooldown targeting, haste application, activation tick reset/increment, alternating sound-pitch metadata, and zero-safe values. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Time Dilator, Band Y, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, and explicit Tiger Rune/Time Dilator dashboard assertions pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Time Melting.

### 2026-10-15 Simulator item parity continuation 216

- Codex owns the Time Melting fidelity repair, focused source/runtime regression, the neighboring duration-port import repair, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-wave-b.js`, `js/pages/sim/engine/scripts/ports-wave-c-onhit.js`, `scripts/sim-time-melting-parity-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.
- Time Melting now mirrors source inventory-duration targeting, p2 duration fallback, prepared duration multiplier composition, high combat-start priority, raw integer Heat grant, activation ordering, and zero-safe values. The adjacent Wave C duration call now imports its required `effectDuration` helper. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Time Melting, duration-effects, predicate, Time Dilator, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertions, and `git diff --check` pass; the latter reports only existing line-ending warnings. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Time Pendant.

### 2026-10-15 Simulator item parity continuation 217

- Codex owns the Time Pendant fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-accessories.js`, `scripts/sim-time-pendant-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.
- Time Pendant now mirrors source cooldown-target filtering, first affected-star selection, inactive-first gate, p1 cooldown advance, opponent-side actor mapping, visual mini activation metadata, and zero-safe values. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Time Pendant, final runtime backlog, Band Y, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertions, and `git diff --check` pass; the latter reports only existing line-ending warnings. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Toad.

### 2026-10-15 Simulator item parity continuation 218

- Codex owns the Toad fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports.js`, `scripts/sim-toad-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.
- Toad now mirrors source prepare-time affected-buff listener registration, integer threshold parameters, placement-modified `getP_m("heal")`, positive/negative threshold remainder handling, Lucky/Mana threshold and cooldown grants, source-order full activation, visual mini activations, and zero-safe values. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Toad, spotlight, Wave D, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertion, and `git diff --check` pass; the latter reports only existing line-ending warnings. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Toast Goobert.

### 2026-10-15 Simulator item parity continuation 219

- Codex owns the Toast Goobert fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-am-goobert.js`, `scripts/sim-toast-goobert-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.
- Toast Goobert now mirrors inherited Goobert peer activation timing, p-slot parameter fallbacks, low-stamina `giveStamina` behavior with effective-max clamping, high-stamina integer Regeneration, source-order activation, stamina projection, and zero-safe values. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Toast Goobert, Wave D, Band Y, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertion, and `git diff --check` pass; the latter reports only existing line-ending warnings. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Toolbox.

### 2026-10-15 Simulator item parity continuation 220

- Codex owns the Toolbox fidelity repair, focused source/runtime regression, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-ai-hard.js`, `scripts/sim-toolbox-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.
- Toolbox now mirrors source p1 speed reduction/p2 damage-factor aura mapping, empowerable-only contents, preparation-time opponent-hit Battle Rage lifesteal, full-damage ceiling with modified lifesteal, modified rage duration, source-order activation, and Bag lock/consume cleanup. Its dashboard verdict is `verified_1to1`; live verification is not required.
- Focused Toolbox, Berserker Bag, Extra Angy, Toast Goobert, Wave D, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit Toolbox dashboard assertion, and `git diff --check` pass. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, 18 duplicate registrations, and 9 remaining call-review candidates. No legal/security surfaces changed. Next step: review Topaz.

### 2026-10-15 Simulator item parity continuation 221

- Codex owns the Topaz family fidelity repair, focused source/runtime regression, shared gem chance/parameter repair, generated audit artifacts, and this handoff. Changed paths include `js/pages/sim/engine/scripts/ports-an-gems.js`, `js/pages/sim/engine/gem-sockets.js`, `scripts/sim-topaz-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.
- Topaz now mirrors source positional p2 inventory stamina and p1 weapon speed values, `getChance/getChance2` modifier/clamp behavior, GemPower-scaled armor stun/crit resistance, and zero-safe values across all five catalog tiers. Chipped, Flawed, Regular, Flawless, and Perfect Topaz all report `verified_1to1`; live verification is not required.
- Focused Topaz family, Perfect Topaz, chipped-gem family, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit all-tier dashboard assertion, and `git diff --check` pass. The raw call heuristic still reports 15 candidates; the retained ledger filters the two proven shared Topaz `addSpeed` candidates, leaving 7 review candidates. The global audit remains at 531 items, 2 intentional lifecycle gaps, 0 untriaged gaps, and 18 duplicate registrations. No legal/security surfaces changed. Next step: review Turtle.

### 2026-10-15 Simulator item parity continuation 222 — in progress

- Codex owns the Turtle fidelity repair, shared shield damage-block registration, focused runtime regression, generated audit artifacts, and this handoff. Planned paths are `js/pages/sim/engine/scripts/ports-ai-c2.js`, `js/pages/sim/engine/scripts/ports-pet.js`, `js/pages/sim/engine/scripts/ports-ao-shields.js`, `scripts/sim-turtle-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, `assets/data/sim-fidelity-ledger.json`, `assets/data/sim-audit-dashboard.json`, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 222 — complete

- Turtle now mirrors the extracted Leather Helm inheritance: shield-only preparation targeting, p2 `modifyParam("damblock", ...)`, dual-side pre-combat damage resistance, modified p3 duration, inherited combat-start activation, and p4 max-health Block added to `getBlock()`.
- The shared shield registration now reads live `paramMult.damblock` values through the real shield damage-reduction path. The stale duplicate Turtle handler was removed from `ports-pet.js`, reducing duplicate registrations from 18 to 17.
- Added `scripts/sim-turtle-smoke.mjs` and source-backed fidelity evidence. Turtle is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Turtle, Shield of Valor, Pine Protector, Shielded, and Shiny Shell smokes; syntax checks; source parity/call audits; sequential ledger/dashboard builds and checks; explicit Turtle dashboard assertion; and `git diff --check` pass. Global audit: 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Twine.

### 2026-10-15 Simulator item parity continuation 223 — in progress

- Codex owns the Twine fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to the Twine handler/supporting simulator code, `scripts/sim-twine-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 223 — complete

- Twine now mirrors source primary `canActivate` targeting, neutral secondary counting, preparation-time activation listening, descriptor base chance composition, source p1 integer max-health gain, activation ordering, and zero-safe chances.
- Added `scripts/sim-twine-smoke.mjs` and source-backed fidelity evidence. Twine is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Twine, lifecycle-closure, Time Pendant, syntax, source parity/call audits, sequential ledger/dashboard builds and checks, explicit Twine dashboard assertion, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Twine Badge.

### 2026-10-15 Simulator item parity continuation 224 — in progress

- Codex owns the Twine Badge fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-twine-badge-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 224 — complete

- Twine Badge now mirrors source preparation timing, crafted cooldown/buff target filtering, source p1 speed, all-buff amplification chance, and excluded-target behavior.
- Added `scripts/sim-twine-badge-smoke.mjs` and source-backed fidelity evidence. Twine Badge is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Twine Badge, Twine, lifecycle-closure, syntax, source parity/call audits, sequential ledger/dashboard builds and checks, explicit Turtle/Twine/Twine Badge dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Ukulele.

### 2026-10-15 Simulator item parity continuation 225 — in progress

- Codex owns the Ukulele fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-ukulele-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 225 — complete

- Ukulele now mirrors source positional p1/p2/p3/p4/p5/p6 parameters, primary affected-item speed count, musical secondary listeners, preparation healing efficiency/all-inventory buff amplification, source percentage cooldown advance with removal/round-robin behavior, effect-before-activation ordering, and zero-safe outputs.
- Added `scripts/sim-ukulele-smoke.mjs` and source-backed fidelity evidence. Ukulele is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Ukulele, Snowcake, final runtime backlog, syntax, source parity/call audits, sequential ledger/dashboard builds/checks, explicit Turtle/Twine/Twine Badge/Ukulele dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Ultima.

### 2026-10-15 Simulator item parity continuation 226 — in progress

- Codex owns the Ultima fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-ultima-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 226 — complete

- Ultima now mirrors source Nature/Ice/Holy/Dark/Spell targeting, positional p1-p5 speed and grant parameters, live `getBlock()` values, effect ordering, random buff theft, consume-after-effects finalization, and zero-safe values.
- Added `scripts/sim-ultima-smoke.mjs` and source-backed fidelity evidence. Ultima is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Ultima, final runtime backlog, syntax checks, source parity/call audits, sequential ledger/dashboard builds/checks, explicit Turtle/Twine/Twine Badge/Ukulele/Ultima dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Unidentified Skill.

### 2026-10-15 Simulator item parity continuation 227 — in progress

- Codex owns the Unidentified Skill fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-unidentified-skill-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 227 — complete

- Unidentified Skill is confirmed as a source shop-only replacement/reveal item with no independent combat override; its intentional no-combat boundary is now source-audited rather than treated as a missing simulator import.
- Added explicit fidelity evidence using `scripts/sim-no-combat-source-audit.mjs`. Unidentified Skill is now `verified_1to1` in the Admin dashboard with `liveRequired: false` and the known shop-only boundary retained.
- No-combat source audit and sequential ledger/dashboard builds passed. No legal/security surfaces changed. Next step: review Uniquely Unique.

### 2026-10-15 Simulator item parity continuation 228 — in progress

- Codex owns the Uniquely Unique fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-uniquely-unique-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 228 — complete

- Uniquely Unique now mirrors source preparation timing, first primary cooldown targeting, secondary Unique/customer-card filtering, p1/p2 speed parameters, excluded-target behavior, and zero-safe values. Its shop-roll hooks remain documented outside the combat simulator scope.
- Added `scripts/sim-uniquely-unique-smoke.mjs` and source-backed fidelity evidence. Uniquely Unique is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Uniquely Unique, syntax checks, source parity/call audits, sequential ledger/dashboard builds/checks, explicit Unidentified Skill/Uniquely Unique dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Unstable Recombobulator.

### 2026-10-15 Simulator item parity continuation 229 — in progress

- Codex owns the Unstable Recombobulator fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-unstable-recombobulator-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 229 — complete

- Unstable Recombobulator required no code repair: its inherited Recombobulator source path already matches the simulator’s one random buff, one random debuff cleanse, effect ordering, and activation sequence. Its existing source-backed dashboard evidence remains `verified_1to1` with `liveRequired: false`.
- Stable/Unstable Recombobulator and combined neighboring source-port smokes pass. No generated artifacts or product code changed. No legal/security surfaces changed. Next step: review Vampiric Armor.

### 2026-10-15 Simulator item parity continuation 230 — in progress

- Codex owns the Vampiric Armor fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-vampiric-armor-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 230 — complete

- Vampiric Armor now mirrors source p1/p2 combat-start health-to-Block and Vampirism, p3/p4 cooldown conversion, zero-value behavior, descriptor Block fallback, activation-after-effects ordering, and opponent-side event projection.
- Added `scripts/sim-vampiric-armor-smoke.mjs` and source-backed fidelity evidence. Vampiric Armor is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Vampiric Armor, Band Y, syntax checks, source parity/call audits, sequential ledger/dashboard builds/checks, explicit four-item dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Vampiric Collar.

### 2026-10-15 Simulator item parity continuation 231 — in progress

- Codex owns the Vampiric Collar fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-vampiric-collar-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 231 — complete

- Vampiric Collar now mirrors source preparation timing, `canDamage`-only affected links, Vampirism-to-crit scaling, pre-Block `DamageResult.damage` lifesteal, Lucky scaling, source rounding, and p1/p2 parameter fallback.
- Added `scripts/sim-vampiric-collar-smoke.mjs` and source-backed fidelity evidence. Vampiric Collar is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Vampiric Collar, Band Y, syntax checks, source parity/call audits, sequential ledger/dashboard builds/checks, explicit Vampiric Armor/Vampiric Collar dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Vampiric Gloves.

### 2026-10-15 Simulator item parity continuation 232 — in progress

- Codex owns the Vampiric Gloves fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-vampiric-gloves-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 232 — complete

- Vampiric Gloves now mirrors source prepare reset, cooldown-only affected-item targeting, active-state transition, exact p1/p2 Vampirism and speed values, zero-safe parameters, and `onAfterEffectFinished` consume activation after all effects.
- Added `scripts/sim-vampiric-gloves-smoke.mjs` and source-backed fidelity evidence. Vampiric Gloves is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Vampiric Gloves, lifecycle and visual regressions, Band Y, syntax checks, source parity/call audits, sequential ledger/dashboard builds/checks, explicit Vampiric Collar/Vampiric Gloves dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Vampiric Scythe.

### 2026-10-15 Simulator item parity continuation 233 — in progress

- Codex owns the Vampiric Scythe fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-vampiric-scythe-smoke.mjs`, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 233 — complete

- Vampiric Scythe now mirrors source prepare timing, Vampirism-gaining affected targets, target buff-power grant, dynamic p1 speed scaling with p2 cap, delta-only speed updates, and excluded-target behavior.
- Added `scripts/sim-vampiric-scythe-smoke.mjs` and source-backed fidelity evidence. Vampiric Scythe is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Vampiric Scythe, final runtime backlog smoke, syntax checks, source parity/call audits, sequential ledger/dashboard builds/checks, explicit Vampiric Gloves/Vampiric Scythe dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Next step: review Vampiric Potion.

### 2026-10-15 Simulator item parity continuation 234 — in progress

- Codex owns the Vampiric Potion fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-vampiric-potion-smoke.mjs` if a dedicated regression is needed, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 234 — complete

- Vampiric Potion and Strong Vampiric Potion required no new repair: their existing combined source-backed regression covers the dual below-threshold trigger, normal effect damage/lifesteal/Vampirism, strong temporary full-damage lifesteal, strict thresholds, side filtering, duration modification, and combat-end cleanup.
- Re-ran `scripts/sim-vampiric-potion-smoke.mjs`; both items remain `verified_1to1` in the Admin dashboard with `liveRequired: false`. No product or generated artifact changed in this checkpoint. No legal/security surfaces changed. Next step: review Villain Sword.

### 2026-10-15 Simulator item parity continuation 235 — in progress

- Codex owns the Villain Sword fidelity review/repair, focused runtime regression, generated audit artifacts, and this handoff. Planned paths will be limited to its handler/supporting simulator code, `scripts/sim-villain-sword-smoke.mjs` if needed, the fidelity builder/generated artifacts, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator item parity continuation 235 — complete

- Villain Sword now mirrors source `onPreCombatStart` timing, `canBeEmpowered` plus melee-only target filtering, exact p1 target bonus-damage reduction, p2 self bonus damage, correct `weapon_base` family, and zero-safe values.
- Added `scripts/sim-villain-sword-smoke.mjs` and source-backed fidelity evidence. Villain Sword is now `verified_1to1` in the Admin dashboard with `liveRequired: false`.
- Villain Sword, Steel Dragon, final runtime backlog, syntax checks, source parity/call audits, sequential ledger/dashboard builds/checks, explicit dashboard assertions, and `git diff --check` pass. Global audit remains 531 source-scanned, 10 intentional no-handler rows, 2 intentional lifecycle gaps, 0 untriaged gaps, 17 duplicate registrations, and 7 retained call-review candidates. No legal/security surfaces changed. Work paused at the user’s request; next item is not claimed.

### 2026-10-15 Simulator coverage truthfulness 236 — in progress

- Codex owns the user-visible simulator coverage source, its compact generated fidelity summary, focused coverage regression, related simulator documentation, and this handoff. Planned paths are limited to the simulator coverage/registry/page/report code, the audit-dashboard builder and generated summary, the focused coverage smoke, the affected simulator docs, and `docs/CODEX_HANDOFF.md`.

### 2026-10-15 Simulator coverage truthfulness 236 — complete

- The `/sim/` fidelity chip now reports retained `verified_1to1` proof for the items actually placed on the board; a handler or generic engine path no longer appears as 1:1 coverage. Report-issue snapshots and saved run summaries use the same verified percentage.
- Added deterministic `assets/data/sim-fidelity-summary.json`, generated alongside the admin dashboard. Current source-backed status is 333 of 519 catalog items verified (64% global); the board chip remains board-specific and intentionally shows `—` if the evidence artifact is unavailable.
- Added `scripts/sim-verified-coverage-smoke.mjs`; updated dashboard-builder coverage tests and simulator documentation. Focused smoke, coverage honesty, syntax checks, parity/call audits, ledger/dashboard/summary stale checks, recent-row verdict assertions, and `git diff --check` pass. The pre-existing engine census still reports its known eight support-class handler gaps plus `dragonegg` generic mapping; no unrelated exceptions were changed. No legal/security surfaces changed and no live verification was required.

### 2026-10-15 Create default-bag preset button 237 — complete

- Replaced the lock-shaped inline SVG on `/create/` with the existing game-style `BagToggle-v3.png` backpack asset and a gold fill/add badge. Updated the tooltip, accessible label, and confirmation action to say “Fill with default bags.”
- Added source-contract and Playwright responsive coverage to `scripts/create-default-bag-browser-smoke.mjs`; the focused browser smoke passes at 1440, 1080, narrow/tablet, and mobile viewports. The default-bag behavior smoke, JavaScript syntax checks, and `git diff --check` also pass.
- Updated both related checklist entries in `docs/todo.md`. No legal/security surfaces changed.
- `npm test` is unavailable because this repository has no `test` script. The earlier simulator audit commit `4989900` remains local because GitHub rejected `git push origin main` with HTTP 403 for the configured account; no remote or credential changes were made.

### 2026-10-15 Home build-animation CTA shadow 238 — complete

- The Home build-animation Create CTA now removes its gold inset shadow and inner rim at rest; both return on hover. The existing dark depth shadow and keyboard focus outline remain intact.
- Extended `scripts/home-promo-create-cta-smoke.mjs` with red/green coverage for the rest and hover shadow states. The smoke passes at 1440, 1080, tablet, and mobile widths. No legal/security surfaces changed.
- Marked the related item complete in `docs/todo.md`. No cache-key change was needed because the page already loads the stylesheet normally and the visual change is CSS-only.

### 2026-10-15 Home build-animation item hover 239 — complete

- The Home Player Info build animation now opts into shared backpack hover chrome without changing decorative promos: item hit pads, rarity/affect markers, sparks, and socketed gem targets are interactive.
- `home-promo-assemble.js` binds `createTooltipHover` to the current board items and updates the lookup map for each rotating build. Existing pointer pause behavior remains unchanged.
- Bumped the Home promo CSS/module cache tokens so the deployed static page can receive the hover implementation.
- Added and ran `scripts/home-promo-item-hover-smoke.mjs` with real grid/tooltip runtime coverage plus responsive checks at 1440, 1080, tablet, and mobile widths. The promo activity smoke, Create CTA smoke, JavaScript syntax checks, and `git diff --check` also pass. No legal/security surfaces changed.

### 2026-10-15 Home Remix CTA 240 — complete

- Added a smaller blue Remix CTA beneath the primary Create CTA in the Home build animation. It uses the same pill design language, existing Remix icon, responsive sizing, and dynamic `/create/?remix={active build slug}` routing.
- Kept the Remix action hidden until a valid active build is painted, so failed/empty animation states do not expose a dead link. Bumped the Home promo cache tokens for the deployed static assets.
- Extended the Create CTA smoke and Home animation smoke with responsive hierarchy and active-slug coverage. Create, item-hover, activity, skeleton lifecycle, Player Info layout, syntax, and `git diff --check` verification pass. No legal/security surfaces changed.

### 2026-10-16 Home Choose Your Hero drag rail 241 — complete

- Choose Your Hero now supports mouse/touch horizontal dragging with pointer capture, keeps vertical page scrolling available on touch, hides the native scrollbar, and suppresses accidental card navigation only when a real drag occurred.
- New pointer interactions clear stale drag-click suppression before starting, so an interrupted drag cannot swallow a later normal card click.
- Added keyboard ArrowLeft/ArrowRight scrolling and a visible focus treatment to the now-focusable rail. Bumped the Home class-showcase CSS/module cache tokens.
- Added and ran `scripts/home-class-showcase-drag-smoke.mjs`; the drag, no-navigation, hidden-scrollbar, cursor, keyboard, syntax, existing bag-link, and responsive Player Info/hero layout checks pass. No legal/security surfaces changed.

### 2026-10-16 Homepage button preset 242 — complete

- Added the shared `home-button-preset.css` pill treatment and applied crimson/blue variants to Featured Watch/View build, Create/Remix, Explore Items tabs and View items, and Curated Builds actions. Existing sprite-preview controls remain specialized item controls.
- Removed the older raster button backgrounds from the affected homepage action styles and bumped the homepage CSS/module cache tokens.
- Added and ran `scripts/home-button-preset-smoke.mjs`; the shared preset, markup contracts, no-raster-background contract, responsive visibility/pill checks at 1440, 1080, tablet, and mobile, Create CTA smoke, syntax checks, and `git diff --check` pass. No legal/security surfaces changed.

### 2026-10-16 Homepage button rim behavior 243 — complete

- The shared homepage preset now keeps its gold inner rim visible at rest and removes the outer depth/glow shadow until hover; hover retains the inner rim and restores the outer shadow.
- Updated the Create CTA smoke to assert both rest and hover shadow states. The focused preset and Create CTA smokes pass across desktop, tablet, and mobile widths. No legal/security surfaces changed.

### 2026-10-16 Potion interaction lines 244 - complete

- Codex owns the shared potion-link geometry, pooled-board SVG layer, board-still canvas painter/cache version, backpack-grid cache-busted page links, focused smokes, plan, todo entry, and this handoff. The extracted game source confirms the rule: `Potion.gd` selects one rotated primary affected cell directly above the potion, and `PotionConnector.gd` follows that active affected target.
- Added `js/shared/potion-links.js`. Create/sim/placed live boards now render directed potion connectors with CSS dash motion; itemiary/packed catalog boards stay sprite-only. Flattened board stills render the same connector statically before item sprites, and active potion boards bypass legacy baked PNGs, so curated/home build images include it without animation. Reduced-motion disables live animation and all connector layers remain pointer-transparent.
- Added `scripts/potion-interaction-lines-smoke.mjs` and `scripts/potion-interaction-lines-browser-smoke.mjs`. Geometry, rotation, duplicate placement keys, false-positive rejection, cache invalidation, live SVG behavior, reduced-motion behavior, static canvas pixels, and responsive 1440/1080/768/390 viewport checks pass. Existing Create pointer, Sim empty-state, Home promo hover, syntax checks, and `git diff --check` also pass. No legal/security surfaces changed.
- No blockers. This work is local and uncommitted; unrelated user changes remain in the working tree. Next step: wait for the next requested UI task.

### 2026-10-16 Footer preset buttons 245 - in progress

- Codex owns `css/shared.css`, `js/shared/footer.js`, the focused footer preset smoke coverage, and this handoff for this cosmetic footer-navigation update. Cursor does not own these paths. Scope is limited to the shared regular/slim footer link treatment; footer geometry, social links, legal content, and page behavior remain unchanged.

### 2026-10-16 Footer preset buttons 245 - complete

- Extracted the homepage button treatment into shared `js/shared/button-preset.css` and applied it to the shared footer renderer. About/Terms/Privacy use the crimson preset; Builds/Items use the existing blue preset. The footer keeps its regular/slim layouts, responsive wrapping, inner gold rim at rest, and hover-only outer depth shadow. A selector fallback also styles older cached footer markup while the shared stylesheet cache key is refreshed across page templates.
- Updated `docs/todo.md` and added `scripts/footer-button-preset-smoke.mjs`. Verification passed: footer static smoke, Admin footer static/browser smokes at 1440/1080/768/390, Home button preset, Home Create CTA, Home item hover, Home skeleton lifecycle, Home footer, Home section skeleton, Home first-paint, JS syntax checks, and `git diff --check`. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Home footer dip paint 246 - in progress

- Codex owns `js/pages/home/home-builds-vault.css`, the Home footer browser smoke, `docs/todo.md`, and this handoff for this visual-only footer paint correction. Cursor does not own these paths. Scope is limited to removing the rectangular Home footer shadow/paint artifact while preserving the existing responsive dip mask, footer overlap, layout, and shared footer buttons.

### 2026-10-16 Home footer dip paint 246 - complete

- Removed the Home footer host’s full rectangular `bg-hills-night-deep.jpg` underlay on desktop/tablet. The footer host is now transparent, so the existing masked footer surface reveals the curated loadout scene through its dip instead of painting a mismatched rectangle. The footer pseudo-surface, 24/25px overlap, responsive mask, and opaque mobile fallback remain unchanged. Bumped the Home stylesheet cache key and marked the todo item complete.
- Updated `scripts/home-footer-browser-smoke.mjs` to require a transparent desktop/tablet host and preserve the textured mobile fallback. Verification passed at 1440/1080/768/390, plus live-rendered screenshots at 1920×1080 and 2560×1440, Home first-paint, Home section skeleton, syntax checks, and `git diff --check`. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Home background first-paint 247 - in progress

- Codex owns the Home combat-sky fallback/preload surface, its focused smoke coverage, `docs/todo.md`, and this handoff for this visual/performance-only background-loading correction. Cursor does not own these paths. Scope is limited to eliminating the Town Square-to-Night flash while retaining the existing independently animated windmill blades and responsive scene.

### 2026-10-16 Home background first-paint 247 - complete

- Added a 1920×1080 static Night frame generated from the existing rendered combat scene, with the windmill omitted so Home can keep only its tower/blades as live DOM. Home now preloads and paints that same frame before JavaScript, and fixed Home boot mounts only `Windmill.png`/`WindmillBlades.png`; the admin scroll preview retains the full layered scene.
- Added static and browser smoke coverage for the preload/fallback contract, windmill-only DOM, exact Home combat asset request set, fixed-scene behavior, no horizontal overflow, and 1440/1080/768/390 responsive viewports. Updated the existing first-paint contract and Home cache keys; background, first-paint, section-skeleton, pointer, footer, curated-loadout, syntax, and `git diff --check` verification pass. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Build tooltip lightweight animation 248 - in progress

- Codex owns the build tooltip preview surface in `js/pages/build/more-build-tip.js`, `js/pages/build/more-build-tip.css`, the two build-thumbnail registration call sites, its focused smoke coverage, `docs/todo.md`, and this handoff. Cursor does not own these paths. Scope is the lightweight no-stats preview requested for build tooltips; the future buff/heat/stamina-aware simulation remains deferred to the Build View surface.

### 2026-10-16 Build tooltip lightweight animation 248 - complete

- Added a Play button with the game play icon to build tooltips. It lazy-loads the shared placed-board renderer and the Sim activation animation map/controller, then advances one normal activation at a time on a lightweight deterministic clock. Clicking again stops the live board and restores the cached still.
- Passed placement/item data from both More Builds and feed board thumbnails, added resize-aware tooltip fitting and responsive button styling, and kept the preview intentionally stat-free: buffs, debuffs, heat, stamina generation/cost, and out-of-stamina behavior remain deferred to the richer Build View preview requested for later.
- Added `scripts/build-tooltip-animation-smoke.mjs` and `scripts/build-tooltip-animation-browser-smoke.mjs`. Verification passed for the focused static/browser checks, tooltip transition checks, board-thumbnail smoke, changed-file syntax, and `git diff --check` at 1440/1080/768/390. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Shared navigation 249 - in progress

- Codex owns `js/shared/nav.js`, `js/shared/nav.css`, the focused navigation density smoke coverage, `docs/todo.md`, and this handoff for the desktop navigation size correction. Cursor does not own these paths. Scope is limited to the desktop responsive scale; the separate <=1100px mobile header/drawer remains unchanged.

### 2026-10-16 Shared navigation 249 - complete

- Added the exported `navDesktopScale()` density helper. The shared desktop nav still uses the 2560×1440 scale reference, but the short-desktop correction now eases to a 15% boost at 1920×1080 (`0.75` → `0.8625`) and stays capped below 1080p. The <=1100px mobile header/drawer remains unscaled and separate.
- Added `scripts/nav-density-smoke.mjs` and `scripts/nav-density-browser-smoke.mjs`. Verification passed at 2560×1440, 1920×1080, 1600×900, 1366×768, 1024×768, and 390×844 with no horizontal overflow; the existing navigation-pennant browser smoke, syntax checks, and `git diff --check` also pass. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Explore item categories button rollback 250 - in progress

- Codex owns `js/pages/home/home-items-explore.js`, `js/pages/home/home-items-explore.css`, `js/pages/home/index.js`, `index.html`, the focused homepage button smoke coverage, `docs/todo.md`, and this handoff for this visual-only correction. Cursor does not own these paths. Scope is limited to the Explore 500+ Items category tabs; the View Items CTA remains on the new blue preset.

### 2026-10-16 Explore item categories button rollback 250 - complete

- Restored the Explore 500+ Items category tabs to their original flat, transparent, yellow text treatment. The View Items CTA remains on the shared blue homepage preset.
- Bumped the Home Explore CSS/module cache token and expanded `scripts/home-button-preset-smoke.mjs` to assert the category-tab exception and the CTA preset across 1440/1080/768/390 widths. Verification passed with Home button preset smoke, changed-file syntax checks, and `git diff --check`. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Shared preset rim behavior 251 - in progress

- Codex owns `js/shared/button-preset.css`, the focused shared preset smoke coverage, `docs/todo.md`, and this handoff for the inner-rim/outer-rim correction. Cursor does not own these paths. Scope is limited to the shared homepage/footer button appearance; no layout, data, security, or legal behavior changes are expected.

### 2026-10-16 Shared preset rim behavior 251 - complete

- Updated the shared homepage/footer preset so its inset `::before` gold rim remains visible at rest, while the outer gold inset ring and depth shadow appear only on hover. Refreshed the shared stylesheet cache key across page templates and the legacy Home preset entry point.
- Updated the todo description and focused smoke assertions. Verification passed with Home CTA, Home button, footer static, admin footer static/browser, changed-script syntax checks, and `git diff --check` across 1440/1080/768/390 coverage. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Hyperlink hover gold 252 - in progress

- Codex owns `css/theme.css`, the focused hyperlink-hover smoke coverage, `docs/todo.md`, and this handoff for the shared text-link hover color correction. Cursor does not own these paths. Scope is limited to the global anchor hover color; button, navigation-banner, and page-specific link treatments remain unchanged unless they inherit the shared rule.

### 2026-10-16 Hyperlink hover gold 252 - complete

- Changed the shared `a:hover` color from banner crimson to the navigation Patches gold `#eac914`, so inherited text links such as profile names use the same yellow accent. Refreshed the theme stylesheet cache key across page templates and marked the todo item complete.
- Added `scripts/theme-link-hover-smoke.mjs`; responsive browser verification passed at 1440/1080/768/390px, along with script syntax validation and `git diff --check`. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Items top-row click interception 253 - in progress

- Codex owns `css/theme.css`, `js/shared/nav.css`, the Items pointer regression smoke, `docs/todo.md`, and this handoff for the 1080p click-interception repair. Cursor does not own these paths. Scope is limited to letting the Items page receive clicks beneath the transparent overflow of the fixed navigation host while preserving clickable navigation controls and all mobile drawer behavior.

### 2026-10-16 Items top-row click interception 253 - complete

- Root cause was the fixed `#site-nav` host retaining pointer events below the visually transformed desktop shelf. At 1920×1080 its host ended at ~295px while the layout spacer/main began at ~257px, so the top filter/grouping area resolved to the nav host; the 2560×1440 reference had no gap.
- Made the transparent host pointer-transparent while keeping the actual `.site-nav-shell` interactive, refreshed the shared theme cache key, and added `scripts/items-nav-pointer-smoke.mjs`. The focused smoke, real `/items/` hit-test at 2560×1440 and 1920×1080, nav density/pennant browser smokes, syntax check, and `git diff --check` pass. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Items native pointer affordance 254 - in progress

- Codex owns `js/pages/items/filters.css`, `js/shared/backpack-grid/backpack-grid.css`, `js/pages/items/spotlight.css`, `js/shared/filter-drawer.css`, the affected page-template stylesheet cache references, `scripts/items-pointer-smoke.mjs`, `docs/todo.md`, and this handoff for the native pointer-affordance correction. Cursor does not own these paths. Scope is limited to interactive Items catalog/filter targets; disabled and non-interactive targets retain their default cursor.

### 2026-10-16 Items native pointer affordance 254 - complete

- Root cause was the Items page using `var(--bpb-cursor-pointer)`/`var(--bpb-cursor-default)` without fallbacks while the custom cursor stylesheet is intentionally not loaded globally, so clickable catalog/filter targets computed to `auto`. Added native pointer/default fallbacks to Items filters, backpack-grid hit targets (including actual `.bpb-bg__hit-pad` cells, gem sockets, and bag sprites), recipe spotlight controls, and responsive filter-drawer controls.
- Added `scripts/items-pointer-smoke.mjs`; it passes at 1440, 1080, 768, and 390 widths, including disabled-filter default-cursor coverage. Refreshed affected stylesheet cache keys across the page templates, passed the Items navigation pointer smoke, nav density/pennant smokes, syntax validation, and `git diff --check`. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Items spotlight responsive tooltip 255 - complete

- Root cause was the locked spotlight tooltip fitting only against viewport width/height. It did not know the fixed navigation clearance or the asynchronously rendered “Builds using this item” strip, so the full-size 1440-reference card could overlap those surfaces at 1080p. Added a live safe-area callback, width/height fitting, boundary clamping, and a reposition after the Builds panel resolves; mobile retains the existing stacked scroll sheet.
- Added `scripts/items-spotlight-layout-smoke.mjs`, which reproduced the pre-fix overlap and now passes at 1440p, 1080p, and short-desktop sizes. Items pointer/navigation/P1 smokes, changed-file syntax checks, and `git diff --check` pass. Updated the Items cache keys and todo entry. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Items spotlight responsive tooltip 255 - in progress

- Codex owns `js/shared/tooltip-hover.js`, `js/pages/items/spotlight.js`, `js/pages/items/spotlight.css`, the focused Items spotlight layout smoke, `docs/todo.md`, affected page-template stylesheet/module cache references, and this handoff for the responsive clicked-item showcase correction. Cursor does not own these paths. Scope is limited to the locked Items spotlight tooltip and its desktop/mobile relationship with the fixed navigation and “Builds using this item” panel; shared hover tooltip placement outside the Items spotlight must remain unchanged.
### 2026-10-16 Items spotlight composition responsive 256 - in progress

- Codex owns `js/pages/items/spotlight.css`, `js/pages/items/spotlight.js`, `js/pages/items/spotlight-recipes.js`, `js/pages/items/spotlight-builds.js`, the focused Items spotlight composition smoke, `docs/todo.md`, affected page-template cache references, and this handoff for making every desktop clicked-item showcase section scale from the 1440p reference. Cursor does not own these paths. Mobile remains on its existing stacked layout; the focused item, recipe panel, and Builds using this item strip are all in scope on desktop.

### 2026-10-16 Items spotlight composition responsive 256 - complete

- The clicked-item showcase now publishes one desktop scale from the shared 2560×1440 navigation density helper to the focused item stage, recipe panel, and Builds using this item strip. Recipe sizing measures reference geometry before applying the scale, preserving its content-fit and scroll behavior; mobile keeps the existing stacked layout.
- Added `scripts/items-spotlight-composition-smoke.mjs` with live CSS/recipe geometry checks at 2560×1440, 1920×1080, 1366×768, 1440×900, tablet, and mobile viewports. The focused composition, tooltip safe-area, pointer, navigation pointer, P1 live-art, syntax, and `git diff --check` verification pass. Bumped the Items spotlight cache token and marked the todo item complete. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Items spotlight hover treatment 257 - in progress

- Codex owns `js/pages/items/spotlight.css`, the focused Items spotlight hover smoke, `docs/todo.md`, the Items spotlight cache reference, and this handoff for replacing outline-only hover states on recipe combination items and Builds using this item cards. Cursor does not own these paths. Scope is cosmetic interaction feedback only; click targets, keyboard focusability, mobile stacking, and reduced-motion behavior must remain intact.

### 2026-10-16 Items spotlight hover treatment 257 - complete

- Replaced the recipe-combination and Builds using this item outline hover states with non-layout-shifting gold highlight treatments: recipe items scale to 1.08 with a radial glow, while build cards lift/scale slightly with a softer glow. Keyboard focus uses the same visible treatment, and reduced-motion users get no transform transition or scale.
- Added `scripts/items-spotlight-hover-smoke.mjs`, refreshed the Items spotlight stylesheet cache key, and marked the todo item complete. Verification passes across 2560×1440, 1920×1080, 1366×768, 768×900, and 390×844, plus changed-file syntax and `git diff --check`. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Items spotlight signature scrollbar 258 - in progress

- Codex owns `js/pages/items/spotlight.css`, the focused Items spotlight scrollbar smoke, `docs/todo.md`, the Items spotlight cache reference, and this handoff for applying the site’s signature image-based scrollbar to the Builds using this item strip. Cursor does not own these paths. Scope is limited to scrollbar chrome and responsive overflow behavior; the strip’s content, sizing, and interaction remain unchanged.

### 2026-10-16 Items spotlight signature scrollbar 258 - complete

- Replaced the Builds using this item strip’s palette scrollbar with the site’s image-based signature scrollbar: `track.png` track, bordered `thumb.png`, automatic fallback colors, 18px chrome, and hidden scrollbar buttons. Horizontal scrolling and responsive strip behavior remain unchanged.
- Added and passed `scripts/items-spotlight-scrollbar-smoke.mjs` at 2560×1440, 1920×1080, 1366×768, 768×900, and 390×844; reran the spotlight hover/composition/layout and pointer smokes, changed-file syntax checks, and `git diff --check`. Refreshed the Items spotlight CSS cache key and marked the todo item complete. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Potion connector visual parity 259 - in progress

- Codex owns `js/shared/potion-links.js`, `js/shared/backpack-grid/backpack-grid.css`, `js/shared/board-still/paint.js`, the shared backpack stylesheet cache references on home/create/sim/builds, the focused potion connector smokes, `docs/todo.md`, and this handoff for correcting the potion interaction visual. Cursor does not own these paths. Scope is limited to the connector’s game-like filled blue triangle, live/static rendering, and cache invalidation; potion activation rules and board state remain unchanged.

### 2026-10-16 Homepage preset color system 260 - complete

- Homepage preset actions now use four banner-mapped colors: crimson for Create, steel blue for build/remix actions, forest for item/catalog discovery, and gold for featured/community actions. The Explore category tabs remain intentionally flat yellow controls.
- Removed section-specific Featured and Explore hover/active overrides so every homepage preset uses the shared hover contract: the same filter, white hover text, inner rim, outer depth shadow, and responsive pill geometry. Refreshed the Home/shared preset cache tokens and expanded `scripts/home-button-preset-smoke.mjs` to cover all four variants and compare their computed hover states at 1440, 1080, tablet, and mobile widths. No legal/security surfaces changed; work remains local and uncommitted; no push was requested.

### 2026-10-16 Slim footer height 261 - complete

- Reduced the slim footer’s desktop bottom padding from the oversized 3.25rem clearance to the frame edge plus the same 0.4rem content gap used at the top. Narrow layouts now use equal 0.4rem top/bottom padding, with safe-area protection retained. The regular footer and Sim-specific slim override remain unchanged.
- Extended `scripts/admin-footer-presets-browser-smoke.mjs` to verify the content-to-frame gap at 1440, 1080, tablet, and mobile widths; the smoke passes with the footer height reduced while preserving the footer preset and no-overflow checks. Refreshed shared stylesheet cache references, marked the todo complete, and ran `git diff --check`. No legal/security surfaces changed; work remains local and uncommitted; no push was requested.

### 2026-10-16 Potion connector visual parity 259 - complete

- Root cause was a visual implementation mismatch: the game’s `PotionConnector.tscn` uses a filled blue `Triangle.png` particle, while the site had rendered only a thin dashed SVG stroke. The shared geometry now produces a closed filled triangle aimed from the affected cell toward the source potion, with a lightweight opacity pulse for live boards and the same static triangle in flattened board stills.
- Added live placed-board integration coverage so a real `mountPlacedGrid` board must produce one visible filled connector, refreshed the shared backpack CSS cache token to `potionlinks2` on home/create/sim/builds, and updated the todo description. Focused potion geometry/browser smokes, Create pointer, Sim empty-state, Home promo hover/activity/P1 smokes, changed-file syntax checks, and `git diff --check` pass. No legal/security surfaces changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds card Alt preview 262 - complete

- Codex owns `js/pages/builds/post-row.js`, `js/pages/builds/board-thumbs.js`, `js/pages/builds/card-preview.js`, `js/pages/builds/builds.css`, the shared build-preview animation option needed by this surface, focused Builds card-preview smoke coverage, `docs/todo.md`, and this handoff. Cursor does not own these paths. Scope is limited to the card-view-only Alt + Play affordance and lightweight no-stats board preview; compact/grid views and existing tooltip preview behavior remain unchanged.
- Added the card-only Alt + Play control with the existing game icon/keycap treatment. It reveals on card hover/focus, is scoped to `body.page-builds`, keeps compact/grid rows unchanged, and mounts the existing lightweight Sim activation preview into a pointer-transparent overlay above the cached still. Alt starts the preview without pointer movement; leaving the card stops it and restores the static view.
- Added `scripts/builds-card-preview-smoke.mjs` and `scripts/builds-card-preview-browser-smoke.mjs`. Both focused checks pass at 1440, 1080, tablet, and mobile widths; the existing tooltip static/browser, board-thumbnail, Builds filter-group, changed-file syntax, and `git diff --check` checks also pass. No legal/security surfaces changed.
- No blockers. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Shared navigation hitbox verification 263 - complete

- Codex owns this verification note and the existing shared-navigation regression coverage. No product code changed because the prior repair is still correct: `#site-nav` is pointer-transparent, `.site-nav-shell` remains interactive, and `#site-nav-space` follows the transformed shell boundary.
- Re-ran `scripts/items-nav-pointer-smoke.mjs`, `scripts/nav-density-smoke.mjs`, and `scripts/nav-density-browser-smoke.mjs`. Hit-testing and responsive density pass at 2560×1440, 1920×1080, short desktop, 1024px tablet, and 390px mobile. A static scan found all 18 nav-bearing pages load the shared theme rules. The todo item is marked complete.
- No blockers. Work remains local and uncommitted; no push was requested. Next step: wait for the next requested UI task.
### 2026-10-16 Builds feed scrollbar spacing 264 - complete

- Codex owns the Builds feed scroll-container spacing in `js/pages/builds/builds.css`, its focused smoke coverage, `docs/todo.md`, the Builds stylesheet cache reference, and this handoff. Cursor does not own these paths. Scope is limited to a small responsive gap between feed content and the existing vertical scrollbar; scrollbar chrome, filter rail, card layout, and page scroll behavior remain unchanged.
- Added `padding-inline-end: clamp(0.35rem, 0.55vw, 0.65rem)` to `.builds-feed__list-host`, keeping the existing scrollbar on the inline-end edge while separating cards from its track. Refreshed the Builds stylesheet cache key and marked the todo item complete.
- Added `scripts/builds-scrollbar-spacing-smoke.mjs` and `scripts/builds-scrollbar-spacing-browser-smoke.mjs`. Focused checks pass at 1440p, 1080p, tablet, and mobile with no horizontal overflow; Home/Builds scrollbar parity, Builds filter groups, surface padding, card preview, changed-file syntax, and `git diff --check` also pass. No legal/security surfaces changed.
- No blockers. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds view modular desktop composition complete

- Codex owned the dedicated `/builds/view/` responsive composition for this task: `js/pages/build/build.css`, `js/pages/build/index.js`, `builds/view/index.html`, the focused Builds-view responsive smoke tests, `docs/todo.md`, and this handoff.
- The full desktop content group now scales from the 2560×1440 reference using `--build-desktop-scale`: author rail, board, round controls, and Build Info stay proportional together. Shared navigation, screen frame, background, and slim footer remain unscaled; the existing <=1100px stacked/tablet/mobile layout stays independent and scrollable.
- Added `scripts/build-view-modular-responsive-smoke.mjs`, which first reproduced the 1080p overflow and now verifies no page scroll or horizontal overflow at 2560×1440, 1920×1080, and 1600×900 while retaining stacked behavior at tablet/mobile sizes. Updated `build-view-density-smoke.mjs` to assert the new modular scale contract and bumped the Builds-view asset cache token.
- Verification passed: focused modular smoke, density, header-layout, title-spacing, and pointer smokes; changed-file `node --check`; and `git diff --check`. The 2560×1440 reference remains scale 1, and the 1920×1080 fixture ends at the viewport footer without scroll.
- No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds view header tag spacing complete

- Codex owned `js/pages/build/build.css`, the focused Builds-view header geometry verification, `docs/todo.md`, and this handoff for this task.
- Removed the header identity column's forced `justify-content: space-between`; the build title and tags now remain naturally grouped while the vote control stays aligned beside the header.
- Updated `scripts/build-view-header-layout-smoke.mjs` to reject `space-between` and verify the vote column still contains the identity content. Desktop, short desktop, tablet, and mobile checks pass, along with title-spacing, modular responsive, pointer, syntax, and diff checks.
- No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds view creator avatar sizing complete

- Codex owned `js/pages/build/build.css`, the focused Builds-view responsive geometry verification, `docs/todo.md`, and this handoff for this task.
- Increased the creator avatar/blob from 5.5rem to 8.25rem at the desktop reference size and from 3.5rem to 5.25rem in the stacked layout, preserving the circular shape and existing avatar/blob rendering.
- Added `scripts/build-view-author-avatar-smoke.mjs`, which verifies 132px at 2560×1440, 99px at 1920×1080 after composition scaling, and 84px at tablet/mobile sizes. Avatar, modular responsive, header-layout, title-spacing, pointer, syntax, and diff checks pass.
- No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds view round drag scrubbing complete

- Codex owned `js/pages/build/round-scrubber.js`, `js/pages/build/page.js`, `js/pages/build/build.css`, the Builds-view round-drag regression, `builds/view/index.html`, `docs/todo.md`, and this handoff for this task.
- Build view round strips now support click-and-hold horizontal pointer scrubbing. Temporary window-level pointer tracking preserves ordinary button clicks while allowing the pointer to leave the strip; video buttons remain excluded from round dragging. The shared scrubber option is gated to `page-build-view`, leaving Create/Sim/history consumers unchanged.
- Build-view board changes now use `appear: false` during round changes, so items and bags switch immediately without the appear/disappear wave. Added the drag CSS affordance and cache-busted the Build-view module graph.
- Added `scripts/build-view-round-drag-smoke.mjs`. It verifies normal click selection, drag right/left selection, keyboard navigation, Build-view scoping, and the no-wave update path. Round-drag, avatar, modular responsive, header-layout, title-spacing, pointer, syntax, and diff checks pass.
- No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds view round wrap synchronization complete

- Codex owned `js/pages/build/round-scrubber.js`, the narrowly related Builds-view module cache references, the focused round-wrap regression, `docs/todo.md`, and this handoff for this task. Cursor does not own these paths.
- The previous-round sentinel branch no longer treats the no-video `videoIndex` value of `-1` as a real step. Round 1 → previous now wraps to the final history frame, updating the round label, selected picker triangle, and Build-view board callback together. The same final-frame behavior is used when stepping back from the published-board state; optional video remains reachable as the forward step after the final round.
- Added `scripts/build-view-round-wrap-smoke.mjs`, covering normal and video-enabled histories. The focused wrap smoke passes, along with the existing round-drag, modular responsive, header-layout, title-spacing, pointer, changed-file syntax, and `git diff --check` verification. No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds view more-by-creator responsive grid complete

- Codex owned the Builds-view author rail grid in `js/pages/build/build.css`, its focused responsive regression, `docs/todo.md`, the Build-view cache reference, and this handoff for this task. Cursor does not own these paths.
- The “More by creator” rail keeps three columns at the 2560×1440 reference and switches to two columns below 2200px, with larger responsive row/column gaps. This gives the 1920×1080 layout measured 65px of horizontal breathing room between miniature boards while preserving the existing small preview size; tablet and mobile also remain two-column and overflow-free.
- Added `scripts/build-view-more-creator-responsive-smoke.mjs`, covering 2560×1440, 1920×1080, 1600×900, 1024px tablet, and 390px mobile. The focused smoke, Build-view modular/avatar/header/title/pointer/round checks, changed-file syntax checks, and `git diff --check` pass. `npm test` is unavailable because this repository has no `test` script. No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds view info tooltip left placement complete

- Codex owned the Build-view info-rail tooltip binding in `js/pages/build/page.js`, its focused placement regression, `docs/todo.md`, the Build-view module cache reference, and this handoff for this task. Cursor does not own these paths.
- Build Info item tooltips now use the shared `itemLeft` placement, so the full-size card opens to the left of items in the right-side rail instead of shrinking into the remaining right-edge space. The shared tooltip engine and other pages were unchanged; narrower viewports still receive the existing safe clamp.
- Added `scripts/build-view-info-tooltip-placement-smoke.mjs`, covering 1440p, 1080p, tablet, and mobile. The focused placement smoke, shared tooltip scale/transition checks, Build-view responsive/header/title/pointer checks, changed-file syntax checks, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.
### 2026-10-16 Builds view info tooltip footer-safe sizing complete

- Codex owned the Build-view tooltip safe-area wiring in `js/pages/build/page.js` and the narrowly scoped shared placement support in `js/shared/tooltip-hover.js`, the focused regression, `docs/todo.md`, the Build-view cache references, and this handoff for this task. Cursor does not own these paths.
- Build Info item tooltips now resolve the responsive frame edges and visible footer top at placement time, then fit oversized cards inside the resulting left/right/top/bottom safe area. The dynamic bounds contract is only passed by the Build Info binding, so other tooltip placements retain their previous behavior.
- Added `scripts/build-view-info-tooltip-safe-area-smoke.mjs`. Safe-area, left-placement, shared tooltip scale/transition, Build-view modular, and More-by-creator responsive checks pass at 1440p/reference, 1080p/short desktop, 900p, tablet, and mobile fixtures. Changed-file syntax checks and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Build Info divider preset complete

- Codex owned the reusable divider preset in `js/shared/tooltip.css`, Build Info divider markup/styles in `js/pages/build/info-rail.js` and `js/pages/build/build.css`, the focused divider regression, Build-view/History cache references, `docs/todo.md`, and this handoff for this task. Cursor does not own these paths.
- Added a reusable layered-gradient `.bpb-divider` CSS preset with gold/legendary, common, rare, epic, godly, and unique variants plus a vertical orientation. It echoes the image-backed item-tooltip divider family without making Build Info depend on an image asset. The four live/loading Build Info divider instances now use the gold vertical preset; the existing item-tooltip image dividers remain unchanged.
- Added `scripts/build-info-divider-smoke.mjs`. The focused divider browser smoke, Build-view tooltip placement/safe-area, modular density, header, title-spacing, changed-file syntax checks, and `git diff --check` pass. `npm test` is unavailable because the repository has no `test` script. No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Create BagBorder visual audit reverified

- Codex verified the existing source-derived Create bag-synergy implementation in `tools/game-extract-full/Items/Tiles/BagBorder.gd`, `js/pages/create/drag-affect.js`, `js/shared/backpack-grid/can-affect.js`, `js/shared/backpack-grid/item-pieces.js`, and `js/pages/create/create.css`. No product-code change was needed because the implementation already matches the audited game behavior.
- The game source shows a placed bag’s border on item pickup only when `showBagBorderForItem` accepts the held non-bag item, applies tint 1.3 at rest and 2.5 when an occupied cell is hovered, and hides it on drop except for a compatible hotswap. Create mirrors compatibility, per-bag extracted border textures/tints, hovered emphasis, visible placed-board fabric cells, and drop/cancel cleanup.
- Re-ran `scripts/create-bag-synergy-smoke.mjs`, `scripts/create-bag-synergy-browser-smoke.mjs`, `scripts/create-duration-hover-smoke.mjs`, and `scripts/create-page-pointer-smoke.mjs`; all pass. Changed-module syntax checks and `git diff --check` pass. Marked the corresponding `docs/todo.md` item complete. No legal/security behavior changed; work remains local and uncommitted.

### 2026-10-16 Build-view simulator planning complete

- Codex audited the existing Build-view round/board seams and simulator seams before implementation. The proposed feature reuses `runSim()` with an inert non-attacking dummy, `mountSimScrubber()`, `createSimFx()`, existing per-placement snapshots, and the shared Premium entitlement/offer helpers; no product code or simulator defaults changed in this planning pass.
- Created [`docs/superpowers/specs/2026-10-16-build-view-simulator-design.md`](superpowers/specs/2026-10-16-build-view-simulator-design.md) and [`docs/superpowers/plans/2026-10-16-build-view-simulator.md`](superpowers/plans/2026-10-16-build-view-simulator.md). The plan covers the paused 0–20s preview, round/video lifecycle, playhead-derived DPS/HPS/Max HP/s/BPS/score/buff/debuff stats, accessible Build Info/Build Stats tabs, Premium-only exact values, client-side obfuscation limits, responsive verification, and focused regressions.
- Documented the key limitation explicitly: the preview is simulator-derived and uses a fixed target sink, not live PvP or a full 1:1 claim. No Minecraft font asset was found; the plan uses changing glyph text with local CSS fallback rather than adding an unlicensed font. No legal/security behavior changed; work remains local and uncommitted.

### 2026-10-16 Prismatic Orb tooltip counts complete

- Codex owned the Prismatic Orb tooltip/data path in `js/shared/prismatic-orb.js`, `js/shared/tooltip.js`, `js/pages/items/catalog/index.js`, `js/pages/create/board-live-stats.js`, its focused smoke, `docs/todo.md`, and this handoff. Cursor does not own these paths.
- Audited `tools/game-extract-full/Items/Exclusive/RainbowOrb.gd` and `ExclusiveItems.csv`: the game uses `countTypes(getAffectedItems())`, inserts `Rainbow Orb_Counter` parentheticals after Magic/Vampiric/Holy/Dark item sections when placed, and strips those counters from unplaced tooltips. The Items catalog now supplies full-catalog section counts for the requested standalone tooltip; Create/Sim preserve affected-board counts. Both use only primary/extra game types, matching `getTypes()` instead of counting custom tags.
- Added `scripts/prismatic-orb-tooltip-smoke.mjs`, including source-rule assertions, type-count regression coverage, and a Playwright render check for all four displayed counts. Verification passed: focused smoke, tooltip scale/transition smokes, changed-module `node --check`, `audit-tooltip-parity.mjs` (0 issues), and `git diff --check`. `npm test` remains unavailable because this repository has no `test` script. No legal/security behavior changed; work remains local and uncommitted.

### 2026-10-16 Profile inventory cosmetic tooltip shadow complete

- Codex owns the cosmetic tooltip host class in `js/pages/u/blob/cosmetic-tooltip.js`, its shared shadow override in `js/shared/tooltip.css`, the focused browser smoke in `scripts/profile-inventory-tooltip-shadow-browser-smoke.mjs`, the tooltip cache-bust references, `docs/todo.md`, and this handoff. Cursor does not own these paths.
- Reproduced the reported halo on the profile inventory fixture: the cosmetic card inherited the shared `.bpb-tooltip-float .bpb-tooltip` `drop-shadow(0 2px 4px ...)`. Cosmetic tooltip hosts now carry a dedicated class and disable only that extra card shadow across profile inventory, wardrobe, admin, events, and other cosmetic surfaces; ordinary item tooltips retain their existing shadow.
- Focused browser verification passes at 1440p, 1080p, tablet, and mobile with no horizontal overflow, and confirms the regular item tooltip shadow is preserved. Tooltip transition browser/static smokes, profile-owner and admin-cosmetics smokes, changed-module syntax checks, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed; work remains local and uncommitted; no push was requested.

### 2026-10-16 Items spotlight horizontal scrollbar repair complete

- Codex owns the Items spotlight Builds scrollbar in `js/pages/items/spotlight.css`, its horizontal derived assets under `assets/icons/scrollbar/`, the asset builder and focused browser smoke, the Items spotlight cache reference, `docs/todo.md`, and this handoff. Cursor does not own these paths.
- The previous rules reused the vertical `track.png` and `thumb.png` directly on a horizontal scroller, so the pseudo-elements resolved but the signature bar painted incorrectly. Added rotated `track-horizontal.png` and `thumb-horizontal.png` derivatives from the existing assets; the Builds using this item strip now paints those horizontally, keeps the scrollbar buttons hidden, and preserves the gold/brown standards fallback.
- Added `scripts/build-scrollbar-assets.mjs` and `scripts/items-spotlight-builds-scrollbar-browser-smoke.mjs`. The focused Edge browser smoke passes at 1440p, 1080p, tablet, and mobile with real horizontal overflow, horizontal asset URLs, hidden buttons, and no page overflow. No legal, authentication, database, storage, or security behavior changed; work remains local and uncommitted; no push was requested.

### 2026-10-16 Items spotlight hover treatment refined

- Codex continues to own the Items spotlight hover styles and focused hover smoke in `js/pages/items/spotlight.css` and `scripts/items-spotlight-hover-smoke.mjs`; Cursor does not own these paths.
- Removed the gold radial/background and yellow glow from recipe ingredients and Builds using this item cards. The existing scale/lift behavior remains, with a subtle brightness increase and neutral depth shadow instead.
- Updated the todo wording and regression assertions to require brightness, preserve the neutral shadow, and reject gold hover treatments. No legal, authentication, database, storage, or security behavior changed; work remains local and uncommitted; no push was requested.

### 2026-10-16 Profile inventory View switch complete

- Codex owns the Profile Inventory View control in `js/pages/u/tab-inventory.js`, `js/pages/u/inventory.css`, the profile module/style cache references in `js/pages/u/shell.js` and `u/index.html`, the focused smoke in `scripts/profile-inventory-view-toggle-smoke.mjs`, `docs/todo.md`, and this handoff. Cursor does not own these paths.
- Replaced the Blob checkbox square with an accessible `role="switch"` control using `aria-checked`. The track uses the existing Patch2 painted shape in the inventory filter's green palette, and a cream circular thumb slides left/right while the existing Blob/item-only behavior remains unchanged.
- Verified the switch at 1440p, 1080p, tablet, and mobile with no horizontal overflow; the focused smoke, changed-module syntax checks, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed; work remains local and uncommitted; no push was requested.

### 2026-10-16 Build Alt preview simulator playback repair complete

- Codex owns the shared build preview playback in `js/pages/build/build-tip-animation.js`, the Builds card binding/board registration in `js/pages/builds/card-preview.js` and `js/pages/builds/board-thumbs.js`, the scoped preview CSS, the two focused smoke suites, `docs/todo.md`, and this handoff for this task. Cursor does not own these paths.
- Reproduced the reported defects: card view appended a second live board over the cached still, while the shared preview used a synthetic 480 ms placement cursor that animated bags as if they were regular items. The preview now replaces the original board host in both tooltip and card views, restores the cached still on pause, runs the simulator engine for a 20-second visual-only timeline with the Sim cooldown shade and activation FX, and filters bag events plus bag cooldown/motion styling from the preview.
- Verification passed: tooltip and Builds-card static smokes; browser smokes at desktop, 1080p/short desktop, tablet, and mobile; changed-module `node --check`; and `git diff --check`. No legal, authentication, database, storage, or security behavior changed. Work remains local and uncommitted; no push was requested.

### 2026-10-16 Simulator item parity continuation 238 — complete

- Codex owned the Vineweave Basket and Walrus Tusk fidelity review/repair, their focused source-backed regressions, the simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Cursor does not own these paths.
- Vineweave Basket had a real lifecycle mismatch: its dedicated port applied the healing-efficiency snapshot at combat start, while `VineweaveBasket.gd` applies it during `onPrepare()` from the base heal amplifier plus `ampbonus` per Nature item inside. The port now uses the preparation hook and the catalog parameters; sale/shop hooks remain explicitly outside combat simulation scope. Walrus Tusk already matched `WalrusTusk.gd` (`onCombatStart`: grant P1 Spikes, then consume), so it required evidence rather than a product-code change.
- Added `scripts/sim-vineweave-basket-smoke.mjs` and `scripts/sim-walrus-tusk-smoke.mjs`, and attached source-backed evidence to both ledger rows. Regenerated artifacts now report 335 / 519 item rows as `verified_1to1` (up from 333 / 519); both rows are deep, non-live-required, and have no lifecycle/call gaps. `docs/todo.md` now records 335 / 519.
- Verification passed: both focused smokes, ledger/dashboard `--check`, dashboard and Admin audit smokes, coverage-honesty smoke, changed-module `node --check`, and `git diff --check`. The repository has no `npm test` script; the broader `sim-engine-1to1-count` smoke still reports its existing unrelated 8 non-item engine IDs and `dragonegg` generic-resolution gap. No legal, authentication, database, storage, or security behavior changed. Local commit `d05db53` contains this two-item batch; `git push origin main` was attempted and rejected with GitHub 403 because `JusticeMcNealLLC` lacks write permission for `bpbbuilds/bpbbuilds.github.io`. Next step is to push after the repository credentials/access are corrected.

### 2026-10-16 Simulator item parity continuation 239 — in progress

- Codex owns the Wand and Wand of Dissonance fidelity review/repair, their focused source-backed regressions, the simulator fidelity evidence entries and generated audit artifacts, and this handoff. Planned paths are limited to the relevant simulator port module(s), `scripts/sim-wand-smoke.mjs`, `scripts/sim-wand-of-dissonance-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 239 — complete

- Wand had a real lifecycle mismatch: `Wand.gd` calls `activate()` after its least-buff grant and optional highest-buff spend/Empower branch, while the port logged activation first. The handler now preserves the source effect ordering. Wand of Dissonance already had the source-backed prepare/effect chain; it received a dedicated item-specific regression rather than a code rewrite.
- Added `scripts/sim-wand-smoke.mjs` and `scripts/sim-wand-of-dissonance-smoke.mjs`, attached evidence for both rows, and regenerated the audit artifacts. The dashboard now reports 337 / 519 item rows as `verified_1to1`; both rows are deep, non-live-required, and have no untriaged lifecycle/call gaps. `docs/todo.md` now records 337 / 519.
- Verification passed: both new focused smokes, the repaired `scripts/sim-wand-rib-smoke.mjs`, ledger/dashboard regeneration and checks, changed-module `node --check`, and `git diff --check`. The combined smoke needed its stale Rib fixture corrected to pass the item map, select pieces by item ID, and expect the fixture's actual 10 base damage; no Rib production behavior changed. `npm test` remains unavailable because the repository has no `test` script. No legal, authentication, database, storage, or security behavior changed. Local commit `567768c` contains this two-item batch; a second `git push origin main` attempt was rejected with the same GitHub 403 because `JusticeMcNealLLC` lacks write permission for `bpbbuilds/bpbbuilds.github.io`. Next step is to push after repository access is corrected.

### 2026-10-16 Simulator item parity continuation 240 - in progress

- Codex owns the War Scythe and Water Elemental fidelity review/repair, their focused source-backed regressions, the shared crit-severity path if required by War Scythe parity, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Planned paths are limited to the relevant simulator port modules, `js/pages/sim/engine/damage.js` if the source-backed crit-severity regression requires it, `scripts/sim-war-scythe-smoke.mjs`, `scripts/sim-water-elemental-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 240 - complete

- Codex repaired War Scythe to match `WarScythe.gd`: linked Poison power now runs in `onPrepare`, the poison threshold conversion runs in the early pre-damage hook, misses do not spend Poison, and the live item crit severity is applied by the damage pipeline from the game base of 2.0.
- Codex repaired Water Elemental to match `WaterElemental.gd`: secondary-only Ice speed, primary Nature-scaled mana chance, external `used` Mana stage listeners, exact thresholds/bonus damage, modified healing, and stage-three Cold are now represented; the weapon no longer spends its own on-hit Mana.
- Added `scripts/sim-war-scythe-smoke.mjs` and `scripts/sim-water-elemental-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 339 / 519 verified item rows. Focused smokes, changed-module syntax, ledger/dashboard `--check`, coverage honesty, Admin audit, full simulator runtime fixtures, and `git diff --check` pass. The broader `sim-engine-1to1-count` smoke still reports its pre-existing eight generic engine IDs and `dragonegg` generic-resolution gap. No legal, authentication, database, storage, or security behavior changed. The two-item batch is committed locally; `git push origin main` was attempted and rejected with GitHub HTTP 403 because `JusticeMcNealLLC` lacks write permission for `bpbbuilds/bpbbuilds.github.io`.

### 2026-10-16 Simulator item parity continuation 241 - in progress

- Codex owns the Broccoli and Broccoli Goobert fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Planned paths are limited to `js/pages/sim/engine/scripts/ports-ap-lucky.js`, `js/pages/sim/engine/scripts/ports-am-goobert.js`, `scripts/sim-broccoli-smoke.mjs`, `scripts/sim-broccoli-goobert-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 241 - complete

- Codex repaired Broccoli to preserve the source effect-before-activation flow while retaining inherited Food preparation speed and the Lucky/Regeneration threshold branch. Broccoli Goobert now emits its activation after the source peer-triggered Lucky/Regeneration effect at the six-activation threshold.
- Added `scripts/sim-broccoli-smoke.mjs` and `scripts/sim-broccoli-goobert-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 341 / 519 verified item rows. Focused smokes, the existing combined Broccoli source smoke, changed-module syntax, ledger/dashboard `--check`, coverage honesty, Admin audit, a 40-second Goobert runtime fixture, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed. The two-item batch is committed locally; `git push origin main` was attempted and rejected with GitHub HTTP 403 because `JusticeMcNealLLC` lacks write permission for `bpbbuilds/bpbbuilds.github.io`.

### 2026-10-16 Simulator item parity continuation 242 - in progress

- Codex owns the Broccotree and Chainsaw fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Planned paths are limited to the relevant simulator port modules, `scripts/sim-broccotree-smoke.mjs`, `scripts/sim-chainsaw-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 242 - complete

- Codex repaired Broccotree to grant Lucky and optional Regeneration before its activation, preserving its Food override and regeneration-driven stamina gain. Chainsaw now mirrors the source charge-state transitions while retaining hit-only five-percent buff removal/steal and self slowdown.
- Added `scripts/sim-broccotree-smoke.mjs` and `scripts/sim-chainsaw-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 343 / 519 verified item rows. Both focused smokes, the combined Broccoli/Broccotree source smoke, ledger/dashboard checks, coverage-honesty, Admin audit, verified-coverage, changed-module syntax, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed.
- Local commit `a6936cb` was pushed successfully to `origin/main` after GitHub access was corrected.

### 2026-10-16 Simulator item parity continuation 243 - in progress

- Codex owns the Chess Master and Chili Goobert fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Planned paths are limited to the relevant simulator port modules, `scripts/sim-chess-master-smoke.mjs`, `scripts/sim-chili-goobert-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 243 - complete

- Codex repaired Chess Master to apply its source preparation-time speed bonus to the first Chess Board, and repaired Chili Goobert to heal, grant Heat, then activate at the six-peer threshold in source order.
- Added `scripts/sim-chess-master-smoke.mjs` and `scripts/sim-chili-goobert-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 345 / 519 verified item rows. Focused smokes, chess call-paths, Goobert regression, lifecycle closure, parity systems, coverage honesty, Admin audit, verified coverage, changed-module syntax, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Coil; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 244 - in progress

- Codex owns the Coil and Dragon Nest fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Planned paths are limited to the relevant simulator port modules, `scripts/sim-coil-smoke.mjs`, `scripts/sim-dragon-nest-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 244 - complete

- Codex verified Coil against its source charge counter, random-buff steal, mini-activation, ten-charge consumption cap, and post-cap no-op. Dragon Nest was repaired to react to every source dragon attack signal, including misses, heal the owner, and emit a visual-only mini-activation projection; its Dragon-only targeting and four start buffs are covered.
- Added `scripts/sim-coil-smoke.mjs` and `scripts/sim-dragon-nest-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 347 / 519 verified item rows. Focused smokes, existing Coil/Band Y/Wave D regressions, lifecycle closure, coverage honesty, verified coverage, Admin audit, changed-module syntax, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Flute; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 245 - complete

- Codex verified Flute against its source affected-item speed, no-repeat Block/Stamina/Lucky cooldown choices, effect-before-activation ordering, both board sides, and zero-safe parameters. The port now preserves source values instead of inventing minimum defaults and uses the piece’s effective Block stat.
- Codex verified Fly Agaric against inherited Food-only preparation speed, exact Poison application, activation ordering, both board sides, and zero-safe parameters; its port now preserves a source zero Poison value.
- Added `scripts/sim-flute-smoke.mjs` and `scripts/sim-fly-agaric-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 349 / 519 verified item rows. Focused smokes, the existing Emerald-through-Gingerbread regression, lifecycle closure, coverage honesty, verified coverage, Admin audit, ledger/dashboard checks, changed-module syntax, and scoped `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Forest Dragon; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 246 - in progress

- Codex owns the Forest Dragon and Forging Hammer fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Planned paths are limited to the relevant simulator port modules, `scripts/sim-forest-dragon-smoke.mjs`, `scripts/sim-forging-hammer-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 246 - complete

- Codex repaired Forest Dragon to use the source preparation hook, Nature-only speed count, exact non-removable Regeneration-driven varying damage, and early successful-hit Regeneration/Lucky grants. Forging Hammer now listens during preparation and applies exact positive/negative Empower signal deltas to the non-removable varying damage pool.
- Added `scripts/sim-forest-dragon-smoke.mjs` and `scripts/sim-forging-hammer-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 351 / 519 verified item rows. Focused smokes, Emerald-through-Gingerbread regression, lifecycle closure, parity systems, coverage honesty, verified coverage, Admin audit, dashboard tests/checks, changed-module syntax, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Fortunas Kiss; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 247 - in progress

- Codex owns the Fortunas Kiss and Friendly Fire fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Planned paths are limited to the relevant simulator port modules, `scripts/sim-fortunas-kiss-smoke.mjs`, `scripts/sim-friendly-fire-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 247 - complete

- Codex verified Fortunas Kiss against its source chance-bearing target filter, exact chance multiplier, Lucky threshold/random-buff branches, activation order, both board sides, and zero-safe parameters. Friendly Fire was repaired to prepare before combat, count linked Fire items, preserve exact heat thresholds/effects, emit each threshold activation, and apply mana-to-Heat before its cooldown activation.
- Added `scripts/sim-fortunas-kiss-smoke.mjs` and `scripts/sim-friendly-fire-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 353 / 519 verified item rows. Focused smokes, Emerald-through-Gingerbread regression, lifecycle closure, parity systems, coverage honesty, verified coverage, Admin audit, dashboard tests/checks, changed-module syntax, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Frog Prince; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 248 - in progress

- Codex owns the Frog Prince and Frostbite fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and this handoff. Planned paths are limited to the relevant simulator port modules, `scripts/sim-frog-prince-smoke.mjs`, `scripts/sim-frostbite-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 248 - complete

- Codex repaired Frog Prince to mirror inherited Toad threshold semantics, including affected-origin tracking, multi-tick heal behavior, one Blind cleanse per threshold callback, mini-activation projections, exact first-use Lucky/Mana/invulnerability state, and cooldown effect ordering. Frostbite now prepares its Vampirism/Cold listeners, preserves exact non-removable varying damage, inflicts Cold in the early successful-hit hook, and grants exact threshold Vampirism.
- Added `scripts/sim-frog-prince-smoke.mjs` and `scripts/sim-frostbite-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 355 / 519 verified item rows. Focused smokes, Emerald-through-Gingerbread regression, lifecycle closure, parity systems, coverage honesty, verified coverage, Admin audit, dashboard tests/checks, changed-module syntax, and `git diff --check` pass. No legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Frozen Buckler; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 249 - complete

- Codex repaired Frozen Buckler to mirror `FrozenBuckler.gd` preparation reset and exact P2 stamina/P3 Cold/P4 block-cap behavior, with source-order shield drain before the after-block effect and activation. Frozen Flame now mirrors its primary Ice block count, secondary `canDamage` target selection (including the two source overrides), preparation Heat/Cold listeners, exact Heat threshold conversion, source-derived crit chance/severity changes, and combat-start activation.
- Added `scripts/sim-frozen-buckler-smoke.mjs` and `scripts/sim-frozen-flame-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 357 / 519 verified item rows. Focused smokes, shield regressions, wave D/B, lifecycle closure, parity systems, coverage honesty, verified coverage, Admin audit, dashboard tests/checks, changed-module syntax, and the scoped staged diff check pass. The full working-tree `git diff --check` still reports unrelated existing trailing whitespace at `docs/todo.md:534`. Two unrelated legacy smokes remain outside this batch: `sim-resource-stack-consumable-candidates-smoke.mjs` assumes a missing `staff_of_unhealing.onCombatStart`, and `sim-harness.mjs` assumes a missing `stoneGolemPort.onPreCombatStart`. No legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Full Body Protection and Garlic; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 250 - complete

- Codex repaired Full Body Protection to mirror `FullBodyProtection.gd` preparation-time linked blocker Block buff power, exact Armor/Helmet/Shoes set activation, per-hit attack/effect `DamageResult.applyDamageReduction`, catalog Block, and source ordering. Garlic now mirrors `Garlic.gd` catalog Block plus `addBonusBlock` value, source chance RNG, opponent-side partial Vampirism removal, and effect-before-activation ordering. Added `scripts/sim-full-body-protection-smoke.mjs` and `scripts/sim-garlic-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 359 / 519 verified item rows. Focused pair tests, Smelly Barrier regression, Band Y, Wave B/D, lifecycle closure, parity systems, coverage honesty, verified coverage, Admin audit, dashboard test/checks, changed-module syntax, and ledger checks pass. No legal, authentication, database, storage, or security behavior changed.
- Scoped staged diff checks remain required before commit; the full working-tree `git diff --check` may still report unrelated existing whitespace in `docs/todo.md:534`. Two unrelated legacy smokes remain outside this batch: `sim-resource-stack-consumable-candidates-smoke.mjs` assumes a missing `staff_of_unhealing.onCombatStart`, and `sim-harness.mjs` assumes a missing `stoneGolemPort.onPreCombatStart`.

### 2026-10-16 Simulator item parity continuation 251 - in progress

- Codex owns the next retained Generator and Ghost fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/scripts/ports-outliers-board.js`, `js/pages/sim/engine/scripts/ports-wave-b-heal.js`, `scripts/sim-generator-smoke.mjs`, `scripts/sim-ghost-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 251 - complete

- Codex repaired Generator to mirror its six explicit lightning charge cells, exact fractional stamina gate, source-modified duration, owner-side charge projections, combat-start/successful-cooldown `charge_emitted` signals, and activation-before-charge ordering. Ghost now mirrors preparation-time Unhealing, one random available buff spend, source-modified heal logging, owner-side projections, unconditional activation, and explicit zero parameters.
- Added `scripts/sim-generator-smoke.mjs` and `scripts/sim-ghost-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 361 / 519 verified item rows. Focused pair tests, Battery/charge/Cog/Con-Trap/Engineer Box regressions, Wave B/D, lifecycle closure, parity systems, coverage honesty, verified coverage, Admin audit, ledger/dashboard checks, changed-module syntax, and scoped `git diff --check` pass.
- The repository-wide continuous audit still has unrelated blockers: the patch-drift baseline reports accumulated source changes requiring its explicit baseline workflow, and the existing Ace/Armored Puppy smoke expects a missing handler. Neither touches Generator/Ghost; no legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Gigawatt and Gingerbread Man; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 252 - in progress

- Codex owns the next retained Gigawatz and Gingerbread Man fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-gigawatz-smoke.mjs`, `scripts/sim-gingerbread-man-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 252 - complete

- Codex repaired Gigawatz to mirror its source preparation reset, count exactly ten charge-based speed boosts instead of accumulating speed against the cap, inflict Blind before source effect damage, use the descriptor damage path, activate before recording the next damage increment, and increment by `damincrease`. Gingerbread Man now preserves inherited Food preparation, source starting/cooldown max-health gains, the nested Lucky/Heat/Mana gate, exact Empower/Regeneration values, modified `maxhealth_use`, both board sides, and explicit zero parameters.
- Added `scripts/sim-gigawatz-smoke.mjs` and `scripts/sim-gingerbread-man-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 363 / 519 verified item rows. Focused pair tests, Emerald-through-Gingerbread, AP milestone, Wave D, Staff of Unhealing, lifecycle closure, parity systems, coverage honesty, verified coverage, Admin audit, ledger/dashboard checks, changed-module syntax, and scoped `git diff --check` pass.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch. No legal, authentication, database, storage, or security behavior changed.
- The next retained queue begins with Girl Power and Gloves of Haste; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 253 - in progress

- Codex owns the next retained Girl Power and Gloves of Haste fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-girl-power-smoke.mjs`, `scripts/sim-gloves-of-haste-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 253 - complete

- Codex repaired Girl Power to use its source preparation hook, distinct primary class-item targeting, exact Empower/Regeneration comparison and tie branches, origin tracking, and zero-safe parameters. Gloves of Haste now uses the source cooldown target rule from catalog descriptors, preserves exact speed values, activates even for zero values, and keeps grant/activation ordering.
- Added `scripts/sim-girl-power-smoke.mjs` and `scripts/sim-gloves-of-haste-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 365 / 519 verified item rows. Focused pair tests, Wave A/B, Emerald-through-Gingerbread, lifecycle closure, changed-module syntax, and scoped verification pass. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Gold Armor and Gold Cube; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 254 - in progress

- Codex owns the next retained Gold Armor and Gold Cube fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-gold-armor-smoke.mjs`, `scripts/sim-gold-cube-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 254 - complete

- Codex repaired Gold Armor to mirror source preparation-time weapon slow, primary Holy target counting, catalog Block, exact cooldown cleanse/Block values, effect-before-activation ordering, and zero-safe parameters. Gold Cube now caches its first source-qualified cooldown target, uses the strict health threshold, modified heal parameters, cached cooldown advancement, consuming activation projection, both board sides, and explicit zero values.
- Added `scripts/sim-gold-armor-smoke.mjs` and `scripts/sim-gold-cube-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 367 / 519 verified item rows. Focused pair tests, changed-module syntax, and scoped verification pass. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Goobert and Goobling; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 255 - in progress

- Codex owns the next retained Goobert and Goobling fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-goobert-smoke.mjs`, `scripts/sim-goobling-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 255 - complete

- Codex repaired Goobert and inherited Goobling peer activation to mirror the source `canActivate` listener, exact activation thresholds, modified `getP_m("heal")`, full-health heal logging, activation ordering, and each item’s handler identity; explicit zero thresholds remain no-ops as in the game.
- Added `scripts/sim-goobert-smoke.mjs` and `scripts/sim-goobling-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 369 / 519 verified item rows. Focused pair tests, Wave A/B/D, Emerald-through-Gingerbread, lifecycle closure, changed-module syntax, and scoped verification pass. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Greatsword and Halberd; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 256 - in progress

- Codex owns the next retained Greatsword and Halberd fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-greatsword-smoke.mjs`, `scripts/sim-halberd-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 256 - complete

- Codex repaired Greatsword to mirror the source `onPrepare` lifecycle, exact Empower threshold transitions, buffed stamina/cooldown values, and explicit zero parameters. Halberd now mirrors source `canBlock` targeting, empty affected-cell counting, Block buff power, exact early-hit damage, late block removal/transfer, and zero parameters. Big Bloodthorne's inherited Greatsword setup now calls the corrected preparation hook.
- Added `scripts/sim-greatsword-smoke.mjs` and `scripts/sim-halberd-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 371 / 519 verified item rows. Focused Greatsword/Halberd, Big Bloodthorne, Wave A/B/D, changed-module syntax, and scoped audit checks pass. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Hammer and Hardwood; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 257 - in progress

- Codex owns the next retained Hammer and Hardwood fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-hammer-smoke.mjs`, `scripts/sim-hardwood-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 257 - complete

- Codex repaired Hammer to mirror source hit/chance gating, modified `getP_m("dur_stun")` duration handling, and explicit zero durations. Hardwood now mirrors source Common-only targeting, preparation-time common melee damage factors, catalog Block per Common target, unconditional combat-start activation, and zero-safe parameters.
- Added `scripts/sim-hammer-smoke.mjs` and `scripts/sim-hardwood-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 373 / 519 verified item rows. Focused Hammer/Hardwood, Wave B/C/D, Forging Hammer, Thor’s Hammer, changed-module syntax, and scoped audit checks pass. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Hawk Rune and Healing Herbs; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 258 - in progress

- Codex owns the next retained Hawk Rune and Healing Herbs fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-hawk-rune-smoke.mjs`, `scripts/sim-healing-herbs-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 258 - complete

- Codex repaired Hawk Rune to mirror source loose-rune Blind infliction and resistance-aware effect-before-activation ordering, plus socketed weapon crit chance/severity and armor Blind resistance. Healing Herbs now mirrors exact source Regeneration, consumption/activation ordering, and explicit zero values.
- Added `scripts/sim-hawk-rune-smoke.mjs` and `scripts/sim-healing-herbs-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 375 / 519 verified item rows. Focused pair tests, lifecycle, gem-socket, loose-gem, affected shared, changed-module syntax, and scoped audit checks pass. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Heart Container and Heart of Darkness; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 259 - in progress

- Codex owns the next retained Heart Container and Heart of Darkness fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-heart-container-smoke.mjs`, `scripts/sim-heart-of-darkness-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 259 - complete

- Codex repaired Heart Container to mirror source preparation-time regeneration listening, exact threshold conversion, regeneration-before-activation ordering, max-health/Empower/healing-efficiency effects, and explicit zero parameters. Heart of Darkness now mirrors source preparation-time Dark speed and regeneration listener, regeneration-priority buff stealing, threshold conversion, opponent healing reduction with stat logging, steal-before-activation ordering, and explicit zero parameters. The obsolete duplicate Heart of Darkness threshold port was removed so the canonical AI-D handler is the only registration.
- Added `scripts/sim-heart-container-smoke.mjs` and `scripts/sim-heart-of-darkness-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 377 / 519 verified item rows. Focused pair tests pass; generated summary reports 377 verified, 119 evidence-pending, 8 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Heart of the Cards and Heart Shield; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 260 - in progress

- Codex owns the next retained Heart of the Cards and Heart Shield fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-heart-of-the-cards-smoke.mjs`, `scripts/sim-heart-shield-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 260 - complete

- Codex repaired Heart of the Cards to mirror the source preparation-time inventory-wide card activation listener, same-side filtering, exact chain-position Mana gate, Regeneration/Mana grants, activation ordering, and explicit zero values. Heart Shield now mirrors source preparation-time affected-item Block buff power, heal/lifesteal parameter modifiers, Regeneration amplification, shield registration, block-side Regeneration, threshold use/health conversion, active ranged/effect blocking, and explicit zero values; the source `useRegeneration` review candidate is now covered by the focused regression and recorded as reviewed.
- Added `scripts/sim-heart-of-the-cards-smoke.mjs` and `scripts/sim-heart-shield-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 379 / 519 verified item rows. Focused pair tests pass; generated summary reports 379 verified, 118 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Heavy Drinking and Hedgehog; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 261 - in progress

- Codex owns the next retained Heavy Drinking and Hedgehog fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-heavy-drinking-smoke.mjs`, `scripts/sim-hedgehog-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 261 - complete

- Codex repaired Heavy Drinking to mirror source preparation-time affected-potion speed, same-inventory potion selection, non-consuming `triggerPotion` behavior, mini activation/activation ordering, and explicit zero speed; the source shop-roll weighting remains documented as out-of-combat scope. Hedgehog now mirrors source preparation-time damaged-health threshold listening, exact Spikes/Block values, one-shot behavior, VFX-only mini activation, effect damage scaling, activation ordering, and explicit zero parameters.
- Added `scripts/sim-heavy-drinking-smoke.mjs` and `scripts/sim-hedgehog-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 381 / 519 verified item rows. Focused pair tests, changed-module syntax, and generated audit checks pass; the generated summary reports 381 verified, 116 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Hero Longsword and Hero Shield; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 262 - in progress

- Codex owns the next retained Hero Longsword and Hero Shield fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-hero-longsword-smoke.mjs`, `scripts/sim-hero-shield-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 262 - complete

- Codex repaired Hero Longsword to mirror source `canBeEmpowered()` weapon-only targeting, the exact `dam`/p1 flat damage grant, source activation ordering, and explicit zero values. Hero Shield now mirrors source `dam`/`damfactor` aura parameters and the inherited Wooden Buckler chance-block, exact `damblock`, after-block stamina drain, and activation path, including explicit zero values.
- Added `scripts/sim-hero-longsword-smoke.mjs` and `scripts/sim-hero-shield-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 383 / 519 verified item rows. Focused pair tests, changed-module syntax, and generated audit checks pass; the generated summary reports 383 verified, 114 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Hero Sword and Hogus Bogus; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 263 - in progress

- Codex owns the next retained Hero Sword and Hogus Bogus fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-hero-sword-smoke.mjs`, `scripts/sim-hogus-bogus-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 263 - complete

- Codex repaired Hero Sword to mirror `Item.canBeEmpowered()` as a damage-capable weapon-only aura target, preserving the exact p1 flat damage and combat-start activation order. Hogus Bogus now mirrors the source three-phase cycle: fractional stamina conversion capped by its named stamina parameter, `buffsPerStamina` random buffs, exact opponent/self stun durations, opponent-current-health percentage healing, activation after each effect, and final `onAfterEffectFinished()` consumption; explicit zero parameters remain safe.
- Added `scripts/sim-hero-sword-smoke.mjs` and `scripts/sim-hogus-bogus-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 385 / 519 verified item rows. Focused pair tests, recent parity regressions, lifecycle/gem/board/audit/coverage checks, changed-module syntax, and scoped diff checks pass. The only diff-check warning is pre-existing trailing whitespace in unrelated `docs/todo.md` additions outside the retained count hunk. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 385 verified, 112 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Holdall and Holy Collar; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 264 - in progress

- Codex owns the next retained Holdall and Holy Collar fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-holdall-smoke.mjs`, `scripts/sim-holy-collar-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 264 - complete

- Codex repaired Holdall to mirror `canApplyEffect` neutral-only cargo filtering, live Block multiplied by affected neutral contents, zero-safe Block, and source start activation. Holy Collar now binds during prepare, tracks only `canActivate` targets, applies Lucky/Regeneration-driven `chance2` crit changes before combat-start grants, uses source chance/luck/regen values without minimum clamping, and records the source mini activation.
- Added `scripts/sim-holdall-smoke.mjs` and `scripts/sim-holy-collar-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 387 / 519 verified item rows. Focused pair and previous-pair tests, lifecycle/gem/board/audit/coverage checks, changed-module syntax, and scoped verification pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 387 verified, 110 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Hyper Hedgehog and Ice Armor; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 265 - in progress

- Codex owns the next retained Hyper Hedgehog and Ice Armor fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-hyper-hedgehog-smoke.mjs`, `scripts/sim-ice-armor-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 265 - complete

- Codex repaired Hyper Hedgehog to mirror inherited Hedgehog preparation and high-priority low-health listening, exact source Spikes/Block/Empower grants, one-shot mini activation, fixed descriptor minimum effect damage with current Spikes/Empower scaling, and effect-before-activation ordering. Ice Armor now mirrors exact start Block/Cold, heat-threshold spending, cooldown Cold/Block values, unconditional activation, and explicit zero parameters.
- Added `scripts/sim-hyper-hedgehog-smoke.mjs` and `scripts/sim-ice-armor-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 389 / 519 verified item rows. Focused pair and prior-pair tests, lifecycle/gem/board/audit/coverage checks, changed-module syntax, and scoped verification pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 389 verified, 108 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Ice Dragon and Ice Flower; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 266 - in progress

- Codex owns the next retained Ice Dragon and Ice Flower fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-ice-dragon-smoke.mjs`, `scripts/sim-ice-flower-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 266 - complete

- Codex repaired Ice Dragon to mirror the source prepare-time opponent Cold listener, early successful-hit Cold infliction, exact live Block fallback, one-shot Cold threshold response, signed effect-damage reduction, activation/log ordering, and explicit zero values. Ice Flower now mirrors source primary weapon and secondary shield-or-activatable-armor target filtering, prepare-time `attacked`/`activated` listeners, miss-inclusive weapon attack behavior, separate chance/chance2 rolls, exact Mana/Cold/own-Block grants, mini activation ordering, and explicit zero values.
- Added `scripts/sim-ice-dragon-smoke.mjs` and `scripts/sim-ice-flower-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 391 / 519 verified item rows. Focused Ice tests, the prior parity queue, lifecycle, loose-gem, vs-board, coverage-honesty, dashboard, changed-module syntax, and generated checks pass. The generated summary reports 391 verified, 106 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.
- The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Inner Power and Investment Opportunity; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 267 - in progress

- Codex owns the next retained Inner Power and Investment Opportunity fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-inner-power-smoke.mjs`, `scripts/sim-investment-opportunity-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 267 - complete

- Codex repaired Inner Power to mirror the source prepare-before-combat-start listener order, exact named/fallback parameters, cooldown-or-heal/lifesteal target filtering, per-item heal/lifesteal multiplier changes, capped Lucky/Empower accumulators, signed reactive deltas, and activation ordering. Investment Opportunity now mirrors source usesBuffs filtering, used-spend/origin matching, fractional max-health accumulation, modified max-health parameters, current-health gain ordering, mini activation projection, and explicit zero values.
- Added `scripts/sim-inner-power-smoke.mjs` and `scripts/sim-investment-opportunity-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 393 / 519 verified item rows. Focused pair tests, changed-module syntax, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 393 verified, 104 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Joker and Just Stats; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 268 - in progress

- Codex owns the next retained Joker and Just Stats fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-joker-smoke.mjs`, `scripts/sim-just-stats-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 268 - complete

- Codex repaired Joker to mirror source card-descriptor pair/triplet/quad counting, exact named/indexed random-buff/stamina/reveal parameters, player-inventory-only stamina reduction, descriptor-based exclusion of the Joker card, repeated reveal selection, and activation ordering. Just Stats now applies modified `maxhealth` parameters before the source temporary max-health gain, preserves low combat-start priority, applies exact stamina regeneration, and remains zero-safe.
- Added `scripts/sim-joker-smoke.mjs` and `scripts/sim-just-stats-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 395 / 519 verified item rows. Focused pair tests, recent parity regressions, changed-module syntax, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 395 verified, 102 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Jynx Staff and Jynx Torquilla; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 269 - in progress

- Codex owns the next retained Jynx Staff and Jynx Torquilla fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-jynx-staff-smoke.mjs`, `scripts/sim-jynx-torquilla-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 269 - complete

- Codex repaired Jynx Staff to mirror source prepare reset, early pre-damage Mana gating, current-hit/permanent damage, exact p1-p5 fallback parameters, hasCooldown target filtering, capped speed activations, and opponent Lucky removal. Jynx torquilla now mirrors source prepare reset, hasCooldown target filtering, exact p1-p3 parameters, capped speed activations, actual Lucky spend logging, and effect-before-activation ordering.
- Added `scripts/sim-jynx-staff-smoke.mjs` and `scripts/sim-jynx-torquilla-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 397 / 519 verified item rows. Focused pair tests, recent parity regressions, changed-module syntax, dashboard tests/checks, coverage checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 397 verified, 100 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with King Crown and King Goobert; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 270 - in progress

- Codex owns the next retained King Crown and King Goobert fidelity review/repair, their focused source-backed regressions, the host-scoped socketed GemPower path they require, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/scripts/ports-wave-d-goobert.js`, `js/pages/sim/engine/gem-sockets.js`, `scripts/sim-king-crown-smoke.mjs`, `scripts/sim-king-goobert-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 270 - complete

- Codex repaired King Crown to mirror its source prepare override, inherited Mana-triggered invulnerability, exact p2 heal, Buff Protect, source effect order, and zero-safe parameters. King Goobert now mirrors source prepare reset, p1 peer activation threshold, p2 heal, p3 Buff Protect, p4 Mana, p5 duration, p6 charges, condition-safe charge spending, base Goobert activation order, and zero-safe parameters. Both now apply the source 50% host-scoped GemPower increase to socketed gems without mutating shared catalog gems.
- Added `scripts/sim-king-crown-smoke.mjs` and `scripts/sim-king-goobert-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 399 / 519 verified item rows. Focused pair tests, Crown/Goobert regressions, gem-system regression, changed-module syntax, dashboard generation, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 399 verified, 98 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with King of the Bling; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 271 - in progress

- Codex owns the next retained King of the Bling and Knife to Meet You fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/scripts/ports-ao-skills.js`, `js/pages/sim/engine/scripts/ports-aura.js`, `scripts/sim-king-of-the-bling-smoke.mjs`, `scripts/sim-knife-to-meet-you-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 271 - complete

- Codex repaired King of the Bling to mirror source prepare timing, Magic Ring/Superior Ring filtering, same-side targeting, and exact all-buff/all-debuff amplification from the item chance. Knife to Meet You now mirrors source prepare-time Dagger subclass speed, linked-Dagger speed scaling, same-side `canBeEmpowered` damage-factor application, exact p2 damage factor, and `onAfterEffectFinished()` consumption ordering; explicit zero parameters remain safe.
- Added `scripts/sim-king-of-the-bling-smoke.mjs` and `scripts/sim-knife-to-meet-you-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 401 / 519 verified item rows. Both focused tests, parity systems, King Crown/Goobert regressions, changed-module syntax, coverage, dashboard generation, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 401 verified, 96 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Holo Fire Lizard and Holy Armor; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 272 - in progress

- Codex owns the next retained Holo Fire Lizard and Holy Armor fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-holo-fire-lizard-smoke.mjs`, `scripts/sim-holy-armor-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 272 - complete

- Codex repaired Holo Fire Lizard to mirror source card-chain zero-based damage scaling, effect-damage factor, Heat grant, raw damage ordering, and activation after effects. Holy Armor now mirrors the source `Type.Holy` target predicate, exact catalog Block, exact Regeneration-per-Holy amount, exact p2 Poison cleanse including zero, and activation after cleansing.
- Added `scripts/sim-holo-fire-lizard-smoke.mjs` and `scripts/sim-holy-armor-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 403 / 519 verified item rows. Both focused tests, shared Card and Holy Collar regressions, changed-module syntax, coverage, dashboard generation, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 403 verified, 94 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The repository-wide continuous audit remains limited by the same unrelated patch-drift baseline and existing Ace/Armored Puppy handler assertion; neither touches this batch.
- The next retained queue begins with Holy Spear and Hungry Blade; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 273 - in progress

- Codex owns the next retained Holy Spear and Hungry Blade fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-holy-spear-smoke.mjs`, `scripts/sim-hungry-blade-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 273 - complete

- Codex repaired Holy Spear to mirror source prepare-time empty/Holy slot accounting, late successful-hit Block stripping and random debuff cleansing, Mana and invulnerability-end trigger listeners, exact source invulnerability duration modification, temporary speed/state timing, and explicit zero parameters. Hungry Blade now mirrors source prepare-time Vampirism listening, combat-start Vampirism and non-consuming activation, exact Vampirism-to-max-damage reaction, successful-hit-only Regeneration conversion, and explicit zero parameters.
- Added `scripts/sim-holy-spear-smoke.mjs` and `scripts/sim-hungry-blade-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 405 / 519 verified item rows. Both focused tests, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 405 verified, 92 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Katana and Laboratory; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 274 - in progress

- Codex owns the next retained Katana and Laboratory fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-katana-smoke.mjs`, `scripts/sim-laboratory-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 274 - complete

- Codex repaired Katana to mirror inherited Rib Saw preparation and `onPreDealDamage_early` ordering, the source `canBeEmpowered` opponent-weapon snapshot, exact damage/buff parameters, thresholded opponent buff stripping, and explicit zero values. Laboratory now mirrors its source Fire/Nature/Holy/Vampiric/Engineer target predicate and snapshot, five-phase Lucky → Heat → Spikes → Regeneration → Vampirism conversions, source spend gates, phase cooldown transition, final consume/activation, and failed-gate behavior.
- Added `scripts/sim-katana-smoke.mjs` and `scripts/sim-laboratory-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 407 / 519 verified item rows. Both focused tests, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 407 verified, 90 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Leaf Badge and Leather Armor; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 275 - in progress

- Codex owns the next retained Leaf Badge and Leather Armor fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-leaf-badge-smoke.mjs`, `scripts/sim-leather-armor-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 275 - complete

- Codex repaired Leaf Badge to mirror source `canDamage()` target filtering, prepare-time Lucky listening, exact crit-chance percentage accumulation, Lucky grant, activation ordering, and zero-safe chance handling. Leather Armor now mirrors source pre-combat Debuff Resist timing, exact catalog Block at combat start, activation after Block, and zero-safe resistance.
- Added `scripts/sim-leaf-badge-smoke.mjs` and `scripts/sim-leather-armor-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 409 / 519 verified item rows. Focused pair tests, Wave C/D/AP regressions, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 409 verified, 88 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Leather Boots and Leather Helm; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 276 - in progress

- Codex owns the next retained Leather Boots and Leather Helm fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-leather-boots-smoke.mjs`, `scripts/sim-leather-helm-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 276 - complete

- Codex repaired Leather Boots to mirror the source strict below-threshold health trigger, `High + 2` damage-listener priority, exact p2/p3 Lucky and Empower grants, catalog Block, one-shot consumption, and explicit zero values. Leather Helm now mirrors source prepare-time Crit/Stun resistance, pre-combat p1 timed damage resistance, active-state/timer cleanup, combat-start activation, and zero-safe parameters.
- Added `scripts/sim-leather-boots-smoke.mjs` and `scripts/sim-leather-helm-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 411 / 519 verified item rows. Focused pair tests, Wave C/D, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 411 verified, 86 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Level Up and Light Flower; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 277 - in progress

- Codex owns the next retained Level Up and Light Flower fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-level-up-smoke.mjs`, `scripts/sim-light-flower-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 277 - complete

- Codex repaired Level Up to mirror source round-based speed, modified `getP_m("maxhealth")` gain, exact Stamina/Mana/Lucky order, activation, and zero-safe parameters. Light Flower now mirrors source Holy-secondary target counting, exact protection chance, Mana spend and debuff cleanse gate, Regeneration/Lucky order, activation, and zero-safe integer parameters.
- Added `scripts/sim-level-up-smoke.mjs` and `scripts/sim-light-flower-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 413 / 519 verified item rows. Focused pair tests, AP milestone, Wave C/D, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 413 verified, 84 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Light Goobert and Lightning Potion; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 278 - in progress

- Codex owns the next retained Light Goobert and Lightning Potion fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-light-goobert-smoke.mjs`, `scripts/sim-lightning-potion-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 278 - complete

- Codex repaired Light Goobert to mirror source prepare reset, inherited activation threshold, modified inherited heal, exact Blind amount/duration, activation ordering, and zero-safe parameters. Lightning Potion now mirrors source random descriptor cooldown range, descriptor damage, p1 Blind/p2 duration, modified p3 Holy-secondary heal, primary potion chaining, consumption, activation, and zero-safe parameters.
- Added `scripts/sim-light-goobert-smoke.mjs` and `scripts/sim-lightning-potion-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 415 / 519 verified item rows. Focused pair tests, AP milestone, Wave C/D, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 415 verified, 82 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Lightning Staff and Lightsaber; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 279 - in progress

- Codex owns the next retained Lightning Staff and Lightsaber fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-lightning-staff-smoke.mjs`, `scripts/sim-lightsaber-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 279 - complete

- Codex repaired Lightning Staff to mirror source prepare reset, early miss-inclusive Mana spend and permanent damage, exact attack threshold, Lightning can-affect mapping, modified charge duration, and the extracted charge stat transition including non-removable damage and final charge cleanup. Lightsaber now mirrors source prepare listeners, exact regeneration/Blind thresholds, non-removable varying damage, modified Blind duration, timed light-end reactivation, and activation ordering.
- Added `scripts/sim-lightning-staff-smoke.mjs` and `scripts/sim-lightsaber-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 417 / 519 verified item rows. Focused pair tests, AP milestone, Wave C/D, parity systems, Scissorswords/Holy Spear regressions, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. `git diff --check` still reports pre-existing unrelated trailing whitespace in user-owned `docs/todo.md` lines; no parity files have whitespace errors. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 417 verified, 80 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Little Mimic and Long Spear; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 280 - in progress

- Codex owns the next retained Little Mimic and Long Spear fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-little-mimic-smoke.mjs`, `scripts/sim-long-spear-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 280 - complete

- Codex repaired Little Mimic to mirror source `onPrepare` price-based speed, signed total handling, exact integer buff count, `giveMostBuffs` before `activate`, and zero-safe parameters. Long Spear now mirrors source empty-cell preparation, early-hit block removal, signed damage-resistance reduction, miss behavior, and zero-safe parameters.
- Added `scripts/sim-little-mimic-smoke.mjs` and `scripts/sim-long-spear-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 419 / 519 verified item rows. Focused pair tests, AP milestone, Wave C/D, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 419 verified, 78 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Lucky Bow and Lucky Cat; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 281 - in progress

- Codex owns the next retained Lucky Bow and Lucky Cat fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-lucky-bow-smoke.mjs`, `scripts/sim-lucky-cat-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 281 - complete

- Codex repaired Lucky Bow to mirror source prepare reset, exact `giveLucky(getP1())` integer semantics, two-strike critical branch, activation behavior, and post-second-strike state reset. Lucky Cat now mirrors source affected gold totals, strict gold thresholds, prepare-time crit resistance, Godly-plus cooldown speed filtering, owner-side inventory scope, and exact named/indexed parameter fallbacks.
- Added `scripts/sim-lucky-bow-smoke.mjs` and `scripts/sim-lucky-cat-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 421 / 519 verified item rows. Focused pair tests, AP milestone, Wave C/D, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 421 verified, 76 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Lucky Clover and Lucky Piggy; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 282 - in progress

- Codex owns the next retained Lucky Clover and Lucky Piggy fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-lucky-clover-smoke.mjs`, `scripts/sim-lucky-piggy-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 282 - complete

- Codex repaired Lucky Clover to mirror source direct `getP1()` Lucky semantics, consume/activation ordering, and explicit zero values. Lucky Piggy now mirrors source `canModifyChance` filtering, prepare-time additive chance multiplier, exact `getP2()` Lucky grant, High+5 combat-start ordering, activation, and zero-safe parameters.
- Added `scripts/sim-lucky-clover-smoke.mjs` and `scripts/sim-lucky-piggy-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 423 / 519 verified item rows. Focused pair tests, AP milestone, Wave C/D, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 423 verified, 74 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Lucky Shortbow and Lump of Coal; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 283 - in progress

- Codex owns the next retained Lucky Shortbow and Lump of Coal fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-lucky-shortbow-smoke.mjs`, `scripts/sim-lump-of-coal-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 283 - complete

- Codex repaired Lucky Shortbow to mirror the source `onPreDealDamage_early` hit/chance hook and exact Lucky grant. Lump of Coal now mirrors source inventory effect-before-completion ordering, consume activation, socketed weapon direct p1 damage plus mini activation, socketed armor debuff-resist stacks, and Gem Power-scaled armor Block.
- Added `scripts/sim-lucky-shortbow-smoke.mjs` and `scripts/sim-lump-of-coal-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 425 / 519 verified item rows. Focused pair tests, socketed/loose gem regressions, Band Y, Wave C/D, AP milestone, parity systems, verified-coverage, coverage-honesty, changed-module syntax, ledger/dashboard freshness checks, and generated-count checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 425 verified, 72 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Mage Hat and Magic Badge; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 284 - in progress

- Codex owns the next retained Mage Hat and Magic Badge fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-mage-hat-smoke.mjs`, `scripts/sim-magic-badge-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 284 - complete

- Codex repaired Mage Hat to mirror the source primary/secondary/tertiary rarity lanes, exact block/mana/effect-damage parameters, source activation, and explicit zero values. Magic Badge now mirrors source Mana-only target filtering, preparation-time Mana amplification, combat-start Mana, activation, and zero-safe parameters; it no longer writes the all-buff amplification field at combat start.
- Added `scripts/sim-mage-hat-smoke.mjs` and `scripts/sim-magic-badge-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 427 / 519 verified item rows. Focused pair tests, Wave B/C/D, AP milestone, parity systems, verified-coverage, coverage-honesty, changed-module syntax, and ledger/dashboard freshness checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 427 verified, 70 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Magic Collar and Magic Mirror; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 285 - complete

- Codex repaired Magic Collar to mirror the source empowered-weapon filter, weapon `attacked` signal (avoiding broad effect-damage over-triggering), Lucky-scaled chance, exact Mana parameter, and mini activation. Magic Mirror now mirrors the source Holy target count, chance/chance2 reflect scaling, proportional buff-limit effect, completion/consume ordering, and zero-safe parameters.
- Added `scripts/sim-magic-collar-smoke.mjs` and `scripts/sim-magic-mirror-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 429 / 519 verified item rows. Focused pair tests, changed-module syntax, and the generated artifacts were checked; no legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 429 verified, 68 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Magic Ring and Magic Staff; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 286 - in progress

- Codex owns the next retained Magic Ring and Magic Staff fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, the shared board target/type helpers needed to carry runtime ring types, `scripts/sim-magic-ring-smoke.mjs`, `scripts/sim-magic-staff-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 286 - complete

- Codex repaired Magic Ring to preserve encoded effect slot 0, honor zero configured effect counts, reset one-shot low-health triggers on re-prepare, mirror source stack-to-type runtime classification, and apply strict below-threshold scaled grants with per-effect activation. Magic Staff now mirrors indexed `getP1/getP2/getP3` parameters, zero-cost `tryUseMana`, insufficient-Mana blocking, early temporary damage ordering, and permanent damage growth without boosting the current hit.
- Added `scripts/sim-magic-ring-smoke.mjs` and `scripts/sim-magic-staff-smoke.mjs`, including a board-target regression proving runtime Ring types participate in `canAffect` checks; attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 431 / 519 verified item rows. Focused pair tests, changed-module syntax, and generated artifact freshness checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 431 verified, 66 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Magic Torch and Magitecc Armor; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 287 - in progress

- Codex owns the next retained Magic Torch and Magitecc Armor fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-magic-torch-smoke.mjs`, `scripts/sim-magitecc-armor-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 287 - complete

- Codex repaired Magic Torch to mirror the source hit-only `tryUseMana` gate, zero-safe indexed parameters, future-only permanent damage growth, and empowerable linked-item filtering; the current damage result is no longer incorrectly boosted. Magitecc Armor now mirrors Holy/Magic link speed, catalog base Block at combat start, activation ordering, exact named Mana/cleanse/Block values, and zero-cost cooldown behavior.
- Added `scripts/sim-magic-torch-smoke.mjs` and `scripts/sim-magitecc-armor-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 433 / 519 verified item rows. Focused pair tests and changed-module syntax pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 433 verified, 64 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Mana Crystal and Mana Mastery; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 288 - in progress

- Codex owns the next retained Mana Crystal and Mana Mastery fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, the shared charge-path helper and Mana Orb lifecycle dependency, `scripts/sim-mana-crystal-smoke.mjs`, `scripts/sim-mana-mastery-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 288 - complete

- Codex repaired Mana Crystal to mirror the source four explicit directional charge paths, correct source-relative coordinates, lightning acceptance, exact Magic/non-Magic Mana grants, per-charge target transitions, charge signal and activation ordering, and explicit zero Mana/duration values. Mana Mastery now mirrors source Magic-linked preparation speed, global Mana Orb pre-combat bonus buffs, exact cooldown Mana, activation ordering, and zero-safe parameters. Mana Orb's reset now runs in `onPrepare`, matching the source lifecycle so Mana Mastery bonuses cannot be cleared afterward.
- Added `scripts/sim-mana-crystal-smoke.mjs` and `scripts/sim-mana-mastery-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 435 / 519 verified item rows. Focused pair tests, changed-module syntax, and generated artifact freshness checks pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 435 verified, 62 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Mananana and Manathirst; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 289 - in progress

- Codex owns the next retained Mananana and Manathirst fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-mananana-smoke.mjs`, `scripts/sim-manathirst-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 289 - complete

- Codex repaired Mananana to mirror Food preparation speed, exact named Mana gating, source heal/stamina ordering, unconditional activation, and explicit zero Mana/heal/stamina values. Manathirst now mirrors the source `onPrepare` Mana listener, one-threshold leftover progress, exact lifesteal damage/heal response, hit-only Mana gain, and explicit zero Mana-on-hit behavior.
- Added `scripts/sim-mananana-smoke.mjs` and `scripts/sim-manathirst-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 437 / 519 verified item rows. Focused pair tests and changed-module syntax pass. No legal, authentication, database, storage, or security behavior changed.
- The generated summary reports 437 verified, 60 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Mana Orb and Markswoman; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 290 - in progress

- Codex owns the next retained Mana Orb and Markswoman fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-mana-orb-smoke.mjs`, `scripts/sim-markswoman-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 290 - complete

- Codex repaired Mana Orb to bind its Mana listener during source `onPrepare`, preserve the source one-shot state and threshold/spend/random-buff ordering, honor `canActivate` links and exact linked-activation Mana, and keep explicit zero parameters valid. Markswoman now runs during source `onPrepare`, targets only ranged weapons, applies the exact speed/damage-factor/accuracy values, and respects empowerable and zero-value behavior.
- Added `scripts/sim-mana-orb-smoke.mjs` and `scripts/sim-markswoman-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 439 / 519 verified item rows. Focused pair tests, prior Mana regressions, coverage honesty, generated artifact freshness, changed-module syntax, and diff checks pass. No legal, authentication, database, storage, or security behavior changed. The next retained queue begins with Mecha Bat and Mega Clover; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 291 - in progress

- Codex owns the next retained Mecha Bat and Mega Clover fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-mecha-bat-smoke.mjs`, `scripts/sim-mega-clover-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 291 - complete

- Codex repaired Mecha Bat to mirror source preparation-time opponent damage listening, charged linked-item lifesteal eligibility, exact full-damage ceiling heal, charge state transitions, Lucky/stamina Vampirism branches, source grant-before-activation ordering, and explicit zero values. Mega Clover now mirrors source preparation timing, one-shot Lucky threshold, Lucky-excluded random-buff pool, exact values, activation ordering, and zero-safe parameters.
- Added `scripts/sim-mecha-bat-smoke.mjs` and `scripts/sim-mega-clover-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 441 / 519 verified item rows. Focused pair tests, prior Mana regressions, coverage honesty, generated artifact freshness, changed-module syntax, and diff checks pass. No legal, authentication, database, storage, or security behavior changed. The next retained queue begins with Mercury Elemental and Miss Fortune; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 292 - in progress

- Codex owns the next retained Mercury Elemental and Miss Fortune fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-mercury-elemental-smoke.mjs`, `scripts/sim-miss-fortune-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-16 Simulator item parity continuation 292 - complete

- Codex repaired Mercury Elemental to mirror source melee-only distinct preparation scaling, incoming attack `DamageResult.damage` Block grants, `stamina_used` accumulation with exact poison/self-poison thresholds and mini-activation projection, cooldown stamina regeneration, and explicit zero values. Miss Fortune now mirrors source Lucky threshold/spend, most-held buff selection, activation-after-effects ordering, unconditional activation, and zero-safe parameters.
- Added `scripts/sim-mercury-elemental-smoke.mjs` and `scripts/sim-miss-fortune-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 443 / 519 verified item rows. Focused pair tests, prior parity regressions, verified coverage, coverage honesty, changed-module syntax, and ledger/dashboard freshness checks pass. No legal, authentication, database, storage, or security behavior changed. The generated summary reports 443 verified, 54 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Molten Dagger and Molten Greatsword; this batch is ready to commit and push.

### 2026-10-16 Simulator item parity continuation 293 - in progress

- Codex owns the next retained Molten Dagger and Molten Greatsword fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-molten-dagger-smoke.mjs`, `scripts/sim-molten-greatsword-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 293 - complete

- Codex repaired Molten Dagger to mirror the source hit-only Heat gate, permanent future-hit damage growth, exact integer parameters, Heat spending, inherited weapon activation, miss behavior, and explicit zero values. Molten Greatsword now uses the inherited Greatsword attack path so stamina, early-hit Heat consumption, Empower grant, damage, and activation ordering match the source; its Fire multiplicity and zero values remain source-backed.
- Added `scripts/sim-molten-dagger-smoke.mjs` and `scripts/sim-molten-greatsword-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 445 / 519 verified item rows. Focused pair tests, prior Mercury/Miss Fortune regressions, verified coverage, coverage honesty, changed-module syntax, and ledger/dashboard freshness checks pass. No legal, authentication, database, storage, or security behavior changed. The generated summary reports 445 verified, 52 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. The next retained queue begins with Molten Spear and Molten Spear2; this batch is ready to commit and push.

### 2026-10-17 Simulator item parity continuation 294 - in progress

- Codex owns the next retained Molten Spear and Molten Spear2 fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/scripts/ports-wave-c-spear.js`, `js/pages/sim/engine/scripts/ports-ap-onhit.js`, `js/pages/sim/engine/scripts/ports-util.js`, `scripts/sim-molten-spear-smoke.mjs`, `scripts/sim-molten-spear2-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 294 - complete

- Codex repaired Molten Spear to mirror source `onPrepare` Fire/empty block-removal scaling, same-strike Heat miss conversion, typed integer parameters, and late block removal. Molten Spear2 now mirrors source Fire multiplicity, same-strike Heat conversion plus permanent future damage, hit-only Blind/self-Blind, late block removal, and explicit zero values. Both ports preserve the source lifecycle instead of creating a second post-miss attack.
- Added `scripts/sim-molten-spear-smoke.mjs` and `scripts/sim-molten-spear2-smoke.mjs`, corrected shared Fire multiplicity to preserve extracted zero/truncation semantics, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 447 / 519 verified item rows. Focused spear tests pass; generated item summary reports 447 verified, 50 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 295 - in progress

- Codex owns the next retained Moon Armor and Moon Shield fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/damage.js`, `js/pages/sim/engine/stacks.js`, `js/pages/sim/engine/scripts/ports-ap-mana.js`, `js/pages/sim/engine/scripts/ports-ao-shields.js`, `scripts/sim-moon-armor-smoke.mjs`, `scripts/sim-moon-shield-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 295 - complete

- Codex repaired Moon Armor to mirror Magic-linked combat-start Block, base Block with placement-aware values, cooldown Mana/Reflect ordering, and explicit zero parameters. Moon Shield now binds its affected-item Block power and origin-scoped Block accumulator during `onPrepare`, preserves the source P4 threshold and P2 drain, supports the source any-attack `triggerOnAttacked` override while retaining melee-only base shields, and avoids counting unrelated Block gains.
- Added `scripts/sim-moon-armor-smoke.mjs` and `scripts/sim-moon-shield-smoke.mjs`, added Block origin metadata to the combat bus, extended shield eligibility for source-specific predicates, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 449 / 519 verified item rows. Focused Moon tests pass; generated item summary reports 449 verified, 48 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 296 - in progress

- Codex owns the next retained More Stats and Mr Struggles fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-more-stats-smoke.mjs`, `scripts/sim-mr-struggles-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 296 - complete

- Codex repaired More Stats to mirror source `Item.canBeEmpowered()` weapon-only filtering, exact damage-factor accumulation, rounded temporary max-health gain, combat-start activation, and explicit zero parameters. Mr Struggles now mirrors source low-health linked cooldown haste, source-duration debuff echo with the ten-per-timestamp trigger cap, fatigue-counter accumulation through the damage pipeline with Block, source activation ordering, and explicit zero fatigue.
- Added `scripts/sim-more-stats-smoke.mjs` and `scripts/sim-mr-struggles-smoke.mjs`, retained temporary-debuff duration on the buff-change bus, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 451 / 519 verified item rows. Focused More Stats/Mr Struggles tests, prior Moon/Molten regressions, changed-module syntax, and generated artifact checks pass. The generated item summary reports 451 verified, 46 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 297 - in progress

- Codex owns the next retained Mrs Struggles and Mushroom Farm fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-mrs-struggles-smoke.mjs`, `scripts/sim-mushroom-farm-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 297 - complete

- Codex repaired Mrs Struggles to mirror source preparation-time self speed per affected Dark item, exact all-buff opponent stripping, source activation ordering, and explicit zero speed. Mushroom Farm now mirrors exact Fly Agaric/Doom Cap target identity, combat-start speed, activation projection, and explicit zero speed.
- Added `scripts/sim-mrs-struggles-smoke.mjs` and `scripts/sim-mushroom-farm-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 453 / 519 verified item rows. Focused pair tests and changed-module syntax pass. The generated item summary reports 453 verified, 44 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 298 - complete

- Codex repaired No Rush Please to preserve the extracted Leather Helm `onPrepare` no-op, inherit the player-side timed resistance, add the source opponent-side resistance, apply Cold at combat start, and retain activation and explicit zero values. Null Blade now mirrors the source hit-only Lucky damage branch, Regeneration spend and opponent-buff stripping, empty-opponent speed grant, miss behavior, and explicit zero parameters.
- Added `scripts/sim-no-rush-please-smoke.mjs` and `scripts/sim-null-blade-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 455 / 519 verified item rows. Focused pair tests, prior parity regressions, verified coverage, coverage honesty, changed-module syntax, and ledger/dashboard freshness checks are next before this batch is pushed. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 299 - complete

- Codex repaired Obsidian Dragon to install its Heat listener during source `onPrepare`, select the first linked empowerable weapon, preserve the source fractional `heatCounter / heatNeeded` conversion for bonus damage and crit tokens, and keep explicit zero values safe. Oil Lamp now preserves source numeric parameters, applies linked empowerable weapon damage/accuracy before cooldown activation, and retains combat-start Heat, activation, and zero-value behavior.
- Added `scripts/sim-obsidian-dragon-smoke.mjs` and `scripts/sim-oil-lamp-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 457 / 519 verified item rows. Focused pair tests and changed-module checks pass; the full regression/coverage suite is next before this batch is pushed. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 300 - complete

- Codex repaired Onion Cutter to prepare linked Food speed, use the source early hit hook for signed opponent resistance changes, preserve the source parameter mapping, and keep miss behavior unchanged. Owl Spirit now prepares linked buff amplification and its fatigue listener, uses source integer Mana thresholds/values without forced minimums, performs fatigue-aware conversion, and activates after its unconditional cooldown path.
- Added `scripts/sim-onion-cutter-smoke.mjs` and `scripts/sim-owl-spirit-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 459 / 519 verified item rows. Focused pair tests and changed-module checks pass; the full regression/coverage suite is next before this batch is pushed. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 301 - complete

- Codex verified Pan’s pre-combat linked Food damage count and zero-safe weapon cooldown path. Pandamonium now prepares only linked Food activation listeners, applies the source opponent poison-crit chance, grants poison once per linked Food activation with exact zero-safe parameters, and no longer double-registers the peer path; poison ticks now honor the stored critical chance and crit resistance.
- Added `scripts/sim-pan-smoke.mjs` and `scripts/sim-pandamonium-smoke.mjs`, extended the shared actor/tick poison path for source poison criticals, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 461 / 519 verified item rows. Focused pair tests and changed-module checks pass; the full regression/coverage suite is next before this batch is pushed. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 302 - in progress

- Codex owns the next retained Paradise Birb and Potion Belt fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-paradise-birb-smoke.mjs`, `scripts/sim-potion-belt-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 302 - complete

- Codex repaired Paradise Birb to mirror source cooldown pulses, exact affected cooldown/buff/heal target filtering, per-item speed and buff-amplification changes, per-item heal/lifesteal parameter multipliers, max-activation retirement through the shared consume path, and explicit zero values. Potion Belt now mirrors source inside-bag Potion listeners, first/fourth consumption rules, exact cleanse amounts, Bagtacular bonus buffs, source-style activation, and outside-Potion exclusion.
- Added `scripts/sim-paradise-birb-smoke.mjs` and `scripts/sim-potion-belt-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 463 / 519 verified item rows. Focused pair regressions, prior parity regressions, verified coverage, coverage honesty, changed-module syntax, and generated artifact freshness checks pass. No legal, authentication, database, storage, or security behavior changed. The generated summary reports 463 verified, 36 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows.

### 2026-10-17 Simulator item parity continuation 303 - in progress

- Codex owns the next retained Rainbow Goobert Pyromancer and Ranger Bag fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-rainbow-goobert-pyromancer-smoke.mjs`, `scripts/sim-ranger-bag-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 303 - complete

- Codex repaired Rainbow Goobert Pyromancer to mirror the source peer threshold, exact Block/Heal/Vampirism/Heat/Blind/weapon-empowerment effects, per-item modified healing, no-Poison behavior, and explicit zero parameters. Ranger Bag now mirrors source prepare-time cached inside-item crit mutation, Lucky listener timing and signed updates, exact chance/chance2 values, and explicit zero parameters.
- Added `scripts/sim-rainbow-goobert-pyromancer-smoke.mjs` and `scripts/sim-ranger-bag-smoke.mjs`, updated the shared Goobert healing path to honor per-item heal multipliers, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 465 / 519 verified item rows. Focused pair regressions, all existing Goobert regressions, verified coverage, coverage honesty, changed-module syntax, and generated artifact freshness checks pass. No legal, authentication, database, storage, or security behavior changed. The generated summary reports 465 verified, 32 evidence-pending, 7 confirmed gaps, and 15 no-independent-combat rows.

### 2026-10-17 Simulator item parity continuation 304 - in progress

- Codex owns the next retained Regular Emerald and Regular Ruby fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/gem-sockets.js`, `scripts/sim-regular-emerald-smoke.mjs`, `scripts/sim-regular-ruby-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 304 - complete

- Codex repaired the shared gem socket path so Regular Emerald and Regular Ruby mirror source `miniActivate()` projections after successful weapon hits, while preserving their inventory effects, socketed Poison/lifesteal behavior, armor GemPower scaling, exact catalog parameters, and explicit zero values.
- Added `scripts/sim-regular-emerald-smoke.mjs` and `scripts/sim-regular-ruby-smoke.mjs`, reviewed the inherited `Emerald.gd`/`Ruby.gd` and base Gem/Item calls, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 467 / 519 verified item rows. Focused gem regressions, the existing regular-gems/resistor/reverse regression, changed-module syntax, and generated artifact checks pass. The generated summary reports 467 verified, 32 evidence-pending, 5 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 305 - in progress

- Codex owns the next retained Regular Sapphire and Ruby Chonk fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/gem-sockets.js`, `js/pages/sim/engine/scripts/ports-ap-basic.js`, `scripts/sim-regular-sapphire-smoke.mjs`, `scripts/sim-ruby-chonk-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 305 - complete

- Codex repaired Regular Sapphire socket projections so source spectral weapon hits and armor Mana-to-Block conversions emit `miniActivate()` visual events, and repaired Ruby Chonk to run Heat/stun in the source `onDealtDamage` lifecycle with inactive prepare state, integer threshold semantics, modified stun duration, miss handling, and explicit zero values.
- Added `scripts/sim-regular-sapphire-smoke.mjs` and `scripts/sim-ruby-chonk-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 469 / 519 verified item rows. Focused pair tests, the existing regular gem regression, the Pumpkin-to-Scale lifecycle regression, changed-module syntax, and generated artifact checks pass. The generated summary reports 469 verified, 31 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 306 - in progress

- Codex owns the next retained Scale and Snowball fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-scale-smoke.mjs`, `scripts/sim-snowball-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 306 - complete

- Codex repaired Scale to preserve the extracted `int()` threshold and grant parameters, retain negative and fractional threshold semantics, apply linked primary/secondary gold balancing and equilibrium speed, and activate only after the selected Mana/Regeneration grant. Snowball now applies its opponent max-health-gain reduction during `onPrepare`, truncates Cold like the source, preserves the source sign, and consumes after Cold with a projected activation.
- Added `scripts/sim-scale-smoke.mjs` and `scripts/sim-snowball-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 471 / 519 verified item rows. Focused pair regressions, changed-module syntax, and generated artifact freshness checks pass. The generated summary reports 471 verified, 29 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 307 - in progress

- Codex owns the next retained Speak with Animals and Spear fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/scripts/ports-aura.js`, `js/pages/sim/engine/scripts/ports-wave-c-spear.js`, `scripts/sim-speak-with-animals-smoke.mjs`, `scripts/sim-spear-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 307 - complete

- Codex repaired Speak with Animals to use the source Pet-only link rule, write the linked Pet's `doubleActivationChance` rather than attack-effect chance, preserve explicit zero trigger chance, and project activation after the aura mutation. Spear now caches its raw Block-removal amount during `onPrepare` and strips Block from the late pre-deal hook, preserving source ordering, empty-cell counts, miss behavior, and zero/fractional parameters.
- Added `scripts/sim-speak-with-animals-smoke.mjs` and `scripts/sim-spear-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 473 / 519 verified item rows. Focused pair tests, all existing spear-family regressions, coverage honesty, changed-module syntax, and generated artifact freshness checks pass. The generated summary reports 473 verified, 27 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 308 - in progress

- Codex owns the next retained Spectral Dagger and Spicy Banana fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to `js/pages/sim/engine/scripts/ports-wave-c-mana.js`, `js/pages/sim/engine/scripts/ports-ao-skills.js`, `scripts/sim-spectral-dagger-smoke.mjs`, `scripts/sim-spicy-banana-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 308 - complete

- Codex repaired Spectral Dagger to spend source Mana in `onPreDealDamage_early`, add the raw bonus to the original hit, mark that same DamageSource spectral so it bypasses Block, and preserve normal miss/zero-cost behavior without emitting a second damage hit. Spicy Banana now binds its stamina listener during `onPrepare`, uses the source Banana/Mananana link path, preserves fractional stamina and modified heal values, truncates only the source integer Heat field, and does not fabricate zero-Heat buff events.
- Added `scripts/sim-spectral-dagger-smoke.mjs` and `scripts/sim-spicy-banana-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 475 / 519 verified item rows. Focused pair tests, neighboring Mana/food/lifecycle regressions, coverage honesty, changed-module syntax, and generated artifact freshness checks pass. The generated summary reports 475 verified, 25 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 309 - in progress

- Codex owns the next retained Spiked Collar and Spiked Shield fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-spiked-collar-smoke.mjs`, `scripts/sim-spiked-shield-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 309 - complete

- Codex repaired Spiked Collar to run from source `onPrepare`, add modified Battle Rage duration, listen only to the owning actor's rage signal, preserve source integer Spikes and explicit zero values, and project activation at the rage event timestamp. Spiked Shield now resets its source counter during preparation, preserves exact integer Spikes/maxSpikes semantics, uses the inherited Shield before/after-block ordering, keeps zero damblock/stamina/Spikes values, and activates after the source stamina drain.
- Added `scripts/sim-spiked-collar-smoke.mjs` and `scripts/sim-spiked-shield-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 477 / 519 verified item rows. Focused pair tests, neighboring rage/collar/shield regressions, changed-module syntax, and generated artifact freshness checks pass. The generated summary reports 477 verified, 23 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 310 - in progress

- Codex owns the next retained Spiked Staff and Spiked Wall fidelity review/repair, the shared Battle Rage bonus-duration correction required by their extracted source, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths include `js/pages/sim/engine/actor.js`, `js/pages/sim/engine/battle-rage.js`, `js/pages/sim/engine/scripts/ports-ai-hard.js`, the relevant simulator port modules, `scripts/sim-spiked-collar-smoke.mjs`, `scripts/sim-spiked-shield-smoke.mjs`, `scripts/sim-spiked-staff-smoke.mjs`, `scripts/sim-spiked-wall-smoke.mjs`, `scripts/sim-deer-totem-smoke.mjs`, `scripts/sim-extra-angy-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 310 - complete

- Codex repaired Spiked Staff to mirror the source early pre-deal hook: Mana spend gates the same hit, Empower is granted from the raw named parameter, Battle Rage grants source Spikes, and misses, zero costs, fractional values, and event timing remain source-compatible. Spiked Wall now inherits the Spiked Shield preparation/reset path, blocks all eligible attack damage rather than only the narrow shield subset, applies additive melee/ranged spike limits, subtracts stamina regeneration from the actor's base regeneration, and adds the extracted Battle Rage bonus duration.
- Corrected the shared Battle Rage bonus-duration field so Spiked Collar, Deer Totem, and Spiked Wall affect later rage starts while Extra Angy preserves its source `applyBonus=false` behavior. Added `scripts/sim-spiked-staff-smoke.mjs` and `scripts/sim-spiked-wall-smoke.mjs`, expanded the related rage regressions, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 479 / 519 verified item rows. Focused Staff/Wall, rage, collar/shield, changed-module syntax, coverage honesty, and generated artifact checks pass. The generated summary reports 479 verified, 21 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 311 - in progress

- Codex owns the next retained Spin to Win and Spirit Bells fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-spin-to-win-smoke.mjs`, `scripts/sim-spirit-bells-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 311 - complete

- Codex repaired Spin to Win to mirror source face-direction stack selection, `int()` parameter initialization, explicit zero values, orientation fallback, and activation after the selected stack grant. Spirit Bells now mirrors inherited Leather Helm crit/stun preparation, distinct linked-Pet duration, timed damage resistance and state expiry, source proportional buff-limit rounding, and post-effect activation/consumption. Added `scripts/sim-spin-to-win-smoke.mjs` and `scripts/sim-spirit-bells-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and retained 479 / 519 verified item rows. Focused pair tests, Band Y handler regressions, changed-module syntax, and generated artifact checks pass. The generated summary reports 479 verified, 19 evidence-pending, 6 confirmed gaps, and 15 no-independent-combat rows; the two confirmed gaps are the pre-existing Heart Shield and Moon Shield `afterBlock` hooks exposed by the fresh audit. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 312 - in progress

- Codex owns the next retained Spring Loader and Squirrel fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-spring-loader-smoke.mjs`, `scripts/sim-squirrel-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 312 - complete

- Codex repaired Spring Loader to mirror source linked cooldown-target speed reduction, exact named `speed`/`speed2`/`cdadvance` parameters, cooldown advancement, source activation after linked effects, consumption, and explicit zero values. Squirrel now mirrors inherited Forest Friend Pet/Food speed scaling, source one-stack buff stealing, linked target filtering, activation ordering, and exact parameters.
- Added `scripts/sim-spring-loader-smoke.mjs` and `scripts/sim-squirrel-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 481 / 519 verified item rows. Focused pair tests, Band Y/Z regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 481 verified, 17 evidence-pending, 6 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 313 - in progress

- Codex owns the next retained Squirrel Archer and Steel Goobert fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-squirrel-archer-smoke.mjs`, `scripts/sim-steel-goobert-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 313 - complete

- Codex repaired Squirrel Archer to mirror inherited Forest Friend Pet/Food speed, the source early-hit one-stack buff steal, stamina-gated ranged strike, grant logging, and activation ordering. Steel Goobert now mirrors inherited Goobert peer-activation timing, secondary `canBeEmpowered` weapon caching, exact `dam` and Block values without forced minimums, effect-before-activation ordering, no timed cooldown, and combat-end state reset.
- Added `scripts/sim-squirrel-archer-smoke.mjs` and `scripts/sim-steel-goobert-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 483 / 519 verified item rows. Focused pair tests, Spring/Squirrel regressions, Band Y/Z regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 483 verified, 15 evidence-pending, 6 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 314 - in progress

- Codex owns the next retained Stone Helm and Torch fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-stone-helm-smoke.mjs`, `scripts/sim-torch-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 314 - complete

- Codex repaired Stone Helm to mirror inherited Leather Helm preparation, Stone Helm’s Chance2 stun-resistance override, timed damage resistance, combat-start Block, activation ordering, and explicit zero values. Torch now preserves the source early-hit chance hook, exact persistent P1 damage growth, zero-safe parameters, duplicate canonical port behavior, and weapon activation ordering.
- Added `scripts/sim-stone-helm-smoke.mjs` and `scripts/sim-torch-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 485 / 519 verified item rows. Focused pair tests, prior helm/weapon/rage regressions, Band Y/Z regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 485 verified, 13 evidence-pending, 6 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 315 - in progress

- Codex owns the next retained Whetstone and Whetstone2 fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-whetstone-smoke.mjs`, `scripts/sim-whetstone2-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 315 - complete

- Codex repaired Whetstone to mirror source `canBeEmpowered` targeting, exact named `dam` mutation without forced rounding/minimums, target-before-activation ordering, and activation. Whetstone2 now uses the extracted Whetstone.gd scene binding with its own handler identity and the same source behavior.
- Added `scripts/sim-whetstone-smoke.mjs` and `scripts/sim-whetstone2-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 487 / 519 verified item rows. Focused pair tests, prior aura/weapon regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 487 verified, 11 evidence-pending, 6 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 316 - in progress

- Codex owns the next retained Whetstone3 and White Eyes Blue Dragon fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-whetstone3-smoke.mjs`, `scripts/sim-white-eyes-blue-dragon-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 316 - complete

- Codex repaired Whetstone3 to mirror the extracted Whetstone inheritance: `canBlock` or inherited `canBeEmpowered` targeting, prepare-time Block buff power, exact `blockfactor`, source-backed custom `canBlock` overrides, inherited damage mutation, and activation ordering. White-Eyes Blue Dragon now uses the extracted base Block plus zero-based chain position, named Cold and effect-damage parameters, card buff power, exact zero handling, and activation after reveal effects.
- Added `scripts/sim-whetstone3-smoke.mjs` and `scripts/sim-white-eyes-blue-dragon-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 489 / 519 verified item rows. Focused pair tests, prior Whetstone/card/aura regressions, source parity audit, changed-module syntax, and generated artifact freshness checks pass. The generated summary reports 489 verified, 9 evidence-pending, 6 confirmed gaps, and 15 no-independent-combat rows. A pre-existing unrelated Halberd smoke failure still calls the old `lucky_bow.onDealtDamage` API; the focused pair and all touched paths pass. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 317 - in progress

- Codex owns the next retained Wisdom Puppy and Wisp fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-wisdom-puppy-smoke.mjs`, `scripts/sim-wisp-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 317 - complete

- Codex repaired Wisdom Puppy to mirror source `onPrepare` Pet-only speed, exact catalog Block fallback with explicit zero support, Block buff-power scaling, Cold cleanse, and effect-before-activation ordering. Wisp now mirrors exact inventory parameters and consumption, Nature preparation speed, fractional weapon damage-to-Spikes accumulation with mini activation, and armor socket GemPower-scaled max health with its mini activation.
- Added `scripts/sim-wisdom-puppy-smoke.mjs` and `scripts/sim-wisp-smoke.mjs`, updated the Wisp socket regression, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 491 / 519 verified item rows. Focused pair tests, Wisdom/Armored Wisdom and gem/socket regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 491 verified, 7 evidence-pending, 6 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 318 - in progress

- Codex owns the next retained Wolf Badge and Wolf Emblem fidelity review/repair, their focused source-backed regressions, simulator fidelity evidence entries and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-wolf-badge-smoke.mjs`, `scripts/sim-wolf-emblem-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 318 - complete

- Codex repaired Wolf Badge to mirror the extracted strict low-health threshold, named and placement-modified Battle Rage duration, owner-scoped Rage resistance/speed start and end signals, catalog cooldown targeting, event-time activation, and explicit zero-duration behavior. Wolf Emblem now mirrors source `onPrepare` primary `canBeEmpowered` crit aura plus secondary Pet scaling, reads the actor’s actual Block field, preserves exact threshold/Empower/Block values, applies item buff power through the shared grant path, uses owner-correct effect events, and activates after the source effect.
- Added `scripts/sim-wolf-badge-smoke.mjs` and `scripts/sim-wolf-emblem-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 493 / 519 verified item rows. Focused Wolf Badge/Emblem tests, Band Y and Berserker Rage regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 493 verified, 5 evidence-pending, 6 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 319 - in progress

- Codex owns the next retained Wolpertinger and Wooden Buckler fidelity review/repair, their focused source-backed regressions and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-wolpertinger-smoke.mjs`, `scripts/sim-wooden-buckler-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 319 - complete

- Codex repaired Wolpertinger to mirror source `onPrepare` timing, count Pet-type affected items for speed, derive stamina-regeneration deltas from the actor's base regeneration, apply both gains and spends, truncate the source integer least-buff count, preserve explicit zero values, and log effects before activation. Wooden Buckler now registers through the inherited Shield preparation path, preserves explicit chance values, applies placement-modified `damblock`, uses source drain-up-to-available stamina semantics after melee blocks, and timestamps drain/activation events from the blocked hit. The shared damage pipeline now accepts a dynamic shield chance getter, and the parity audit recognizes `afterBlock` carried by Shield `onPrepare` registration. A missing `canBeEmpoweredPiece` import exposed by the neighboring Shepherd's Crook smoke was also repaired.
- Added `scripts/sim-wolpertinger-smoke.mjs` and `scripts/sim-wooden-buckler-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 497 / 519 verified item rows. Focused pair tests, the neighboring pet/shield regressions, Moon/Heart Shield checks, changed-module syntax, source parity audit, coverage checks, and generated artifact freshness checks pass. The generated summary reports 497 verified, 3 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 320 - in progress

- Codex owns the next retained Wooden Sword and Wrench fidelity review/repair, their focused source-backed regressions and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, `scripts/sim-wooden-sword-smoke.mjs`, `scripts/sim-wrench-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 320 - complete

- Codex verified Wooden Sword against its extracted stamina-gated `Item` sequence and retained the shared Weapon strike path, including successful stamina spend/damage/activation, starvation without damage or activation, and explicit zero-cost behavior. Wrench now mirrors source hit-only first-valid Primary/Secondary target selection, filters targets by the source color rules, applies modified Chance and Chance2 values with explicit zero support, and no longer emits a simulator-only info event.
- Added `scripts/sim-wooden-sword-smoke.mjs` and `scripts/sim-wrench-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 499 / 519 verified item rows. Focused pair tests, neighboring weapon/on-hit regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 499 verified, 1 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 321 - in progress

- Codex owns the final retained Yggdrasil Leaf fidelity review/repair, its focused source-backed regression and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port module, `scripts/sim-yggdrasil-leaf-smoke.mjs`, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 321 - complete

- Codex repaired Yggdrasil Leaf to mirror source Nature-only targeting, start Mana and Regeneration grants through the buff-power-aware path, truncated integer Mana threshold accumulation, modified `getP_m("heal")`, random debuff cleansing, owner-correct triggered heal projection, effect-before-activation ordering, and explicit zero values.
- Added `scripts/sim-yggdrasil-leaf-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 500 / 519 verified item rows. Focused Yggdrasil and related Nature/aura regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 500 verified, 0 evidence-pending, 4 confirmed gaps, and 15 no-independent-combat rows. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 322 - in progress

- Codex owns the next remaining confirmed-gap review, starting with Chess Board and Stone, their source-backed regressions and generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the relevant simulator port modules, focused smoke scripts for the two items, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 322 - complete

- Codex repaired Stone’s final-ammo consume projection and verified its source stamina gate, late P1 Block removal, starvation preservation, and explicit zero values. Stone Golem now runs its source bonus-damage work in `onPreCombatStart`, grants Empower from the early damage hook, preserves exact zero Block/cooldown/Empower/stun values, and passes RNG to the source stun path. The existing harness regression now invokes the required prepare lifecycle before the pre-combat hook.
- Added `scripts/sim-stone-smoke.mjs` and `scripts/sim-stone-golem-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 502 / 519 verified item rows. Focused Stone, Stone Golem, Bag of Stones, and Stoned regressions, changed-module syntax, source parity audit, and generated artifact freshness checks pass. The generated summary reports 502 verified, 0 evidence-pending, 2 confirmed gaps, and 15 no-independent-combat rows. The full legacy harness still reports its pre-existing unrelated fixture/socket/claim failures after the Stone Golem unit check. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 323 - in progress

- Codex owns the next remaining confirmed-gap review, Chess Board’s supported-mode boundary and its source-backed audit evidence, focused regression, generated audit artifacts, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Planned paths are limited to the Chess Board simulator handler/tests, `scripts/build-sim-fidelity-ledger.mjs`, the generated simulator audit JSON files, `docs/todo.md`, and `docs/CODEX_HANDOFF.md`. Cursor does not own these paths.

### 2026-10-17 Simulator item parity continuation 323 - complete

- Codex repaired Chess Board's supported simulator mode to mirror source turn order, legal movement, occupancy updates, opposite-color captures, Chess Master price selection, blocked-line behavior, and capture/elimination effect ordering. The legacy chess dispatch API remains unchanged for existing callers.
- Added `scripts/sim-chess-board-smoke.mjs`, attached source-backed evidence, updated parity/no-op/system-surface audits, regenerated the simulator artifacts, and updated `docs/todo.md` to 503 / 519 verified item rows at this checkpoint. Focused Chess Board, chess call-path, Chess Master, AG/Wave D/no-op/coverage checks, changed-module syntax, and generated artifact freshness checks pass. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 324 - complete

- Codex repaired Winged Boots to mirror the extracted strict health threshold, High+2 listener priority, `character_damaged` registration, exact integer Empower/Cleanse/Dodge values including explicit zeros, one-shot consumption metadata, and source-compatible Dodge clamping.
- Added `scripts/sim-winged-boots-smoke.mjs`, attached source-backed evidence, regenerated the ledger/dashboard/public summary, and updated `docs/todo.md` to 504 / 519 verified item rows. The generated summary reports 504 verified, 0 confirmed gaps, 0 evidence-pending, and 15 no-independent-combat rows. Focused Winged Boots, Chess Board/chess call-path, related audit checks, changed-module syntax, and generated artifact freshness checks pass. The full legacy harness still has pre-existing unrelated fixture/socket/claim failures. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 325 - in progress

- Codex has no remaining retained independent-combat item gaps; the next review is the 15 no-independent-combat rows or another user-directed item/mechanic. Codex owns the simulator parity files, focused smoke tests, generated audit artifacts, `docs/todo.md`, and this handoff for that review. Cursor does not own these paths.
### 2026-10-17 Simulator item parity continuation 325 - complete

- Reviewed the remaining 15 public `no_independent_combat` rows against the extracted sources. They are correctly classified as shop-only/currency/generic-bag entries or ChessPiece records whose movement and combat effects are owned by Chess Board; no standalone simulator item implementation is missing.
- Fresh no-combat source audit, Chess Board regression, Winged Boots regression, fidelity-ledger freshness, and dashboard/summary freshness checks all pass. No product files changed in this review; no legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator item parity continuation 326 - in progress

- All retained source-backed independent-combat item rows are verified or correctly classified; the next step is another user-directed item/mechanic or a new source extract. Codex owns the simulator audit paths and this handoff for that review. Cursor does not own these paths.
### 2026-10-17 Simulator mechanic parity continuation 326 - complete

- Codex repaired the shared Character status helpers to match the extracted game behavior: active invulnerability adds the new duration to remaining time and emits each start event, stun uses a per-character BalancedRng and preserves zero-duration stun events, and Battle Rage applies bonus duration, resets on restart, emits every start, and exposes explicit end handling.
- Added `scripts/sim-character-status-smoke.mjs`, marked `character-status` implemented in the source-surface audit, regenerated the system-surface/dashboard artifacts, and ran the focused status, lifecycle, stun, invulnerability, Rage-neighbor, syntax, and freshness checks. Current item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 327 - in progress

- Codex owns the next shared mechanic review from the 19 remaining partial system-surface rows, beginning with the next source-backed state/timing boundary. Cursor does not own these paths.

### 2026-10-17 Simulator mechanic parity continuation 327 - complete

- Codex repaired the Character/Buff stack contract against the extracted source: permanent and timed stacks now retain independent accounting, losses clamp to available stacks, use-losses remove permanent then farthest-expiry temporary stacks, temporary reflections retain duration, debuff reflection precedes Character debuff-resist pools, per-stack one-use resistance is modeled, and non-used buff losses consume source Buff Protect stacks while keeping the legacy simulator alias synchronized.
- Corrected socketed Burning Coal to grant source one-use Cold resistance stacks instead of percentage Cold resistance. Added `scripts/sim-character-stacks-smoke.mjs`, marked `character-stacks` implemented in the source-surface audit, regenerated the system-surface/dashboard/public summary, and ran focused stack, temporary-stack, protection, buff, item, syntax, and freshness checks. Current item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat; shared mechanic totals are 3 implemented and 18 partial. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 328 - in progress

- Codex owns the next partial shared surface, `buff-object`, for source-backed timeout, reset, protection, and cleanup review. Planned paths are limited to the shared stack engine, focused stack/buff regressions, generated simulator audit artifacts, and this handoff. Cursor does not own these paths.

### 2026-10-17 Simulator mechanic parity continuation 328 - complete

- Codex completed the Buff-object parity pass: timed entries now expire in source earliest-time order even when granted out of order, exact-boundary timers expire once, combat-end cleanup clears temporary metadata without fabricating a second stack loss, and reflection chance is per stack type with the legacy actor-wide fallback preserved.
- Added `scripts/sim-buff-object-smoke.mjs`, marked `buff-object` implemented in the source-surface audit, regenerated the system-surface/dashboard/public summary, and reran the Character stack, temporary-stack, protection, Magic Mirror, lifecycle, syntax, and freshness checks. Shared mechanic totals are now 4 implemented and 17 partial; item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 329 - in progress

- Codex owns the next partial shared surface, `combat-event`, for source-backed event initialization, targeting, parameter, depth, and text-contract review. Planned paths are limited to the simulator event/log modules, a focused source regression, generated simulator audit artifacts, and this handoff. Cursor does not own these paths.

### 2026-10-17 Simulator mechanic parity continuation 329 - complete

- Codex completed the CombatEvent contract pass: canonical projections now expose source-like parameters and format parameters, preserve combat effect flags, resolve item ownership before actor fallback, distinguish system origins from triggering items, expose the source main actor, and retain causal id/root/depth/target/phase data for every projection boundary.
- Extended `scripts/sim-event-contract-smoke.mjs` with a direct `CombatEvent.gd` method audit plus parameter, origin, actor, log, meter, HUD, scrubber, and export assertions. Marked `combat-event` implemented in the source-surface audit and regenerated the system-surface/dashboard/public summary. Shared mechanic totals are now 5 implemented and 16 partial; item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 330 - in progress

- Codex owns the next partial shared surface, `combat-log`, for source-backed event creation/logging, snapshot projection, and presentation-order review. Planned paths are limited to simulator log/export/meter modules, a focused source regression, generated simulator audit artifacts, and this handoff. Cursor does not own these paths.

### 2026-10-17 Simulator mechanic parity continuation 330 - complete

- Codex completed the CombatLog parity pass: raw engine events now receive unique source-like identities and monotonic event numbers at creation, the simulator retains character and item snapshot samples through the capped fight end, and the short-duration-before-combat-delay edge case now keeps its final snapshot instead of trimming it away.
- Added `scripts/sim-combat-log-smoke.mjs`, marked `combat-log` implemented in the source-surface audit, regenerated the system-surface/dashboard/public summary, and reran the CombatLog/CombatEvent contract, stack, lifecycle, parity, syntax, and freshness checks. Shared mechanic totals are now 6 implemented and 15 partial; item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 331 - in progress

- Codex owns the next partial shared surface, `combat-snapshot`, for source-backed snapshot initialization, application, and scrub/replay state review. Planned paths are limited to simulator snapshots/HUD/scrubber modules, a focused source regression, generated simulator audit artifacts, and this handoff. Cursor does not own these paths.

### 2026-10-17 Simulator mechanic parity continuation 331 - complete

- Codex verified the CombatSnapshot contract: source health, stamina, stack, and damage-meter state are retained by simulator actor/item timelines; scrub selection uses the latest state at or before the playhead, same-time updates replace earlier state, and capped fights retain their final snapshot even when the duration is shorter than the combat delay.
- Added `scripts/sim-combat-snapshot-smoke.mjs`, marked `combat-snapshot` implemented in the source-surface audit, regenerated the system-surface/dashboard/public summary, and reran snapshot, CombatLog, CombatEvent, stack, parity, syntax, and freshness checks. Shared mechanic totals remain 7 implemented and 14 partial; item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 332 - in progress

- Codex owns the next partial shared surface, `combat-stat-logger`, for source-backed character/stack/item metric histories and current simulator meter/report projections. Planned paths are limited to simulator metric/report modules, a focused source regression, generated simulator audit artifacts, and this handoff. Cursor does not own these paths.

### 2026-10-17 Simulator mechanic parity continuation 332 - complete

- Codex completed the CombatStatLogger parity pass: character, stack, item, and system histories are represented by cumulative event-time meter sources and status reports, and system-origin Poison/Vampirism now receives the correct source kind instead of falling through to generic dummy damage or generic healing.
- Added `scripts/sim-combat-stat-logger-smoke.mjs`, marked `combat-stat-logger` implemented in the source-surface audit, regenerated the system-surface/dashboard/public summary, and reran the stat/logger, legacy log, snapshot, CombatLog, CombatEvent, stack, parity, syntax, and freshness checks. Shared mechanic totals are now 8 implemented and 13 partial; item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 333 - in progress

- Codex owns the next partial shared surface, `combat-timer`, for source-backed combat clock, fatigue start/tick, and time-advance semantics. Planned paths are limited to simulator combat-time/fatigue/timing modules, a focused source regression, generated simulator audit artifacts, and this handoff. Cursor does not own these paths.

### 2026-10-17 Simulator mechanic parity continuation 333 - complete

- Codex completed the CombatTimer parity pass: the simulator now matches the extracted 14-second fatigue warning, 17-second first damage, one-second subsequent ticks, counter escalation, Power of the Moon threshold advance, and the three-second first-tick delay when `advanceTime` crosses a live threshold. `fatigue_start` is projected at the first damage tick, matching `dealFatigueDamage`.
- Added `scripts/sim-combat-timer-smoke.mjs`, marked `combat-timer` implemented in the source-surface audit, regenerated the scheduler/audit/dashboard/public artifacts, and ran focused timer, scheduler, Power of the Moon, syntax, and freshness checks. Shared mechanic totals are now 9 implemented and 12 partial; item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 334 - in progress

- Codex owns the next partial shared surface, `item-lifecycle`, for source-backed prepare/pre-combat/combat-start/trigger/cooldown/cleanup ordering review. Planned paths are limited to simulator lifecycle/cooldown modules, a focused source regression, generated simulator audit artifacts, and this handoff. Cursor does not own these paths.

### 2026-10-17 Simulator mechanic parity continuation 334 - complete

- Codex repaired the Item lifecycle trigger order: cooldown advancement now rearms the next iteration before invoking the cooldown effect, matching `Item.trigger()` and preserving source-visible self-cooldown state. Existing prepare/socket/pre-start/start/post-start tracing, consumable one-shot handling, and `onAfterEffectFinished` lock/cleanup remain covered.
- Extended `scripts/sim-lifecycle-smoke.mjs` with direct source-order and rearmed-trigger assertions, marked `item-lifecycle` implemented in the source-surface audit, regenerated the system-surface/dashboard/public summary, and ran lifecycle, CD-then-consume, Lightning Potion, Dark Ritual, broad parity, syntax, and freshness checks. Shared mechanic totals are now 10 implemented and 11 partial; item totals remain 504 verified 1:1, 0 gaps, 0 evidence pending, and 15 no-independent-combat. No legal, authentication, database, storage, or security behavior changed.

### 2026-10-17 Simulator mechanic parity continuation 335 - in progress

- Codex owns the next partial shared surface, `item-effects`, for source-backed block/stack/random-buff/debuff/charge helper coverage and event-order review. Planned paths are limited to simulator effect/stack/charge modules, a focused regression, generated simulator audit artifacts, and this handoff. Cursor does not own these paths.
