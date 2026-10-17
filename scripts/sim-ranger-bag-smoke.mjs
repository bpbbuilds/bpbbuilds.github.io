import assert from 'node:assert/strict';
import fs from 'node:fs';

import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/RangerBag.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ak-bags.js', 'utf8');
const rangerPort = port.match(/export const rangerBagPort = \{[\s\S]*?\n\};/u)?.[0] || '';

assert.equal(inventory.byId.ranger_bag?.file, 'RangerBag.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*itemsInside = getItemsInside\(\)[\s\S]*connectForCombat\(character\(\), "character_lucky_changed", "onLuckyChanged"\)[\s\S]*item\.changeCritChancePercent\(getChance\(\)/);
assert.match(source, /func onLuckyChanged\(amount, event\):[\s\S]*amount \* getChance2\(\)[\s\S]*item\.changeCritChancePercent\(change\)/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*return toItem\.canDamage\(\)/);
assert.match(rangerPort, /onPrepare\(piece, ctx\)/);
assert.doesNotMatch(rangerPort, /onCombatStart\(piece, ctx\)/);
assert.match(rangerPort, /getItemsInside\(ctx\.graph, piece\.placementKey\)/);

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

function makeContext(params = {}) {
  const bag = item('ranger_bag', {
    placementKey: 'ranger',
    cells: ['bag-a', 'bag-b'],
    kind: 'bag',
    params,
  });
  const sword = item('wooden_sword', {
    placementKey: 'sword',
    cells: ['bag-a'],
    kind: 'weapon',
    damageMin: 1,
    damageMax: 3,
    critChance: 0,
  });
  const stone = item('stone', {
    placementKey: 'stone',
    cells: ['bag-b'],
    kind: 'passive',
    critChance: 0,
  });
  const player = {
    _buffListeners: [],
    stacks: { lucky: 0 },
  };
  return {
    piece: bag,
    sword,
    stone,
    player,
    pieces: [bag, sword, stone],
    itemsById: byId,
    graph: {
      pieces: new Map([
        ['ranger', { key: 'ranger', id: 'ranger_bag', cells: bag.cells, affectCells: [] }],
        ['sword', { key: 'sword', id: 'wooden_sword', cells: sword.cells, affectCells: [] }],
        ['stone', { key: 'stone', id: 'stone', cells: stone.cells, affectCells: [] }],
      ]),
      filled: new Map([
        ['bag-a', 'sword'],
        ['bag-b', 'stone'],
      ]),
    },
  };
}

const handler = getScriptHandler('ranger_bag');
assert.equal(handler?.handlerId, 'ranger_bag');

{
  const ctx = makeContext();
  handler.onPrepare(ctx.piece, ctx);
  assert.equal(ctx.sword.critChance, 12, 'source chance applies during prepare to inside damage items');
  assert.equal(ctx.stone.critChance, 12, 'source loop preserves inside-item crit mutation');
  grantStacks(ctx.player, 'lucky', 2);
  assert.equal(ctx.sword.critChance, 18, 'Lucky applies chance2 to the same cached inside items');
  assert.equal(ctx.stone.critChance, 18);
}

{
  const ctx = makeContext({ chance: 0, chance2: 0 });
  const zeroCatalog = byId.get('ranger_bag');
  const oldChance = zeroCatalog.chance;
  const oldChance2 = zeroCatalog.chance2;
  zeroCatalog.chance = 0;
  zeroCatalog.chance2 = 0;
  try {
    handler.onPrepare(ctx.piece, ctx);
    assert.equal(ctx.sword.critChance || 0, 0, 'explicit zero base crit remains zero');
    grantStacks(ctx.player, 'lucky', 2);
    assert.equal(ctx.sword.critChance || 0, 0, 'explicit zero Lucky crit remains zero');
  } finally {
    zeroCatalog.chance = oldChance;
    zeroCatalog.chance2 = oldChance2;
  }
}

console.log('Ranger Bag source/parity smoke passed.');
