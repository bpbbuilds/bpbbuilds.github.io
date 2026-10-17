import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { runCharacterTick } from '../js/pages/sim/engine/ticks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Pandamonium.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-al-weapons.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'pandamonium');

assert.ok(sourceItem, 'Pandamonium: extracted catalog row');
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(item, "activated", "onFoodActivated"\)[\s\S]*changePoisonCritChancePercent\(getNumAffectedItems\(\) \* getChance\(\)\)/);
assert.match(source, /func onFoodActivated\(event\):[\s\S]*inflictPoison\(getP1\(\)/);
assert.match(port, /handlerId: 'pandamonium'/);
const pandaPort = port.match(/export const pandamoniumPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(pandaPort, /onPrepare\(piece, ctx\)/);
assert.match(pandaPort, /onPeerActivated\(listener, activated, ctx\)/);
assert.doesNotMatch(pandaPort, /onCombatStart\(piece, ctx\)/,
  'Pandamonium food listeners must be prepared before combat starts');
assert.doesNotMatch(pandaPort, /ctx\.bus\?\.on\?\.\('piece_activated'/,
  'Pandamonium must not double-register the peer activation path');
assert.doesNotMatch(pandaPort, /Math\.max\(1,\s*Math\.round\(getP1/,
  'Pandamonium poison amount may be explicitly zero');

const handler = getScriptHandler('pandamonium');
assert.equal(handler?.handlerId, 'pandamonium');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const piece = {
    itemId: 'pandamonium',
    placementKey: 'panda',
    name: 'Pandamonium',
    kind: 'weapon',
    chance: 5,
    params,
    baseCooldown: 2,
    cooldown: 2,
  };
  const foodA = { itemId: 'carrot', placementKey: 'food-a', kind: 'food', name: 'Carrot' };
  const foodB = { itemId: 'cheese', placementKey: 'food-b', kind: 'food', name: 'Cheese' };
  const unrelatedFood = { itemId: 'banana', placementKey: 'food-other', kind: 'food', name: 'Banana' };
  const graph = {
    pieces: new Map([
      ['panda', { key: 'panda', id: 'pandamonium', affectCells: [
        { cell: 'food-a', color: 'primary' },
        { cell: 'food-b', color: 'primary' },
      ], cells: [] }],
      ['food-a', { key: 'food-a', id: 'carrot', affectCells: [], cells: ['food-a'] }],
      ['food-b', { key: 'food-b', id: 'cheese', affectCells: [], cells: ['food-b'] }],
    ]),
    filled: new Map([
      ['food-a', 'food-a'],
      ['food-b', 'food-b'],
    ]),
  };
  return {
    t: 0,
    player,
    dummy,
    bus,
    piece,
    foodA,
    foodB,
    unrelatedFood,
    events: [],
    pieces: [piece, foodA, foodB, unrelatedFood],
    graph,
    itemsById: new Map([
      ['pandamonium', sourceItem],
      ['carrot', { id: 'carrot', type: 'Food' }],
      ['cheese', { id: 'cheese', type: 'Food' }],
      ['banana', { id: 'banana', type: 'Food' }],
    ]),
    canAffect: {},
  };
}

{
  const ctx = makeContext();
  handler.onPrepare(ctx.piece, ctx);
  assert.equal(ctx.dummy.poisonCritChance, 10, 'Pandamonium adds chance per linked Food');
  handler.onPeerActivated(ctx.piece, ctx.foodA, ctx);
  assert.equal(ctx.dummy.stacks.poison, 1);
  handler.onPeerActivated(ctx.piece, ctx.unrelatedFood, ctx);
  assert.equal(ctx.dummy.stacks.poison, 1, 'unlinked Food must not trigger Pandamonium');
  ctx.bus.emit('piece_activated', { piece: ctx.foodB });
  assert.equal(ctx.dummy.stacks.poison, 1, 'direct bus emission must not duplicate peer handling');
}

{
  const ctx = makeContext({ p1: 0 });
  handler.onPrepare(ctx.piece, ctx);
  handler.onPeerActivated(ctx.piece, ctx.foodA, ctx);
  assert.equal(ctx.dummy.stacks.poison, 0);
}

{
  const dummy = createActor('dummy');
  dummy.stacks.poison = 2;
  dummy.poisonCritChance = 100;
  const events = [];
  runCharacterTick(dummy, 0.5, 1, events, () => 0);
  assert.equal(events[0].amount, 4, 'poison crit chance doubles poison tick damage');
  assert.equal(events[0].meta.critical, true);
}

console.log('Pandamonium source/parity smoke passed.');
