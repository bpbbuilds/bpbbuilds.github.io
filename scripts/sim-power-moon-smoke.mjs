import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FATIGUE_TIME,
  advanceFatigueTime,
  createFatigueState,
} from '../js/pages/sim/engine/fatigue.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'js/pages/sim/engine/scripts/ports-threshold.js'),
  'utf8',
);
const start = source.indexOf('export const powerOfTheMoonPort');
const end = source.indexOf('\n};', start);
assert.ok(start >= 0 && end > start, 'Power of the Moon handler is registered');
const handler = source.slice(start, end);

// Source-linked guardrails: these are the four effects in the catalog/source
// contract and prevent a future port from silently falling back to basic_cd.
assert.match(handler, /onPostCombatStart[\s\S]*advanceTime/);
assert.match(handler, /onPrepare[\s\S]*_moonLinkedKeys/);
assert.match(handler, /fatigue_start[\s\S]*maxhealth/);
assert.match(handler, /activatedId === 'moon_armor'[\s\S]*blind/);
assert.match(handler, /activatedId === 'moon_shield'[\s\S]*debuffReflectStacks/);
assert.doesNotMatch(handler, /onCooldownEffect/);

// CombatTimer.advanceTime changes only the fatigue threshold. It is additive
// for multiple linked Power of the Moon pieces and is inert after fatigue has
// already started.
const state = createFatigueState();
assert.equal(state.startAt, FATIGUE_TIME);
assert.equal(advanceFatigueTime(state, 6), 6);
assert.equal(state.startAt, 11);
assert.equal(state.advancedBy, 6);
assert.equal(advanceFatigueTime(state, 6), 6);
assert.equal(state.startAt, 5);
state.started = true;
assert.equal(advanceFatigueTime(state, 1), 0);

console.log('Power of the Moon smoke passed: handler effects and fatigue timer advance are source-guarded.');
