import assert from 'node:assert/strict';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('arcane_intellect');
assert.equal(typeof handler?.onPrepare, 'function', 'Arcane Intellect applies its source speed during preparation');

for (const side of ['you', 'them']) {
  const intellect = { itemId: 'arcane_intellect', placementKey: `${side}:intellect`, params: { speed: 12 } };
  const magic = { itemId: 'magic', placementKey: `${side}:magic`, cooldown: 2, speedScale: 0 };
  const noCooldown = { itemId: 'no-cd', placementKey: `${side}:no-cd`, cooldown: 0, speedScale: 0 };
  const nonMagic = { itemId: 'non-magic', placementKey: `${side}:non-magic`, cooldown: 2, speedScale: 0 };
  const graph = { pieces: new Map([[intellect.placementKey, { key: intellect.placementKey, id: intellect.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }, { cell: '3,0', color: 'primary' }] }], [magic.placementKey, { key: magic.placementKey, id: magic.itemId, cells: ['1,0'], affectCells: [] }], [noCooldown.placementKey, { key: noCooldown.placementKey, id: noCooldown.itemId, cells: ['2,0'], affectCells: [] }], [nonMagic.placementKey, { key: nonMagic.placementKey, id: nonMagic.itemId, cells: ['3,0'], affectCells: [] }]]), filled: new Map([['0,0', intellect.placementKey], ['1,0', magic.placementKey], ['2,0', noCooldown.placementKey], ['3,0', nonMagic.placementKey]]) };
  handler.onPrepare(intellect, { pieces: [intellect, magic, noCooldown, nonMagic], graph, itemsById: new Map([[intellect.itemId, { id: intellect.itemId }], [magic.itemId, { id: magic.itemId, type: 'Magic' }], [noCooldown.itemId, { id: noCooldown.itemId, type: 'Magic' }], [nonMagic.itemId, { id: nonMagic.itemId, type: 'Weapon' }]]), canAffect: null });
  assert.equal(magic.speedScale, 0.12, `Magic cooldown item gets source speed on ${side}`);
  assert.equal(noCooldown.speedScale, 0, `Magic item without cooldown is excluded on ${side}`);
  assert.equal(nonMagic.speedScale, 0, `non-Magic cooldown item is excluded on ${side}`);
}

console.log('OK Arcane Intellect focused smoke');
