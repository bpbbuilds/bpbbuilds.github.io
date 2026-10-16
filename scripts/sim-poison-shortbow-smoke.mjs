import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'poison_shortbow');
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PoisonShortbow.gd', 'utf8');

assert.equal(inventory.byId.poison_shortbow?.file, 'Exclusive/PoisonShortbow.gd');
assert.equal(inventory.byId.poison_shortbow?.extends, 'Weapon');
assert.match(source, /^extends Weapon/m);
assert.match(source, /onPreDealDamage_early\(damageRes[^)]*\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollChance\(\)/);
assert.match(source, /var randomDebuff = Util\.pickRandomElement\(Game\.getDebuffs\(\)\)[\s\S]*if randomDebuff == Game\.EventType\.Poison:[\s\S]*inflictPoison\(poison \+ 1\)/);
assert.equal(item.params.p1, 2);
assert.equal(item.chance, 70);

const bow = {
  ...item,
  itemId: 'poison_shortbow',
  placementKey: 'bow',
  name: 'Poison Shortbow',
  params: item.params,
  kind: 'weapon',
  alive: true,
  chance: item.chance,
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const ctx = { player, dummy, events: [], t: 2, rng: () => 0 };
const handler = getScriptHandler('poison_shortbow');

assert.equal(handler?.handlerId, 'poison_shortbow');
handler.onPreDealDamageEarly(bow, ctx, { hit: false });
assert.equal(dummy.stacks.poison, 0, 'misses do not trigger Poison Shortbow');

handler.onPreDealDamageEarly(bow, ctx, { hit: true });
assert.equal(dummy.stacks.poison, 3, 'Poison result adds p1 plus one Poison');

const blindBow = { ...bow, chanceRng: undefined };
const blindCtx = { ...ctx, rng: (() => { const values = [0, 0.5]; return () => values.shift() ?? 0.5; })() };
handler.onPreDealDamageEarly(blindBow, blindCtx, { hit: true });
assert.equal(dummy.stacks.poison, 5, 'non-Poison result still adds the base Poison amount');
assert.equal(dummy.stacks.blind, 1, 'non-Poison result adds exactly one random debuff');

console.log('OK Poison Shortbow source and random-debuff regression');
