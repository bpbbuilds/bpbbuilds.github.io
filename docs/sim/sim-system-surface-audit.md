# Shared combat-system surface audit

## Status

This is the executed baseline for Package A of
[`sim-1to1-gap-audit-plan.md`](sim-1to1-gap-audit-plan.md). It is intentionally
an inventory of *evidence and gaps*, not a 1:1 certification.

Run it with:

```powershell
node scripts/build-sim-system-surface.mjs
node scripts/build-sim-system-surface.mjs --check
```

The generated artifact is
[`assets/data/sim-system-surface.json`](../../assets/data/sim-system-surface.json).
It records extract-file hashes and per-function body hashes. `--check` fails
if either the generated artifact or a named source function no longer matches
the current game extract.

## Current result

| Disposition | Count | Meaning |
| --- | ---: | --- |
| Partial | 20 | Simulator owner exists, but source-complete behavior or evidence is missing. |
| Unsupported | 1 | Intentional non-support with a named source owner. |
| Implemented | 0 | No shared system has enough evidence to receive this label. |
| Unmapped | 0 | Nothing in the reviewed baseline is silently omitted. |

The reviewed shared surface is 21 systems across game transitions, character
state and damage, buffs, events/logs/snapshots/meters, the combat timer, base
item/gem/card lifecycles, and deferred Chess Board AI. The artifact additionally
captures all current `Game.EventType` names plus signal/log-constant references
seen in each audited method. This makes a source change visible before a port
is called current.

It also contains the full function inventory for each reviewed source file and
marks every function as reviewed or unreviewed. An unreviewed function is not
automatically combat-relevant, but it is deliberately visible until classified
instead of being mistaken for a confirmed omission-free audit.
At this extract revision that inventory contains 1,439 functions: 90 reviewed
by the shared-system baseline and 1,349 awaiting classification.

## Findings passed to the remaining packages

- **B — scheduling:** the game timer's `advanceTime` is a fatigue-timer action;
  it is not proof that arbitrary item cooldowns advance. The scheduler audit
  now proves the extracted 14-second warning, 17-second first-damage, and
  one-second subsequent-damage cadence; Power of the Moon remains open until
  the timer-advance path and a live probe establish it.
- **C — randomness:** simulator `Mulberry32` and selective `BalancedRng`
  usage still lack a source-to-stream/reset map.
- **D — two-sided board:** player/opponent symmetry and dynamic changes to a
  board have no generated coverage matrix.
- **E — projection:** simulator events carry causal data only for some paths;
  the game event, log, snapshot, meter, HUD, scrubber, and export contracts are
  not yet mechanically reconciled.
- **F — state:** shared health, stamina, stacks, damage, and cleanup are
  represented but lack a complete invariant/property suite.
- **G — drift:** extract hashes are now exposed for the shared baseline, but
  inheritance and parameter patch impact are not yet generated for every item.
- **H — live evidence:** no current source-only conclusion is promoted to a
  live-timing claim without retained game captures.
- **I/J:** mutation/fuzz gates and user-visible unsupported-behavior wording
  remain outstanding.

## Completion condition

Package A itself is complete only after the full source inventory—not merely
the 21 shared-system baseline—has an explicit disposition, including all
combat-relevant signals, enum fields, snapshot fields, inherited base behavior,
and links from dependent item-ledger rows. Until then this audit should be
read as a reproducible starting gate, not a completed 1:1 audit.
