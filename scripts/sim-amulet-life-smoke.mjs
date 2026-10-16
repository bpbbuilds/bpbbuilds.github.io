import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amulet_of_life');
assert.equal(typeof handler?.onPrepare, 'function', 'Amulet of Life applies source healing efficiency during preparation');
assert.equal(typeof handler?.onCombatStart, 'function', 'Amulet of Life implements its source max-health start effect');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  player.hp = 80;
  player.maxHp = 100;
  const amulet = {
    itemId: 'amulet_of_life',
    placementKey: `${side}:amulet`,
    name: 'Amulet of Life',
    params: { healamp: 10, maxhealth: 20 },
  };
  const ctx = { player, events: [], t: 0 };

  handler.onPrepare(amulet, ctx);
  assert.equal(player._healAmp, 0.1, `source healing efficiency is ready before combat on ${side}`);
  handler.onCombatStart(amulet, ctx);
  assert.equal(player.maxHp, 120, `source max-health grant applies at combat start on ${side}`);
  assert.equal(player.hp, 100, `max-health grant heals by its source amount on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'heal' && event.amount === 20), `max-health projection is logged on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'activate'), `source activation is logged on ${side}`);
}

console.log('OK Amulet of Life focused smoke');
