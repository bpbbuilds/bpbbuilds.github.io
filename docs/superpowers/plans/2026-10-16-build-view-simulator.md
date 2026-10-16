# Build-view simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a paused, simulator-derived 20-second single-build preview and a Premium-gated Build Stats tab to `/builds/view/`.

**Architecture:** Build view will call the existing `runSim()` engine with an inert, non-attacking dummy, then reuse the existing simulator scrubber and FX modules on the one visible board. A pure stats adapter will aggregate the run's events/snapshots at the playhead, while a Build Stats panel owns tab state, Premium presentation, and obfuscation. The round scrubber remains the source of truth for which board frame is active; every frame change disposes and rebuilds the preview.

**Tech Stack:** Vanilla ES modules, existing simulator engine/scrubber/FX, existing `mountPlacedGrid`, CSS, Playwright/browser smoke scripts, Node smoke scripts.

**Spec:** `docs/superpowers/specs/2026-10-16-build-view-simulator-design.md`

## Global Constraints

- The visible combat clock is 0.0–20.0 seconds.
- It is paused at 0.0 seconds on first paint; there is no autoplay.
- The preview uses an inert dummy that never attacks and is not presented as a PvP opponent.
- Free viewers can use the preview, but exact Build Stats values are Premium-only and the free presentation uses changing obfuscated glyphs.
- The score is provisional: `score = (DPS × 0.50) + (HPS × 0.30) + (BPS × 0.20)`.
- Use the existing simulator engine and visual FX seams; do not duplicate item handlers or change the simulator's default duration/math.
- Keep the current published/round board behavior, video toggle behavior, tooltip behavior, and round scrubber semantics outside this feature.
- Verify 1440p, 1080p/short desktop, narrow desktop/tablet, and mobile; preserve no horizontal page overflow.
- Do not change screenshot-import paths, authentication/payment/storage/RLS behavior, or legal pages.

## Review Focus

- A board with no placements or a missing item map must show a safe empty preview state instead of throwing or leaving stale controls. Test in Task 3.
- A history round change and video step must dispose old FX/timers and reset the new run to paused 0.0 seconds. Test in Task 3.
- A self-damaging or early-ending board may stop before 20 seconds; stats must use the actual elapsed time and never divide by zero. Test in Task 1 and Task 3.
- Duplicate catalog IDs must remain separate by placement key for activation, stats, and snapshot lookup. Test in Task 1 and Task 2.
- Free, Premium, founding, owner, signed-out, and profile-load-pending states must not expose exact values in the locked DOM and must keep the upgrade action usable. Test in Task 4.
- Reduced-motion users must still receive scrubbed state changes without CSS playback animation. Test in Task 2 and Task 5.

---

### Task 1: Build preview run adapter and playhead stats

**Files:**
- Create: `js/pages/build/build-preview-sim.js`
- Create: `js/pages/build/build-preview-stats.js`
- Test: `scripts/build-view-preview-sim-smoke.mjs`

**Interfaces:**
- Consumes: Build-view placements/items and `runSim()` from `js/pages/sim/engine/index.js`.
- Produces: `BUILD_PREVIEW_SECONDS`, `createBuildPreviewRun({ placements, itemsById, round, seed }) -> SimRun`, and `buildPreviewStatsAt(run, engineTime) -> BuildPreviewStats`.

`createBuildPreviewRun` must call the engine with an engine duration of
`COMBAT_DELAY + BUILD_PREVIEW_SECONDS`, no opponent placements, and
`dummyAttacks: false`. Use a large finite dummy HP only as a target sink; do
not alter the shared engine default. The page supplies a deterministic seed
derived from the build slug and active round so a reload does not reshuffle
the preview unexpectedly.

`BuildPreviewStats` contains `elapsedSec`, `damage`, `damagePerSecond`,
`healing`, `healingPerSecond`, `maxHealthGained`, `maxHealthPerSecond`,
`block`, `blockPerSecond`, `score`, `activeBuffStacks`, and
`activeDebuffStacks`. Count only player→dummy damage for DPS, effective
player healing for HPS, max-health gain separately, positive player Block
grants for BPS, and current positive stack values from the player/dummy
snapshots for the two stack totals. Use the visible combat clock
(`engineTime - COMBAT_DELAY`) for the denominator and clamp it to zero.

