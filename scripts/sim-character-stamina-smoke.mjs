import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyStaminaSackInventoryMax,
  createActor,
  drainStamina,
  effectiveMaxStamina,
  gainMaxStaminaTemporary,
  giveStamina,
  regenStamina,
  tryUseStamina,
} from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';

const source = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');

assert.match(source, /var allowStaminaOverflow: bool = false/);
assert.match(source, /func gainStamina\(amount, item = null, triggerEvent = null\):[\s\S]*curStamina \+= amount[\s\S]*if not allowStaminaOverflow:[\s\S]*clampStamina\(\)/);
assert.match(source, /func useStamina\(amount\):[\s\S]*allowStaminaOverflow = true[\s\S]*character_pre_use_stamina[\s\S]*allowStaminaOverflow = false[\s\S]*curStamina >= amount/);
assert.match(source, /func drainStamina\(amount, item, triggerEvent = null\):[\s\S]*min\(curStamina, amount\)[\s\S]*Removed_Opponent/);
assert.match(source, /func gainMaxStaminaTemporary\(amount, item, triggerEvent, filled: bool = true\):[\s\S]*temporaryMaxStamina \+= amount[\s\S]*if filled and amount > 0:[\s\S]*curStamina \+= amount/);
assert.match(source, /func recalculateMaxStamina\(\):[\s\S]*maxStamina = getBaseMaxStamina\(\)[\s\S]*staminaSackDescriptor[\s\S]*curStamina = maxStamina/);

const player = createActor('player');
const bus = createCombatBus();
player._combatBus = bus;
player._simT = 3;
player.stamina = 4;
const signals = [];
bus.on('pre_use_stamina', ({ amount }) => {
  signals.push(`pre:${amount}`);
  // Source useStamina sets allowStaminaOverflow before this callback, so a
  // rescue can exceed the ordinary cap until the cost is actually applied.
  giveStamina(player, 3);
});
bus.on('stamina_used', ({ amount }) => signals.push(`used:${amount}`));
assert.equal(tryUseStamina(player, 6), 'ok', 'pre-use recovery may rescue a cost above the normal cap');
assert.equal(player.stamina, 1, 'the rescued stamina is consumed after the pre-use hook');
assert.deepEqual(signals, ['pre:6', 'used:6']);

player.stamina = 1;
signals.length = 0;
bus.reset();
assert.equal(tryUseStamina(player, 2), 'starve', 'insufficient stamina remains a no-op after the pre-use hook');
assert.equal(player.stamina, 1);
assert.deepEqual(signals, []);

player.stamina = 2;
gainMaxStaminaTemporary(player, 2);
assert.equal(effectiveMaxStamina(player), 7);
assert.equal(player.stamina, 4, 'filled temporary maximum stamina also fills current stamina');
gainMaxStaminaTemporary(player, 2, { filled: false });
assert.equal(effectiveMaxStamina(player), 9);
assert.equal(player.stamina, 4, 'unfilled temporary maximum stamina does not fill current stamina');

player.stamina = 4;
const drained = [];
bus.on('stamina_drained', ({ amount }) => drained.push(amount));
assert.equal(drainStamina(player, 10, { events: [], t: 4 }), 4);
assert.equal(player.stamina, 0);
assert.deepEqual(drained, [4], 'drain reports the amount actually removed');

player.stamina = 0;
regenStamina(player, 2);
assert.equal(player.stamina, 2, 'stamina regeneration advances by elapsed time');
regenStamina(player, 20);
assert.equal(player.stamina, 9, 'regeneration clamps to permanent plus temporary maximum');

const sack = { itemId: 'stamina_sack', alive: true };
applyStaminaSackInventoryMax(player, [sack, sack]);
assert.equal(player.maxStamina, 7, 'each live stamina sack adds one permanent maximum');
assert.equal(player.stamina, 7, 'inventory maximum recalculation refills stamina to the new maximum');

console.log('OK Character stamina source contract, pre-use overflow rescue, use/drain, temporary max, regeneration, and sack recalculation');
