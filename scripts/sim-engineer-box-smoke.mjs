/**
 * Phase 255 — Port-O-Charger queues emitCharge(delay), not addSpeed at start.
 *   node scripts/sim-engineer-box-smoke.mjs
 */
import fs from 'fs';
import { COMBAT_DELAY, simulateEngine } from '../js/pages/sim/engine/simulate.js';

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

const run = simulateEngine({
  placements: [
    { id: 'engineer_box', key: 'box', x: 0, y: 0, r: 0 },
    { id: 'battery', key: 'bat', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 12,
  seed: 2551,
});

const startSnap = (run.pieceSnapshots || []).find(
  (s) => Math.abs(Number(s.t) - COMBAT_DELAY) < 0.05,
);
const startScale = Number(startSnap?.byKey?.bat?.speedScale) || 0;
ok(startScale === 0, `battery speedScale at combat start is 0 (got ${startScale})`);

const sparks = (run.events || []).filter(
  (e) => e.type === 'activate' && e.itemId === 'battery' && e.meta?.emitCharge,
);
ok(sparks.length === 2, `battery emitCharge twice (start + delayed), got ${sparks.length}`);
ok(Math.abs(Number(sparks[0]?.t) - COMBAT_DELAY) < 0.05, `first spark at COMBAT_DELAY (${sparks[0]?.t})`);
const delayedAt = COMBAT_DELAY + 5;
ok(
  sparks[1] && Math.abs(Number(sparks[1].t) - delayedAt) < 0.08,
  `second spark ~delay 5s after start (${sparks[1]?.t}, expect ~${delayedAt})`,
);
ok(Number(sparks[1]?.meta?.speedFactor) === 1.5, `re-emit uses box speed/100 (${sparks[1]?.meta?.speedFactor})`);

if (failed) process.exit(1);
