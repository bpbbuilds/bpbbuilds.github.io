# Simulator combat lifecycle trace

Source audit for the start-of-battle pipeline. This document records verified
order from the game extract and the simulator counterpart. It is deliberately
separate from item coverage: an item port cannot be considered faithful if it
runs in the wrong lifecycle phase.

## Verified game order

`Core/Game.gd` creates two independently shuffled, trigger-priority-sorted
lists, then concatenates player items before opponent items:

```text
PLAYER.INVENTORY.getItems() → shuffle → ItemSort.sort_TriggerPriority
OPPONENT.INVENTORY.getItems() → shuffle → ItemSort.sort_TriggerPriority
prepareItems(playerItems + opponentItems)
wait COMBAT_DELAY
activateItems(playerItems + opponentItems)
```

Sources: `Core/Game.gd` `switchToCombat`, `prepareItems`, and
`activateItems`; `ItemSort.sort_TriggerPriority`.

### Prepare phase — before the combat delay

For every item in the combined order, `Item.prepare()` executes:

1. cache affected items;
2. reset chance/damage RNGs;
3. call `gem.prepare()` for every socketed gem;
4. call the item’s `onPrepare()`.

Sources: `Items/Item.gd` `prepare`; `Items/Gems/Gem.gd` `onPrepare`.

### Activation phase — after `COMBAT_DELAY`

`Game.activateItems()` executes in this order:

1. emit `combat_start`, start the combat timer;
2. `PLAYER.combatStart()`, then `OPPONENT.combatStart()`;
3. for every combined item, `item.preCombatStart()`:
   - every socket gem `preCombatStart()`;
   - if it has a cooldown: `adjustCooldown`, set `triggerTime`, and
     `activateCooldown`;
   - item `onPreCombatStart()`;
4. for every combined item, `item.combatStart()`:
   - every socket gem `combatStart()`;
   - item `onCombatStart()` when implemented;
5. for every combined item, `item.postCombatStart()`:
   - every socket gem `postCombatStart()`;
   - item `onPostCombatStart()`.

Sources: `Core/Game.gd` `activateItems`; `Items/Item.gd`
`preCombatStart`, `combatStart`, `postCombatStart`; `Items/Gems/Gem.gd`
`combatStart`.

## Simulator alignment status

| Game phase | Simulator location | Status |
|---|---|---|
| Per-side shuffle / trigger priority / player then opponent | `engine/combat-start-priority.js` | Implemented; verify every item priority against `Item.getTriggerPriority`. |
| Character start order | `engine/simulate.js` | Implemented as player then opponent. |
| Cooldown arm before `onPreCombatStart` | `engine/simulate.js` | Corrected 2026-10-03. |
| Separate post-combat-start pass | `engine/simulate.js` | Implemented and covered by the shared lifecycle fixture. This does not make a missing item-specific handler faithful. |
| Socket gem prepare before host pre-start | `engine/gem-sockets.js` | Implemented as a separate prepare pass before cooldown arm; Topaz's first armed cooldown is covered by the shared fixture. |
| Socket gem combat-start before host start | `engine/gem-sockets.js` | Implemented as a separate pass immediately before the host start hook; covered by the lifecycle trace. |
| Item `onPrepare` before delay | Dedicated ports | **Open.** Existing ports map most preparation behavior to pre-combat; source-led migration is required for timing-sensitive listeners. |
| `onPostCombatStart` item ports | Dedicated ports | The engine pass is implemented. `PoweroftheMoon.gd` timer advance remains a known unported item-specific behavior and must stay visible as a gap. |

## Shared deterministic lifecycle fixture

Run `node scripts/sim-lifecycle-smoke.mjs`. It uses a fixed seed and matching
player/opponent boards containing four Healing Herbs, Stone Golem, a
Topaz-socketed Wooden Sword, and Pocket Sand. The four Herbs intentionally
meet Stone Golem's source threshold of seven Regeneration without adding a
seed-specific rule.

The fixture uses `simulateEngine({ captureLifecycle: true })`. That optional
trace is test-only: it records the shared engine phase and placement at the
time it is invoked; it does not become a combat-log event or alter a fight.

| Source phase / origin | Simulator entry | Fixture assertion |
|---|---|---|
| `Game.gd` combined player-first item lists | `buildCombatStartOrder` and `simulateEngine` | Every phase has the full player batch before the opponent batch. |
| `Item.prepare`: item RNG reset, then `Gem.prepare` | preparation loop, `prepareGemSockets` | Every piece traces `prepare` then `socket_prepare`; Topaz changes the first armed host cooldown. |
| `Item.preCombatStart`: gem, cooldown arm, item hook | start loops in `simulateEngine` | Each placement traces socket preparation, cooldown arm, then pre-start in that order. |
| `Item.combatStart`: gem then item hook | `combatStartGemSockets`, script `onCombatStart` | Each placement traces socket combat-start immediately before host combat-start. |
| `Item.postCombatStart` | final post-start loop | Both boards complete the separate post-start pass. |
| Healing Herbs grant -> Stone Golem listener -> stack spend/block | stack-bus callbacks from the registered port | A same-`t` causal chain preserves root and greater nested depth, rather than relying only on timestamp sorting. |
| Pocket Sand combat-start consume/activation | consumable port | Exactly one activation and consumed effect per side occurs at the combat-start timestamp. |

This fixture validates the shared lifecycle and causal-order infrastructure.
It is not evidence that every item `onPrepare` or post-start override has been
ported; known source-specific gaps remain in the fidelity ledger and work plan.

## Required test matrix

Every lifecycle repair must add a deterministic fixture that includes both
sides and verifies ordered events/side effects for:

- priority and player-before-opponent ordering;
- cooldown arm followed by a pre-combat override/deactivation;
- a socketed gem’s prepare effect and combat-start effect;
- start-of-battle grant followed by a reactive spend/refund;
- consume/activation and `onAfterEffectFinished` one-shots;
- a post-combat-start effect;
- identical timestamps with parent/root causal ordering.

The fixture must assert the event sequence, not only final HP. Use a live
capture when the extract does not establish timing.
