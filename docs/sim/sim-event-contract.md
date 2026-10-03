# Simulator event-contract conformance

This is the Package 3 contract for projecting one combat result consistently
to the Combat Log, damage meter, HUD/scrubber, and debugging JSON. It is based
on `Core/CombatEvent.gd`, `Core/CombatLog.gd`, `Core/Game.gd` `EventType`, and
the `LOG_*` keys in `Sheets/CSV/Interface.csv`.

It is a projection contract, not an assertion that every source event is
already produced by every item port. Unsupported or incomplete item behavior
remains visible in the fidelity ledger and source-audit reports.

## Canonical projection

`conformSimEvents(events)` is called by the Combat Log, damage meter, scrubber,
and JSON exporter. It copies rather than mutates the engine list and attaches
`meta.contract`:

| Game `CombatEvent` field | Simulator contract field | Rule |
|---|---|---|
| `id` | `id` | Keeps an emitter's event ID or assigns a stable `sim-N` ID at projection time. |
| `timestamp` | `timestamp` | Exact simulator timestamp; UI uses the combat-clock conversion where applicable. |
| `parentEvent` / `getDepth()` | `parentId`, `rootId`, `depth` | Preserves explicit causal metadata and resolves missing root/depth through the parent chain. |
| `origin` | `origin`, `originKind`, `itemId`, `placementKey`, `side` | Uses system origin, item ID, or stack origin without inventing an item. |
| `type` | `type`, `phase` | Keeps the simulator type; phase is explicit when emitted, otherwise `combat` (with fight start/end exceptions). |
| `target` | `target` | `null` remains explicit when a source event has no target. |
| `params` | `amount` plus `meta` | Existing per-effect parameters remain attached to the exported event. |

The player fallback for a source-less event follows `CombatEvent.getMainActor()`.
That lets system events be displayed without pretending they belong to an item.

## EventType mapping

| `Game.EventType` | `SimEvent` projection | Primary presentation |
|---|---|---|
| `Activation` | `activate` | Activation line + Activations meter. |
| `DealDamage`, `CriticalDamage`, `TakeDamage`, `LoseHealth` | `damage`, with `critical`, `blocked`, DR and source metadata | Damage line + Damage / Blocked meter. |
| `MissedAttack` | `miss` | Miss line + Misses meter. |
| `Health` | `heal` | Heal line + Heal / Overheal / Maximum Health meter. |
| `Stamina`, `DrainStamina`, `OutofStamina` | `stamina`, with `kind: used` or `starved` | Regeneration, removed-stamina, or out-of-stamina line + Stamina / Activations meter. |
| `AttackSpeed`, `DamageBuff`, `DamReduction`, `DamIncrease` | `stat` or `buff` | Stat/buff line; HUD combat-stat rack where state is snapshot-backed. |
| `TemporaryMaxHealth`, `TemporaryMaxStamina`, `Reincarnate` | `heal`, `stamina`, or `info` with typed metadata | Log/export; snapshot is authoritative for HUD state. |
| `InvulnerableStart`, `InvulnerableEnd`, `Stun`, `StunResisted`, `CriticalResisted`, `BattleRageStart`, `BattleRageEnd` | `info` / `stat` with status metadata | Log/export; item-wave fixtures must prove individual state behavior. |
| `CooldownAdvance` | `cooldown` | Export/scrubber event; item snapshots carry the live cooldown tooltip state. |
| `Unhealing`, `Fatigue`, `Spikes`, `Vampirism`, `Regeneration` | `damage`, `heal`, or `buff` with `systemOrigin` | Source-separated damage/heal or stack meter, plus HUD snapshot. |
| `Block`, `Lucky`, `Mana`, `Empower`, `Heat` | `buff` with `stack` | Stack line + corresponding gained/removed/used meter + HUD counter. |
| `Poison`, `Blind`, `Cold` | `debuff` with `stack` | Debuff line + corresponding meter + HUD counter. |
| `Win`, `Loss` | `fight_end` | Outcome line; final snapshot supplies HUD dead/health state. |
| Simulator transport charge (no direct `EventType`) | `charge` | Export/scrubber only; intentionally not a Combat Log or meter line. |

## Shared corpus

Run:

```text
node scripts/sim-event-contract-smoke.mjs
```

The deterministic corpus covers both sides and asserts:

- gain → spend → reactive stack chains at one timestamp, including root and
  depth;
- critical damage, blocked damage, effect damage, and a miss;
- Vampirism and Regeneration healing;
- stamina spend, consumed activation, debuff, cooldown, and charge;
- death/fight-end outcome projection;
- exact meter totals and side attribution;
- HUD snapshot selection at scrub time; and
- exported causal ID, parent/root, placement, timestamp, and every corpus
  event.

`charge` is deliberately a non-log transport event: its expected result is a
contract/export/scrubber record, not an invented `CombatLog` sentence or meter
row. Likewise, a state only appears in the HUD when a snapshot contains it;
the HUD does not reconstruct state from rendered text.

## Known limits

- This conformance suite does not turn partial item handlers into faithful
  ports. The item-wave work still owns unsupported status effects, source
  parameters, and edge combinations.
- The source-specific gaps recorded in Package 1 (Power of the Moon timer
  advance, Wand of Dissonance preparation factor, and Rib Saw Blade setup)
  remain unresolved.
- Live-game captures are required before calling a fixture result a live parity
  result. The corpus validates simulator projections, not a real combat replay.
