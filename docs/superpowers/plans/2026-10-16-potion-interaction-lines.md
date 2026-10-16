# Potion Interaction Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the game’s potion-to-potion connector on live backpack boards and on flattened board stills whenever a potion’s primary affected cell contains another potion.

**Architecture:** Add a DOM-free shared geometry module that reproduces the extracted game rule and returns directed potion links. The pooled board renderer will paint those links into the existing SVG layer with a low-cost CSS pulse, while the board-still canvas painter will draw the same links statically before potion sprites so the endpoints remain covered like the game. Cache/version and responsive smoke coverage will keep the live and flattened paths aligned.

**Tech Stack:** Vanilla ES modules, shared backpack-grid renderer, SVG/CSS, Canvas 2D, Node smoke tests.

**Spec:** User request in the current conversation; extracted game source at `tools/game-extract-full/Items/Potion.gd` and `tools/game-extract-full/Items/Animations/PotionConnector.gd`.

## Global Constraints

- Treat the feature as cosmetic only; it must not mutate placements, item state, simulator state, or history data.
- Match the game rule: a potion affects only the potion occupying its primary affected cell directly above it, with face rotation respected.
- Keep flattened board stills static and allow live boards to use CSS animation, disabled for `prefers-reduced-motion`.
- Keep the connector layer pointer-transparent; static strokes sit below item sprites while live SVG connectors use a non-interactive overlay so the connection remains visible.
- Preserve responsive behavior at 1440px, 1080px/short desktop, tablet/narrow desktop, and mobile.
- Do not change screenshot-import assets, auth, storage, or legal-page behavior.

## Review Focus

- Rotated and multi-cell potions must resolve the same affected cell as the extracted game rule.
- Nearby potions with a gap or side-by-side placement must not receive a false connector.
- Duplicate placement keys/IDs in history and simulator boards must keep links tied to placement instances.
- Empty, missing, or parked pooled entries must clear stale SVG links on repaint.
- Reduced-motion users and static board stills must never receive a CSS animation.

### Task 1: Shared potion-link geometry

**Files:**
- Create: `js/shared/potion-links.js`
- Test: `scripts/potion-interaction-lines-smoke.mjs`

**Interfaces:**
- Consumes: item shape/rotation data and explicit placements from the existing shared `shape.js` contract.
- Produces: `potionInteractionPairs(placements, itemsById)` returning directed `{ source, target, sourcePlacement, targetPlacement, sourceCell }` records for live and canvas painters.

- [x] **Step 1: Write the failing geometry smoke** covering direct vertical adjacency, no-gap/no-line cases, rotation, non-potion filtering, and duplicate placement instances.
- [x] **Step 2: Run `node scripts/potion-interaction-lines-smoke.mjs` and confirm it fails because the shared module is missing.
- [x] **Step 3: Implement the minimal pure geometry module using `shapeForItem`, rotated body order, and the extracted Potion primary-cell rule.
- [x] **Step 4: Run the smoke and confirm it passes.**

### Task 2: Live pooled-board connector layer

**Files:**
- Modify: `js/shared/backpack-grid/item-pool.js`
- Modify: `js/shared/backpack-grid/backpack-grid.css`
- Test: `scripts/potion-interaction-lines-smoke.mjs`

**Interfaces:**
- Consumes: `potionInteractionPairs` from Task 1 and the existing `.bpb-bg__lines` board layer.
- Produces: one SVG connector per active potion link, refreshed on every pooled paint and styled below item sprites.

- [x] **Step 1: Extend the smoke with static source checks for SVG layer creation, directed link attributes, pointer transparency, and reduced-motion animation rules.
- [x] **Step 2: Run the smoke and confirm the new live-board assertions fail.**
- [x] **Step 3: Add the SVG painter call after pooled placement/fabric synchronization and before the paint event, using grid-space paths so resize and face changes remain aligned.**
- [x] **Step 4: Add a subtle CSS dash/opacity pulse for live SVG links, with a reduced-motion override and no pointer interception.**
- [x] **Step 5: Run the focused smoke and existing backpack-grid syntax checks.**

### Task 3: Static board-still connectors

**Files:**
- Modify: `js/shared/board-still/paint.js`
- Modify: `js/shared/board-still/cache.js`
- Modify: `js/shared/board-still/index.js`
- Test: `scripts/potion-interaction-lines-smoke.mjs`

**Interfaces:**
- Consumes: Task 1’s directed link records and the existing board crop/translation geometry.
- Produces: static connector strokes in generated PNGs, with the cache key bumped for the new painter output.

- [x] **Step 1: Extend the smoke with source checks that static links are painted before item sprites and the still cache version changes.**
- [x] **Step 2: Run the smoke and confirm those assertions fail.**
- [x] **Step 3: Draw the shared links with a fixed game-like translucent blue/white treatment and no canvas animation.**
- [x] **Step 4: Bump the still cache key, bypass legacy baked stills when active potion links are known, and run the focused smoke plus board-still syntax checks.**

### Task 4: Responsive integration and handoff

**Files:**
- Modify: `create/index.html`, `sim/index.html`, `index.html`, and any other direct backpack-grid stylesheet links whose cache key is required by the repo’s page contract.
- Modify: `docs/todo.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Test: `scripts/potion-interaction-lines-smoke.mjs` and existing responsive board/home/sim smokes where available.

**Interfaces:**
- Consumes: Tasks 1–3’s shared live and static painter behavior.
- Produces: cache-busted pages, the requested todo completion, and an evidence-backed Codex handoff entry.

- [x] **Step 1: Extend the smoke to require page stylesheet cache invalidation and the completed todo entry.**
- [x] **Step 2: Run the smoke and confirm the integration assertions fail before the page/cache edits.**
- [x] **Step 3: Update only the necessary cache keys and mark the todo item complete after the implementation is verified.**
- [x] **Step 4: Run focused smokes, responsive browser checks at 1440/1080/768/390 where available, JS syntax checks, and `git diff --check`.**
- [x] **Step 5: Record owned paths, source evidence, verification results, and any deliberate visual exceptions in the Codex handoff.**

---
