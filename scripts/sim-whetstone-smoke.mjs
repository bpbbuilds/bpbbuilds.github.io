import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Whetstone.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-aura.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const sourceItem = catalog.find((item) => item.id === 'whetstone');
const targetItem = catalog.find((item) => item.id === 'wooden_sword');

assert.ok(sourceItem && targetItem, 'Whetstone: extracted catalog rows');
assert.match(source, /onready var dam: = getP\("dam"\)/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*item\.addBonusDamage\(dam\)[\s\S]*activate\(\)/);

const port = portSource.match(/export const whetstonePort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /getPName\(piece\.params, 'dam'/);
assert.match(port, /pushActivate\(piece/);
assert.doesNotMatch(port, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'dam'/);
assert.ok(getScriptHandler('whetstone'), 'Whetstone handler is registered');

const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};
const graph = {
  pieces: new Map([
    ['whetstone', {
      key: 'whetstone',
      id: 'whetstone',
      affectCells: [{ cell: 'weapon-cell', color: 'primary' }],
      cells: [],
    }],
    ['weapon', { key: 'weapon', id: 'wooden_sword', affectCells: [], cells: ['weapon-cell'] }],
  ]),
  filled: new Map([['weapon-cell', 'weapon']]),
};
const piece = {
  itemId: 'whetstone',
  placementKey: 'whetstone',
  name: 'Whetstone',
  kind: 'passive',
  side: 'you',
  alive: true,
  params: { ...sourceItem.params },
};
const target = {
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  name: 'Wooden Sword',
  kind: 'weapon',
  side: 'you',
  damageMin: targetItem.damageMin,
  damageMax: targetItem.damageMax,
  bonusDamage: 0,
  empowerable: true,
};
const events = [];
const ctx = {
  t: 0,
  player: {},
  events,
  graph,
  pieces: [piece, target],
  itemsById: new Map([
    ['whetstone', sourceItem],
    ['wooden_sword', targetItem],
  ]),
  canAffect,
};
const handler = getScriptHandler('whetstone');

handler.onCombatStart(piece, ctx);
assert.equal(target.bonusDamage, 1, 'Whetstone applies its exact named damage bonus');
assert.equal(events.at(-1)?.type, 'activate', 'Whetstone activates after empowering the target');

const zero = {
  ...ctx,
  events: [],
  piece: { ...piece, params: { dam: 0, p1: 0 } },
  pieces: [piece, { ...target, bonusDamage: 0 }],
};
zero.pieces[0] = zero.piece;
handler.onCombatStart(zero.piece, zero);
assert.equal(zero.pieces[1].bonusDamage, 0, 'explicit zero Whetstone damage remains zero');

console.log('OK Whetstone source/parity smoke');
