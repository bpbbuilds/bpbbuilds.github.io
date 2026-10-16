# Build-view simulator design

## Goal

Give `/builds/view/` a paused, single-build combat preview. A visitor can
press Play, watch the viewed board use the simulator's item effects and visual
states, pause it, or scrub through at most 20 seconds. The right rail can also
show simulator-derived Build Stats; exact values are a Premium-only UI
feature, while free visitors see a changing obfuscated preview and an upgrade
path.

## Evidence and existing seams

The implementation should reuse these existing boundaries rather than create
a second combat model:

- `js/pages/sim/engine/index.js` / `runSim()` already returns deterministic
  `SimRun` events, actor snapshots, and per-placement snapshots.
- `js/pages/sim/engine/simulate.js` already supports a fixed dummy with
  `dummyAttacks: false`; this is the target sink required for a one-board run,
  not a claim that the preview is PvP.
- `js/pages/sim/controls/sim-scrubber.js` already maps engine time to the
  game's visible combat clock and has Play/Pause, range seeking, and event
  callbacks.
- `js/pages/sim/fx/sim-fx.js` already synchronizes item activation clips,
  cooldown art, charge paths, consumed potions, item labels, and visual-state
  snapshots. The Build view can pass no-op actor HUD adapters because it has no
  opponent or fighter HUD.
- `js/pages/build/round-scrubber.js` already changes the displayed board by
  frame. A preview run must be rebuilt when the selected Build-view round
  changes and disposed when video is shown.
- `js/shared/entitlements.js` and `js/shared/premium-offer.js` already define
  the site's Premium access check and upgrade dialog.

## Product behavior

### Preview timeline

- The preview is mounted only on `/builds/view/`, directly above the viewed
  board and below the build title/tags.
- It is paused at 0.0 seconds on first paint. There is no autoplay.
- Play and Pause share one control. The existing game-style simulator
  scrubber is reused for the visible timeline and range input.
- The visible combat clock is 0.0–20.0 seconds. The engine may end earlier if
  the player dies; the UI then stops at the actual end time.
- A fixed inert dummy receives effects/damage so existing item handlers can run.
  It never attacks, has no displayed board, and is not presented as an
  opponent.
- The preview uses the currently displayed published board or selected history
  round. Changing rounds resets the preview to paused 0.0 seconds for the new
  board. Showing an attached video hides/disposes the preview until a board is
  selected again.
- Scrubbing is a seek operation: it updates item art, cooldown overlays,
  consumption, and state snapshots without requiring playback.
- Reduced-motion users still receive state changes and the scrubber, but CSS
  animation is suppressed by the existing simulator animation rules.

### Build Stats tab

- The Build Info rail header becomes a two-tab control: `Build Info` and
  `Build Stats`.
- The selected title remains centered; the inactive title sits to its side at
  reduced opacity. Both tabs are keyboard reachable and expose correct
  `role="tab"`, `aria-selected`, and `aria-controls` state.
- Build Info content is unchanged when selected.
- Build Stats shows, at the current playhead:
  - Build Score (explicitly labeled as a provisional simulator score).
  - DPS: player damage dealt to the inert dummy per elapsed combat second.
  - HPS: effective healing applied to the player per elapsed combat second.
  - Max HP/s: maximum-health gains per elapsed combat second.
  - BPS: positive Block gained per elapsed combat second.
  - Buff stacks currently active on the player.
  - Debuff stacks currently active on the inert dummy.
- Values are zero at 0.0 seconds and update from the scrubber/clock. Rates use
  elapsed visible combat time, never the 2.5-second engine startup delay.
- Initial score formula for this feature is deliberately provisional:
  `score = (DPS × 0.50) + (HPS × 0.30) + (BPS × 0.20)`. It is not a global
  build ranking and must be labeled as simulator-derived.

### Premium presentation

- The preview animation and scrubber are available to everyone.
- Premium/founding/owner viewers see the exact Build Stats values.
- Free viewers can open the tab, but the value cells contain only obfuscated
  glyphs. The glyph string changes on a short deterministic timer while the
  tab is visible, with an accessible `Premium stats locked` label that is not
  obfuscated.
- The panel includes `Become a Premium member to unlock Build Stats` and
  opens the existing shared Premium offer when activated.
- This is a client-side presentation gate over public, simulator-derived
  calculations; it must not be described as a server authorization boundary.
  If the product later requires stats to be secret, that is a separate server-
  protected feature and not part of this implementation.

## Scope boundaries

- Do not create a second combat engine or copy simulator item handlers.
- Do not add an opponent board, dummy attacks, PvP claims, or a full Sim page
  log/HUD to Build view.
- Do not change the simulator's combat math or its existing 30-second default.
  The Build view supplies its own 20-second preview duration.
- Do not add a new font asset for the Minecraft-style obfuscation. Use
  changing glyph text/CSS treatment with a normal local fallback so licensing,
  loading, and mobile performance stay predictable.
- Do not modify authentication, payments, storage, RLS, or legal copy.

## Acceptance criteria

1. A Build-view board renders a paused preview control above the board; no item
   animation or clock advancement occurs until Play is pressed.
2. Play/Pause and range seeking drive the same board FX/state seams used by the
   simulator, and the range never exceeds 20.0 visible seconds.
3. Preview runs contain no dummy attack events and no opponent board, while
   item damage/effect handlers still receive the inert dummy target.
4. Switching history rounds rebuilds the run, resets time, and never leaves FX
   or stats from the previous frame attached.
5. Premium access reveals exact score/DPS/HPS/Max HP/s/BPS/buff/debuff values;
   free access shows changing obfuscated cells plus the shared upgrade action.
6. Stats are derived from the current playhead and use explicit, tested event
   filters; 0.0 seconds has no divide-by-zero output.
7. The tab is accessible and responsive at 1440p, 1080p/short desktop,
   narrow desktop/tablet, and mobile without horizontal page overflow.
8. Existing Build view round/video behavior, simulator behavior, and tooltip
   behavior remain unchanged outside the new preview surface.
