import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { canBagAffectItem } from '../js/shared/backpack-grid/can-affect.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/Puzzlebox.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-outliers-board.js',
  'utf8',
);
const puzzleboxPort = port.slice(
  port.indexOf('export const puzzleboxPort'),
  port.indexOf('/** TimeDilator.gd', port.indexOf('export const puzzleboxPort')),
);

assert.equal(inventory.byId.puzzlebox?.file, 'Exclusive/Puzzlebox.gd');
assert.match(source, /extends Bag/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*reduceSpeed\(slowSpeed\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*addSpeed\(slowSpeed \+ fastSpeed\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(puzzleboxPort, /handlerId: 'puzzlebox'[\s\S]*onPrepare\(piece, ctx\)/);
assert.doesNotMatch(puzzleboxPort, /onCombatStart\(/);
assert.match(puzzleboxPort, /getPName\(piece\.params, 'speed'/);
assert.match(puzzleboxPort, /getPName\(piece\.params, 'speed2'/);
assert.match(puzzleboxPort, /canBagAffectItem\(\{ id: 'puzzlebox' \}/);
assert.match(puzzleboxPort, /afterEffectFinished\(piece, ctx, 'puzzlebox'\);/);

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

const bag = item('puzzlebox', {
  placementKey: 'box',
  cells: ['sword-cell', 'banana-cell', 'potion-cell'],
});
const sword = item('wooden_sword', {
  placementKey: 'sword',
  cells: ['sword-cell'],
  speedScale: 0,
  kind: 'weapon',
  alive: true,
});
const banana = item('banana', {
  placementKey: 'banana',
  cells: ['banana-cell'],
  speedScale: 0,
  kind: 'consumable',
  alive: true,
});
const potion = item('health_potion', {
  placementKey: 'potion',
  cells: ['potion-cell'],
  speedScale: 0,
  kind: 'consumable',
  alive: true,
});
const graph = {
  pieces: new Map([
    ['box', { key: 'box', id: 'puzzlebox', cells: bag.cells, affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: sword.cells, affectCells: [] }],
    ['banana', { key: 'banana', id: 'banana', cells: banana.cells, affectCells: [] }],
    ['potion', { key: 'potion', id: 'health_potion', cells: potion.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['sword-cell', 'sword'],
    ['banana-cell', 'banana'],
    ['potion-cell', 'potion'],
  ]),
};
const handler = getScriptHandler('puzzlebox');
const events = [];
const ctx = {
  pieces: [bag, sword, banana, potion],
  graph,
  itemsById: byId,
  canAffect: {},
  events,
  t: 5,
};

assert.equal(handler?.handlerId, 'puzzlebox');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler.onCombatStart, undefined, 'source reduction belongs to prepare');
assert.equal(canBagAffectItem({ id: 'puzzlebox' }, sword), true);
assert.equal(canBagAffectItem({ id: 'puzzlebox' }, potion), false);

handler.onPrepare(bag, ctx);
assert.equal(sword.speedScale, -0.2, 'prepare applies source speed reduction to cooldown items');
assert.equal(banana.speedScale, -0.2, 'food with a cooldown is affected');
assert.equal(potion.speedScale, 0, 'items without a cooldown are excluded');

handler.onCooldownEffect(bag, ctx);
assert.ok(Math.abs(sword.speedScale - 0.5) < 1e-12, 'cooldown adds speed + speed2 after prepare');
assert.ok(Math.abs(banana.speedScale - 0.5) < 1e-12);
assert.equal(potion.speedScale, 0);
assert.equal(bag.alive, false, 'source onAfterEffectFinished consumes the Puzzlebox');
assert.equal(bag.cooldown, 999, 'source deactivates the Puzzlebox cooldown');
assert.equal(events.find((event) => event.type === 'activate')?.itemId, 'puzzlebox');

const noParams = item('puzzlebox', {
  placementKey: 'empty-box',
  cells: ['empty-sword-cell'],
  params: {},
});
const noParamSword = item('wooden_sword', {
  placementKey: 'empty-sword',
  cells: ['empty-sword-cell'],
  speedScale: 0,
  kind: 'weapon',
  alive: true,
});
const noParamGraph = {
  pieces: new Map([
    ['empty-box', { key: 'empty-box', id: 'puzzlebox', cells: noParams.cells, affectCells: [] }],
    ['empty-sword', { key: 'empty-sword', id: 'wooden_sword', cells: noParamSword.cells, affectCells: [] }],
  ]),
  filled: new Map([['empty-sword-cell', 'empty-sword']]),
};
const noParamCtx = { ...ctx, graph: noParamGraph, pieces: [noParams, noParamSword], events: [], t: 8 };
handler.onPrepare(noParams, noParamCtx);
handler.onCooldownEffect(noParams, noParamCtx);
assert.equal(noParamSword.speedScale, 0, 'missing speed parameters do not fabricate a bonus');

console.log('OK Puzzlebox source and handler regression');
