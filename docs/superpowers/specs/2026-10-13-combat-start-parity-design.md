# Combat-start parity design

## Goal

Document the extracted Backpack Battles start-of-battle pipeline and correct the
three confirmed simulator divergences without broadening the combat model.

## Evidence boundary

This design is based on the local game extract, principally:

- `Core/Game.gd`: `switchToCombat`, `prepareItems`, `activateItems`, and
  `ItemSort.sort_TriggerPriority`.
- `Core/Character.gd`: `prepare`, `combatStart`, `takeDamage`, `loseHealth`,
  `stun`, `onTick`, and the auto-rage timer.
- `Items/Item.gd`: `prepare`, `preCombatStart`, `combatStart`, and
  `postCombatStart`.
- `Items/Gems/Gem.gd`: `onPrepare` and `combatStart`.
- `Items/Shield.gd`, `Items/SpikedShield.gd`, and
  `Items/Exclusive/FullBodyProtection.gd`.
- `Utility/EventBus.gd`: listeners run in connection order. There is no
  independent event-listener priority layer in the source.

The document describes source behavior, not UI animation timing. Game UI-only
listeners of `Game.combat_start` (combat scene, cooldown visuals, and stat
display) are intentionally out of simulator scope.

## Verified source sequence

### 1. Build the persistent combat order

At the combat transition, `Game.gd` independently copies, shuffles, and sorts
the player and opponent inventories by descending `Item.getTriggerPriority()`.
It then concatenates the two lists as **player items followed by opponent
items**. Equal-priority order is randomized by the shuffle before the sort.
The same combined list is reused by every item lifecycle pass.

Priority categories are:

| Category | Value | Examples |
| --- | ---: | --- |
| Highest | 10000 | Deer Totem |
| High + 100 | 1100 | Time Melting, Puzzle Bag of Endurance |
| High + 10 | 1010 | Berserker Bag, Wolf Badge |
| High + 5 | 1005 | Battery, Fedora, Fortuna's Kiss, Generator, Lucky Piggy, Amulet of Fortune |
| High + 3 / +2 / +1 | 1003 / 1002 / 1001 | Mr Struggles, Stone items, Hedgehog; boots and Automanaton; Stone Golem and Strong Health Potion |
| High | 1000 | Dark Lantern, Health Potion, Shelly, Heart of Darkness |
| Normal + offsets | 2 / 1 | Holy Spear, King Crown |
| Normal | 0 | Most items |
| Low | -1000 | Just Stats, More Stats |

### 2. Prepare, before the combat delay

`prepareItems(combinedItems)` performs both character preparations first, then
visits each item in the persistent combined order. A character preparation
resets stamina regeneration/RNG state and selects an automatic Battle Rage
source when applicable. For each item, `Item.prepare()`:

1. caches affected targets;
2. resets item chance/damage RNGs;
3. runs `gem.prepare()` for every socketed gem;
4. runs the host item's `onPrepare()`.

Gem `onPrepare()` dispatches its inventory/weapon/armor preparation at this
point. That is why socketed Topaz speed, Sapphire listener registration, and
similar effects are observable by the host's own preparation hook.

Prepared listeners are inserted in this exact item order. `EventBus.gd`
iterates connections in insertion order, so the earlier source item receives a
shared signal first. This is distinct from item trigger priority; priority only
creates the initial preparation order.

### 3. Start the live fight after `COMBAT_DELAY`

`activateItems(combinedItems)` proceeds in strict passes:

1. emits global `combat_start` and starts the combat timer;
2. calls `PLAYER.combatStart()`, then `OPPONENT.combatStart()`;
3. runs every item's `preCombatStart()`;
4. runs every item's `combatStart()`;
5. runs every item's `postCombatStart()`.

Each `preCombatStart()` is contiguous for one item: gem pre-start hooks,
cooldown adjustment/arming, then host `onPreCombatStart()`. Each
`combatStart()` is likewise contiguous: visual rotation, gem combat-start
hooks, then host `onCombatStart()`. Each `postCombatStart()` runs socket post
hooks before host `onPostCombatStart()`.

