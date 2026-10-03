# Simulator near-1:1 execution plan

## Goal

Make `/sim/` reproduce Backpack Battles combat as closely as evidence permits:
item behavior, global combat lifecycle, start-of-battle order, event causality,
Combat Log sentences/order, Damage Meter attribution, HUD state, and both
sides of a fight. The game extract and live captures are the authority; a
coverage percentage, a generic port, or an end-HP match alone is not proof.

This is intentionally a sequence of **one-shot-shippable work packages**.
Each numbered package can be completed, reviewed, tested, committed, and
deployed independently. No package requires quietly changing a baseline or
claiming full 1:1 before its evidence exists.

## Current starting point

The 2026-10-03 audit recorded:

- 519 catalog items in the imported game catalog; the generated ledger is the
  authoritative denominator. (The earlier 553 HAND count was a port-list
  count, not a catalog count.)
- 452 extract-audited item scripts: 16 raw lifecycle-hook differences, all
  triaged (3 confirmed gaps, 7 equivalent implementations, 3 base behaviors,
  and 3 visual-only behaviors), plus 21 duplicate registrations and 82 shallow
  ports.
- 45 call-level audit candidates. These are leads, not confirmed defects.
- Combat-log, coverage-honesty, and the corrected Puzzlebag T noop audit pass.
  Package 1 is complete: `--require-triage` ensures every raw hook difference
  has a current source-led disposition instead of treating audit output as a
  defect list.

The two item totals are not yet a trusted denominator comparison. The first
work package reconciles catalog IDs, extract scripts, base classes, deliberate
noops, gems, and board-only pieces into one ledger.

## Non-negotiable rules

- Read the applicable item `.gd` and every called `Core/*.gd` method before
  changing a port. Use `Interface.csv` and `Core/CombatLog.gd` for log text.
- Do not create item- or seed-specific ordering exceptions. Causality, item
  origin, placement, side, and lifecycle phase must be represented by data.
- Do not mark an item complete because it has a handler. Completion requires
  source review, a focused regression, and the relevant state/event/UI proof.
- Do not delete mismatch reports, loosen expected bands, or downgrade a test
  to hide a failed comparison.
- Keep fixed-dummy results separate from live player-vs-player results. A
  dummy end-HP band cannot prove real-opponent parity.

The detailed contribution rules live in [`js/pages/sim/AGENTS.md`](../../js/pages/sim/AGENTS.md).

## Definition of an audited item

Every game item that can participate in combat receives one ledger row with:

| Field | Required evidence |
|---|---|
| ID, name, item family, game version | Catalog + extract provenance |
| Game source | Exact `.gd` path; base class if inherited behavior matters |
| Lifecycle hooks | `onPrepare`, `onPreCombatStart`, `onCombatStart`, trigger/CD, damage hooks, consume, cleanup, and any signals |
| Effects | Stack, damage, heal, stat, targeting, adjacency, cards, charges, or board effects, with named parameters |
| Sim owner | Dedicated port/core module and runtime registration winner |
| Fidelity | `no_combat`, `incomplete`, `source_ported`, `fixture_validated`, or `live_validated` |
| Tests | Focused test, broader smoke, fixture, and live capture if required |
| Known delta | Exact remaining mismatch or an explicit `none observed` scope |

`no_combat` is allowed only with source evidence that the item has no combat
behavior in the supported fight mode. Base scripts (`weapon`, `bow`, `card`)
are inheritance sources, not user-item failures; they must be represented
separately so they do not distort the item denominator.

## Work packages

### 0. Freeze the source baseline and build the fidelity ledger

**Deliverable:** a generated, reviewable `sim-fidelity-ledger` containing one
row per catalog item plus separate rows for base/inherited scripts.

1. Record the game extract revision/hash and catalog import version.
2. Reconcile all 519 catalog entries against the 452 audited scripts.
3. Resolve aliases, Exclusive paths, gems, board-only pieces, shop-only items,
   and base classes; each discrepancy gets a reason, never a silent drop.
4. Capture the runtime handler winner for every item and flag duplicates as
   either intentional precedence or a defect.
