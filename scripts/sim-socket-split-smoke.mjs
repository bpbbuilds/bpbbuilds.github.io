/**
 * Phase 254 — socket prepareWeapon vs inventory prepareInventory.
 *   node scripts/sim-socket-split-smoke.mjs
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

function speedAfterActivates(run, key) {
  const out = [];
  for (const e of run.events || []) {
    if (e.type !== 'activate' || e.itemId !== 'wooden_sword') continue;
    const snap = [...(run.pieceSnapshots || [])]
      .reverse()
      .find((s) => Number(s.t) <= Number(e.t) + 0.05);
    out.push(Number(snap?.byKey?.[key]?.speedScale) || 0);
  }
  return out;
}

{
  const run = simulateEngine({
    placements: [{ id: 'wooden_sword', key: 'w', x: 0, y: 0, r: 0, gems: ['chipped_topaz'] }],
    itemsById: byId,
    durationSec: 10,
    seed: 2541,
  });
  const speeds = speedAfterActivates(run, 'w');
  ok(speeds.length >= 2, `topaz socket: sword activated (${speeds.length})`);
  const first = speeds[0];
  const last = speeds[speeds.length - 1];
  ok(first > 0, `topaz prepareWeapon addSpeed once (speed ${first})`);
  ok(first === last, `topaz speed not per hit (${first} → ${last})`);
  ok(
    !(Number(run.summary?.player?.combatStats?.stamina_regen) > 0),
    'socketed topaz does not apply prepareInventory stam regen',
  );

  const baseline = simulateEngine({
    placements: [{ id: 'wooden_sword', key: 'w', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 2.51,
    seed: 2541,
    dummyAttacks: false,
  });
  const initialSocketCd = run.pieceSnapshots.find((s) => Number(s.t) === 2.5)?.byKey?.w?.cooldown;
  const initialBaseCd = baseline.pieceSnapshots.find((s) => Number(s.t) === 2.5)?.byKey?.w?.cooldown;
  ok(
    Number(initialSocketCd) < Number(initialBaseCd),
    `socketed topaz prepares before initial cooldown arm (${initialSocketCd} < ${initialBaseCd})`,
  );
}

{
  const run = simulateEngine({
    placements: [{ id: 'chipped_topaz', key: 'g', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 4,
    seed: 2542,
  });
  ok(
    Number(run.summary?.player?.combatStats?.stamina_regen) > 0,
    'loose topaz prepareInventory stam regen',
  );
}

{
  const run = simulateEngine({
    placements: [{ id: 'wooden_sword', key: 'w', x: 0, y: 0, r: 0, gems: ['badger_rune'] }],
    itemsById: byId,
    durationSec: 10,
    seed: 2543,
  });
  const speeds = speedAfterActivates(run, 'w');
  ok(speeds.length >= 3, `badger socket: sword activated (${speeds.length})`);
  ok(speeds[0] > 0, `badger first hit addSpeed (${speeds[0]})`);
  ok(speeds[speeds.length - 1] > speeds[0], `badger speed stacks per hit (${speeds[0]} → ${speeds[speeds.length - 1]})`);
}

{
  const run = simulateEngine({
    placements: [{ id: 'moon_armor', key: 'moon', x: 0, y: 0, r: 0, gems: ['lump_of_coal'] }],
    itemsById: byId,
    durationSec: 2.51,
    seed: 2544,
    dummyAttacks: false,
  });
  const start = run.snapshots.find((s) => Number(s.t) === 2.5);
  ok(
    Number(start?.player?.block) === 58,
    `coal socket combat-start block combines with host start effect (${start?.player?.block})`,
  );
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nSocket/inventory split smoke passed');
