/**
 * Source/formula regression for Game.getHealthGain and round health.
 *
 *   node scripts/sim-round-health-smoke.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  actorMaxHpForSim,
  getHealthGain,
  getMaxHealthInRound,
} from '../js/pages/sim/engine/round-health.js';
import { DUMMY_MAX_HP, PLAYER_MAX_HP } from '../js/pages/sim/engine/actor.js';

const gameSource = fs.readFileSync('tools/game-extract-full/Core/Game.gd', 'utf8');
assert.match(gameSource, /func getMaxHealthInRound\(forClass, untilRound\):[\s\S]*for i in range\(2, untilRound \+ 1\):[\s\S]*health \+= getHealthGain\(i\)/);
assert.match(gameSource, /func getHealthGain\(inRound\):[\s\S]*if inRound >= 15:[\s\S]*elif inRound >= 10:[\s\S]*elif inRound >= 5:[\s\S]*else:[\s\S]*curHealthGain = 10/);

for (const className of [
  'Adventurer',
  'Berserker',
  'Engineer',
  'Mage',
  'Pyromancer',
  'Ranger',
  'Reaper',
]) {
  const source = fs.readFileSync(`tools/game-extract-full/CharacterClasses/${className}/${className}.tres`, 'utf8');
  assert.match(source, /health = 25/, `${className} starts with 25 health`);
}

for (const [round, expected] of [
  [0, 10],
  [1, 10],
  [2, 10],
  [4, 10],
  [5, 15],
  [9, 15],
  [10, 20],
  [14, 20],
  [15, 30],
  [20, 30],
]) {
  assert.equal(getHealthGain(round), expected, `round ${round} health gain`);
}

for (const [round, expected] of [
  [1, 25],
  [2, 35],
  [5, 70],
  [10, 150],
  [15, 260],
]) {
  assert.equal(getMaxHealthInRound(round), expected, `round ${round} max health`);
}

assert.equal(getMaxHealthInRound(null), PLAYER_MAX_HP, 'missing player round uses simulator fallback');
assert.deepEqual(
  actorMaxHpForSim(5, false),
  { player: 70, dummy: 70 },
  'single-board early-round dummy uses the same round health for deterministic tests',
);
assert.deepEqual(
  actorMaxHpForSim(5, true, 10),
  { player: 70, dummy: 150 },
  'versus-board actors use their respective round health',
);
assert.deepEqual(
  actorMaxHpForSim(undefined, false),
  { player: PLAYER_MAX_HP, dummy: DUMMY_MAX_HP },
  'missing round keeps the default player and training-dummy pools',
);

console.log('OK Game round-health source formulas and simulator branches');
