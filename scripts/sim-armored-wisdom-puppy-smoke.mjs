import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('armored_wisdom_puppy');
assert.equal(typeof handler?.onPrepare, 'function', 'Armored Wisdom Puppy inherits Wisdom Puppy preparation setup');

for (const side of ['you', 'them']) {
  const puppy = { itemId: 'armored_wisdom_puppy', placementKey: `${side}:puppy`, params: { p1: 2, p2: 10, p3: 3 }, blockGrant: 5, speedScale: 0 };
  const pet = { itemId: 'pet', placementKey: `${side}:pet` };
  const graph = { pieces: new Map([[puppy.placementKey, { key: puppy.placementKey, id: puppy.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }], [pet.placementKey, { key: pet.placementKey, id: pet.itemId, cells: ['1,0'], affectCells: [] }]]), filled: new Map([['0,0', puppy.placementKey], ['1,0', pet.placementKey]]) };
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  player.stacks.cold = 5;
  const ctx = { t: 0, player, events: [], pieces: [puppy, pet], graph, itemsById: new Map([[puppy.itemId, { id: puppy.itemId, type: 'Pet' }], [pet.itemId, { id: pet.itemId, type: 'Pet' }]]), canAffect: null };
  handler.onPrepare(puppy, ctx);
  assert.equal(puppy.speedScale, 0.1, `linked Pet speed applies during preparation on ${side}`);
  handler.onCooldownEffect(puppy, ctx);
  assert.equal(player.block, 5, `first cooldown grants base Block on ${side}`);
  assert.equal(player.stacks.cold, 3, `first cooldown cleanses source Cold amount on ${side}`);
  handler.onCooldownEffect(puppy, ctx);
  assert.equal(player.block, 13, `each cooldown adds the source growing Block bonus on ${side}`);
}

console.log('OK Armored Wisdom Puppy focused smoke');
