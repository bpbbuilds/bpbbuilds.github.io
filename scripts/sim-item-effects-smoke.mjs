/**
 * Shared Item helper contract: block/stack helpers, random stack selection,
 * protection-aware stealing, and charge receive/leave ordering.
 *
 *   node scripts/sim-item-effects-smoke.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import {
  bindBuffPowerPieces,
  unbindBuffPowerPieces,
} from '../js/pages/sim/engine/buff-power.js';
import {
  grantStacks,
  giveRandomBuffs,
  inflictRandomDebuffs,
  stealStack,
} from '../js/pages/sim/engine/buff-economy.js';
import { deliverCharge, leaveCharge } from '../js/pages/sim/engine/charge-delivery.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');

assert.match(source, /func giveBlock\(amount = getBlock\(\), canTriggerEffects = true, triggerEvent = null\):[\s\S]*giveStacks\(character\(\), Game\.EventType\.Block/);
assert.match(source, /func giveStacks\(target, type: int, amount, triggerEvent = null\):[\s\S]*round\(amount \* buffPowers\[type\]\)/);
assert.match(source, /func stealStack\(type: int, amount, triggerEvent = null\):[\s\S]*opponent\(\)\.loseStacks\(type, amount, self, triggerEvent\)[\s\S]*giveStacks\(character\(\), type, amount, removeEvent\)/);
assert.match(source, /func giveRandomBuffs\(numBuffs: int[\s\S]*pickRandomStacksToGive\(availableBuffs, numBuffs\)/);
assert.match(source, /func inflictRandomDebuffs\(numDebuffs[\s\S]*pickRandomStacksToGive\(availableDebuffs, numDebuffs\)/);
assert.match(source, /func sendCharge\(durPerTile: float, cells: Array, speedFactor: float, event\):[\s\S]*chargeDuration \/ speedFactor/);
assert.match(source, /func chargeReceived\(charge\):[\s\S]*numCharges \+= 1[\s\S]*onChargeReceived/);

const bus = createCombatBus();
const actor = createActor('player');
actor._combatBus = bus;
const blockEvents = [];
bus.on('item_gave_block', (event) => blockEvents.push(event));

const sourcePiece = {
  itemId: 'source',
  placementKey: 'source',
  buffPowers: { block: 1.5 },
};
bindBuffPowerPieces([sourcePiece]);
try {
  const block = grantStacks(actor, 'block', 3, {
    originKey: sourcePiece.placementKey,
    originId: sourcePiece.itemId,
  });
  assert.equal(block.gained, 5, 'giveBlock rounds the source buff-power result');
  assert.equal(blockEvents.length, 1, 'block grants expose the item-level signal');
  assert.equal(blockEvents[0].originKey, sourcePiece.placementKey);

  const random = giveRandomBuffs(actor, 4, () => 0, {
    availableBuffs: ['lucky', 'mana'],
    originKey: sourcePiece.placementKey,
    originId: sourcePiece.itemId,
  });
  assert.deepEqual(random, { lucky: 4 }, 'random buffs pick one source type per stack');
  assert.equal(actor.stacks.lucky, 4);

  const debuffs = inflictRandomDebuffs(actor, 3, () => 0.99, {
    availableDebuffs: ['poison', 'cold'],
    originKey: sourcePiece.placementKey,
    originId: sourcePiece.itemId,
  });
  assert.deepEqual(debuffs, { cold: 3 }, 'random debuffs honor the supplied pool');
  assert.equal(actor.stacks.cold, 3);
} finally {
  unbindBuffPowerPieces();
}

const from = createActor('dummy');
const to = createActor('player');
from.stacks.regeneration = 3;
from.buffProtectStacks = 1;
const stolen = stealStack(from, to, 'regeneration', 2, { rng: () => 0 });
assert.equal(stolen.stolen, 1, 'stack theft respects source Buff Protect');
assert.equal(from.stacks.regeneration, 2);
assert.equal(to.stacks.regeneration, 1);

const chargePiece = { itemId: 'charge_target', placementKey: 'charge-target', alive: true, numCharges: 0 };
deliverCharge(chargePiece, { t: 1 });
assert.equal(chargePiece.numCharges, 1, 'chargeReceived increments before the target hook');
leaveCharge(chargePiece, { t: 2 });
assert.equal(chargePiece.numCharges, 0, 'chargeLeft decrements after the charge leaves');

console.log('OK Item helper source order, block signal, buff-power rounding, random selection, protected stealing, and charge lifecycle');
