# Simulator second-pass gap audit plan

## Purpose

This is a second, adversarial audit for `/sim/`. It deliberately does **not**
repeat the first roadmap's catalog ledger, item-port waves, or initial
start-of-battle trace. Instead, it asks what can still make a simulation wrong
after an item appears ported: timing, numeric rules, random streams, source
data, two-sided state, event/replay projection, and evidence quality.

The goal is to find missing systems and false confidence before any future
"near-1:1" claim. A passed smoke, deep handler, or matched final HP remains
insufficient on its own.

Read these before starting any package:

- [`sim-1to1-execution-plan.md`](sim-1to1-execution-plan.md) for the existing
  catalog and item-port work.
- [`sim-combat-lifecycle.md`](sim-combat-lifecycle.md) for verified opening
  order.
- [`sim-validation.md`](sim-validation.md) and
  [`sim-debug-protocol.md`](sim-debug-protocol.md) for known deltas and
  evidence handling.
- [`js/pages/sim/AGENTS.md`](../../js/pages/sim/AGENTS.md) before code changes.

## What this audit found is still unclosed

These are source/code observations, not claims that each one is already a
defect:

| Area outside the first roadmap's exit gates | Current evidence | Why it needs its own audit |
|---|---|---|
| Discrete timing and timer semantics | The engine advances in `DT = 0.05`; game code uses Godot physics and Timer nodes. | Same-frame tie order, timer expiry, cooldown crossing, fatigue, and death can differ even when an item hook is correct. |
| Randomness topology | The simulator uses Mulberry32 plus selective `BalancedRng`; game uses shared and per-item random sources. | Exact live RNG streams are not expected, but probability, reset scope, and random-call consumption must still match. |
| Full `Character` lifecycle | The opening trace is documented, while tick, death, cleanup, fatigue, out-of-stamina, and fight-end pathways are only partly audited. | A correct opening can still become wrong on the first damage, tick, death, or finish. |
| Source parameter/data drift | The ledger hashes catalog/extract inputs, but there is no complete behavior/parameter diff gate tied to every port and fixture. | A game patch can silently invalidate a faithful-looking handler. |
| Two-sided execution | Bag-vs-bag exists, but validation notes retain thin cross-board charge/steal behavior and many ports are written around `ctx.player` / `ctx.dummy`. | A player-side pass is not proof of opponent-side or symmetric PvP behavior. |
| Event contract and projection | `SimEvent` has a compact type union and optional metadata; game `CombatEvent` has richer origin/parent/type/parameter semantics. | The engine, Combat Log, meters, HUD, scrubber, effects, and export can disagree about one state change. |
| Board state over time | Board graph and placement data are built up front; cards, consume, transformed items, summons, bags, and charged paths can change the effective board. | Initial adjacency is not sufficient for dynamic combat board behavior. |
| Verification quality | Most fixture bands are simulator baselines; live captures are sparse and end-state-oriented. | A simulation cannot validate itself, and final HP hides order and attribution faults. |
| Test adequacy | There are many focused smokes, but no system-wide mutation/property/fuzz gate or test-to-source manifest. | Hand-picked happy paths can leave systematic omissions invisible. |
| User-facing truth | The page carries a partial-simulator banner, but feature surfaces must be audited so no mode, export, share card, or metric implies a ranked replay. | Product wording and displayed precision are part of a trustworthy simulator. |

The existing 16 lifecycle candidates, 82 shallow ports, 40 catalog call-review
candidates, 21 duplicate registrations, deferred Chess Board AI, and Power of
the Moon fatigue/time-advance issue remain owned by the first roadmap. This
plan supplies the audits that determine whether fixes for those items are
actually system-faithful.

## Evidence model

Every package below must produce all applicable artifacts:

1. **Source matrix** — exact game paths, methods, parameters, and version hash.
2. **Simulator mapping** — owner module, event fields, affected state, and both
   sides of a fight.
3. **Deterministic regression** — minimal board, seed, expected ordered events,
   snapshots, and totals. It must fail before the proven repair.
4. **Live probe when source alone is insufficient** — retained screenshot/video
   or Combat Log/Damage Meter transcription with game version and both boards.
5. **Visible delta** — an unresolved difference goes in `sim-validation.md`;
   never remove a report flag or widen an expectation to hide it.

