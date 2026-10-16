import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amulet_of_the_wild');
assert.equal(typeof handler?.onPrepare, 'function', 'Amulet of the Wild applies source spikes limits during preparation');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Amulet of the Wild implements its source cooldown effect');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const amulet = { itemId: 'amulet_of_the_wild', placementKey: `${side}:wild`, name: 'Amulet of the Wild', params: { spikedam: 50, spikes: 3 }, alive: true, charges: 1 };
  const pet = { itemId: 'courage_puppy', placementKey: `${side}:pet`, name: 'Courage Puppy', damageMin: 4, damageMax: 4, alive: true, charges: 1 };
  const nonPet = { itemId: 'wooden_sword', placementKey: `${side}:weapon`, name: 'Wooden Sword', damageMin: 4, damageMax: 4, alive: true, charges: 1 };
  const graph = { pieces: new Map([[amulet.placementKey, { key: amulet.placementKey, id: amulet.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }], [pet.placementKey, { key: pet.placementKey, id: pet.itemId, cells: ['1,0'], affectCells: [] }], [nonPet.placementKey, { key: nonPet.placementKey, id: nonPet.itemId, cells: ['2,0'], affectCells: [] }]]), filled: new Map([['0,0', amulet.placementKey], ['1,0', pet.placementKey], ['2,0', nonPet.placementKey]]) };
  const ctx = { player, dummy, pieces: [amulet, pet, nonPet], graph, itemsById: new Map([[amulet.itemId, { id: amulet.itemId }], [pet.itemId, { id: pet.itemId, type: 'Pet' }], [nonPet.itemId, { id: nonPet.itemId, type: 'Weapon' }]]), canAffect: null, events: [], t: 0, rng: () => 0 };

  handler.onPrepare(amulet, ctx);
  assert.equal(player.meleeSpikesLimit, 1.5, `source melee spikes limit adds during preparation on ${side}`);
  assert.equal(player.rangedSpikesLimit, 0.5, `source ranged spikes limit adds during preparation on ${side}`);
  handler.onCooldownEffect(amulet, ctx);
  assert.equal(player.stacks.spikes, 3, `source spikes are granted on ${side}`);
  assert.ok(ctx.events.some((event) => event.itemId === pet.itemId), `affected Pet cooldown is invoked on ${side}`);
  assert.ok(!ctx.events.some((event) => event.itemId === nonPet.itemId), `non-Pet linked item is not invoked on ${side}`);
  assert.equal(amulet.alive, false, `source after-effect consumes the Amulet on ${side}`);
}

console.log('OK Amulet of the Wild focused smoke');
