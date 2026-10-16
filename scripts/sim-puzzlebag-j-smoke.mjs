import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { effectDuration } from '../js/pages/sim/engine/effect-duration.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { canBagAffectItem } from '../js/shared/backpack-grid/can-affect.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/PuzzlebagJ.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ak-bags.js',
  'utf8',
);

assert.equal(inventory.byId.puzzlebag_j?.file, 'Exclusive/PuzzlebagJ.gd');
assert.equal(
  canBagAffectItem({ id: 'puzzlebag_j' }, { params: { dur_stun: 0.5 } }),
  true,
  'shared bag predicate accepts duration items',
);
assert.equal(
  canBagAffectItem({ id: 'puzzlebag_j' }, { params: { p1: 1 } }),
  false,
  'shared bag predicate excludes non-duration items',
);
assert.match(source, /extends Bag/);
assert.match(source, /onready var bonusdur: = getP\("bonusdur"\) \/ 100\.0/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.hasInventoryDuration\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*modifyParam\("dur", bonusdur\)/);
assert.match(source, /func getTriggerPriority\(\):[\s\S]*Priority\.High \+ 100/);
assert.match(port, /handlerId: 'puzzlebag_j'[\s\S]*getPName\(piece\.params, 'bonusdur', 0\)/);
assert.match(port, /hasInventoryDuration\(target\)/);
assert.match(port, /addEffectDurationFactor\(o, bonus\)/);

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

const bag = item('puzzlebag_j', {
  placementKey: 'bag',
  cells: ['duration-cell', 'plain-cell', 'named-cell'],
});
const durationItem = item('hammer', {
  placementKey: 'duration',
  cells: ['duration-cell'],
  params: { dur_stun: 0.5 },
});
const plainItem = item('wooden_sword', {
  placementKey: 'plain',
  cells: ['plain-cell'],
  params: { p1: 1 },
});
const namedDurationItem = {
  id: 'fixture_named_duration',
  itemId: 'fixture_named_duration',
  name: 'Fixture Named Duration',
  placementKey: 'named',
  cells: ['named-cell'],
  params: { dur: 2 },
};
byId.set(namedDurationItem.id, namedDurationItem);

const graph = {
  pieces: new Map([
    ['bag', { key: 'bag', id: 'puzzlebag_j', cells: bag.cells, affectCells: [] }],
    ['duration', { key: 'duration', id: 'hammer', cells: durationItem.cells, affectCells: [] }],
    ['plain', { key: 'plain', id: 'wooden_sword', cells: plainItem.cells, affectCells: [] }],
    ['named', { key: 'named', id: namedDurationItem.id, cells: namedDurationItem.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['duration-cell', 'duration'],
    ['plain-cell', 'plain'],
    ['named-cell', 'named'],
  ]),
};
const handler = getScriptHandler('puzzlebag_j');
assert.equal(handler?.handlerId, 'puzzlebag_j');
assert.equal(typeof handler?.onPrepare, 'function');

handler.onPrepare(bag, {
  graph,
  pieces: [bag, durationItem, plainItem, namedDurationItem],
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
});

assert.equal(durationItem.effectDurationFactor, 1.3, 'duration item receives source +30% multiplier');
assert.equal(namedDurationItem.effectDurationFactor, 1.3, 'named dur parameter receives source +30% multiplier');
assert.equal(effectDuration(durationItem, 'dur_stun'), 0.65, 'stun duration is scaled by the prepared factor');
assert.equal(effectDuration(namedDurationItem, 'dur'), 2.6, 'generic duration is scaled by the prepared factor');
assert.equal(Number(plainItem.effectDurationFactor) || 1, 1, 'items without descriptor duration stay unchanged');

const missingBonusBag = { ...bag, params: { p1: 30 } };
const untouchedDuration = { ...durationItem, effectDurationFactor: 1 };
const missingGraph = {
  ...graph,
  pieces: new Map([
    ['bag', { key: 'bag', id: 'puzzlebag_j', cells: bag.cells, affectCells: [] }],
    ['duration', { key: 'duration', id: 'hammer', cells: untouchedDuration.cells, affectCells: [] }],
  ]),
  filled: new Map([['duration-cell', 'duration']]),
};
handler.onPrepare(missingBonusBag, {
  graph: missingGraph,
  pieces: [missingBonusBag, untouchedDuration],
  itemsById: byId,
});
assert.equal(untouchedDuration.effectDurationFactor, 1, 'missing source bonusdur does not fabricate a multiplier');

console.log('OK Puzzlebag J source and handler regression');