An audit package may end in `confirmed`, `source-resolved`, `needs-live`, or
`unsupported`. Only `confirmed` work can reduce a gap count. `needs-live` and
`unsupported` are valid outcomes when documented precisely.

## Work packages

### A. Build a source-to-simulator completeness map

**Why this is new:** the first ledger is item-centric. This map is
system-centric: every combat-relevant game method, signal, Timer, enum value,
and snapshot field gets a simulator disposition.

1. Index `Core/Game.gd`, `Core/Character.gd`, `Core/Buff.gd`,
   `Core/CombatEvent.gd`, `Core/CombatLog.gd`, `Core/CombatSnapshot.gd`,
   `Core/CombatStatLogger.gd`, `Interface/CombatTimer/CombatTimer.gd`, and
   base item/gem/card scripts.
2. Record function body hash, called signals, data fields, and all source
   `EventType` values; distinguish a direct implementation from an intentional
   unsupported mode.
3. Map every source element to one simulator owner or an explicit gap ticket.
   Include base inheritance; do not count an item script twice for inherited
   behavior.
4. Generate a review report with `unmapped`, `approximate`, `needs-live`, and
   `proven` totals. Link each item-ledger row to the shared systems it relies
   on.

**Exit gate:** no combat-relevant source method/signal/enum/snapshot field is
silently absent. The report is regenerated from hashes and fails when the
extract changes.

### B. Verify time, scheduler, and numerical semantics

**Why this is new:** the simulator's fixed 0.05-second loop is an
implementation choice, not proof of Godot-timer equivalence.

1. Trace all game clocks: pre-combat delay, physics delta, item cooldown,
   character tick, fatigue start/tick, delayed jobs, animation-independent
   time advances, stun expiry, temporary stacks, and post-death work.
2. Define an explicit scheduler contract: timestamp resolution, tie-breakers,
   re-entrancy, cancellation, timer reset/restart, and whether an effect can
   fire multiple times in a single frame.
3. Add boundary tests just before, exactly at, and just after each timer
   threshold; include 0.05-grid and non-grid values, equal cooldowns, and
   multiple immediate triggers.
4. Audit rounding, floor/ceil, integer conversion, min/max, percent stacking,
   and floating-point tolerances against the exact GDScript call sites.
5. Deep-audit fatigue and Power of the Moon: `CombatTimer.advanceTime` affects
   the fatigue timer, not generic item cooldowns. Capture a live probe for
   first fatigue and its first damage if the extract leaves visual timing open.
6. Verify termination ordering: simultaneous lethal damage, fatigue death,
   consume/deactivate, pending jobs, victory/loss, snapshot, and final meter.

**Exit gate:** a scheduler conformance suite has source-linked tests for every
clock and all documented same-timestamp ties. No time advancement is modeled
as a generic cooldown shift without a game source proving it.

### C. Audit randomness as behavior, not seed matching

**Why this is new:** live clients randomize at boot, so matching one seed is
not the target; matching probability and independent random state is.

1. Inventory every game random API and stateful RNG (`Util.flip`, range/int
   rolls, chance RNG, damage range RNG, balanced RNG, shuffles, target picks).
2. Record reset scope: game boot, combat, item preparation, activation, or
   per-use. Record whether a missed roll consumes a random value.
3. Map each source use to a named simulator stream. Do not use one shared
   callback merely because it is convenient when the game owns independent
   state.
4. Add deterministic sequence tests for reset/consumption and statistical
   tests over a large fixed seed set for each probability family. Test edge
   values 0%, 1%, 50%, 99%, and inclusive boundary behavior.
5. Add order-sensitivity tests: reorder unrelated items and prove only the
   game-equivalent random stream changes. Separate stable simulation replay
   seeds from live screenshot comparison expectations.

**Exit gate:** every combat random call has a source type, stream owner,
reset rule, and regression. Distribution tests use documented tolerance rather
than an arbitrary exact output sequence.

### D. Prove full two-sided and dynamic-board behavior

**Why this is new:** existing bag-vs-bag support is a first slice; symmetric
execution and changing board relationships have no comprehensive gate.

1. Create a side-symmetry matrix for every shared helper and port: player as
   actor, opponent as actor, player as target, opponent as target, and a
   cross-board effect where allowed.
