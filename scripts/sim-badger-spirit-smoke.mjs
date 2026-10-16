import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('badger_spirit');
assert.equal(typeof handler?.onPrepare, 'function', 'Badger Spirit installs its damage listener during preparation');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Badger Spirit exposes its cooldown effect');

for (const side of ['you', 'them']) {
  const piece = {
    itemId: 'badger_spirit',
    placementKey: `${side}:spirit`,
    side,
    name: 'Badger Spirit',
    params: { healtht: 50, heal: 20, manat: 2, maxhealth: 10, maxhealth_bonus: 3 },
  };
  const nature = { itemId: 'nature_item', placementKey: `${side}:nature`, side };
  const graph = {
    pieces: new Map([
      [piece.placementKey, { key: piece.placementKey, id: piece.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
      [nature.placementKey, { key: nature.placementKey, id: nature.itemId, cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', piece.placementKey], ['1,0', nature.placementKey]]),
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  const ctx = {
    t: 0,
    player,
    dummy,
    bus,
    events,
    graph,
    itemsById: new Map([
      [piece.itemId, { id: piece.itemId, type: 'Pet' }],
      [nature.itemId, { id: nature.itemId, type: 'Nature' }],
    ]),
    canAffect: null,
  };

  handler.onPrepare(piece, ctx);
  player.hp = 99;
  bus.emit('character_damaged', { actor: dummy, hit: true, t: 1 });
  assert.equal(player.hp, 99, `opponent damage does not trigger Badger Spirit on ${side}`);
  bus.emit('character_damaged', { actor: player, hit: false, t: 1.5 });
  assert.equal(player.hp, 99, `a non-hit damage event does not trigger Badger Spirit on ${side}`);
  bus.emit('character_damaged', { actor: player, hit: true, t: 2 });
  assert.equal(player.hp, 139, `low-health damage heals 20% of max health once on ${side}`);
  player.hp = 90;
  bus.emit('character_damaged', { actor: player, hit: true, t: 3 });
  assert.equal(player.hp, 90, `the source low-health heal is one-shot per preparation on ${side}`);

  grantStacks(player, 'mana', 3);
  const beforeMaxHp = player.maxHp;
  const beforeHp = player.hp;
  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.stacks.mana, 1, `the cooldown spends source Mana on ${side}`);
  assert.equal(player.maxHp, beforeMaxHp + 13, `the cooldown grants base plus linked Nature max health on ${side}`);
  assert.equal(player.hp, beforeHp + 13, `the cooldown gives the granted max health as current health on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.meta?.handler === 'badger_spirit'), `the cooldown activates on ${side}`);

  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.maxHp, beforeMaxHp + 13, `insufficient Mana prevents a second max-health grant on ${side}`);
}

console.log('OK Badger Spirit focused smoke');