- [ ] **Step 1: Write the failing smoke.**

  Cover the inert-dummy run options, the 22.5-second engine cap for a 20.0-
  second visible clock, no dummy attack events, duplicate placement keys, the
  event filters, monotonic cumulative values, early-end handling, and the
  provisional score formula.

- [ ] **Step 2: Run `node scripts/build-view-preview-sim-smoke.mjs` and confirm it fails** because the adapter modules do not exist.

- [ ] **Step 3: Implement `createBuildPreviewRun` and `buildPreviewStatsAt`.**

  Keep aggregation pure and keyed by `placementKey`; do not mutate the
  `SimRun`. Preserve the simulator's existing event semantics and use its
  snapshots for active-stack values rather than reconstructing temporary state
  from labels.

- [ ] **Step 4: Run the smoke and confirm it passes.**

- [ ] **Step 5: Commit the adapter and stats seam.**

### Task 2: Reuse simulator FX on a single Build-view board

**Files:**
- Create: `js/pages/build/build-preview-fx.js`
- Test: `scripts/build-view-preview-browser-smoke.mjs`

**Interfaces:**
- Consumes: Task 1's `SimRun`, the mounted Build-view board element, and
  `createSimFx()` from `js/pages/sim/fx/sim-fx.js`.
- Produces: `mountBuildPreviewFx({ boardEl, run, assetRoot }) -> { seek, flashEvent, scrubEvents, setRate, destroy }`.

Pass no-op actor HUD adapters to `createSimFx`; Build view has no displayed
fighter HUD or opponent column. Keep item animations, cooldown/consumption
art, charge paths, item labels, and visual-state snapshots enabled. Labels that
require a fighter field are disabled or safely ignored, and the FX module must
never create a second board.

- [ ] **Step 1: Extend the browser smoke with a fixture board** containing two
  duplicate catalog IDs under different placement keys and a synthetic run
  with activation, cooldown, consume, and state-snapshot events.

- [ ] **Step 2: Run the browser smoke and confirm it fails** because the
  Build-view FX adapter is missing.

- [ ] **Step 3: Implement the adapter** as a thin lifecycle wrapper around
  `createSimFx`; ensure `destroy()` clears timers, in-flight labels, and item
  classes before the host is reused.

- [ ] **Step 4: Run the browser smoke** with normal and
  `prefers-reduced-motion: reduce` contexts. Confirm item activation classes,
  consumed art, cooldown state, and cleanup are observable at the expected
  playhead times.

- [ ] **Step 5: Commit the FX adapter and regression.**

### Task 3: Mount the paused preview above the viewed board

**Files:**
- Modify: `js/pages/build/page.js`
- Modify: `js/pages/build/build.css`
- Modify: `builds/view/index.html`
- Test: `scripts/build-view-preview-browser-smoke.mjs`

**Interfaces:**
- Consumes: Tasks 1–2, `mountSimScrubber()` from
  `js/pages/sim/controls/sim-scrubber.js`, and the existing
  `mountRoundScrubber()` frame callbacks.
- Produces: a `build-preview` host immediately above `#build-media`, with a
  paused game-style scrubber and a board-bound preview lifecycle.

Add a small page-local `mountBuildPreview()` lifecycle in `page.js`. It must
build the current frame's run, mount FX, mount the existing scrubber with
`autoplay: false`, forward `onSeek`/`onEvent`/`onScrubEvents`/rate/play-state
callbacks, and expose cleanup. The round callback must update the board first,
then rebuild the preview from that frame; video steps must pause and hide it.
An empty board must render a disabled/empty state rather than a fake run.

Import or scope the existing simulator scrubber CSS in Build view and add
responsive preview spacing without changing the shared simulator layout. The
desktop composition scaling must include the preview controls; tablet/mobile
must remain single-column and overflow-free.

- [ ] **Step 1: Add failing browser assertions** for the preview host location,
  paused initial Play state, no time advancement before Play, Play→Pause
  transitions, 20.0-second maximum range, seek-driven FX, round reset, video
  cleanup, and empty-board handling at 2560×1440, 1920×1080, 1024px, and
  390px.

- [ ] **Step 2: Run `node scripts/build-view-preview-browser-smoke.mjs` and
  confirm it fails** before the Build-view mount exists.

