import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('blood_goobert');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  player.hp = 80;
  const piece = {
    itemId: 'blood_goobert',
    placementKey: `${side}:blood_goobert`,
    side,
    name: 'Blood Goobert',
    kind: 'pet',
    params: { dam: 10, vampirism: 5, lifesteal: 100 },
    critChance: 0,
  };
  const ctx = { t: 2, player, dummy, events: [], rng: () => 0.5 };
  const ownerId = side === 'you' ? 'player' : 'dummy';
  const foeId = side === 'you' ? 'dummy' : 'player';

  handler.onCombatStart(piece, ctx);
  assert.equal(player.stacks.vampirism, 5, `Blood Goobert grants source Vampirism on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'activate' && event.actor === ownerId), `combat-start activation is attributed to the owner on ${side}`);

  handler.onCooldownEffect(piece, ctx);
  assert.equal(dummy.hp, 85, `Blood Goobert deals dam plus current Vampirism through stealLife on ${side}`);
  assert.equal(player.hp, 95, `Blood Goobert heals the source lifesteal amount on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'damage' && event.actor === ownerId && event.target === foeId && event.amount === 15), `Blood Goobert damage event uses the owner and foe sides on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'heal' && event.actor === ownerId && event.target === ownerId && event.amount === 15), `Blood Goobert heal event uses the owner side on ${side}`);
}

console.log('OK Blood Goobert focused smoke');
