import assert from 'node:assert/strict';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amulet_of_feasting');
assert.equal(typeof handler?.onPrepare, 'function', 'Amulet of Feasting applies Food speed during source preparation');

for (const side of ['you', 'them']) {
  const amulet = {
    itemId: 'amulet_of_feasting',
    placementKey: `${side}:amulet`,
    params: { foodspeed: 15 },
    side,
  };
  const food = { itemId: 'banana', placementKey: `${side}:food`, speedScale: 0, side };
  const nonFood = { itemId: 'wooden_sword', placementKey: `${side}:weapon`, speedScale: 0, side };
  const graph = {
    pieces: new Map([
      [amulet.placementKey, { key: amulet.placementKey, id: amulet.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }],
      [food.placementKey, { key: food.placementKey, id: food.itemId, cells: ['1,0'], affectCells: [] }],
      [nonFood.placementKey, { key: nonFood.placementKey, id: nonFood.itemId, cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', amulet.placementKey], ['1,0', food.placementKey], ['2,0', nonFood.placementKey]]),
  };
  const ctx = {
    pieces: [amulet, food, nonFood],
    itemsById: new Map([
      [amulet.itemId, { id: amulet.itemId }],
      [food.itemId, { id: food.itemId, type: 'Food' }],
      [nonFood.itemId, { id: nonFood.itemId, type: 'Weapon' }],
    ]),
    graph,
    canAffect: null,
  };

  handler.onPrepare(amulet, ctx);
  assert.equal(food.speedScale, 0.15, `Food gets source Food speed during preparation on ${side}`);
  assert.equal(nonFood.speedScale, 0, `non-Food does not get Food speed on ${side}`);
}

console.log('OK Amulet of Feasting focused smoke');