5. Seed every row with source path, hooks, current depth, no-op reason, and
   links to existing fixtures/smokes.

**Exit gate:** every catalog entry is represented exactly once in the ledger;
the denominator and intentional exclusions are machine-checkable.

### 1. Repair existing audit gates before expanding scope

**Deliverable:** a green, non-weakened baseline audit.

1. Reproduce the Puzzlebag T audit failure from its `.gd` source.
2. Repair the audit's lifecycle-hook classification and retain a focused
   source/handler regression without weakening its assertions.
3. Re-run noop, log, coverage-honesty, and source audits.
4. Triage the 16 hook gaps into confirmed gap, inherited/base behavior,
   intentional non-combat, or false-positive extraction; write the result to
   the ledger.

**Exit gate:** `sim-noop-audit` passes unchanged; every existing hook gap has
an owner and evidence status.

### 2. Establish the canonical global combat lifecycle

**Deliverable:** a source-backed lifecycle trace and deterministic engine test
covering both player and opponent sides.

Audit these game sources together before changing order:

- `Core/Game.gd`, `Core/Combat.gd`, `Core/Character.gd`, `Core/Buff.gd`
- `Items/Item.gd`, `Items/Weapon.gd`, `Items/Gem.gd`, and bag/card bases
- `Core/CombatEvent.gd`, `Core/CombatLog.gd`, and cooldown helpers

The resulting trace must explicitly prove the order of:

1. board/item preparation and inherited setup;
2. gem preparation and stat modification;
3. `onPrepare` signal registration and affected-item discovery;
4. pre-combat hooks, start-of-battle hooks, cooldown arming/jitter, and
   post-start hooks;
5. consumables, one-shot `onAfterEffectFinished`, cards, charges, and first
   cooldown triggers;
6. character ticks, damage hook phases, stack listeners, delayed jobs, death,
   cleanup, fatigue, and fight-end events.

For every phase, record its game source, expected event parent/origin, sim
entry point, and an order test. Where the extract is ambiguous, add a live
capture task instead of guessing.

**Exit gate:** a shared lifecycle fixture asserts order for player and opponent
items, nested stack reactions, consume/activation, and same-timestamp events.

### 3. Make event, log, meter, HUD, and export one coherent model

**Deliverable:** an event-contract conformance suite.

1. Map each `Core/Game.gd EventType` and `CombatEvent` field to `SimEvent`.
2. Require event ID, parent/root cause, phase, side, item placement, target,
   and timestamp whenever the game supplies an equivalent.
3. Audit every shared helper (`damage`, `stacks`, `buff-economy`, cooldown,
   heals, effects, charges) to emit the event required by the UI.
4. Compare log sentence templates against `CombatLog.gd` and `Interface.csv`.
5. Test that the Combat Log, Damage Meter, HUD, scrubber snapshots, and JSON
   export show the same source and totals for a representative event corpus.

**Exit gate:** the corpus includes stack gain/spend/react chains, damage,
critical/miss/block strip, effect damage, heal/vampirism/regeneration,
stamina, consume/activation, debuffs, cooldown changes, charge, death, and
both sides. Every corpus event has an expected sentence/order/metric result.

### 4. Audit and port every incomplete item in source-driven waves

**Deliverable per wave:** ledger rows upgraded with source review, a dedicated
or proven shared implementation, and a focused fixture. The wave completes
only when all of its rows meet the item definition above.

Prioritize by correctness risk rather than popularity alone:

1. **Lifecycle blockers:** the confirmed hook-gap items, any start-of-battle
   item, consumed one-shot, cooldown override, or signal listener.
2. **Core-state modifiers:** stack caps, temporary stacks, cleanse/protection,
   crit/lucky tokens, speed, resist, max health/stamina, and stat factors.
3. **Damage-path items:** early/late pre-deal, attack-effect loops, effect
   damage, on-hit/on-damaged, block removal, vampirism, spikes, and reflected
   damage.
4. **Targeting systems:** adjacency, bags, linked/affected cells, cards,
   summons, peer activations, and charge delivery.