2. Instrument direct actor and board references to detect a handler that
   mutates the wrong side or uses player-only event attribution.
3. Cover graph evolution: consumed items, cards/deck changes, charged paths,
   transforms, reveals, copied items, summons, bags, socket changes, and
   affected-item re-evaluation. Classify unsupported dynamics explicitly.
4. Test placement identity under duplicate item IDs, rotations, overlapping
   bag footprints, stars/diamonds, and separate boards with matching keys.
5. Add paired-board fixtures with asymmetric class/round/health/stamina,
   simultaneous triggers, side-specific immunity/resistance, and a cross-board
   charge/steal attempt.

**Exit gate:** a generated side matrix has no unexplained one-sided helper or
port. Every dynamic-board feature is either state-tested for both sides or
shown as unsupported in the UI and validation notes.

### E. Reconcile event, log, meter, HUD, effects, scrubber, and export

**Why this is new:** the earlier plan calls for conformance but does not define
a mechanical projection-equivalence gate.

1. Expand the internal event schema to a versioned canonical record with
   required event id, parent/root, phase, actor/target/origin, placement,
   timestamp, source parameters, and state delta when the game has an
   equivalent. Preserve unknown game fields in structured metadata, not labels.
2. Build an EventType/`LOG_*`/`Interface.csv` manifest. Track unsupported
   strings and BBCode separately from absent game behavior.
3. For a representative corpus, replay the same canonical events into every
   projection and assert: log row order/text tokens, meter totals/by-source,
   HUD stacks/HP, item overlays, scrubber snapshot, final summary, and JSON
   export all reconcile.
4. Add serialization round-trip tests: export -> import/normalization ->
   replay must preserve ordering, causal links, side, placement keys, and
   totals. Include missing/unknown catalog data and old export versions.
5. Test cancellation and correction paths so an item consumed, a blocked buff,
   a reflected debuff, or a dead actor never leaves ghost UI/meter state.

**Exit gate:** no projection recomputes a competing truth. Corpus failures
identify the exact event and projection; all user-visible simulation state is
traceable to canonical events/snapshots.

### F. Audit character, stack, damage, and resource invariants

**Why this is new:** per-item source review does not prove shared accounting
invariants or interactions among all modifiers.

1. Extract a state-transition table for health, max health, block, stamina,
   each buff/debuff, temporary stack, resist/reflect/protection, stun,
   invulnerability, Battle Rage, heal amplification, Unhealing, and damage
   meter counters.
2. For each transition, define legal ranges, cap/underflow behavior,
   expiration/cleanup, origin/parent propagation, and whether it logs/meters.
3. Exhaustively test damage phases and combinations: accuracy/miss, critical,
   early/late modifiers, percent/flat resistance, block, spikes, on-hit,
   vampirism, effect damage, fatigue, protection, invulnerability, and
   simultaneous death.
4. Audit stamina: regeneration cadence, insufficient-stamina outcomes,
   drain, maximum changes, item activation cancellation, and both-side state.
5. Generate property tests that randomly compose legal state transitions and
   assert invariants (finite values, caps, no negative resource unless source
   permits it, causal parent before child, and equal meter/accounting deltas).

**Exit gate:** shared state invariants have source-linked unit/property tests;
every known exception is explicitly source-documented.

### G. Validate data, inheritance, and game-patch drift end to end

**Why this is new:** the catalog ledger hashes current inputs but does not yet
prove that all runtime values and inherited content stay aligned with a patch.

1. Version and hash all inputs consumed by `/sim/`: item catalog, item
   inventory, coverage/parity/noop metadata, can-affect rules, sprite/type
   aliases, class/rank/round data, and any Supabase item normalization.
2. Compare extract descriptor values with imported catalog fields including
   aliases, null-vs-zero meaning, named params, gem power/block, chance tags,
   shapes, sockets, class gates, and release state.
3. Generate inherited-method resolution for each item so a changed base class
   invalidates every dependent ledger row and fixture.
4. Make duplicate runtime registration deterministic and reviewed: report the
   winning handler, shadowed handlers, source owner, and a justification or
   fail the audit.
5. On extract/catalog change, generate a patch-impact manifest that marks
   affected item rows and shared-system tests stale; do not retain validation
   status until re-run.

