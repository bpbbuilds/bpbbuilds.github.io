import assert from 'node:assert/strict';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amethyst_whelp');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onDealtDamage, 'function');
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const opponent = createActor(side === 'you' ? 'dummy' : 'player');
  opponent.stacks.lucky = 1;
  const piece = { itemId: 'amethyst_whelp', placementKey: `${side}:whelp`, name: 'Amethyst Whelp', params: { p1: 2 }, side };
  const events = [];
  const ctx = { player: owner, dummy: opponent, events, t: 0, rng: () => 0 };
  handler.onCombatStart(piece, ctx);
  assert.equal(opponent.stacks.poison + opponent.stacks.blind + opponent.stacks.cold, 2, `start debuffs on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'amethyst_whelp'), `start activates after source debuffs on ${side}`);
  handler.onDealtDamage(piece, ctx, { hit: true });
  assert.equal(opponent.stacks.lucky, 0, `successful hit removes one random buff on ${side}`);
}
console.log('OK Amethyst Whelp focused smoke');