5. **Families:** weapons, armor, accessories, food/potions, pets, skills,
   spells, shields, books, gems, and class-specific Exclusives.
6. **Remaining shallow rows and the confirmed subset of call-audit leads.**

For each item, inspect inherited behavior as well as its own file. If several
items genuinely share an identical game pattern, use one shared helper with
per-item tests; otherwise retain dedicated ports.

**Exit gate per item:** source path/hook/params recorded; state and event
sequence asserted; log/meter/HUD effects tested where applicable; player and
opponent execution tested; remaining uncertainty labelled in the ledger.

### 5. Build authoritative fixtures and live-capture coverage

**Deliverable:** a fixture matrix that proves behavior beyond a synthetic
dummy calculation.

1. Give every class a starter, mid-game, late-game, and interaction-heavy
   board. Add rows for each unrepresented item family/system.
2. Add minimized fixtures for every fixed bug; preserve reported build slug,
   seed, and game source when available.
3. Capture real fights/logs for high-risk lifecycle, timing, targeting, and
   damage paths. Store exact game version, board, opponent board, observed
   timestamps, final state, and screenshots/export where possible.
4. Use paired boards (`slug` + `oppSlug`) for PvP comparisons. Fixed-dummy
   fixtures continue to test deterministic engine behavior only.
5. Keep tolerance bands explicit and narrow them only with new live evidence;
   never replace a live capture with a dummy baseline.

**Exit gate:** each item family has at least one fixture; every
`fixture_validated` item participates in a relevant deterministic fixture;
every `live_validated` item has retained capture evidence.

### 6. Continuous audit and patch-drift workflow

**Deliverable:** repeatable checks that prevent newly imported items or game
patches from silently regressing parity.

1. Run inventory, ledger, hook, call, no-op, coverage-honesty, log, and
   relevant family smokes on every simulator change.
2. On a game patch, refresh the extract, diff catalog/scripts/hooks/params,
   mark changed ledger rows `incomplete`, and create a wave only for those
   rows plus shared-core impacts.
3. Publish generated audit output in CI once the command is stable and does
   not rewrite tracked baselines unexpectedly.
4. Require any unexplained mismatch to remain visible in
   `sim-validation.md` with owner, source, severity, and next evidence.

**Exit gate:** a patch produces a deterministic changed-item list and no item
can retain `fixture_validated`/`live_validated` status after its game source
changes without re-review.

### 7. Near-1:1 release gate

**Deliverable:** an evidence-backed status, not a marketing phrase.

The simulator may be described as **near-1:1 for the supported mode** only if:

- every supported catalog item has a ledger row and no unresolved P0/P1 gap;
- all lifecycle phases and EventTypes used by supported items are source- and
  corpus-tested;
- all no-ops/base scripts are source-justified;
- all source audits are green or every remaining candidate is explicitly
  classified and documented;
- fixture and live-capture matrices cover every family, class, and both sides;
- known exclusions (for example unsupported chess AI or sandbox/dummy limits)
  are visibly disclosed;
- the existing legal/marketing review gates allow the wording.

Until then, the UI remains honest: “fixture-validated subset” or “partial
simulator,” with the ledger/validation page describing the current scope.

## Recommended execution order

Start with packages **0 → 1 → 2 → 3**. They make the simulator’s denominator,
global order, and observability trustworthy before spending time deepening
hundreds of item ports. Then execute package 4 in small source-driven waves,
interleaving package 5 live captures for the systems most likely to mislead
the engine. Package 6 runs continuously; package 7 is a final evidence gate,
not a deadline.

## Progress checklist

- [x] 0. Source baseline and complete fidelity ledger
- [x] 1. Existing audit failures and hook-gap triage
- [x] 2. Canonical combat/start-of-battle lifecycle trace
- [x] 3. Event/log/meter/HUD/export conformance suite
- [ ] 4. All source-driven item-port waves
- [ ] 5. Full fixture and live-capture matrix
- [x] 6. Patch-drift and continuous-audit workflow
- [ ] 7. Near-1:1 release gate