- [ ] **Step 3: Add the host, lifecycle, round/video wiring, stylesheet/cache
  references, and responsive rules.**

- [ ] **Step 4: Run the browser smoke and confirm playback remains paused on
  load, advances only after Play, pauses without losing the playhead, and
  resets cleanly on frame changes.**

- [ ] **Step 5: Commit the Build-view preview surface.**

### Task 4: Add Build Stats tab, aggregation display, and Premium presentation

**Files:**
- Create: `js/pages/build/build-stats-panel.js`
- Modify: `js/pages/build/info-rail.js`
- Modify: `js/pages/build/build.css`
- Modify: `js/pages/build/page.js`
- Test: `scripts/build-view-stats-smoke.mjs`
- Test: `scripts/build-view-stats-browser-smoke.mjs`

**Interfaces:**
- Consumes: Task 1's `buildPreviewStatsAt`, the current preview playhead/run,
  `hasPremiumAccess()` from `js/shared/entitlements.js`, and
  `openUpgradeOffer()` from `js/shared/premium-offer.js`.
- Produces: `mountBuildStatsPanel(host, { run, profile, getEngineTime, root }) -> { setRun, setProfile, setTime, destroy }` plus accessible two-tab Build Info/Build Stats markup.

Render the two tabs in the existing Build Info header. Keep the selected title
centered with the inactive title beside it at reduced opacity. Keep Build Info
content intact and toggle only the panel visibility. The stats panel must
render the exact values for entitled profiles and a text-only obfuscation for
free/pending profiles. Use text nodes/escaped strings only; do not inject
untrusted build or profile values as HTML.

The obfuscation timer must be scoped to the stats panel, pause when the panel
is destroyed, and update on a short bucket (for example 700ms) so the glyphs
change without a per-frame timer. The locked cells must not contain raw metric
values in text, attributes, or `data-*` fields. The upgrade button uses the
existing shared Premium offer and must work for signed-out and signed-in free
profiles.

- [ ] **Step 1: Write the failing Node smoke** for stats-panel markup contracts,
  tab accessibility, exact metric labels, locked-state copy, obfuscation
  bucket behavior, and the premium CTA hook.

- [ ] **Step 2: Run `node scripts/build-view-stats-smoke.mjs` and confirm it
  fails** before the panel exists.

- [ ] **Step 3: Implement the panel and wire it to the preview's `onSeek`,
  frame rebuild, and profile resolution.** Start locked until the cached
  profile resolves, then rerender using `hasPremiumAccess(profile)`.

- [ ] **Step 4: Run the browser smoke** for free, Premium, founding, owner,
  signed-out, and pending-profile fixtures. Assert exact values are visible
  only for entitled fixtures; assert locked cells change glyph buckets and
  never reveal raw values. Verify tab keyboard/focus behavior and responsive
  layout.

- [ ] **Step 5: Commit the stats panel and Premium presentation.**

### Task 5: Full responsive verification and handoff

**Files:**
- Modify: `docs/todo.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Test: focused preview/stats/browser smokes plus existing Build-view
  responsive, pointer, round, tooltip, syntax, and `git diff --check` checks.

**Interfaces:**
- Consumes: Tasks 1–4's preview and stats contracts.
- Produces: cache-busted Build-view assets, a completed todo entry, and an
  evidence-backed Codex handoff.

- [ ] **Step 1: Add a browser assertion for the 1440p reference, 1080p/short
  desktop, narrow desktop/tablet, and mobile composition.** Confirm the
  preview controls remain above the board, the tabs remain usable, and there
  is no horizontal page overflow.

- [ ] **Step 2: Run the focused preview/stats smokes and existing Build-view
  regressions** (modular responsive, header layout, title spacing, pointer,
  round drag/wrap, tooltip placement/safe area, divider) plus changed-module
  `node --check`.

- [ ] **Step 3: Mark the todo item complete only after the browser checks pass,
  linking this plan/spec and recording any deliberate responsive exception.**

- [ ] **Step 4: Run `git diff --check`; inspect the diff for accidental
  changes to simulator defaults, Premium authorization, secrets, or unrelated
  dirty-worktree files.**

- [ ] **Step 5: Record source seams, tests, limitations, and owned paths in
  `docs/CODEX_HANDOFF.md`.**

---
