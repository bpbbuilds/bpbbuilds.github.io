import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/OnionCutter.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-scale.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'onion_cutter');

assert.ok(sourceItem, 'Onion Cutter: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Food\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(foodSpeed \* getNumAffectedItems\(\)\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*opponent\(\)\.changeDamageResistance\( - damFactor\)/);
assert.match(port, /handlerId: 'onion_cutter'/);
const onionPort = port.match(/export const onionCutterPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(onionPort, /onPrepare\(piece, ctx\)/);
assert.match(onionPort, /onPreDealDamageEarly\(piece, ctx, hit\)/);
assert.doesNotMatch(onionPort, /onCombatStart\(piece, ctx\)/,
  'Onion Cutter food speed must be prepared before combat starts');
assert.doesNotMatch(onionPort, /Math\.abs\(/,
  'Onion Cutter must preserve the source signed resistance value');

const handler = getScriptHandler('onion_cutter');
assert.equal(handler?.handlerId, 'onion_cutter');

const piece = {
  itemId: 'onion_cutter',
  placementKey: 'onion',
  name: 'Onion Cutter',
  kind: 'weapon',
  params: { dam: 2, p1: 2, speed: 20, p2: 20 },
  speedScale: 0,
};
const foodA = { itemId: 'carrot', placementKey: 'food-a', name: 'Carrot', kind: 'food' };
const foodB = { itemId: 'cheese', placementKey: 'food-b', name: 'Cheese', kind: 'food' };
const nonFood = { itemId: 'wooden_sword', placementKey: 'weapon', name: 'Wooden Sword', kind: 'weapon' };
const ctx = {
  t: 0,
  piece,
  dummy: { damageResistancePct: 0 },
  events: [],
  pieces: [piece, foodA, foodB, nonFood],
  graph: {
    pieces: new Map([
      ['onion', { key: 'onion', id: 'onion_cutter', affectCells: [
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
    ['onion_cutter', sourceItem],
    ['carrot', { id: 'carrot', type: 'Food' }],
    ['cheese', { id: 'cheese', type: 'Food' }],
    ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
  ]),
  canAffect: {},
};

handler.onPrepare(piece, ctx);
assert.equal(piece.speedScale, 0.4, 'two linked Food items grant the source speed bonus');

handler.onPreDealDamageEarly(piece, ctx, { hit: true });
assert.equal(ctx.dummy.damageResistancePct, -2);
handler.onPreDealDamageEarly(piece, ctx, { hit: false });
assert.equal(ctx.dummy.damageResistancePct, -2);

const signedPiece = { ...piece, params: { dam: -3, p2: -3 } };
handler.onPreDealDamageEarly(signedPiece, ctx, { hit: true });
assert.equal(ctx.dummy.damageResistancePct, 1, 'signed source value can increase resistance');

console.log('Onion Cutter source/parity smoke passed.');
