/**
 * Source/runtime regression for effect-damage scaling of Unhealing.
 *
 *   node scripts/sim-heal-parity-smoke.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor, unhealingFromLoggedHeal } from '../js/pages/sim/engine/actor.js';
import { applyEffectDmgFactor } from '../js/pages/sim/engine/actor-stats.js';

const source = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
assert.match(
  source,
  /func changeEffectDamageFactor\(amount\):[\s\S]*typedDamageFactors\[DamageSource\.Type\.Effect\] \+= amount[\s\S]*typedDamageFactors\[DamageSource\.Type\.Unhealing\] \+= amount/,
);
assert.match(
  source,
  /var unhealing = ceil\(amount \* getUnhealing\(\) \* \(1 \+ typedDamageFactors\[DamageSource\.Type\.Unhealing\]\)\)/,
);

const actor = createActor('player', { maxHp: 100 });
actor.unhealing = 0.25;
const events = [];
applyEffectDmgFactor(actor, 0.5, { t: 1, events }, { itemId: 'holo_fire_lizard' });
assert.equal(actor.effectDmgFactor, 0.5, 'effect damage factor still increases normally');
assert.equal(actor.unhealingDmgFactor, 0.5, 'effect damage factor also updates Unhealing factor');
assert.equal(
  unhealingFromLoggedHeal(actor, 100),
  38,
  'Unhealing uses ceil(heal × rate × (1 + typed factor))',
);

applyEffectDmgFactor(actor, -0.5, { t: 2, events }, { itemId: 'ice_dragon' });
assert.equal(actor.effectDmgFactor, 0, 'effect damage factor can be restored');
assert.equal(actor.unhealingDmgFactor, 0, 'Unhealing factor follows the same restoration');
assert.equal(unhealingFromLoggedHeal(actor, 100), 25, 'restored factor returns base Unhealing damage');

applyEffectDmgFactor(actor, -2, { t: 3, events }, { itemId: 'test_reduction' });
assert.equal(unhealingFromLoggedHeal(actor, 100), 0, 'negative total typed factor cannot deal negative damage');

console.log('OK effect damage factor and Unhealing parity');
