import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Pan.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-aura.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'pan');

assert.ok(sourceItem, 'Pan: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Food\)/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*addBonusDamage\(getP1\(\) \* getNumAffectedItems\(\)\)/);
assert.match(port, /handlerId: 'pan'/);
const panPort = port.match(/const panPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(panPort, /onPreCombatStart\(piece, ctx\)/);
assert.doesNotMatch(panPort, /onCombatStart\(piece, ctx\)/);

const handler = getScriptHandler('pan');
assert.equal(handler?.handlerId, 'pan');

const piece = {
  itemId: 'pan',
  placementKey: 'pan',
  name: 'Pan',
  kind: 'weapon',
  params: { p1: 1 },
  bonusDamage: 0,
};
const foodA = { itemId: 'carrot', placementKey: 'food-a', kind: 'food' };
const foodB = { itemId: 'cheese', placementKey: 'food-b', kind: 'food' };
const weapon = { itemId: 'wooden_sword', placementKey: 'weapon', kind: 'weapon' };
const ctx = {
  piece,
  pieces: [piece, foodA, foodB, weapon],
  graph: {
    pieces: new Map([
      ['pan', { key: 'pan', id: 'pan', affectCells: [
        { cell: 'food-a', color: 'primary' },
        { cell: 'food-b', color: 'primary' },
        { cell: 'weapon', color: 'primary' },
      ], cells: [] }],
      ['food-a', { key: 'food-a', id: 'carrot', affectCells: [], cells: ['food-a'] }],
      ['food-b', { key: 'food-b', id: 'cheese', affectCells: [], cells: ['food-b'] }],
      ['weapon', { key: 'weapon', id: 'wooden_sword', affectCells: [], cells: ['weapon'] }],
    ]),
    filled: new Map([
      ['food-a', 'food-a'],
      ['food-b', 'food-b'],
      ['weapon', 'weapon'],
    ]),
  },
  itemsById: new Map([
    ['pan', sourceItem],
    ['carrot', { id: 'carrot', type: 'Food' }],
    ['cheese', { id: 'cheese', type: 'Food' }],
    ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
  ]),
  canAffect: {},
};

handler.onPreCombatStart(piece, ctx);
assert.equal(piece.bonusDamage, 2, 'Pan counts only linked Food items');

const zeroPiece = { ...piece, bonusDamage: 0, params: { p1: 0 } };
handler.onPreCombatStart(zeroPiece, ctx);
assert.equal(zeroPiece.bonusDamage || 0, 0);

console.log('Pan source/parity smoke passed.');
