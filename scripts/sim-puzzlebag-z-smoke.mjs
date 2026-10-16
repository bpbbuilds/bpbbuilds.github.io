import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { canBagAffectItem } from '../js/shared/backpack-grid/can-affect.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/PuzzlebagZ.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ak-bags.js',
  'utf8',
);

assert.equal(inventory.byId.puzzlebag_z?.file, 'Exclusive/PuzzlebagZ.gd');
assert.equal(byId.get('puzzlebag_z')?.chance, 25, 'catalog retains source getChance value');
assert.match(source, /extends Bag/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.inflictsDebuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*changeAmplificiationChancePercent_allDebuffs\(getChance\(\)\)/);
assert.match(port, /handlerId: 'puzzlebag_z'[\s\S]*onPrepare\(piece, ctx\)/);
assert.match(port, /canBagAffectItem\(\{ id: 'puzzlebag_z' \}/);

function item(id, overrides = {}) {
  const base = byId.get(id);
  assert.ok(base, `catalog item ${id} exists`);
  return {
    ...base,
    ...overrides,
    itemId: id,
    placementKey: overrides.placementKey || id,
    cells: overrides.cells || [id],
  };
}

const bag = item('puzzlebag_z', {
  placementKey: 'bag',
  cells: ['poison-cell', 'sword-cell'],
});
const poison = item('poison_dagger', {
  placementKey: 'poison',
  cells: ['poison-cell'],
  effect: '<Poison>',
});
const sword = item('wooden_sword', {
  placementKey: 'sword',
  cells: ['sword-cell'],
});
const graph = {
  pieces: new Map([
    ['bag', { key: 'bag', id: 'puzzlebag_z', cells: bag.cells, affectCells: [] }],
    ['poison', { key: 'poison', id: 'poison_dagger', cells: poison.cells, affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: sword.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['poison-cell', 'poison'],
    ['sword-cell', 'sword'],
  ]),
};
const canAffect = {};
assert.equal(canBagAffectItem({ id: 'puzzlebag_z' }, poison), true);
assert.equal(canBagAffectItem({ id: 'puzzlebag_z' }, sword), false);

const handler = getScriptHandler('puzzlebag_z');
assert.equal(handler?.handlerId, 'puzzlebag_z');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler.onCombatStart, undefined, 'source amplification belongs to prepare');
const ctx = {
  graph,
  pieces: [bag, poison, sword],
  itemsById: byId,
  canAffect,
};

handler.onPrepare(bag, ctx);
assert.equal(poison.debuffAmpChance, 25, 'source chance amplifies only linked debuff inflicters');
assert.equal(sword.debuffAmpChance, undefined, 'non-debuff items are excluded by source predicate');
handler.onPrepare(bag, ctx);
assert.equal(poison.debuffAmpChance, 50, 'repeated source-style modifiers add percentage points');

console.log('OK Puzzlebag Z source and handler regression');
