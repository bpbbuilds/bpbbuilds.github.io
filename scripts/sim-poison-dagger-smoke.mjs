import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/PoisonDagger.gd', 'utf8');
const parent = fs.readFileSync('tools/game-extract-full/Items/Dagger.gd', 'utf8');

assert.equal(inventory.byId.poison_dagger?.file, 'PoisonDagger.gd');
assert.match(source, /extends Dagger/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*if damageRes\.hasHit\(\):[\s\S]*inflictPoison\(poison\)/);
assert.match(parent, /func prepare\(\):[\s\S]*character_stunned[\s\S]*func onStun\(triggerEvent\):[\s\S]*attack\(triggerEvent\)/);

const dagger = {
  ...byId.get('poison_dagger'),
  itemId: 'poison_dagger',
  placementKey: 'dagger',
  name: 'Poison Dagger',
  params: byId.get('poison_dagger').params,
  side: 'you',
  kind: 'weapon',
  alive: true,
  damageMin: 5,
  damageMax: 5,
  staminaCost: 0,
  accuracy: 100,
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const bus = createCombatBus();
player._combatBus = dummy._combatBus = bus;
const ctx = {
  player,
  dummy,
  bus,
  events: [],
  t: 5,
  rng: () => 0,
  pieces: [dagger],
  graph: { pieces: new Map(), filled: new Map() },
  itemsById: byId,
};
const handler = getScriptHandler('poison_dagger');

assert.equal(handler?.handlerId, 'poison_dagger');
handler.onPrepare(dagger, ctx);
assert.equal(dummy.stacks.poison, 0);
handler.onPreDealDamageEarly(dagger, ctx, { hit: false });
assert.equal(dummy.stacks.poison, 0, 'misses do not inflict Poison');
handler.onPreDealDamageEarly(dagger, ctx, { hit: true });
assert.equal(dummy.stacks.poison, 2, 'a hit inflicts source p1 Poison exactly');

console.log('OK Poison Dagger source and hit lifecycle regression');
