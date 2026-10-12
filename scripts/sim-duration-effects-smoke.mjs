/**
 * Regression for source duration multipliers on stun effects and simulator tips.
 * Run: node scripts/sim-duration-effects-smoke.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { mergeLiveItemStats } from '../js/pages/sim/shell/sim-live-item.js';

const game = JSON.parse(readFileSync('scripts/_cache/game-items.json', 'utf8'));
const descr = JSON.parse(readFileSync('scripts/_cache/game-descr.json', 'utf8'));
const canAffect = {
  rulesById: JSON.parse(readFileSync('assets/data/can-affect-rules.json', 'utf8')).byId,
};

const byId = new Map(game.items.map((item) => [item.id, item]));
const descriptionById = new Map((descr.items || []).map((item) => [item.id, item]));

function item(id, overrides = {}) {
  const base = byId.get(id);
  assert.ok(base, `catalog item ${id} exists`);
  const out = structuredClone(base);
  const effect = descriptionById.get(id)?.effect;
  if (effect) out.effect = effect;
  return Object.assign(out, overrides);
}

const hammer = item('hammer', { chance: 100 });
const time = item('time_melting');
const endurance = item('puzzlebag_j');
const itemsById = new Map([
  [hammer.id, hammer],
  [time.id, time],
  [endurance.id, endurance],
]);

function run(placements) {
  return simulateEngine({
    placements,
    itemsById,
    canAffect,
    seed: 2965184550,
    durationSec: 8,
    dummyAttacks: false,
  });
}

function hammerStun(runResult) {
  const event = runResult.events.find(
    (entry) => entry.meta?.handler === 'hammer' && /Stun \(/i.test(entry.label || ''),
  );
  assert.ok(event, 'Hammer emits a stun event');
  const match = String(event.label).match(/Stun \(([^)]+)s\)/i);
  assert.ok(match, `Hammer event contains a duration: ${event.label}`);
  return Number(match[1]);
}

const base = run([{ id: 'hammer', key: 'hammer', x: 0, y: 0, r: 0 }]);
assert.equal(hammerStun(base), 0.5, 'Hammer base stun is 0.5s');

const inEndurance = run([
  { id: 'puzzlebag_j', key: 'endurance', x: 0, y: 0, r: 0 },
  { id: 'hammer', key: 'hammer', x: 0, y: 0, r: 0 },
]);
assert.equal(hammerStun(inEndurance), 0.65, 'Endurance extends Hammer stun to 0.65s');

const inFourEndurance = run([
  { id: 'puzzlebag_j', key: 'endurance-a', x: 0, y: 0, r: 0 },
  { id: 'puzzlebag_j', key: 'endurance-b', x: 0, y: 0, r: 0 },
  { id: 'puzzlebag_j', key: 'endurance-c', x: 0, y: 0, r: 0 },
  { id: 'puzzlebag_j', key: 'endurance-d', x: 0, y: 0, r: 0 },
  { id: 'hammer', key: 'hammer', x: 0, y: 0, r: 0 },
]);
assert.ok(Math.abs(hammerStun(inFourEndurance) - 1.42805) < 1e-9, 'Four Endurance bags compose on Hammer');

const timeOnHammer = run([
  { id: 'time_melting', key: 'time', x: 0, y: 1, r: 0 },
  { id: 'hammer', key: 'hammer', x: 0, y: 0, r: 0 },
]);
assert.equal(hammerStun(timeOnHammer), 0.775, 'Time Melting extends Hammer stun to 0.775s');

const combined = run([
  { id: 'time_melting', key: 'time', x: 0, y: 1, r: 0 },
  { id: 'puzzlebag_j', key: 'endurance', x: 0, y: 0, r: 0 },
  { id: 'hammer', key: 'hammer', x: 0, y: 0, r: 0 },
]);
assert.ok(Math.abs(hammerStun(combined) - 1.0075) < 1e-9, 'Duration multipliers compose for Hammer');
const combinedTip = mergeLiveItemStats(hammer, combined.pieceSnapshots[0].byKey.hammer);
assert.match(combinedTip.effect, /1\.0075s/, 'Combined prepared duration appears in Hammer tooltip');

const tip = mergeLiveItemStats(hammer, inEndurance.pieceSnapshots[0].byKey.hammer);
assert.match(tip.effect, /0\.65s/, 'Simulator Hammer tooltip shows modified stun duration');

console.log('Simulator duration-effects smoke passed.');
