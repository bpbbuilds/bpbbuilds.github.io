/**
 * Source-backed critical roll parity smoke.
 *   node scripts/sim-crit-parity-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { runCharacterTick } from '../js/pages/sim/engine/ticks.js';

const damageSource = fs.readFileSync('tools/game-extract-full/Utility/DamageSource.gd', 'utf8');
const characterSource = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
assert.match(damageSource, /const chipDamageFlags = Flags\.CanBeBlocked/);
assert.match(characterSource, /poisonDamageSource\.flags = DamageSource\.chipDamageFlags \+ DamageSource\.Flags\.CanCrit/);
assert.match(characterSource, /if damageSource\.canCrit\(\):[\s\S]*critRng\.rollPercent/);
assert.match(characterSource, /func critResisted\(\) -> bool:[\s\S]*critResistanceRng\.rollPercent[\s\S]*critResistStacks/);

// A critical-resistance percentage is checked after a successful crit roll;
// it is not subtracted from the attacker's critical chance.
{
  const defender = createActor('dummy');
  const attacker = createActor('player');
  defender.critResistance = 100;
  defender.critResistStacks = 1;
  const result = takeDamage(defender, attacker, {
    amount: 10,
    canMiss: false,
    canCrit: true,
    critChance: 100,
    canBlock: false,
    isAttack: true,
    rng: () => 0,
  });
  assert.equal(result.critical, false, 'critical-resistance chance cancels the rolled critical');
  assert.equal(defender.critResistStacks, 1, 'chance resistance does not consume the fallback stack');
  assert.equal(result.damage, 10, 'a resisted critical keeps base damage');
}

// If the percentage roll fails, Character.critResisted consumes one guaranteed
// stack. This is distinct from the percentage resistance branch.
{
  const defender = createActor('dummy');
  const attacker = createActor('player');
  defender.critResistance = 0;
  defender.critResistStacks = 1;
  const result = takeDamage(defender, attacker, {
    amount: 10,
    canMiss: false,
    canCrit: true,
    critChance: 100,
    canBlock: false,
    isAttack: true,
    rng: () => 0,
  });
  assert.equal(result.critical, false, 'guaranteed resistance cancels the rolled critical');
  assert.equal(defender.critResistStacks, 0, 'fallback resistance stack is consumed');
  assert.equal(result.damage, 10, 'a stack-resisted critical keeps base damage');
}

// Poison ticks use the same DamageSource chip/CanCrit path as the game, so
// poison criticals must respect the same crit-resistance rules.
{
  const actor = createActor('dummy');
  actor.stacks.poison = 2;
  actor.poisonCritChance = 100;
  actor.critResistance = 100;
  const events = [];
  runCharacterTick(actor, 0.5, 1, events, () => 0);
  assert.equal(events[0]?.meta?.critical, false, 'poison crit is cancelled by percentage resistance');
  assert.equal(events[0]?.amount, 2, 'resisted poison crit deals normal poison damage');
}

console.log('OK critical source/parity smoke');
