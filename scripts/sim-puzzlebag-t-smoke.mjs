import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/PuzzlebagT.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ak-bags.js',
  'utf8',
);

assert.equal(inventory.byId.puzzlebag_t?.file, 'Exclusive/PuzzlebagT.gd');
assert.match(source, /extends Bag/);
assert.match(source, /onready var refund = getP\("buff"\) \/ 100\.0/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.usesBuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*connectToCharacterBuffs/);
assert.match(source, /toRefund = int\(round\(usedStacks\[buffType\]\)\)/);
assert.match(source, /giveStacks\(character\(\), buffType, toRefund, event\)[\s\S]*miniActivate\(\)/);
assert.match(port, /handlerId: 'puzzlebag_t'[\s\S]*onPrepare\(piece, ctx\)/);
assert.match(port, /getPName\(piece\.params, 'buff', 0\)/);
assert.match(port, /canBagAffectItem\(\{ id: 'puzzlebag_t' \}/);

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

const bag = item('puzzlebag_t', {
  placementKey: 'bag',
  cells: ['mana-cell', 'sword-cell'],
});
const manaOrb = item('mana_orb', {
  placementKey: 'mana',
  cells: ['mana-cell'],
});
const sword = item('wooden_sword', {
  placementKey: 'sword',
  cells: ['sword-cell'],
});
const graph = {
  pieces: new Map([
    ['bag', { key: 'bag', id: 'puzzlebag_t', cells: bag.cells, affectCells: [] }],
    ['mana', { key: 'mana', id: 'mana_orb', cells: manaOrb.cells, affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: sword.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['mana-cell', 'mana'],
    ['sword-cell', 'sword'],
  ]),
};
const canAffect = { usesBuffsIds: new Set(['mana_orb']) };
const handler = getScriptHandler('puzzlebag_t');
assert.equal(handler?.handlerId, 'puzzlebag_t');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler.onPreCombatStart, undefined, 'source refund listener belongs to prepare');

const player = createActor('player');
const events = [];
const ctx = {
  player,
  dummy: createActor('dummy'),
  graph,
  pieces: [bag, manaOrb, sword],
  itemsById: byId,
  canAffect,
  events,
  t: 4,
};
handler.onPrepare(bag, ctx);
assert.deepEqual(Object.keys(bag._usedStacks), [
  'lucky',
  'regeneration',
  'vampirism',
  'spikes',
  'mana',
  'empower',
  'heat',
]);

grantStacks(player, 'mana', 5, { piece: manaOrb });
spendStacks(player, 'mana', 3, { piece: manaOrb });
assert.equal(player.stacks.mana, 3, 'used Mana is refunded with source round() threshold');
assert.equal(bag._usedStacks.mana, -0.25, 'fractional refund remainder is retained');
assert.equal(events.filter((event) => event.type === 'buff').length, 1);
assert.equal(events.at(-1)?.itemId, 'puzzlebag_t');
assert.equal(events.some((event) => event.type === 'activate'), false, 'source miniActivate is not a full activation');

grantStacks(player, 'mana', 3, { piece: manaOrb });
spendStacks(player, 'mana', 3, { piece: manaOrb });
assert.equal(player.stacks.mana, 4, 'second spend crosses the retained fractional refund threshold');
assert.equal(bag._usedStacks.mana, -0.5);
assert.equal(events.filter((event) => event.type === 'buff').length, 2);

grantStacks(player, 'mana', 2, { piece: sword });
spendStacks(player, 'mana', 1, { piece: sword });
assert.equal(player.stacks.mana, 5, 'spends from non-usesBuffs cargo do not trigger the bag');
assert.equal(events.filter((event) => event.type === 'buff').length, 2);

console.log('OK Puzzlebag T source and handler regression');
