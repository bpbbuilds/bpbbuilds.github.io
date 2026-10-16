import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Daggerang.gd', 'utf8');
const row = inventory.byId.daggerang;
assert.ok(row, 'Daggerang has a source inventory row');
assert.equal(row.file, 'Exclusive/Daggerang.gd');
assert.equal(row.extends, 'Dagger');
assert.deepEqual(row.overrides, ['onPreDealDamage_early']);
assert.match(source, /extends Dagger/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*changeStaminaFactor\(\s*-\s*staminaReduction\)/);
assert.match(source, /if rollChance\(\):[\s\S]*stealRandomBuff\(1\)/);
assert.equal(getScriptHandler('daggerang')?.handlerId, 'daggerang');

const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = [];
dummy._eventLog = [];
const piece = {
  itemId: 'daggerang',
  placementKey: 'daggerang',
  name: 'Daggerang',
  kind: 'weapon',
  side: 'you',
  alive: true,
  damageMin: 4,
  damageMax: 4,
  accuracy: 100,
  chance: 100,
  params: { stamina: 20, p1: 20 },
  staminaCost: 5,
  baseStaminaCost: 5,
  staminaFactor: 1,
};
const ctx = {
  player,
  dummy,
  events: [],
  bus,
  rng: () => 0,
  t: 3,
  pieces: [piece],
  itemsById: new Map(),
  canAffect: null,
  notifyPreDealDamageEarly: (attacker, attackCtx, result) =>
    getScriptHandler(attacker.itemId)?.onPreDealDamageEarly?.(attacker, attackCtx, result),
};
const handler = getScriptHandler('daggerang');
assert.equal(typeof handler?.onPrepare, 'function', 'Daggerang inherits Dagger preparation');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');
handler.onPrepare(piece, ctx);

bus.emit('actor_stunned', { actor: player, t: 3 });
assert.equal(dummy.hp, 100, 'allied stuns do not trigger Daggerang');

dummy.stacks.lucky = 2;
player.stacks.lucky = 0;
player.stamina = 0;
bus.emit('actor_stunned', { actor: dummy, t: 3.1 });
assert.equal(dummy.hp, 96, 'inherited Dagger attack fires after opponent stun');
assert.equal(dummy.stacks.lucky, 1, 'successful early hit steals one random buff');
assert.equal(player.stacks.lucky, 1, 'stolen buff is granted to the Daggerang owner');
assert.equal(piece.staminaCost, 4, 'successful early hit reduces future stamina cost by source factor');
assert.ok(ctx.events.some((event) => event.type === 'buff' && event.meta?.handler === 'daggerang'));

handler.onPreDealDamageEarly(piece, ctx, { hit: false });
assert.equal(piece.staminaCost, 4, 'misses do not apply another stamina reduction');

console.log('OK Daggerang source port');
