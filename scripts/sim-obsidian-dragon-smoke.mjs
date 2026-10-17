import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ObsidianDragon.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-al-weapons.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'obsidian_dragon');

assert.ok(sourceItem, 'Obsidian Dragon: extracted catalog row');
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_heat_changed", "onHeatChanged"\)/);
assert.match(source, /var proccs = heatCounter \/ heatNeeded/);
assert.match(source, /addBonusDamage\(bonusDam \* proccs\)/);
assert.match(source, /affectedWeapon\.addCritTokens\(proccs\)/);
assert.match(port, /handlerId: 'obsidian_dragon'/);
const dragonPort = port.match(/export const obsidianDragonPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(dragonPort, /onPrepare\(piece, ctx\)/);
assert.doesNotMatch(dragonPort, /onCombatStart\(piece, ctx\)/,
  'Obsidian Dragon listener must be installed during preparation');
assert.match(dragonPort, /piece\._odHeat %=/);
assert.doesNotMatch(dragonPort, /Math\.floor\(piece\._odHeat \/ need\)/,
  'Obsidian Dragon must preserve fractional source procs');

const handler = getScriptHandler('obsidian_dragon');
assert.equal(handler?.handlerId, 'obsidian_dragon');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const target = {
    itemId: 'wooden_sword',
    placementKey: 'sword',
    name: 'Wooden Sword',
    kind: 'weapon',
    damageMin: 8,
    damageMax: 10,
    empowerable: true,
    critChance: 10,
  };
  const piece = {
    itemId: 'obsidian_dragon',
    placementKey: 'dragon',
    name: 'Obsidian Dragon',
    kind: 'weapon',
    params,
    damageMin: 11,
    damageMax: 16,
    critChance: 5,
  };
  const graph = {
    pieces: new Map([
      ['dragon', { key: 'dragon', id: 'obsidian_dragon', affectCells: [{ cell: 'target', color: 'primary' }], cells: [] }],
      ['sword', { key: 'sword', id: 'wooden_sword', affectCells: [], cells: ['target'] }],
    ]),
    filled: new Map([['target', 'sword']]),
  };
  return {
    player,
    dummy,
    bus,
    piece,
    target,
    events: [],
    graph,
    itemsById: new Map([
      ['obsidian_dragon', sourceItem],
      ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon', damageMin: 8, damageMax: 10 }],
    ]),
    canAffect: {},
    pieces: [piece, target],
    t: 0,
  };
}

{
  const ctx = makeContext();
  handler.onPrepare(ctx.piece, ctx);
  assert.equal(ctx.piece._odHeat, 0);
  grantStacks(ctx.player, 'heat', 4, { originId: 'test' });
  assert.equal(ctx.piece.bonusDamage, 1.6, 'source procs on any positive Heat ratio');
  assert.equal(ctx.target.critChance, 10.8);
  grantStacks(ctx.player, 'heat', 2, { originId: 'test' });
  assert.equal(ctx.piece.bonusDamage, 4, '6 total Heat keeps the source fractional proc');
  assert.equal(ctx.target.critChance, 12);
  assert.equal(ctx.piece._odHeat, 1);
}

{
  const ctx = makeContext({ heatt: 0, p1: 0, dambonus: 0, p2: 0 });
  handler.onPrepare(ctx.piece, ctx);
  grantStacks(ctx.player, 'heat', 6, { originId: 'test' });
  assert.equal(ctx.piece.bonusDamage || 0, 0);
  assert.equal(ctx.target.critChance, 10);
}

console.log('Obsidian Dragon source/parity smoke passed.');