**Exit gate:** a changed source/data hash yields an actionable changed-item and
changed-system list, and runtime handler precedence cannot change silently.

### H. Build an evidence-grade live comparison program

**Why this is new:** current live capture supports final-state notes but does
not yet provide a reproducible event-by-event corpus.

1. Define compact live probe templates for each shared system: both boards,
   game version, round/classes, full placement/gems, video or sequential
   screenshots, Combat Log/Damage Meter views, timestamps, and observed state
   transitions.
2. Prioritize probes where source cannot settle timing/visual event order:
   first tick/fatigue, same-time triggers, random target selection, temporary
   expiration, cross-board effects, consume/deactivation, death, and rare
   `LOG_*` variants.
3. Store raw captures separately from derived assertions. Give each assertion
   a confidence level and link it to source, fixture, and simulation export.
4. Compare live data at the correct scope: ordered operation/stack/meter
   checks for paired boards; final HP only as a secondary signal. Keep dummy
   baselines separate.
5. Require two independent captures or a source-plus-capture explanation
   before marking timing-sensitive behavior `live_validated`.

**Exit gate:** each core system and item family has retained live evidence at
the appropriate granularity. No live label is granted from a dummy-only run.

### I. Test the tests and make regressions adversarial

**Why this is new:** individual smoke scripts are valuable but do not prove
they can detect a broken ordering, side, or accounting path.

1. Make a test manifest relating every source-matrix row and ledger item to
   at least one regression, its scope, and whether it is source, simulated,
   or live evidence.
2. Add mutation checks for high-risk primitives: invert player/opponent,
   remove a parent link, swap same-time ordering, skip cooldown rearm, change
   a rounding mode, and omit a meter event. The relevant test must fail.
3. Add seeded property/fuzz boards under legal placement constraints, including
   duplicate IDs, socketed gems, extreme stack values, zero/near-zero cooldown,
   and both sides. Persist minimized counterexamples.
4. Add differential checks between full simulation and segmented/replayed
   simulation at multiple scrubber times. Snapshot and resume must agree with
   uninterrupted execution.
5. Separate fast deterministic CI checks from artifact-writing diagnostics;
   add a no-dirty-worktree gate for read-only audits.

**Exit gate:** mutations in each high-risk class are caught, fuzz failures are
reproducible, and CI can run the audit suite without rewriting trusted
baselines.

### J. Audit the simulator's public contract and unsupported behavior

**Why this is new:** accuracy includes preventing users from interpreting a
sandbox prediction, demo mode, or export as a replay of a real ranked fight.

1. Inventory every `/sim/` entry point, URL mode, empty/error state, report,
   export, shared link, damage meter, and label.
2. Verify each exposes the correct mode/side/round/seed/input data and does
   not imply the game supplied the Combat Log or opponent behavior.
3. Show source-backed unsupported differences where they affect a result:
   Chess Board AI, dummy behavior, incomplete cross-board systems, missing
   item data, unvalidated ports, and stale extract/version.
4. Test that copied URLs reproduce the same local simulation inputs and that
   settings do not silently alter a shared result. Distinguish a simulator seed
   from the game's unseeded live RNG.
5. Re-review the legal/marketing gate before changing copy that suggests
   equivalence to the game.

**Exit gate:** user-visible mode and confidence are mechanically derived from
the audit state, rather than hand-written marketing text.

## Recommended execution order

Run **A -> B -> C -> D -> E -> F -> G -> H -> I -> J**. A establishes a
complete source surface. B/C/F make the shared engine trustworthy before more
item work. D/E reveal side and projection faults that final-state fixtures
miss. G protects the work from patch drift. H supplies independent evidence;
I proves the tests can catch regressions; J keeps the product honest while
the remaining gaps are closed.

The original roadmap's item waves should consume the outputs of A-G: an item
is not upgraded merely because its dedicated port looks complete. Each port
must also pass the applicable scheduler, randomness, side, projection, and
invariant gates above.

## Completion criteria for this second audit

This plan is complete only when every package has an artifact, all findings
are either fixed or explicitly retained in `sim-validation.md`, and no
unreviewed source/data/side/projection path remains. That still does **not**
by itself grant a public 1:1 claim: the original roadmap's all-item and live
coverage gates, plus `sim-ip-marketing.md`'s legal gate, remain required.
