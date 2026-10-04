# Simulator fidelity rules

The `/sim/` page is a behavioral reproduction project. The target is the live
game's combat engine and Combat Log, not a plausible-looking outcome. Never
describe a port, fixture, coverage percentage, or UI result as 1:1 unless it
has evidence from the game extract and the applicable regression coverage.

## Source of truth

Use sources in this order whenever changing combat behavior, timing, logging,
or meters:

1. `tools/game-extract-full/Items/**/*.gd` for the exact item lifecycle and
   named parameters.
2. `tools/game-extract-full/Core/` for shared Character, Buff, damage,
   cooldown, event, and CombatLog behavior.
3. `tools/game-extract-full/Sheets/CSV/Interface.csv` for player-facing log
   wording and `scripts/_cache/game-items.json` for catalog parameters.
4. A live-game capture for behavior the extract cannot settle.
5. Existing simulator code, fixtures, and comments only as implementation
   evidence; they are never the authority over the game.

Read `docs/sim/sim-1to1-audit.md`, `docs/sim/sim-validation.md`, and
`docs/sim/sim-debug-protocol.md` before changing engine behavior. For an item
report, also open that item's `.gd` file and every shared core file it calls.
For every new or deepened item port, follow
[`docs/sim/sim-item-porting.md`](../../../docs/sim/sim-item-porting.md) in
full. It is the required evidence, implementation, regression, ledger, and
handoff procedure; it exists specifically so a port task is safe to delegate.

## Implementation rules

- Port the whole lifecycle: prepare, pre-combat, combat-start, cooldown arm,
  trigger, pre-/post-damage hooks, consume/deactivate, and cleanup. Do not
  replace a specific script with a generic cooldown effect just to make an
  item appear covered.
- Preserve order as data. An event needs its origin, side, item placement,
  time, and parent/cause where it reacts to another event. The source event
  must be emitted before listener consequences; never hard-code ordering for
  one item, seed, board, or screenshot.
- State changes that are visible in the game must also emit the matching
  `SimEvent`, so the Combat Log, Damage Meter, HUD, export, and scrubber agree.
  Use shared stack/damage/event helpers rather than mutating actor fields from
  a port.
- Match the game pathway, not only the final number: weapon damage, effect
  damage, block removal, vampirism, temporary stacks, and consume/activation
  have different log and meter semantics.
- Keep player/opponent symmetry. A fix must work for both sides unless the GD
  script explicitly restricts it.
- Do not remove `paramChecks`, `ui.mismatches`, or widen expected fixture bands
  to make a report pass. A clean report is evidence only when its game source
  and fixture/capture support it.
- Do not treat a handler registration, a green syntax check, or a plausible
  end-HP total as a completed port. A port remains incomplete until its source
  lifecycle, state/reset behavior, both-side path, event/UI projections, and
  focused regression have been verified.
- Keep combat state per placement (`piece`) or per correct-side actor. Never
  use module-global state for an item or merge distinct copies by catalog id.
- If an item calls a game operation that has no clearly matching shared helper,
  stop and record a shared-engine gap instead of approximating it in one port.

## Required evidence

For every simulator behavior fix:

1. Record the game source path and relevant hook/parameter in the change or
   in `docs/sim/sim-validation.md`.
2. Add or update a focused regression that proves state, event order, log
   sentence, and meter/HUD impact as applicable. Reproduce the supplied saved
   build and seed when one exists.
3. Run `node --check` on changed modules and the narrowest relevant smoke
   script. Combat-log changes require `npm run sim-log-smoke`; engine changes
   should also run the relevant family/system smoke.
4. Run source audits when a port is added or deepened:
   `node scripts/audit-sim-gd-parity.mjs` and
   `node scripts/audit-sim-gd-calls.mjs`. Their results are leads for review,
   not automatic proof of a bug.
5. Do not run artifact-writing full harnesses casually. If `sim-harness` or a
   fixture generator changes baseline files, inspect and stage only intended
   outputs; never overwrite a baseline just to pass.
6. Run `node scripts/sim-continuous-audit.mjs --check --family <relevant-smoke>`
   after the focused regression. Run the fixture mode when modifying the
   harness or fixture data. Regenerate/check the fidelity ledger when an item's
   source or completeness status changes.

## Honesty and maintenance

- Keep known gaps current in `docs/sim/sim-validation.md`; add a ticketed gap
  rather than silently approximating it.
- The dummy is not a live PvP opponent. Follow the live-capture protocol for
  player-vs-player claims, and retain the fixed-dummy distinction in all
  fixture documentation.
- Do not market or label the engine as fully 1:1 until the explicit claim
  gates in `docs/sim/sim-validation.md` and `docs/sim/sim-ip-marketing.md`
  are met.
