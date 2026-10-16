import assert from 'node:assert/strict';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { BAG_STONE_AMMO } from '../js/pages/sim/engine/scripts/stone-ammo.js';

const handler = getScriptHandler('bag_of_stones');
assert.equal(typeof handler?.onPrepare, 'function', 'Bag of Stones applies its tags during preparation');

for (const side of ['you', 'them']) {
  const bag = {
    itemId: 'bag_of_stones',
    placementKey: `${side}:bag`,
    side,
    cells: ['2,2'],
  };
  const starredStone = {
    itemId: 'stone',
    placementKey: `${side}:starred-stone`,
    side,
    ammunition: 1,
  };
  const unstarredStone = {
    itemId: 'stone',
    placementKey: `${side}:unstarred-stone`,
    side,
    ammunition: 1,
  };
  const graph = {
    pieces: new Map([
      [bag.placementKey, { key: bag.placementKey, id: bag.itemId, cells: bag.cells, affectCells: [] }],
      [starredStone.placementKey, { key: starredStone.placementKey, id: starredStone.itemId, cells: ['2,1'], affectCells: [] }],
      [unstarredStone.placementKey, { key: unstarredStone.placementKey, id: unstarredStone.itemId, cells: ['3,2'], affectCells: [] }],
    ]),
    filled: new Map([
      ['2,2', bag.placementKey],
      ['2,1', starredStone.placementKey],
      ['3,2', unstarredStone.placementKey],
    ]),
  };
  const ctx = {
    graph,
    pieces: [bag, starredStone, unstarredStone],
    itemsById: new Map([
      [bag.itemId, { id: bag.itemId, type: 'Bag' }],
      [starredStone.itemId, { id: starredStone.itemId, type: 'Weapon', tags: ['Stone'] }],
      [unstarredStone.itemId, { id: unstarredStone.itemId, type: 'Weapon', tags: ['Stone'] }],
    ]),
  };

  handler.onPrepare(bag, ctx);
  assert.equal(starredStone.ammunition, BAG_STONE_AMMO, `the UP-1 Stone receives source bag ammunition on ${side}`);
  assert.equal(unstarredStone.ammunition, 1, `a Stone outside the source star remains unchanged on ${side}`);
}

console.log('OK Bag of Stones focused smoke');
