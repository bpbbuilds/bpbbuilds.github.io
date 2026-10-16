import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { canBagAffectItem } from '../js/shared/backpack-grid/can-affect.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/PuzzlebagS.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ak-bags.js',
  'utf8',
);

assert.equal(inventory.byId.puzzlebag_s?.file, 'Exclusive/PuzzlebagS.gd');
assert.equal(byId.get('puzzlebag_s')?.chance, 20, 'catalog retains source getChance value');
assert.match(source, /extends Bag/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.gainsBuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*changeAmplificiationChancePercent_allBuffs\(getChance\(\)\)/);
assert.match(port, /handlerId: 'puzzlebag_s'[\s\S]*onPrepare\(piece, ctx\)/);
assert.match(port, /canBagAffectItem\(\{ id: 'puzzlebag_s' \}/);

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

const bag = item('puzzlebag_s', {
  placementKey: 'bag',
  cells: ['book-cell', 'sword-cell'],
});
const book = item('book_of_light', {
  placementKey: 'book',
  cells: ['book-cell'],
});
const sword = item('wooden_sword', {
  placementKey: 'sword',
  cells: ['sword-cell'],
});
const graph = {
  pieces: new Map([
    ['bag', { key: 'bag', id: 'puzzlebag_s', cells: bag.cells, affectCells: [] }],
    ['book', { key: 'book', id: 'book_of_light', cells: book.cells, affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: sword.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['book-cell', 'book'],
    ['sword-cell', 'sword'],
  ]),
};
const canAffect = { gainsBuffsIds: new Set(['book_of_light']) };
assert.equal(canBagAffectItem({ id: 'puzzlebag_s' }, book, canAffect), true);
assert.equal(canBagAffectItem({ id: 'puzzlebag_s' }, sword, canAffect), false);

const handler = getScriptHandler('puzzlebag_s');
assert.equal(handler?.handlerId, 'puzzlebag_s');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler.onCombatStart, undefined, 'source amplification belongs to prepare');
const ctx = {
  graph,
  pieces: [bag, book, sword],
  itemsById: byId,
  canAffect,
};

handler.onPrepare(bag, ctx);
assert.equal(book.buffAmpChance, 20, 'source chance amplifies only linked buff-gainers');
assert.equal(sword.buffAmpChance, undefined, 'non-buff items are excluded by source predicate');
handler.onPrepare(bag, ctx);
assert.equal(book.buffAmpChance, 40, 'repeated source-style modifiers add percentage points');

console.log('OK Puzzlebag S source and handler regression');
