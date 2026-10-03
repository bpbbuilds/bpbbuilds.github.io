# Simulator 1:1 audit

This is the operational audit for `/sim/`. It establishes what can currently
be proved, what cannot, and the next evidence needed to close a gap. It does
not use coverage counts as a substitute for live-game parity.

## Standard of proof

For a simulator behavior to be called game-faithful, retain all of the
following:

1. The item and shared-engine source in `tools/game-extract-full/`.
2. The matching lifecycle/hook and catalog parameters.
3. A focused automated regression for state and event sequence.
4. Combat Log, Damage Meter, and HUD events for every user-visible effect.
5. A live capture where the extract or dummy model cannot prove the behavior.

The game extract is authoritative for code behavior. The simulator's existing
code, static fixtures, and coverage data are useful evidence but cannot
override it.

## 2026-10-03 baseline audit

Commands run against the current extract and ports:

```text
npm run sim-log-smoke                 PASS (8 log sentences; 15 meter metrics)
node scripts/audit-sim-gd-parity.mjs  452 items; 3 abstract base entries with no handler;
                                      15 hook gaps; 21 duplicate registrations; 82 shallow ports
node scripts/audit-sim-gd-calls.mjs   45 candidate item/call gaps (heuristic; requires GD review)
npm run sim-coverage-honesty          PASS
npm run sim-noop-audit                FAIL: Puzzlebag T combat-start assertion
```

The three no-handler entries are `bow`, `card`, and `weapon`, which the audit
identifies as base scripts. They are not automatically user-facing failures.
Likewise, duplicate registrations and call-audit candidates are investigation
leads: runtime registration precedence and the actual `.gd` call path must be
checked before changing a port.

The immediate actionable audit failure is the Puzzlebag T combat-start
assertion. It must be reproduced and corrected before treating the full audit
as green. Do not hide it by weakening the noop audit.

## What is already structurally in place

- Engine events carry time, actor/target, origin, placement, and metadata;
  snapshots power the HUD and log scrubber.
- Stack changes have a shared event path. Reactive stack listeners inherit
  causal provenance, so a trigger gain can sort before its spend and result
  without an item-specific exception.
- There are separate log/meter smoke tests, source-hook and source-call audits,
  coverage-honesty checks, intentional-noop checks, parity fixtures, and a
  live-capture schema.

## Gaps preventing a 1:1 claim

The current blockers are evidenced in `docs/sim/sim-validation.md` and the
audit baseline above:

| Priority | Gap | Evidence needed |
|---|---|---|
| P0 | Failing Puzzlebag T audit | Reproduce the source hook against its `.gd`, add a focused regression, then make `sim-noop-audit` pass without relaxing assertions. |
| P0 | Event order and log semantics beyond the static sample | Expand focused tests around game `CombatEvent` parent chains, both sides, consume/activation, and each corrected live report. |
| P1 | 15 hook gaps / 82 shallow ports | Triage each by actual `.gd` effect; port the missing hook or document an intentional non-combat/noop case. |
| P1 | 45 call-audit candidates | Review the `.gd` call and port path; convert confirmed misses into per-item tests. |
| P1 | Dummy versus a real opposing bag | Add paired-board captures before using PvP end HP or timing as parity evidence. |
| P2 | Rare EventTypes and full log sentences | Compare `Core/CombatLog.gd`, `Core/CombatEvent.gd`, and `Interface.csv` with a growing live-log corpus. |

## Repeatable audit loop

1. Start from a bug report, a saved board/seed, or one source-audit candidate.
2. Read the item's `.gd`, then its called `Core/*.gd` behavior and catalog
   parameter names.
3. Reproduce it in a narrow fixture or focused smoke, preserving both sides
   and the event chain.
4. Fix the shared engine or dedicated port; do not special-case the report.
5. Verify state, event order, sentence, meter, HUD, export, and no regression
   in the relevant smoke/audit.
6. Add the confirmed result or remaining gap to `sim-validation.md`.

Use the live-capture protocol in `sim-validation.md` for any claim that needs
the real game rather than the extract. The simulator remains a fixed-dummy
sandbox unless a paired opponent board is explicitly loaded.
