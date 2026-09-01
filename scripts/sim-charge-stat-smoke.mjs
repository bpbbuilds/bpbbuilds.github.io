/**
 * Smoke: changeChargedItemStat enter/leave/increment parity.
 *   node scripts/sim-charge-stat-smoke.mjs
 */
import {
  changeChargedItemStat,
  clearChargeTrackers,
  enterChargeCell,
  registerChargePath,
} from '../js/pages/sim/engine/charge-stat.js';

let ok = true;

function piece(key) {
  return {
    placementKey: key,
    itemId: key,
    name: key,
    alive: true,
    speedScale: 0,
    timedSpeeds: [],
  };
}

function fail(msg, ...rest) {
  console.error('FAIL', msg, ...rest);
  ok = false;
}

clearChargeTrackers();
const tracker = registerChargePath('smoke:stat');

const shovel = piece('shovel');
const torch = piece('torch');
const flat = 0.1;
const per = 0.05;

// cell 1: newVal = flat + (1-2)*per + per = flat = 0.10
enterChargeCell(tracker, 1, shovel, flat, per);
if (Math.abs(shovel.speedScale - 0.1) > 1e-9) {
  fail('cell1 speed', shovel.speedScale, 'want 0.1');
}

// cell 2: leave shovel (-0.10), torch gets newVal = 0.15
enterChargeCell(tracker, 2, torch, flat, per);
if (Math.abs(shovel.speedScale - 0) > 1e-9) {
  fail('cell2 shovel cleared', shovel.speedScale);
}
if (Math.abs(torch.speedScale - 0.15) > 1e-9) {
  fail('cell2 torch speed', torch.speedScale, 'want 0.15');
}

// cell 3: same item increment +per
enterChargeCell(tracker, 3, torch, flat, per);
if (Math.abs(torch.speedScale - 0.2) > 1e-9) {
  fail('cell3 torch increment', torch.speedScale, 'want 0.2');
}

// cell 4: end — remove previousVal = flat + (4-2)*per = 0.2
enterChargeCell(tracker, 4, null, flat, per);
if (Math.abs(torch.speedScale - 0) > 1e-9) {
  fail('cell4 torch cleared', torch.speedScale);
}

// multi-cell same item: cell1 +0.10, cell2 +0.05 → 0.15
const tracker2 = registerChargePath('smoke:same');
const only = piece('only');
enterChargeCell(tracker2, 1, only, flat, per);
enterChargeCell(tracker2, 2, only, flat, per);
if (Math.abs(only.speedScale - 0.15) > 1e-9) {
  fail('same-item stack', only.speedScale, 'want 0.15');
}

// direct API spot-check
const tracker3 = registerChargePath('smoke:api');
tracker3.lastChargedPiece = shovel;
tracker3.curChargedPiece = null;
shovel.speedScale = 0.2;
changeChargedItemStat(tracker3, 4, flat, per);
if (Math.abs(shovel.speedScale - 0) > 1e-9) {
  fail('leave-only stat', shovel.speedScale);
}

if (!ok) process.exit(1);
console.log('sim-charge-stat-smoke OK');
