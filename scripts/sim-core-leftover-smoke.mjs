/**
 * Phase 256 — Bow.onWeaponAttacked + no self-hit stand-ins.
 *   node scripts/sim-core-leftover-smoke.mjs
 */
import fs from 'fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

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

function lastScale(run, key, field) {
  const snaps = run.pieceSnapshots || [];
  const last = snaps[snaps.length - 1];
  return Number(last?.byKey?.[key]?.[field]) || 0;
}

function endSpikes(run) {
  return Number(run.summary?.player?.spikes) || 0;
}

{
  const run = simulateEngine({
    placements: [{ id: 'thorn_bow', key: 'tb', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 12,
    seed: 2561,
  });
  ok(endSpikes(run) === 4, `solo Thorn Bow does not spend spikes on its own CD (got ${endSpikes(run)})`);
}

{
  const run = simulateEngine({
    placements: [
      { id: 'thorn_bow', key: 'tb', x: 0, y: 0, r: 0 },
      { id: 'wooden_sword', key: 'w', x: 3, y: 1, r: 0 },
    ],
    itemsById: byId,
    durationSec: 12,
    seed: 2562,
  });
  ok(endSpikes(run) < 4, `linked sword hit spends Thorn Bow spikes (got ${endSpikes(run)})`);
}

{
  const run = simulateEngine({
    placements: [{ id: 'bow_and_arrow', key: 'ba', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 12,
    seed: 2563,
  });
  ok(
    lastScale(run, 'ba', 'bonusDamage') === 0,
    `solo Bow and Arrow does not grow on its own shots (got ${lastScale(run, 'ba', 'bonusDamage')})`,
  );
}

{
  const run = simulateEngine({
    placements: [
      { id: 'bow_and_arrow', key: 'ba', x: 0, y: 0, r: 0 },
      { id: 'wooden_sword', key: 'w', x: 3, y: 1, r: 0 },
    ],
    itemsById: byId,
    durationSec: 12,
    seed: 2564,
  });
  ok(
    lastScale(run, 'ba', 'bonusDamage') > 0,
    `linked sword hit grows Bow and Arrow bonus (got ${lastScale(run, 'ba', 'bonusDamage')})`,
  );
}

{
  const run = simulateEngine({
    placements: [{ id: 'poison_bow', key: 'pb', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 10,
    seed: 2565,
  });
  const poisonHits = (run.events || []).filter(
    (e) => e.type === 'debuff' && e.itemId === 'poison_bow',
  );
  ok(
    poisonHits.length === 0,
    `solo Poison Bow does not poison from its own damage/per (got ${poisonHits.length})`,
  );
}

if (failed) process.exit(1);
