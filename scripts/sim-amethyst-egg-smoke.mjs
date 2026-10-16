import assert from 'node:assert/strict';
import fs from 'node:fs';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = inventory.byId.amethyst_egg;
assert.equal(source.file, 'Exclusive/AmethystEgg.gd');
assert.equal(source.extends, 'DragonEgg');
assert.deepEqual(source.overrides.sort(), ['doCooldownEffect', 'onCombatStart']);
const handler = getScriptHandler('amethyst_egg');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const opponent = createActor(side === 'you' ? 'dummy' : 'player');
  const events = [];
  const piece = { itemId: 'amethyst_egg', placementKey: `${side}:egg`, name: 'Amethyst Egg', params: byId.get('amethyst_egg').params, side, alive: true };
  const debuffs = Number(piece.params.p1);
  const ctx = { player: owner, dummy: opponent, events, t: 0, rng: () => 0 };
  handler.onCombatStart(piece, ctx);
  assert.equal(opponent.stacks.poison + opponent.stacks.blind + opponent.stacks.cold, debuffs, `start inflicts source debuff count on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'amethyst_egg'), `start activates after debuff on ${side}`);
  events.length = 0;
  handler.onCooldownEffect(piece, { ...ctx, t: 4 });
  assert.equal(opponent.stacks.poison + opponent.stacks.blind + opponent.stacks.cold, debuffs * 2, `cooldown repeats source debuff count on ${side}`);
}
console.log('OK Amethyst Egg focused smoke');
