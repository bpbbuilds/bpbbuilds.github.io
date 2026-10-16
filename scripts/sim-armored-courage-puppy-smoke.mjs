import assert from 'node:assert/strict';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('armored_courage_puppy');
assert.equal(typeof handler?.onPreCombatStart, 'function', 'Armored Courage Puppy inherits Courage Puppy pre-combat damage setup');

for (const side of ['you', 'them']) {
  const puppy = { itemId: 'armored_courage_puppy', placementKey: `${side}:puppy`, params: { p1: 2 }, damageMin: 4, damageMax: 4 };
  const pet = { itemId: 'pet', placementKey: `${side}:pet` };
  const graph = { pieces: new Map([[puppy.placementKey, { key: puppy.placementKey, id: puppy.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }], [pet.placementKey, { key: pet.placementKey, id: pet.itemId, cells: ['1,0'], affectCells: [] }]]), filled: new Map([['0,0', puppy.placementKey], ['1,0', pet.placementKey]]) };
  handler.onPreCombatStart(puppy, { pieces: [puppy, pet], graph, itemsById: new Map([[puppy.itemId, { id: puppy.itemId, type: 'Pet' }], [pet.itemId, { id: pet.itemId, type: 'Pet' }]]), canAffect: null });
  assert.equal(puppy.bonusDamage, 2, `linked Pet adds inherited source bonus damage on ${side}`);
}

console.log('OK Armored Courage Puppy focused smoke');
