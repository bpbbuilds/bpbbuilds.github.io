/**
 * Source/runtime regression for Character.takeDamage/dealDamage phases.
 *
 *   node scripts/sim-character-damage-smoke.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { dealDamage, takeDamage } from '../js/pages/sim/engine/damage.js';

const source = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
const shieldSource = fs.readFileSync('tools/game-extract-full/Items/Shield.gd', 'utf8');
assert.match(source, /EventBus\.emitSignal\(self, "pre_take_damage"[\s\S]*damageRes\.damage -= damageRes\.damageReduction/);
assert.match(source, /EventBus\.emitSignal\(self, "pre_take_damage_late"[\s\S]*damageRes\.healthDamage = damageRes\.damage/);
assert.match(source, /if damageSource\.canBeBlocked\(\):[\s\S]*loseBlock\(curBlock\)[\s\S]*curHealth -= damageRes\.healthDamage/);
assert.match(source, /EventBus\.emitEvent\(self, "character_attacked"[\s\S]*EventBus\.emitSignal\(self, "character_damaged"[\s\S]*if curHealth <= 0:[\s\S]*death\(\)/);
assert.match(shieldSource, /onCharacterAttacked[\s\S]*afterBlock\(\)[\s\S]*EventBus\.emitSignal\(self, "blocked"/);
assert.match(source, /applySpikes\(damageRes\)[\s\S]*return damageRes/);

const attacker = createActor('player', { maxHp: 100 });
const defender = createActor('dummy', { maxHp: 100, block: 3 });
const bus = createCombatBus();
attacker._combatBus = bus;
defender._combatBus = bus;

const order = [];
bus.on('character_damaged', (payload) => order.push(['damaged', payload.hit, payload.healthDamage]));
bus.on('character_died', (payload) => order.push(['died', payload.actor.id]));

defender.damageResistancePct = 20;
defender.damageReduction = 2;
const reduced = takeDamage(defender, attacker, {
  amount: 10,
  canMiss: false,
  canCrit: false,
  canBlock: true,
  isAttack: true,
  isMelee: true,
  nowT: 1,
  bus,
  rng: () => 0,
});
assert.equal(reduced.raw, 10, 'damage retains the rolled raw amount');
assert.equal(reduced.damage, 6, 'resistance and flat attack reduction run before Block');
assert.equal(reduced.blocked, 3, 'Block consumes the post-reduction amount');
assert.equal(reduced.healthDamage, 3, 'health damage is separated from blocked damage');
assert.equal(defender.hp, 97, 'damage applies only remaining health damage');
assert.deepEqual(order.at(-1), ['damaged', true, 3], 'character_damaged carries the final hit result');

const shieldOrder = [];
const shieldBus = createCombatBus();
const shieldAttacker = createActor('player', { maxHp: 100 });
const shieldDefender = createActor('dummy', { maxHp: 100 });
shieldDefender._combatBus = shieldBus;
shieldDefender._shields = [{
  piece: { itemId: 'test_shield', placementKey: 'test_shield:0' },
  chance: 100,
  canBlockDamageRes: () => true,
  getDamblock: () => 0,
  beforeBlock: () => shieldOrder.push('beforeBlock'),
  afterBlock: () => shieldOrder.push('afterBlock'),
}];
shieldBus.on('character_damaged', () => shieldOrder.push('character_damaged'));
takeDamage(shieldDefender, shieldAttacker, {
  amount: 5,
  canMiss: false,
  canCrit: false,
  canBlock: true,
  isAttack: true,
  isMelee: true,
  nowT: 1,
  bus: shieldBus,
  rng: () => 0,
});
assert.deepEqual(
  shieldOrder,
  ['beforeBlock', 'afterBlock', 'character_damaged'],
  'shield afterBlock runs from character_attacked before character_damaged listeners',
);

const missedSignals = [];
const missBus = createCombatBus();
const missAttacker = createActor('player');
const missDefender = createActor('dummy');
missDefender._combatBus = missBus;
missBus.on('character_damaged', (payload) => missedSignals.push(payload));
const missed = dealDamage(missAttacker, missDefender, {
  amount: 10,
  accuracy: 0,
  canMiss: true,
  canCrit: false,
  isAttack: true,
  nowT: 2,
  bus: missBus,
  rng: () => 0,
});
assert.equal(missed.hit, false, 'zero accuracy produces a miss');
assert.equal(missedSignals.length, 1, 'misses still emit the source character_damaged signal');
assert.equal(missedSignals[0].hit, false, 'miss signal preserves the failed hit result');
assert.equal(missDefender.hp, missDefender.maxHp, 'misses do not change health');

const invulnerable = createActor('dummy', { maxHp: 100 });
invulnerable.invulnUntil = 10;
invulnerable._combatBus = missBus;
const poisonWhileInvulnerable = takeDamage(invulnerable, missAttacker, {
  amount: 7,
  canMiss: false,
  canCrit: false,
  canBlock: true,
  isAttack: false,
  isPoison: true,
  nowT: 3,
  bus: missBus,
  rng: () => 0,
});
assert.equal(poisonWhileInvulnerable.healthDamage, 0, 'poison respects active invulnerability');
assert.equal(invulnerable.hp, 100, 'invulnerability prevents poison damage');

const invulnerabilityPhases = [];
const invulnerabilityBus = createCombatBus();
invulnerabilityBus.on('pre_take_damage', () => invulnerabilityPhases.push('pre'));
invulnerabilityBus.on('pre_take_damage_late', () => invulnerabilityPhases.push('late'));
invulnerabilityBus.on('character_damaged', (payload) => invulnerabilityPhases.push(`damaged:${payload.hit}`));
const invulnerableHit = createActor('dummy', { maxHp: 100, block: 4 });
invulnerableHit.invulnUntil = 10;
const zeroedHit = takeDamage(invulnerableHit, missAttacker, {
  amount: 7,
  canMiss: false,
  canCrit: false,
  canBlock: true,
  isAttack: true,
  isMelee: true,
  nowT: 3,
  bus: invulnerabilityBus,
  rng: () => 0,
});
assert.equal(zeroedHit.hit, true, 'an invulnerable attack can still register as a hit');
assert.equal(zeroedHit.damage, 0, 'invulnerability zeros damage before take-damage hooks');
assert.equal(zeroedHit.healthDamage, 0, 'invulnerability prevents health loss without skipping the phase');
assert.equal(invulnerableHit.block, 4, 'zero invulnerable damage does not consume Block');
assert.deepEqual(
  invulnerabilityPhases,
  ['pre', 'late', 'damaged:true'],
  'invulnerable hits preserve source pre/late/damaged ordering',
);

const invulnerableMissPhases = [];
const invulnerableMissBus = createCombatBus();
invulnerableMissBus.on('pre_take_damage', () => invulnerableMissPhases.push('pre'));
invulnerableMissBus.on('pre_take_damage_late', () => invulnerableMissPhases.push('late'));
invulnerableMissBus.on('character_damaged', (payload) => invulnerableMissPhases.push(`damaged:${payload.hit}`));
const invulnerableMissTarget = createActor('dummy', { maxHp: 100 });
invulnerableMissTarget.invulnUntil = 10;
const missedInvulnerableHit = takeDamage(invulnerableMissTarget, missAttacker, {
  amount: 7,
  accuracy: 0,
  canMiss: true,
  canCrit: false,
  isAttack: true,
  isMelee: true,
  nowT: 3,
  bus: invulnerableMissBus,
  rng: () => 0,
});
assert.equal(missedInvulnerableHit.hit, false, 'invulnerability does not bypass accuracy');
assert.deepEqual(invulnerableMissPhases, ['damaged:false'], 'missed invulnerable attacks skip hit-only hooks');

const spikeOwner = createActor('dummy', { maxHp: 100 });
const spikeAttacker = createActor('player', { maxHp: 100 });
spikeOwner.stacks.spikes = 4;
const spiked = takeDamage(spikeOwner, spikeAttacker, {
  amount: 4,
  canMiss: false,
  canCrit: false,
  canBlock: false,
  isAttack: true,
  isMelee: true,
  nowT: 4,
  rng: () => 0,
});
assert.equal(spiked.spikeDamage, 4, 'melee damage reflects capped Spikes damage');
assert.equal(spikeAttacker.hp, 96, 'Spikes damage reaches the attacking character');

const vampAttacker = createActor('player', { maxHp: 100 });
const vampDefender = createActor('dummy', { maxHp: 100 });
vampAttacker.hp = 90;
vampAttacker.stacks.vampirism = 10;
const vamped = dealDamage(vampAttacker, vampDefender, {
  amount: 10,
  canMiss: false,
  canCrit: false,
  canBlock: false,
  isAttack: true,
  isMelee: true,
  canTriggerVampirism: true,
  nowT: 5,
  rng: () => 0,
});
assert.equal(vamped.vampHeal, 10, 'damage applies source vampirism after the hit');
assert.equal(vampAttacker.hp, 100, 'vampirism restores health from dealt damage');

const lethalBus = createCombatBus();
const lethalAttacker = createActor('player');
const lethalDefender = createActor('dummy', { maxHp: 5 });
lethalDefender._combatBus = lethalBus;
const lethalOrder = [];
lethalBus.on('character_damaged', () => lethalOrder.push('damaged'));
lethalBus.on('character_died', () => lethalOrder.push('died'));
takeDamage(lethalDefender, lethalAttacker, {
  amount: 5,
  canMiss: false,
  canCrit: false,
  canBlock: false,
  isAttack: false,
  nowT: 6,
  bus: lethalBus,
  rng: () => 0,
});
assert.deepEqual(lethalOrder, ['damaged', 'died'], 'damage signal precedes source death boundary');

console.log('OK Character damage phases, miss/invulnerability signals, Block, Spikes, and vampirism');
