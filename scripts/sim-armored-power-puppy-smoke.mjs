import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('armored_power_puppy');
assert.equal(typeof handler?.onPrepare, 'function', 'Armored Power Puppy applies source speed and rotation setup during preparation');

for (const side of ['you', 'them']) {
  const puppy = { itemId: 'armored_power_puppy', placementKey: `${side}:puppy`, params: { p1: 2, p2: 3, p3: 4, p4: 10, p5: 20 }, speedScale: 0 };
  const pet = { itemId: 'pet', placementKey: `${side}:pet` };
  const food = { itemId: 'food', placementKey: `${side}:food` };
  const graph = { pieces: new Map([[puppy.placementKey, { key: puppy.placementKey, id: puppy.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }], [pet.placementKey, { key: pet.placementKey, id: pet.itemId, cells: ['1,0'], affectCells: [] }], [food.placementKey, { key: food.placementKey, id: food.itemId, cells: ['2,0'], affectCells: [] }]]), filled: new Map([['0,0', puppy.placementKey], ['1,0', pet.placementKey], ['2,0', food.placementKey]]) };
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const ctx = { player, pieces: [puppy, pet, food], graph, itemsById: new Map([[puppy.itemId, { id: puppy.itemId, type: 'Pet' }], [pet.itemId, { id: pet.itemId, type: 'Pet' }], [food.itemId, { id: food.itemId, type: 'Food' }]]), canAffect: null, rng: () => 0, events: [], t: 0 };
  handler.onPrepare(puppy, ctx);
  assert.ok(Math.abs(puppy.speedScale - 0.3) < 1e-12, `Food and Pet speed sources add during preparation on ${side}`);
  handler.onCooldownEffect(puppy, ctx);
  assert.equal(player.stacks.lucky, 2, `first inherited rotation option grants Lucky on ${side}`);
  handler.onCooldownEffect(puppy, ctx);
  assert.equal(player.stacks.regeneration, 3, `used rotation option is removed before the next source cooldown on ${side}`);
}

console.log('OK Armored Power Puppy focused smoke');
