import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Markswoman.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-skills.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'markswoman');
const rangedItem = catalog.find((item) => item.id === 'shortbow');
const meleeItem = catalog.find((item) => item.id === 'wooden_sword');

assert.ok(sourceItem, 'Markswoman: extracted catalog row');
assert.ok(rangedItem, 'Markswoman: ranged weapon fixture');
assert.ok(meleeItem, 'Markswoman: melee weapon fixture');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.descriptor\.isRangedWeapon\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(rangedBonusSpeed\)[\s\S]*canBeEmpowered\(\)[\s\S]*addBonusDamageFactor\(rangedBonusDam\)[\s\S]*addAccuracy\(rangedBonusAcc\)/);
assert.match(port, /handlerId: 'markswoman'/);
assert.match(port, /onPrepare\(piece, ctx\)/);

const markswoman = {
  itemId: 'markswoman',
  placementKey: 'markswoman',
  name: 'Markswoman',
  params: sourceItem.params,
  side: 'you',
  alive: true,
};
const ranged = {
  itemId: 'shortbow',
  placementKey: 'ranged',
  name: 'Shortbow',
  side: 'you',
  alive: true,
  kind: 'weapon',
  damageMin: 2,
  damageMax: 3,
  speedScale: 0,
  accuracy: 85,
  bonusDamageFactor: 1,
};
const melee = {
  itemId: 'wooden_sword',
  placementKey: 'melee',
  name: 'Wooden Sword',
  side: 'you',
  alive: true,
  kind: 'weapon',
  damageMin: 1,
  damageMax: 3,
  speedScale: 0,
  accuracy: 90,
  bonusDamageFactor: 1,
};
const ctx = {
  pieces: [markswoman, ranged, melee],
  itemsById: new Map([
    ['markswoman', sourceItem],
    ['shortbow', rangedItem],
    ['wooden_sword', meleeItem],
  ]),
  graph: {
    pieces: new Map([
      ['markswoman', { key: 'markswoman', id: 'markswoman', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
        { cell: '2,0', color: 'primary' },
      ] }],
      ['ranged', { key: 'ranged', id: 'shortbow', cells: ['1,0'], affectCells: [] }],
      ['melee', { key: 'melee', id: 'wooden_sword', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'markswoman'], ['1,0', 'ranged'], ['2,0', 'melee']]),
  },
  canAffect: {
    rulesById: {
      markswoman: { primary: { op: 'true' } },
    },
  },
};

const handler = getScriptHandler('markswoman');
assert.equal(handler?.handlerId, 'markswoman');
handler.onPrepare(markswoman, ctx);
assert.equal(ranged.speedScale, 0.4,
  'Markswoman: preparation adds the exact ranged speed factor');
assert.equal(ranged.bonusDamageFactor, 1.2,
  'Markswoman: empowerable ranged weapon receives the exact damage factor');
assert.equal(ranged.bonusAccuracy, 15,
  'Markswoman: empowerable ranged weapon receives the exact accuracy bonus');
assert.equal(melee.speedScale, 0,
  'Markswoman: melee weapons are not valid source targets');
assert.equal(melee.bonusDamageFactor, 1,
  'Markswoman: melee damage remains unchanged');

const zeroRanged = {
  ...ranged,
  placementKey: 'zero-ranged',
  speedScale: 0,
  bonusDamageFactor: 1,
  bonusAccuracy: undefined,
};
const zero = {
  ...markswoman,
  placementKey: 'zero-markswoman',
  params: { ...sourceItem.params, dam: 0, p1: 0, speed: 0, p2: 0, acc: 0, p3: 0 },
};
const zeroCtx = {
  ...ctx,
  pieces: [zero, zeroRanged],
  graph: {
    pieces: new Map([
      ['zero-markswoman', { key: 'zero-markswoman', id: 'markswoman', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
      ] }],
      ['zero-ranged', { key: 'zero-ranged', id: 'shortbow', cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'zero-markswoman'], ['1,0', 'zero-ranged']]),
  },
};
handler.onPrepare(zero, zeroCtx);
assert.equal(zeroRanged.speedScale, 0,
  'Markswoman: explicit zero speed does not invent a bonus');
assert.equal(zeroRanged.bonusDamageFactor, 1,
  'Markswoman: explicit zero damage does not invent a factor');
assert.equal(zeroRanged.bonusAccuracy, undefined,
  'Markswoman: explicit zero accuracy does not invent a bonus');

console.log('Markswoman source/parity smoke passed.');
