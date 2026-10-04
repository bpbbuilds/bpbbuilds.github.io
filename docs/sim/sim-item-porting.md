# Simulator item-porting runbook

Use this runbook for every new or deepened `/sim/` item port. It is designed
to make a small, well-scoped port safe to hand to an agent that does not yet
know the combat engine. A port is complete only when its game behavior,
simulator state, events, and regression evidence agree. Registering a handler
or producing a plausible final HP number is never enough.

## Non-negotiable rules

1. Work **one item or one source-proven, tightly related family** at a time.
   Do not use a backlog wave as permission to rewrite an entire port module.
2. The game extract is the authority. Read the item's `.gd` file and every
   called shared `Core/` implementation before editing JavaScript.
3. If the source path, inheritance, parameter meaning, lifecycle, or target
   selection is uncertain, stop. Leave the row `source_unresolved` or record
   the uncertainty in [`sim-validation.md`](sim-validation.md); do not invent
   a behavior from a tooltip, item name, or another port.
4. Use the engine's shared helpers for damage, stacks, cooldowns, consumes,
   targeting, events, and RNG. Do not directly mutate actor state when a
   helper exists, and do not add an item-specific log-order exception.
5. Preserve player/opponent symmetry, per-placement state, source placement,
   causal parent/root/depth, and timestamp ordering.
6. Never weaken an audit, delete `paramChecks`/`ui.mismatches`, widen a
   fixture band, or relabel a ledger row merely to obtain green output.

## Required preflight

Before changing a port, read:

- [`js/pages/sim/AGENTS.md`](../../js/pages/sim/AGENTS.md)
- [`sim-1to1-audit.md`](sim-1to1-audit.md)
- [`sim-combat-lifecycle.md`](sim-combat-lifecycle.md)
- [`sim-event-contract.md`](sim-event-contract.md)
- [`sim-validation.md`](sim-validation.md)
- the exact item source under `tools/game-extract-full/Items/`

Then make an item dossier in the task/PR description. It must name:

| Required fact | Evidence to record |
|---|---|
| Catalog ID and source path | Item id plus exact `.gd` path and any `extends` chain |
| Parameters | Every `getP*`/named parameter, units, fallback, and catalog value |
| Lifecycle | Every relevant `onPrepare`, pre/start/post-combat, cooldown, trigger, pre-/post-damage, consume, and cleanup hook in source order |
| Targets | Self, enemy, linked/affected cells, sockets, left/line cells, and target-selection/randomness rules |
| State | Per-item versus per-actor values, reset/re-arm/expire behavior, and both-side implications |
| User-visible output | Required Combat Log sentence/event type, meter category, HUD/snapshot field, export fields |
| Evidence plan | Focused regression plus the applicable family smoke; live capture if source/dummy cannot settle it |

Do not begin implementation until the dossier is complete. A tooltip may help
find source, but it is not evidence for timing or mechanics.

## Implementation procedure

1. **Locate the narrow owner module.** Follow the existing family boundaries
   in `js/pages/sim/engine/scripts/`. Put a dedicated handler in the matching
   small module; create a new focused module only when the behavior has no
   clear owner. Do not add a second registration for an existing id.
2. **Check the registry before and after editing.** `ports.js` imports the
   family maps. The catalog id must resolve exactly once at runtime. Never
   leave a registry reference to an undefined export, and never replace a
   complete module with a partial rewrite while adding one item.
3. **Map source operations to shared helpers.** For example, use the damage
   path for weapon/effect damage, buff/stack helpers for gain/spend and their
   listeners, cooldown helpers for arm/deactivate, board-graph helpers for
   geometry, and the seeded RNG helpers for rolls. If a required source
   operation has no equivalent helper, treat that as a shared-engine gap and
   write a focused helper plus a system regression before porting the item.
4. **Keep state on the correct object.** Item-local state belongs on `piece`
   and must initialize/reset in the source-equivalent phase. Actor-wide state
   belongs on the correct side's actor. Never use a module global for combat
   state, and never key copies by item id when placement identity is required.
5. **Emit the complete event path.** A visible change must enter the canonical
   event contract with source item/placement, actor/target side, time, and
   causal relationship. The action event must precede its reactions. Event
   order comes from the shared engine/cause chain, not a hard-coded item or
   seed ordering rule.
6. **Handle both boards.** Test the item on the player and opponent board.
   Use `ctx.player`, `ctx.dummy`, `eventFoeSide`, and board graph helpers as
   intended; do not assume the player is always the acting side.
7. **Keep an honest status.** A handler that only covers one hook or omits
   source behavior remains incomplete. Do not check it off in the backlog
   until the completion criteria below are met.

## Minimum regression standard

Add a narrow smoke/fixture that proves the source behavior, not just function
existence. It should assert, where applicable:

- source lifecycle order and initialization/reset;
- parameter values and units;
- player and opponent paths;
- target geometry/selection and deterministic seeded RNG;
- state change and expiration/consume/deactivate behavior;
- causal event order and exact event metadata;
- Combat Log sentence/category, meter attribution, HUD snapshot, and export.

Run all of the following after the focused test passes:

```powershell
node --check <each changed .js module>
node scripts/audit-sim-gd-parity.mjs --require-triage
node scripts/audit-sim-gd-calls.mjs
node scripts/sim-continuous-audit.mjs --check --family <relevant-smoke-stem>
```

Use the actual family script name without `scripts/` or `.mjs`, for example
`sim-wave-d-smoke`. If the change touches fixtures or the harness, also run:

```powershell
node scripts/sim-continuous-audit.mjs --check --fixtures
```

The fixture-inclusive gate may expose existing open evidence failures. Report
them; do not change fixture expectations unless independently justified by
game source and retained evidence.

## Ledger and backlog protocol

The generated ledger is the status authority:

```powershell
node scripts/build-sim-fidelity-ledger.mjs
node scripts/build-sim-fidelity-ledger.mjs --check
```

- Do not manually mark a backlog checkbox complete because a handler exists.
- A row can move from `source_unresolved` only after its source/inheritance is
  recorded and reviewed.
- A row can leave `port_present_incomplete` only after all source hooks,
  shared behavior, focused regression, and required UI projections are
  covered. Retain any remaining uncertainty in `sim-validation.md`.
- Regenerate the backlog only from the ledger. Verify its count against the
  ledger; the three priority references may duplicate rows and are not extra
  backlog work.

## Stop conditions and escalation

Stop and report instead of guessing when any of these occur:

- no exact source mapping or an unclear inheritance/base behavior;
- a source call has no simulator helper or has ambiguous semantics;
- player and opponent results differ without a source-side reason;
- the port requires changing scheduler, RNG, event contract, targeting, or
  shared character semantics beyond the item task;
- source, fixture, and live capture conflict;
- the audit reports an undefined export, duplicate registration, or new
  unexplained hook/call discrepancy.

Create a named shared-engine follow-up, keep the item incomplete, and include
the source path, minimal reproduction, expected behavior, actual behavior,
and affected UI surfaces. This is a correct outcome; an invented port is not.

## Handoff template

Every item-port handoff must include:

```text
ITEM:
SOURCE + INHERITANCE:
HOOKS / PARAMETERS:
TARGETING / RNG:
STATE + RESET:
EVENT / LOG / METER / HUD:
PLAYER + OPPONENT PROOF:
TESTS RUN:
LEDGER STATUS:
OPEN UNCERTAINTY / FOLLOW-UP:
```

Do not claim “1:1,” “complete,” or “ported” without filling every field with
evidence. Use “partial” or “incomplete” when any requirement remains open.
