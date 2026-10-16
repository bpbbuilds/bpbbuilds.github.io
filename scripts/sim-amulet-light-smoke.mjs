import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amulet_of_light');
assert.equal(typeof handler?.onPrepare, 'function', 'Amulet of Light binds its source listeners during preparation');
assert.equal(typeof handler?.onPeerActivated, 'function', 'Amulet of Light handles source affected-item activations');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  player.hp = 80;
  player.maxHp = 100;
  const amulet = { itemId: 'amulet_of_light', placementKey: `${side}:amulet`, name: 'Amulet of Light', params: { regen: 2, maxhealth: 3 } };
  const normal = { itemId: 'normal', placementKey: `${side}:normal`, name: 'Normal Item' };
  const holy = { itemId: 'holy', placementKey: `${side}:holy`, name: 'Holy Item' };
  const ctx = {
    player,
    events: [],
    t: 0,
    rng: () => 0,
    itemsById: new Map([
      [amulet.itemId, { id: amulet.itemId, chance: 100, chance2: 100 }],
      [normal.itemId, { id: normal.itemId }],
      [holy.itemId, { id: holy.itemId, extraTypes: ['Holy'] }],
    ]),
  };
  handler.onPrepare(amulet, ctx);
  handler.onPeerActivated(amulet, normal, ctx);
  handler.onPeerActivated(amulet, holy, ctx);
  assert.equal(player.stacks.regeneration, 4, `normal and Holy source chances both grant configured regeneration on ${side}`);
  assert.equal(player.maxHp, 112, `each regeneration point grants source max health on ${side}`);
  assert.equal(player.hp, 92, `source max-health grant heals by the gained max health on ${side}`);
  assert.equal(ctx.events.filter((event) => event.type === 'buff').length, 2, `both activation grants are projected on ${side}`);
}

console.log('OK Amulet of Light focused smoke');
