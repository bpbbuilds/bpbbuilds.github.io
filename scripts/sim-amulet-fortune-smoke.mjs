import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amulet_of_fortune');
assert.equal(typeof handler?.onPrepare, 'function', 'Amulet of Fortune adds chance during source preparation');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Amulet of Fortune implements its source cooldown effect');

for (const side of ['you', 'them']) {
  const amulet = {
    itemId: 'amulet_of_fortune',
    placementKey: `${side}:amulet`,
    name: 'Amulet of Fortune',
    params: { chance: 15, buffs: 2 },
    cooldown: 4,
    alive: true,
    charges: 1,
    side,
  };
  const chanceItem = { itemId: 'lucky_bow', placementKey: `${side}:chance`, name: 'Lucky Bow', bonusChanceMult: 0, side };
  const noChanceItem = { itemId: 'wooden_sword', placementKey: `${side}:no-chance`, name: 'Wooden Sword', bonusChanceMult: 0, side };
  const graph = {
    pieces: new Map([
      [amulet.placementKey, { key: amulet.placementKey, id: amulet.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }],
      [chanceItem.placementKey, { key: chanceItem.placementKey, id: chanceItem.itemId, cells: ['1,0'], affectCells: [] }],
      [noChanceItem.placementKey, { key: noChanceItem.placementKey, id: noChanceItem.itemId, cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', amulet.placementKey], ['1,0', chanceItem.placementKey], ['2,0', noChanceItem.placementKey]]),
  };
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const ctx = {
    player,
    pieces: [amulet, chanceItem, noChanceItem],
    itemsById: new Map([
      [amulet.itemId, { id: amulet.itemId }],
      [chanceItem.itemId, { id: chanceItem.itemId, chance: 20 }],
      [noChanceItem.itemId, { id: noChanceItem.itemId, chance: 0 }],
    ]),
    graph,
    canAffect: null,
    events: [],
    t: 0,
    rng: () => 0,
  };

  handler.onPrepare(amulet, ctx);
  assert.equal(chanceItem.bonusChanceMult, 15, `chance-capable item receives +15% chance on ${side}`);
  assert.equal(noChanceItem.bonusChanceMult, 0, `zero-base-chance item is excluded on ${side}`);
  handler.onCooldownEffect(amulet, ctx);
  assert.equal(Object.values(player.stacks).reduce((sum, value) => sum + value, 0), 2, `cooldown grants the source number of most-needed buffs on ${side}`);
  assert.equal(amulet.alive, false, `after-effect source consumption removes the Amulet on ${side}`);
}

console.log('OK Amulet of Fortune focused smoke');
