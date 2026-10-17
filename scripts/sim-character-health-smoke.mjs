/**
 * Source/runtime regression for Character health, healing, Unhealing, and
 * reincarnation boundaries.
 *
 *   node scripts/sim-character-health-smoke.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor, healActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { applyUnhealingHit } from '../js/pages/sim/engine/unhealing.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';

const source = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
const damageSource = fs.readFileSync('tools/game-extract-full/Utility/DamageSource.gd', 'utf8');
assert.match(source, /func heal\(amount,[\s\S]*amount \*= getHealingEfficiency\(\)[\s\S]*curHealth = min\(curHealth, getMaxHealth\(\)\)/);
assert.match(source, /func heal\(amount,[\s\S]*if getUnhealing\(\) > 0:[\s\S]*opponent\.takeDamage\(Game\.unhealingDamageSource/);
assert.match(source, /func loseHealth\(amount,[\s\S]*curHealth -= amount[\s\S]*if curHealth <= 0:[\s\S]*death\(\)/);
assert.match(source, /func changeMaxHealthTemporary\(amount,[\s\S]*temporaryMaxHealth \+= amount[\s\S]*curHealth \+= amount/);
assert.match(source, /func reincarnate\(healAmount: int,[\s\S]*setCurrentHealth\(0\)[\s\S]*setCurrentHealth\(healAmount\)[\s\S]*emitEvent\(self, "reincarnated"/);
assert.match(damageSource, /const unhealingFlags = Flags\.CanBeBlocked \+ Flags\.CanTriggerItems/);

const bus = createCombatBus();
const healer = createActor('player', { maxHp: 100 });
healer._combatBus = bus;
healer.hp = 80;
healer._healAmp = 0.5;
const healSignals = [];
bus.on('actor_healed', (payload) => healSignals.push(payload));
assert.equal(healActor(healer, 10), 15, 'healing efficiency scales the applied heal');
assert.equal(healer.hp, 95, 'healing is capped by max health after efficiency');
assert.equal(healer._lastHeal?.loggedAmount, 15, 'heal log keeps the post-efficiency amount');
assert.equal(healSignals.at(-1)?.loggedAmount, 15, 'healing emits the source actor_healed signal');

const foe = createActor('dummy', { maxHp: 100, block: 4 });
foe._combatBus = bus;
healer.unhealing = 0.5;
const unhealingEvents = [];
const unhealingSignals = [];
bus.on('character_damaged', (payload) => unhealingSignals.push(payload));
applyUnhealingHit({
  healer,
  foe,
  logged: 10,
  t: 2,
  events: unhealingEvents,
  rng: () => 0,
  bus,
});
assert.equal(foe.hp, 99, 'Unhealing applies its rounded damage after Block');
assert.equal(foe.block, 0, 'Unhealing consumes the source Block');
assert.equal(unhealingEvents.at(-1)?.amount, 1, 'Unhealing log reports health damage, not pre-Block damage');
assert.equal(unhealingSignals.at(-1)?.healthDamage, 1, 'Unhealing emits character_damaged through the shared path');

const reincarnating = createActor('dummy', { maxHp: 100 });
const attacker = createActor('player');
const resurrectionBus = createCombatBus();
reincarnating._combatBus = resurrectionBus;
resurrectionBus.on('character_damaged', ({ actor }) => {
  if (actor === reincarnating && actor.hp <= 0) {
    actor.dead = false;
    actor.hp = 20;
  }
});
takeDamage(reincarnating, attacker, {
  amount: 100,
  canMiss: false,
  canCrit: false,
  canBlock: false,
  isAttack: false,
  nowT: 3,
  bus: resurrectionBus,
  rng: () => 0,
});
assert.equal(reincarnating.hp, 20, 'reincarnation listener can restore health during character_damaged');
assert.equal(reincarnating.dead, false, 'restored characters are not marked dead after the signal');

console.log('OK Character health, healing efficiency, blockable Unhealing, and reincarnation boundary');
