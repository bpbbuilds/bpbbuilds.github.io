# Shared effect-duration fidelity

## Goal

Match current Backpack Battles duration behavior on Create and Simulator: Time Melting increases starred-item effect durations by 55%, and Puzzlebag of Endurance increases contained-item effect durations by 30%. This includes stun durations such as Hammer's 0.5-second stun.

## Scope

- Store a multiplicative duration factor on each simulator piece.
- Have Time Melting and Puzzlebag of Endurance add their catalog-derived factors without mutating one named parameter.
- Route every simulator effect-duration read through one helper, including generic duration, stun, self-stun, blind, invulnerability, resistance, and other `dur*` parameters.
- Treat any catalog item with a numeric `dur` or `dur_*` parameter as duration-capable for Create star feedback and Time Melting targeting.

## Non-goals

- Change cooldown speed, damage, stack quantities, or Puzzlebag of Ruin's separate debuff-duplication system.
- Infer duration behavior from prose at runtime; catalog parameters remain the boundary.

## Data flow

1. A catalog item with a duration parameter is recognized by the shared duration predicate.
2. Create uses that predicate when deciding whether Time Melting's star applies and lights the matching star.
3. Simulator prepare hooks add to a piece's duration multiplier: Time Melting for valid star targets and Endurance for valid bag contents.
4. Duration consumers read their catalog duration, then apply the piece multiplier immediately before scheduling or granting the effect.

## Verification

- A Hammer in Puzzlebag of Endurance stuns for 0.65 seconds.
- A Hammer affected by Time Melting stuns for 0.775 seconds.
- Combined modifiers multiply (0.5 × 1.30 × 1.55).
- Existing generic-duration behavior, including Black Queen, remains multiplied.
- Create's Time Melting predicate accepts Hammer and rejects non-duration items.
- Run focused smoke checks, JavaScript syntax checks, `node scripts/build-sim-fidelity-ledger.mjs --check`, and diff checks.
