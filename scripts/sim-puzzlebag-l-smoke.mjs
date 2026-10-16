import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/PuzzlebagL.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ap-start.js',
  'utf8',
);

assert.equal(inventory.byId.puzzlebag_l?.file, 'Exclusive/PuzzlebagL.gd');
assert.match(source, /extends Bag/);
assert.match(source, /onready var healamp: = getP\("healamp"\) \/ 100\.0/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.canHealOrLifesteal\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*changeHealAmp\(healamp\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMaxHealth\(\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'puzzlebag_l'[\s\S]*getPName\(piece\.params, 'healamp', 0\)/);
assert.match(port, /canBagAffectItem\(\{ id: 'puzzlebag_l' \}/);
assert.match(port, /_puzzlebagLBonus/);
assert.match(port, /getPName\(piece\.params, 'maxhealth', 0\)/);

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

const bag = item('puzzlebag_l', {
  placementKey: 'bag',
  cells: ['banana-cell', 'collar-cell', 'sword-cell'],
});
const banana = item('banana', {
  placementKey: 'banana',
  cells: ['banana-cell'],
});
const collar = item('vampiric_collar', {
  placementKey: 'collar',
  cells: ['collar-cell'],
});
const sword = item('wooden_sword', {
  placementKey: 'sword',
  cells: ['sword-cell'],
});
const graph = {
  pieces: new Map([
    ['bag', { key: 'bag', id: 'puzzlebag_l', cells: bag.cells, affectCells: [] }],
    ['banana', { key: 'banana', id: 'banana', cells: banana.cells, affectCells: [] }],
    ['collar', { key: 'collar', id: 'vampiric_collar', cells: collar.cells, affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: sword.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['banana-cell', 'banana'],
    ['collar-cell', 'collar'],
    ['sword-cell', 'sword'],
  ]),
};
const handler = getScriptHandler('puzzlebag_l');
assert.equal(handler?.handlerId, 'puzzlebag_l');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');

const ctx = {
  graph,
  pieces: [bag, banana, collar, sword],
  itemsById: byId,
  events: [],
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
};
handler.onPrepare(bag, ctx);
assert.equal(banana.params.heal, 4.8, 'source heal amp scales linked healing');
assert.ok(Math.abs(collar.params.lifesteal - 3.6) < 1e-12, 'source heal amp scales linked lifesteal');
assert.equal(sword.params.heal, undefined, 'non-healing linked items remain untouched');
assert.equal(sword.params.lifesteal, undefined, 'non-lifesteal linked items remain untouched');

// A second source-style modifier adds another 20 percentage points, not 20%
// on top of the already-prepared value.
handler.onPrepare(bag, ctx);
assert.equal(banana.params.heal, 5.6, 'multiple source heal amps compose additively');
assert.ok(Math.abs(collar.params.lifesteal - 4.2) < 1e-12, 'multiple source lifesteal amps compose additively');

const startEvents = [];
const startCtx = {
  ...ctx,
  events: startEvents,
  player: createActor('player'),
  dummy: createActor('dummy'),
  t: 3,
};
handler.onCombatStart(bag, startCtx);
assert.equal(startCtx.player.maxHp, 207, 'source maxhealth gain is applied');
assert.equal(startCtx.player.hp, 207, 'temporary maxhealth gain heals the new capacity');
assert.deepEqual(
  startEvents.map((event) => event.type),
  ['heal', 'activate'],
  'source gives max health before activation',
);

const missingParamsBag = { ...bag, params: { healamp: 20 } };
const missingEvents = [];
const missingCtx = {
  ...startCtx,
  events: missingEvents,
  player: createActor('player'),
};
handler.onCombatStart(missingParamsBag, missingCtx);
assert.equal(missingCtx.player.maxHp, 200, 'missing source maxhealth does not fabricate a gain');
assert.deepEqual(missingEvents.map((event) => event.type), ['activate']);

console.log('OK Puzzlebag L source and handler regression');
