import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/UniquelyUnique.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-skills.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.uniquely_unique?.file, 'Exclusive/UniquelyUnique.gd');
assert.deepEqual(inventory.byId.uniquely_unique?.overrides, ['onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*Rarity\.Unique[\s\S]*platinCardDescriptor[\s\S]*customerCardDescriptor/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItems\(\)[\s\S]*affectedItems\[0\]\.addSpeed\(/);
assert.match(source, /getNumAffectedItems\(Affected\.Secondary\) \* bonusSpeed/);
assert.match(source, /func onBought\(\):[\s\S]*boosted = 2/);
assert.match(source, /func onItemRoll\(descr\):[\s\S]*multiplyWeight\(1\.5\)/);
assert.match(source, /func onItemRolled\(descr\):[\s\S]*boosted -= 1/);
assert.match(portSource, /handlerId: 'uniquely_unique'/);
assert.match(portSource, /onPrepare\(piece, ctx\)/);
assert.match(portSource, /getP1\(piece\.params/);
assert.match(portSource, /getP2\(piece\.params/);

const handler = getScriptHandler('uniquely_unique');
assert.equal(handler?.handlerId, 'uniquely_unique');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Uniquely Unique prepares before combat cooldowns arm');

for (const id of ['uniquely_unique', 'hammer', 'toolbox', 'customer_card', 'platin_customer_card', 'wooden_sword']) {
  assert.ok(byId.get(id), `catalog item ${id}`);
}

const unique = {
  ...byId.get('uniquely_unique'),
  itemId: 'uniquely_unique',
  placementKey: 'unique',
  name: 'Uniquely Unique',
  kind: 'skill',
  params: { speed: 99, p1: 20, speed2: 99, p2: 12 },
};
const firstPrimary = {
  ...byId.get('hammer'),
  itemId: 'hammer',
  placementKey: 'primary',
  name: 'Hammer',
  kind: 'weapon',
  speedScale: 0,
};
const secondaryIds = ['toolbox', 'customer_card', 'platin_customer_card'];
const secondaryPieces = secondaryIds.map((id) => ({
  ...byId.get(id),
  itemId: id,
  placementKey: id,
  name: id,
  kind: 'item',
  speedScale: 0,
}));
const excluded = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'excluded',
  name: 'Wooden Sword',
  kind: 'weapon',
  speedScale: 0,
};
const graph = {
  pieces: new Map([
    ['unique', { key: 'unique', id: 'uniquely_unique', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'secondary' },
      { cell: '3,0', color: 'secondary' },
      { cell: '4,0', color: 'secondary' },
      { cell: '5,0', color: 'secondary' },
    ] }],
    ['primary', { key: 'primary', id: 'hammer', cells: ['1,0'], affectCells: [] }],
    ['toolbox', { key: 'toolbox', id: 'toolbox', cells: ['2,0'], affectCells: [] }],
    ['customer_card', { key: 'customer_card', id: 'customer_card', cells: ['3,0'], affectCells: [] }],
    ['platin_customer_card', { key: 'platin_customer_card', id: 'platin_customer_card', cells: ['4,0'], affectCells: [] }],
    ['excluded', { key: 'excluded', id: 'wooden_sword', cells: ['5,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'unique'],
    ['1,0', 'primary'],
    ['2,0', 'toolbox'],
    ['3,0', 'customer_card'],
    ['4,0', 'platin_customer_card'],
    ['5,0', 'excluded'],
  ]),
};
const itemsById = new Map([
  ['uniquely_unique', byId.get('uniquely_unique')],
  ['hammer', byId.get('hammer')],
  ['toolbox', byId.get('toolbox')],
  ['customer_card', byId.get('customer_card')],
  ['platin_customer_card', byId.get('platin_customer_card')],
  ['wooden_sword', byId.get('wooden_sword')],
]);
const ctx = {
  graph,
  pieces: [unique, ...secondaryPieces, firstPrimary, excluded],
  itemsById,
  canAffect: { rulesById: rules.byId },
};

handler.onPrepare(unique, ctx);
assert.equal(firstPrimary.speedScale, 0.56, 'source p1 plus three accepted secondary targets speeds the first primary item');
assert.equal(secondaryPieces[0].speedScale, 0, 'secondary Unique target is not sped directly');
assert.equal(excluded.speedScale, 0, 'non-cooldown/non-secondary target is excluded');

const zero = { ...unique, placementKey: 'zero', speedScale: 0, params: { p1: 0, p2: 0 } };
handler.onPrepare(zero, { ...ctx, pieces: [zero, firstPrimary], graph: { ...graph, pieces: new Map([['zero', graph.pieces.get('unique')], ['primary', graph.pieces.get('primary')]]) } });
assert.equal(firstPrimary.speedScale, 0.56, 'zero source parameters add no speed');

console.log('OK Uniquely Unique source prepare timing, primary-first targeting, secondary Unique/card count, p1/p2 parameters, exclusions, shop hooks, and zero-safe regression');
