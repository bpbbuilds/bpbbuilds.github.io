import assert from 'node:assert/strict';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amulet_of_alchemy');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onPeerActivated, 'function');
assert.equal(typeof handler?.onChargeReceived, 'function');
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const amulet = { itemId: 'amulet_of_alchemy', placementKey: `${side}:amulet`, name: 'Amulet of Alchemy', params: { buffs: 2, delay: 1 }, side };
  const potion = { itemId: 'health_potion', placementKey: `${side}:potion`, name: 'Health Potion', charges: 0, alive: false, side };
  const events = []; let triggered = 0;
  const ctx = { player: owner, dummy: createActor(side === 'you' ? 'dummy' : 'player'), pieces: [amulet, potion], itemsById: new Map([[amulet.itemId, { id: amulet.itemId, chance: 100 }], [potion.itemId, { id: potion.itemId, type: 'Potion' }]]), events, t: 0, rng: () => 0, activatePiece() { triggered += 1; } };
  handler.onCombatStart(amulet, ctx);
  assert.equal(owner.stacks.lucky + owner.stacks.regeneration + owner.stacks.mana, 2, `start grants source buff count on ${side}`);
  handler.onPeerActivated(amulet, potion, ctx);
  const charge = amulet.pendingCharges?.[0];
  assert.ok(charge, `potion activation queues delayed refill on ${side}`);
  handler.onChargeReceived(amulet, ctx, charge.meta);
  assert.equal(triggered, 1, `delayed refill re-triggers potion on ${side}`);
}
console.log('OK Amulet of Alchemy focused smoke');
