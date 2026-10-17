/**
 * Source/runtime regression for Character lifecycle and death signaling.
 *
 *   node scripts/sim-character-lifecycle-smoke.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const gameSource = fs.readFileSync('tools/game-extract-full/Core/Game.gd', 'utf8');
const characterSource = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');

assert.match(characterSource, /func prepare\(\):[\s\S]*staminaRegen = baseStaminaRegen[\s\S]*accuracyRng\.reset\(\)/);
assert.match(characterSource, /func combatStart\(\):[\s\S]*stunnedDuration = 0\.0[\s\S]*tickTimer\.start\(\)/);
assert.match(characterSource, /func combatEnd\(\):[\s\S]*tickTimer\.stop\(\)[\s\S]*for buff in buffs:[\s\S]*buffs\[buff\]\.combatEnd\(\)/);
assert.match(characterSource, /func death\(\):[\s\S]*isDead = true[\s\S]*emit_signal\("character_died"\)/);
assert.match(gameSource, /PLAYER\.connect\("character_died", self, "endCombat"\)/);
assert.match(gameSource, /OPPONENT\.connect\("character_died", self, "endCombat"\)/);
assert.match(gameSource, /OPPONENT\.curHealth <= 0 or winNextRun or winNextRound/);

const catalogRaw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(catalogRaw) ? catalogRaw : catalogRaw.items || [];
const crossblades = catalog.find((item) => item.id === 'crossblades');
assert.ok(crossblades, 'catalog contains crossblades');

const run = simulateEngine({
  placements: [{ id: 'crossblades', key: 'you:crossblades', x: 0, y: 0, r: 0 }],
  itemsById: new Map([['crossblades', crossblades]]),
  durationSec: 5,
  dummyMaxHp: 1,
  dummyAttacks: false,
  seed: 20261017,
  captureLifecycle: true,
});

assert.equal(run.summary.endReason, 'dummy_dead', 'dummy death ends the engine as a player win');
const death = (run.transition || []).filter((entry) => entry.phase === 'character_died');
assert.equal(death.length, 1, 'death signal fires once');
assert.equal(death[0].side, 'dummy', 'the defeated character emits the death boundary');
assert.ok(
  death[0].t >= 2.5 && death[0].t <= 5,
  'death boundary is stamped during live combat',
);

console.log('OK Character lifecycle source hooks, death signal, and result resolution');
