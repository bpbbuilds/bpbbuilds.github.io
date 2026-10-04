# Codex handoff

Codex writes this file only. Cursor writes [`CURSOR_HANDOFF.md`](CURSOR_HANDOFF.md). Read **both** before starting. Do not edit the other handoff. Do not invent progress. Label new ideas **Proposal** until measured or approved.

Shared instructions stay in root [`AGENTS.md`](../AGENTS.md). Only one assistant edits that file at a time.

## Owned paths

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
