import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Whetstone.gd', 'utf8');
const scene = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Whetstone2.tscn', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-armor.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;

const sourceItem = catalog.find((item) => item.id === 'whetstone2');
assert.ok(sourceItem, 'Whetstone2: extracted catalog row');
assert.match(scene, /res:\/\/Items\/Whetstone\.gd/);
assert.match(source, /func onCombatStart\(\):[\s\S]*item\.addBonusDamage\(dam\)[\s\S]*activate\(\)/);
assert.match(portSource, /const whetstone2Port = \{ \.\.\.whetstonePort, handlerId: 'whetstone2' \}/);
assert.equal(getScriptHandler('whetstone2')?.handlerId, 'whetstone2', 'Whetstone2 uses the inherited Whetstone handler');

const sourceHandler = getScriptHandler('whetstone');
const improvedHandler = getScriptHandler('whetstone2');
assert.equal(typeof sourceHandler?.onCombatStart, 'function');
assert.equal(typeof improvedHandler?.onCombatStart, 'function');
assert.notEqual(sourceHandler, improvedHandler, 'Whetstone2 has its own registered handler identity');

const target = {
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  name: 'Wooden Sword',
  kind: 'weapon',
  damageMin: 1,
  damageMax: 3,
  bonusDamage: 0,
  empowerable: true,
};
const piece = {
  itemId: 'whetstone2',
  placementKey: 'whetstone2',
  name: 'Improved Whetstone',
  kind: 'passive',
  params: { ...sourceItem.params },
};
const events = [];
const ctx = {
  t: 0,
  player: {},
  events,
  graph: {
    pieces: new Map([
      ['whetstone2', { key: 'whetstone2', id: 'whetstone2', affectCells: [{ cell: 'weapon-cell', color: 'primary' }], cells: [] }],
      ['weapon', { key: 'weapon', id: 'wooden_sword', affectCells: [], cells: ['weapon-cell'] }],
    ]),
    filled: new Map([['weapon-cell', 'weapon']]),
  },
  pieces: [piece, target],
  itemsById: new Map([
    ['whetstone2', sourceItem],
    ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon', damageMin: 1, damageMax: 3 }],
  ]),
  canAffect: null,
};

improvedHandler.onCombatStart(piece, ctx);
assert.equal(target.bonusDamage, 1, 'Whetstone2 applies the inherited exact damage bonus');
assert.equal(events.at(-1)?.type, 'activate', 'Whetstone2 preserves inherited activation ordering');

console.log('OK Whetstone2 source/parity smoke');
