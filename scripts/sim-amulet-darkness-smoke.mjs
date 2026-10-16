import assert from 'node:assert/strict';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amulet_of_darkness');
assert.equal(typeof handler?.onPrepare, 'function', 'source listener binds during prepare');
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const opponent = createActor(side === 'you' ? 'dummy' : 'player');
  const bus = createCombatBus(); const events = [];
  const piece = { itemId: 'amulet_of_darkness', placementKey: `${side}:dark`, name: 'Amulet of Darkness', params: { damt: 4, dam: 4 }, side };
  const ctx = { player: owner, dummy: opponent, bus, events, t: 0, rng: () => 0, itemsById: new Map([[piece.itemId, { id: piece.itemId, chance: 100 }]]) };
  handler.onPrepare(piece, ctx);
  handler.onPeerActivated(piece, { itemId: 'health_potion', name: 'Health Potion' }, ctx);
  assert.ok(events.some((event) => event.type === 'damage' && event.itemId === 'amulet_of_darkness'), `affected activation deals source effect damage on ${side}`);
  bus.emit('character_damaged', { actor: opponent, hit: true, damage: { damage: 4, damageSource: { isEffectDamage: true } } });
  assert.equal(opponent.stacks.poison + opponent.stacks.blind + opponent.stacks.cold, 2, `each threshold-sized effect-damage hit inflicts a source debuff on ${side}`);
}
console.log('OK Amulet of Darkness focused smoke');