This means a start effect from an earlier item can wake a listener installed by
an earlier prepared item, but cannot wake a listener belonging to an item that
has not yet prepared. It also means an item cannot see a later item’s
start-of-battle effect until that later item's turn in the relevant pass.

### 4. Reactive and state ordering

- `Character.takeDamage()` resolves miss, crit/resistance, invulnerability,
  pre-damage hooks, damage reduction, Block, health loss, log event, and then
  emits `character_attacked` and `character_damaged` before death/spikes.
- `Character.loseHealth()` bypasses ordinary damage mitigation, creates the
  lose-health event, emits `character_damaged`, then checks death. Dark
  Lantern's opening 50%-max-health loss uses this path.
- Threshold hooks therefore observe the post-loss health value. Source checks
  commonly use strict `<`; exactly 50% does not satisfy a 50% threshold.
- Successful stun keeps one `max(existing, incoming)` duration, emits one stun
  event, and pauses the stunned character's item cooldown/trigger processing.
- Character ticks begin after `combatStart`: even ticks Regeneration, odd
  ticks Poison. Heat is not a free character DoT.
- If no item tagged as a Battle Rage starter exists, Character selects one
  eligible Battle-Rage-effect item/gem before combat and starts it at five
  seconds for a four-second base duration. Item-specific Battle Rage modifiers
  apply through prepared listeners.

## Simulator status before this change

Already aligned:

- per-side shuffle, source priority map, player-before-opponent batch, and
  reuse of that order;
- separate pre-, combat-, and post-combat-start passes;
- cooldown arm before an item's pre-combat hook;
- Dark Lantern's source `loseHealth` behavior and threshold-event ordering;
- canonical damage events, stun state, ticks, and explicit item handlers.

Confirmed divergences:

1. `prepareGemSockets()` currently runs in the simulator's pre-combat-start
   pass. It must instead run in the per-item prepare pass before the host
   handler.
2. `applyPreCombat()` infers permanent actor damage reduction and starting
   Spikes from a catalog item's armor classification/text. The extract has no
   such generic armor start rule. Shields use prepared incoming-attack hooks;
   Spiked Shield grants Spikes only after a successful qualifying block.
3. The Full Body Protection port gives permanent actor-wide damage reduction at
   combat start. Source connects a prepared `pre_take_damage` listener when
   its set is active; that listener reduces only `isAttackOrEffect()` damage.

## Approved implementation

1. Move the socket preparation call and its lifecycle trace into the item
   prepare loop. Retain only actual gem pre-start work in the pre-combat pass.
2. Remove inferred generic armor damage reduction/Spikes from the startup
   path. Preserve explicit item/gem ports that grant Block, Spikes, resistance,
   or per-hit reduction.
3. Replace Full Body Protection's actor-stat mutation with a prepared
   pre-take-damage listener that follows the source eligibility boundary.
4. Add deterministic smoke coverage for socket-before-host preparation,
   absence of invented generic armor stats, and Full Body Protection's
   attack/effect-only reduction.
5. Publish the final user-facing audit at
   `docs/sim/combat-start-sequence.md`, including the ordering table, source
   anchors, simulator status, and test commands.

## Non-goals

- No alteration to visual combat-start effects, combat-log presentation, or
  unrelated item ports.
- No claim that every source item hook is ported solely because the shared
  lifecycle is accurate.
- No change to cooldown tie-breaking outside the start-of-battle pipeline.

## Acceptance criteria

- A socketed preparation effect is visible to its host `onPrepare` handler.
- A plain armor/shield item does not acquire inferred opening DR or Spikes.
- Full Body Protection reduces eligible attack/effect damage only while its
  source set condition is active; non-eligible damage remains unchanged.
- Existing combat-start priority/lifecycle/Dark Lantern regressions pass.
- `node scripts/build-sim-fidelity-ledger.mjs --check` and `git diff --check`
  pass.
