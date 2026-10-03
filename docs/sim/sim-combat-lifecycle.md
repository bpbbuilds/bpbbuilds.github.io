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
| Separate post-combat-start pass | `engine/simulate.js` | Added 2026-10-03; no item port is yet promoted on this fact alone. |
| Socket gem prepare before host pre-start | `engine/gem-sockets.js` | **Open.** The current helper combines prepare and combat-start work; split it before upgrading socketed-gem fidelity. |
| Socket gem combat-start before host start | `engine/gem-sockets.js` | **Open.** Current application follows host `onCombatStart`; must be split and reordered. |
| Item `onPrepare` before delay | Dedicated ports | **Open.** Existing ports map most preparation behavior to pre-combat; source-led migration is required for timing-sensitive listeners. |
| `onPostCombatStart` item ports | Dedicated ports | **Open.** `PoweroftheMoon.gd` is the known extract override; audit and port it in the post-start phase. |

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
