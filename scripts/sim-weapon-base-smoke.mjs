import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { runWeaponInheritedHook } from '../js/pages/sim/engine/scripts/ports-wave-c-util.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Weapon.gd', 'utf8');
assert.match(source, /func attack\([\s\S]*dealDamage[\s\S]*activate/);
assert.match(source, /func doCooldownEffect\([\s\S]*useStamina[\s\S]*attack/);

const weapon = getScriptHandler('weapon');
assert.equal(weapon?.handlerId, 'weapon', 'Weapon.gd resolves to the shared engine surface');
assert.equal(typeof weapon?.onCooldownEffect, 'function', 'Weapon cooldown hook is exposed');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const events = [];
  const piece = {
    itemId: 'weapon',
    name: 'Weapon base',
    placementKey: `${side}:weapon`,
    side,
    kind: 'weapon',
    staminaCost: 2,
    damageMin: 7,
    damageMax: 7,
    damageKind: 'melee',
    accuracy: 100,
    chance: 0,
    critChance: 0,
    alive: true,
  };
  const ctx = {
    t: 1,
    player,
    dummy,
    events,
    rng: () => 0.5,
    bus: createCombatBus(),
  };
  assert.equal(weapon.onCooldownEffect(piece, ctx), true, `Weapon activates on ${side}`);
  assert.equal(player.stamina, 3, `Weapon spends stamina on ${side}`);
  assert.equal(dummy.hp, dummy.maxHp - 7, `Weapon returns and applies its hit result on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate'), `Weapon logs activation on ${side}`);
  assert.ok(
    events.findIndex((event) => event.type === 'damage') <
      events.findIndex((event) => event.type === 'activate'),
    `Weapon activates after its source attack on ${side}`,
  );

  player.stamina = 0;
  const before = events.length;
  assert.equal(weapon.onCooldownEffect(piece, ctx), false, `Weapon stops when stamina is insufficient on ${side}`);
  assert.equal(events.slice(before).some((event) => event.type === 'activate'), false, `Starved Weapon does not activate on ${side}`);
}

const calls = [];
const lifecyclePiece = {
  chanceRng: { reset: () => calls.push('chance-reset') },
  damageRangeRng: { reset: () => calls.push('range-reset') },
};
for (const phase of ['prepare', 'pre_combat_start', 'combat_start']) {
  runWeaponInheritedHook(lifecyclePiece, {}, phase, () => calls.push(phase));
}
assert.deepEqual(calls, ['chance-reset', 'range-reset', 'prepare', 'pre_combat_start', 'combat_start']);

console.log('OK shared Weapon stamina, attack/hit, activation, and inherited lifecycle');
