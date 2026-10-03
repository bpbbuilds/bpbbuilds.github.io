# Simulator patch-drift and continuous-audit workflow

Package 6 prevents an imported game patch from silently retaining an old
simulator confidence label. It is a review gate, not a parity claim and never
changes game data, the fidelity ledger, or fixture bands by itself.

## Normal simulator change

Run this before submitting any simulator engine, port, event, log, meter, or
source-audit change:

```powershell
node scripts/sim-continuous-audit.mjs --check
```

The command is read-only for tracked data. It checks the game-source baseline,
shared source surface, generated ledger, hook dispositions, source-call leads,
intentional noops, coverage honesty, and the shared log/lifecycle/event/socket/
two-board regressions. The hook and call audits refresh ignored cache reports
only; they do not rewrite a reviewed baseline.

Add the smallest relevant behavior-family smoke when changing a family:

```powershell
node scripts/sim-continuous-audit.mjs --check --family sim-charge-smoke
```

Use the actual smoke stem after `scripts/` (for example `sim-aq-smoke`). A
fixture or harness change must additionally run:

```powershell
node scripts/sim-continuous-audit.mjs --check --fixtures
```

That invokes deterministic parity bands and the live-capture schema. It is
expected to fail while a real mismatch remains; do not widen a band, remove an
assertion, or omit the command to make the audit green.

## Imported game patch

The tracked baseline contains all 519 current catalog rows, each catalog
record's full parameter hash, the resolved item-script hash and function list,
and every shared core file represented by the source-surface audit.

```powershell
node scripts/sim-patch-drift.mjs --check
```

Any catalog, parameter, item source/hook, or shared-core change fails with a
sorted changed-item list. A shared-core change intentionally places every
combat-relevant source row in the review wave because it can affect inherited
behavior. The output separately identifies any `fixture_validated` or
`live_validated` rows still carrying their old status; they must be downgraded
to `incomplete` before acknowledging the patch.

Patch procedure:

1. Refresh the game extract and catalog, then regenerate source inventories and
   the fidelity ledger as needed. Do not overwrite their output merely to pass
   an audit.
2. Run `node scripts/sim-patch-drift.mjs --check` and retain its changed-item
   list as the patch's source-driven port wave. Include shared-core impacts.
3. Mark affected validated rows incomplete, record every remaining mismatch in
   [`sim-validation.md`](sim-validation.md), and add source-led regressions.
4. Re-run the continuous audit and the applicable family/fixture checks.
5. Only after review is complete, deliberately write the new baseline:

   ```powershell
   node scripts/sim-patch-drift.mjs --write-baseline
   ```

`--write-baseline` is intentionally the only mutating mode. A normal check
cannot accidentally bless new game behavior.

## CI

[`sim-continuous-audit.yml`](../../.github/workflows/sim-continuous-audit.yml)
runs the stable, non-fixture gate for pull requests touching simulator source,
simulator data, fixture scripts, or this workflow. Fixture/live validation is
kept explicit because it currently has open Package 5 evidence failures.

## Current evidence boundary

The continuous gate passing means the known source baseline and shared
regressions are consistent. It does **not** mean all ports are game-faithful:
the three confirmed hook gaps, 82 shallow ports, 45 call-review candidates,
and Package 5's missing live evidence remain visible in
[`sim-validation.md`](sim-validation.md).
