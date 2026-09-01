/**
 * Phase 257 — cd-then-consume does not loop; start consume still activates.
 *   node scripts/sim-cd-consume-smoke.mjs
 */
import fs from 'fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { CD_THEN_CONSUME_IDS } from '../js/pages/sim/engine/cd-then-consume-ids.js';
import { findCdThenConsumeMismatches } from '../js/pages/sim/engine/report-cd-consume.js';
import { findMissingConsumeActivations } from '../js/pages/sim/engine/report-params.js';

const GAME_ITEMS = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const byId = new Map();
for (const it of GAME_ITEMS.items || []) {
  byId.set(it.id, {
    id: it.id,
    name: it.name,
    type: it.type,
    extraTypes: it.extraTypes,
    cooldown: it.cooldown,
    damageMin: it.damageMin,
    damageMax: it.damageMax,
    accuracy: it.accuracy,
    staminaCost: it.staminaCost,
    params: it.params,
    shape: it.shape || [[1]],
    chance: it.chance,
    chance2: it.chance2,
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

let skipped = 0;
for (const id of [...CD_THEN_CONSUME_IDS].sort()) {
  if (!byId.has(id)) {
    skipped += 1;
    continue;
  }
  const run = simulateEngine({
    placements: [{ id, key: 'x', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 30,
    seed: 2570,
  });
  const flags = findCdThenConsumeMismatches(run, byId);
  ok(flags.length === 0, `${id}: no cd_then_consume loop (${flags[0]?.note || 'ok'})`);
}

for (const id of ['piggybank', 'pocket_sand']) {
  const run = simulateEngine({
    placements: [{ id, key: 'x', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 8,
    seed: 2571,
  });
  const acts = (run.events || []).filter((e) => e.type === 'activate' && e.itemId === id).length;
  const miss = findMissingConsumeActivations(run, byId);
  ok(acts >= 1, `${id}: combat-start consume activate (${acts})`);
  ok(miss.length === 0, `${id}: no missing consume activation`);
}

ok(skipped <= 3, `catalog aliases skipped (${skipped} emerald/ruby/sapphire parents)`);

if (failed) process.exit(1);
