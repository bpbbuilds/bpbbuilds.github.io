import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Dagger.gd', 'utf8');
const row = inventory.byId.dagger;
assert.ok(row, 'Dagger has a source inventory row');
assert.equal(row.file, 'Dagger.gd');
assert.equal(row.extends, 'Weapon');
assert.deepEqual(row.overrides, ['onPrepare']);
assert.match(source, /func prepare\(\):[\s\S]*connectForCombat\(opponent\(\), "character_stunned", "onStun"\)/);
assert.match(source, /func onStun\(triggerEvent\):[\s\S]*attack\(triggerEvent\)/);
assert.equal(getScriptHandler('dagger')?.handlerId, 'dagger');

const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = [];
dummy._eventLog = [];
const piece = {
  itemId: 'dagger',
  placementKey: 'dagger',
  name: 'Dagger',
  kind: 'weapon',
  side: 'you',
  alive: true,
  damageMin: 4,
  damageMax: 4,
  accuracy: 100,
  chance: null,
  critChance: 0,
};
const ctx = {
  player,
  dummy,
  events: [],
  bus,
  rng: () => 0,
  t: 2,
  pieces: [piece],
  itemsById: new Map(),
  canAffect: null,
};
const handler = getScriptHandler('dagger');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(piece, ctx);

bus.emit('actor_stunned', { actor: player, t: 2 });
assert.equal(dummy.hp, 100, 'Dagger ignores allied stuns');

player.stamina = 0;
bus.emit('actor_stunned', { actor: dummy, t: 2.1 });
assert.equal(dummy.hp, 96, 'Dagger attacks after an opponent stun without stamina');
assert.ok(ctx.events.some((event) => event.type === 'damage' && event.itemId === 'dagger'));
assert.ok(!ctx.events.some((event) => event.type === 'activate' && event.itemId === 'dagger'));

console.log('OK Dagger source port');
