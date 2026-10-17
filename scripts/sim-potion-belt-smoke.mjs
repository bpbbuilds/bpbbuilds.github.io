import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/PotionBelt.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ak-bags.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'potion_belt');

assert.ok(sourceItem, 'Potion Belt: extracted catalog row');
assert.match(source, /var affectedPotions: Array[\s\S]*var numConsumed: int/);
assert.match(source, /func onPrepare\(\):[\s\S]*getItemsInside\(\)[\s\S]*canApplyEffect\(item\)[\s\S]*connectForCombat\(item, "potion_emptied", "onPotionEmptied"\)/);
assert.match(source, /elif numConsumed == 4:[\s\S]*cleanseRandomDebuffs\(getP1\(\)\)/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*return toItem\.hasType\(Type\.Potion\)/);
assert.match(port, /handlerId: 'potion_belt'/);
const beltPort = port.match(/export const potionBeltPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(beltPort, /getItemsInside\(ctx\.graph, piece\.placementKey\)/);
assert.match(beltPort, /payload\?\.piece/);
assert.doesNotMatch(beltPort, /Math\.max\(1,\s*Math\.round\(getPName\(piece\.params, 'p1'/);

const handler = getScriptHandler('potion_belt');
assert.equal(handler?.handlerId, 'potion_belt');

function makeContext(params = sourceItem.params, withBagtacular = false) {
  const bus = createCombatBus();
  const player = createActor('player');
  player._combatBus = bus;
  player.stacks.poison = 3;
  player.stacks.cold = 2;
  const dummy = createActor('dummy');
  const piece = {
    itemId: 'potion_belt',
    placementKey: 'belt',
    name: 'Potion Belt',
    kind: 'bag',
    params: { ...params },
  };
  const potionA = { itemId: 'health_potion', placementKey: 'potion-a', name: 'Health Potion' };
  const potionB = { itemId: 'mana_potion', placementKey: 'potion-b', name: 'Mana Potion' };
  const outsidePotion = { itemId: 'health_potion', placementKey: 'potion-outside', name: 'Outside Potion' };
  const bagtacular = { itemId: 'bagtacular', placementKey: 'bagtacular', name: 'Bagtacular', alive: true };
  const pieces = [piece, potionA, potionB, outsidePotion];
  if (withBagtacular) pieces.push(bagtacular);
  return {
    t: 0,
    bus,
    player,
    dummy,
    piece,
    potionA,
    potionB,
    outsidePotion,
    bagtacular,
    pieces,
    events: [],
    rng: () => 0,
    itemsById: new Map([
      ['potion_belt', sourceItem],
      ['health_potion', { id: 'health_potion', type: 'Potion' }],
      ['mana_potion', { id: 'mana_potion', type: 'Potion' }],
      ['bagtacular', { id: 'bagtacular', type: 'Skill', params: { buffs: 2, p3: 2 } }],
    ]),
    graph: {
      pieces: new Map([
        ['belt', { key: 'belt', id: 'potion_belt', affectCells: [], cells: ['belt-cell', 'belt-cell-2'] }],
        ['potion-a', { key: 'potion-a', id: 'health_potion', affectCells: [], cells: ['belt-cell'] }],
        ['potion-b', { key: 'potion-b', id: 'mana_potion', affectCells: [], cells: ['belt-cell-2'] }],
        ['potion-outside', { key: 'potion-outside', id: 'health_potion', affectCells: [], cells: ['other-cell'] }],
      ]),
      filled: new Map([
        ['belt-cell', 'potion-a'],
        ['belt-cell-2', 'potion-b'],
        ['other-cell', 'potion-outside'],
      ]),
    },
  };
}

function buffTotal(actor) {
  return Object.entries(actor.stacks)
    .filter(([key]) => !['poison', 'cold', 'blind', 'weak', 'slow', 'fatigue'].includes(key))
    .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
}

{
  const ctx = makeContext();
  handler.onPrepare(ctx.piece, ctx);
  ctx.bus.emit('potion_emptied', { piece: ctx.outsidePotion, t: 1 });
  assert.equal(ctx.piece._beltN, 0, 'Outside potions do not count');
  ctx.bus.emit('potion_emptied', { piece: ctx.potionA, t: 2 });
  assert.equal(ctx.piece._beltN, 1);
  assert.equal(buffTotal(ctx.player), 1, 'First linked potion grants one random buff');
  ctx.bus.emit('potion_emptied', { piece: ctx.potionB, t: 3 });
  ctx.bus.emit('potion_emptied', { piece: ctx.potionA, t: 4 });
  ctx.bus.emit('potion_emptied', { piece: ctx.potionB, t: 5 });
  assert.equal(ctx.piece._beltN, 4);
  assert.equal(ctx.player.stacks.poison, 0, 'Fourth linked potion cleanses poison by source p1');
  assert.equal(ctx.player.stacks.cold, 0, 'Fourth linked potion cleanses cold by source p1');
}

{
  const ctx = makeContext({}, true);
  handler.onPrepare(ctx.piece, ctx);
  ctx.bus.emit('potion_emptied', { piece: ctx.potionA, t: 1 });
  assert.equal(buffTotal(ctx.player), 3, 'Bagtacular adds its configured buffs to the first trigger');
}

{
  const ctx = makeContext({ p1: 0 });
  handler.onPrepare(ctx.piece, ctx);
  for (let i = 0; i < 4; i += 1) {
    ctx.bus.emit('potion_emptied', { piece: i % 2 ? ctx.potionB : ctx.potionA, t: i });
  }
  assert.equal(ctx.piece._beltN, 4);
  assert.equal(ctx.player.stacks.poison, 3, 'Explicit zero cleanse amount is preserved');
}

console.log('Potion Belt source/parity smoke passed.');
