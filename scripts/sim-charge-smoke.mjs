/**
 * Smoke: Battery charge path length + Godot-matched enter schedule.
 *   node scripts/sim-charge-smoke.mjs
 */
import {
  BATTERY_DUR_PER_TILE,
  buildBatteryChargePath,
  buildScriptChargePath,
  chargeEnterSchedule,
  collisionCellsToBoard,
  GENERATOR_CHARGE_CELLS,
  sampleWaypoint,
} from '../js/pages/sim/engine/charge-path.js';
import { isLogNoise } from '../js/pages/sim/sim-log-sentences.js';

const batteryItem = {
  id: 'battery',
  name: 'Battery',
  shape: [
    [6],
    [6],
    [6],
    [6],
    [1],
  ],
};

let ok = true;

const path = buildBatteryChargePath({
  pathId: 'smoke:battery',
  item: batteryItem,
  placement: { x: 0, y: 0, r: 0, key: 'p0' },
  startT: 2.52,
  durPerTile: BATTERY_DUR_PER_TILE,
  cellPx: 80,
});

if (!path) {
  console.error('FAIL no path');
  process.exit(1);
}

if (path.cells.length !== 5) {
  console.error('FAIL cell count', path.cells.length, 'want 5');
  ok = false;
}

if (Math.abs(path.duration - 8) > 1e-9) {
  console.error('FAIL duration', path.duration, 'want 8');
  ok = false;
}

const schedule = chargeEnterSchedule(5, 2);
const wantEnter = [
  { cellIndex: 1, enterT: 0 },
  { cellIndex: 2, enterT: 2 },
  { cellIndex: 3, enterT: 4 },
  { cellIndex: 4, enterT: 6 },
  { cellIndex: 5, enterT: 8 },
];
if (JSON.stringify(schedule) !== JSON.stringify(wantEnter)) {
  console.error('FAIL enter schedule', schedule, 'want', wantEnter);
  ok = false;
}

const mid = sampleWaypoint(path.waypoints, 4);
if (!Number.isFinite(mid.x) || !Number.isFinite(mid.y)) {
  console.error('FAIL sampleWaypoint mid', mid);
  ok = false;
}

const end = sampleWaypoint(path.waypoints, 8);
const lastWp = path.waypoints[path.waypoints.length - 1];
if (Math.abs(end.x - lastWp.x) > 1e-6 || Math.abs(end.y - lastWp.y) > 1e-6) {
  console.error('FAIL sample end', end, lastWp);
  ok = false;
}

if (!isLogNoise({ type: 'charge', t: 0 })) {
  console.error('FAIL charge should be log noise');
  ok = false;
}

if (!ok) process.exit(1);

// Generator @ (7,5) r=0 — collision-map path must start on generator, pass shovel (7,1).
const genItem = {
  id: 'generator',
  name: 'Generator',
  shape: [
    [0, 6, 6],
    [6, 0, 0],
    [6, 0, 0],
    [0, 6, 0],
    [0, 1, 0],
    [0, 1, 0],
  ],
};
const genPath = buildScriptChargePath({
  pathId: 'smoke:generator',
  item: genItem,
  placement: { x: 7, y: 5, r: 0, key: 'gen' },
  startT: 0,
  collisionCells: GENERATOR_CHARGE_CELLS,
  durPerTile: BATTERY_DUR_PER_TILE,
});
const wantGenCells = ['7,5', '7,4', '6,3', '6,2', '7,1', '8,1'];
if (!genPath || genPath.cells.map((c) => c.cell).join('|') !== wantGenCells.join('|')) {
  console.error('FAIL generator path', genPath?.cells.map((c) => c.cell), 'want', wantGenCells);
  ok = false;
}
const collisionBoard = collisionCellsToBoard(
  GENERATOR_CHARGE_CELLS,
  { x: 7, y: 5, r: 0 },
).map((b) => b.cell);
if (JSON.stringify(collisionBoard) !== JSON.stringify(wantGenCells)) {
  console.error('FAIL collisionCellsToBoard', collisionBoard, 'want', wantGenCells);
  ok = false;
}

if (!ok) process.exit(1);
console.log('sim-charge-smoke OK', {
  cells: path.cells.length,
  duration: path.duration,
  waypoints: path.waypoints.length,
  enters: schedule.map((s) => s.enterT),
});
