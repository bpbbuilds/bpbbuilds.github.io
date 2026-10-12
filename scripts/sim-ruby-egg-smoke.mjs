import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { changeReflectStacks } from '../js/pages/sim/engine/actor-stats.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const rubyEgg = {
  id: 'ruby_egg',
  name: 'Ruby Egg',
  type: 'Pet',
  cooldown: null,
  params: { p1: 2, p3: 4 },
};
const items = new Map([['ruby_egg', rubyEgg]]);
const [piece] = buildCombatPieces(
  [{ id: 'ruby_egg', key: 'ruby-egg' }],
  items,
);
const handler = getScriptHandler('ruby_egg');

assert.ok(piece, 'Ruby Egg builds as a simulator piece');
assert.equal(piece.cooldown, 0, 'Ruby Egg has no combat cooldown loop');
assert.equal(typeof handler?.onCooldownEffect, 'undefined', 'Ruby Egg does not expose a cooldown effect');
assert.equal(typeof handler?.onPreCombatStart, 'function', 'Ruby Egg reflects debuffs before combat');
assert.equal(typeof handler?.onCombatStart, 'function', 'Ruby Egg grants start-of-battle Heat');

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  t: 2.05,
  player,
  dummy,
  rng: () => 0,
  events,
};

handler.onPreCombatStart(piece, ctx);
assert.equal(player.debuffReflectStacks, 2, 'Ruby Egg grants its configured Reflect stacks');
handler.onCombatStart(piece, ctx);
assert.equal(player.stacks.heat, 4, 'Ruby Egg grants Heat once at combat start');
assert.equal(
  events.filter((event) => event.itemId === 'ruby_egg' && event.type === 'activate').length,
  1,
  'Ruby Egg activates once at combat start',
);

grantStacks(player, 'poison', 2, {
  rng: () => 0,
  opponent: dummy,
  originId: 'dummy-poison',
});
assert.equal(player.stacks.poison, 0, 'Ruby Egg prevents incoming debuffs from landing on the owner');
assert.equal(dummy.stacks.poison, 2, 'Ruby Egg reflects incoming debuff stacks to the opponent');
assert.equal(player.debuffReflectStacks, 0, 'Ruby Egg consumes one Reflect stack per reflected debuff');

for (const stack of ['blind', 'cold']) {
  changeReflectStacks(player, 1, ctx, piece);
  grantStacks(player, stack, 1, {
    rng: () => 0,
    opponent: dummy,
    originId: `dummy-${stack}`,
  });
  assert.equal(player.stacks[stack], 0, `Ruby Egg reflects incoming ${stack} debuffs`);
  assert.equal(dummy.stacks[stack], 1, `Ruby Egg applies reflected ${stack} to the opponent`);
  assert.equal(player.debuffReflectStacks, 0, `Ruby Egg consumes the ${stack} Reflect stack`);
}

console.log('OK Ruby Egg start-only Heat and poison/blind/cold Reflect');
