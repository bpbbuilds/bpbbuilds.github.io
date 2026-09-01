/**
 * Board graph star/body cells must match stampAffectCells (shapeMarkToBoard).
 *   node scripts/sim-board-cells-smoke.mjs
 */
import fs from 'node:fs';
import { buildBoardGraph, affectedTargets } from '../js/pages/sim/engine/board-graph.js';
import { shapeMarkToBoard, shapeForItem, bodyBounds } from '../js/shared/backpack-grid/shape.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const items = raw.items || Object.values(raw.byId || {});
const byId = new Map(items.map((i) => [i.id, i]));
const shapesFile = JSON.parse(fs.readFileSync('assets/data/item-shapes.json', 'utf8'));
const shapeRoot = shapesFile.items || shapesFile;
for (const [id, shape] of Object.entries(shapeRoot)) {
  const it = byId.get(id);
  if (it && !it.shape) it.shape = shape;
}
const rulesFile = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rulesFile.byId || null };

/** @param {object} item @param {{ x: number, y: number, r?: number }} p */
function boardMarks(item, p) {
  const face = Number(p.r) || 0;
  const placement = { x: p.x, y: p.y, r: face };
  const up = shapeForItem(item, 0);
  const bounds = bodyBounds(up);
  const body = up.body.map((c) =>
    shapeMarkToBoard(item, placement, c.x - bounds.minX, c.y - bounds.minY).cell,
  );
  const stars = (up.stars || []).map((c) =>
    shapeMarkToBoard(item, placement, c.x - bounds.minX, c.y - bounds.minY).cell,
  );
  return { body, stars };
}

const cases = [
  { id: 'amulet_of_the_wild', x: 3, y: 6, r: 0 },
  { id: 'amulet_of_feasting', x: 4, y: 2, r: 1 },
  { id: 'banana', x: 3, y: 5, r: 2 },
  { id: 'fanny_pack', x: 2, y: 1, r: 1 },
];

for (const c of cases) {
  const item = byId.get(c.id);
  const key = `k:${c.id}:${c.r}`;
  const p = { key, id: c.id, x: c.x, y: c.y, r: c.r };
  const graph = buildBoardGraph([p], byId);
  const piece = graph.pieces.get(key);
  const marks = boardMarks(item, p);
  ok(
    JSON.stringify(piece.cells.sort()) === JSON.stringify(marks.body.sort()),
    `${c.id} r${c.r} body cells match shapeMarkToBoard`,
  );
  const graphStars = piece.affectCells
    .filter((a) => a.color === 'primary')
    .map((a) => a.cell)
    .sort();
  ok(
    JSON.stringify(graphStars) === JSON.stringify(marks.stars.sort()),
    `${c.id} r${c.r} star cells match shapeMarkToBoard`,
  );
}

// Feasting must not buff banana when only body-adjacent (star off banana).
const feastingP = { key: 'feast', id: 'amulet_of_feasting', x: 0, y: 0, r: 0 };
const bananaP = { key: 'ban', id: 'banana', x: 8, y: 8, r: 0 };
const graph2 = buildBoardGraph([feastingP, bananaP], byId);
const targets = affectedTargets(graph2, 'feast', byId, canAffect);
const sim = simulateEngine({
  placements: [feastingP, bananaP],
  itemsById: byId,
  canAffect,
  durationSec: 0.5,
  seed: 1,
});
const lastSnap = sim.pieceSnapshots?.[sim.pieceSnapshots.length - 1] || {};
const bananaSpeed = (lastSnap.ban?.statMods || []).filter((m) => m.stat === 'speed');
const feastSpeed = bananaSpeed.find((m) => m.sourceId === 'amulet_of_feasting');

ok(!targets.some((t) => t.id === 'banana'), 'feasting does not link distant banana');
ok(!feastSpeed, 'feasting does not grant banana speed without star overlap');

// Wild amulet star on banana cell still must not link Food (canAffect Pet only).
const wildP = { key: 'wild', id: 'amulet_of_the_wild', x: 3, y: 6, r: 0 };
const bananaNear = { key: 'ban2', id: 'banana', x: 3, y: 5, r: 2 };
const graph3 = buildBoardGraph([wildP, bananaNear], byId);
const wildTargets = affectedTargets(graph3, 'wild', byId, canAffect);
ok(!wildTargets.some((t) => t.id === 'banana'), 'wild amulet ignores non-Pet on star cell');

// Bags share cells with cargo; filledCells is items-only (Inventory.gd).
{
  const bagP = { key: 'bag', id: 'leather_bag', x: 0, y: 0, r: 0 };
  const cardP = { key: 'card', id: 'the_fool', x: 0, y: 0, r: 0 };
  const graphBag = buildBoardGraph([bagP, cardP], byId);
  ok(graphBag.filled.get('0,0') === 'card', 'item wins bag cell in filled map');
  ok(graphBag.filled.get('0,1') === 'card', 'item wins second bag/card cell');
  const deckP = { key: 'deck', id: 'deck_of_cards', x: 0, y: 2, r: 0 };
  const graphChain = buildBoardGraph([bagP, cardP, deckP], byId);
  const deckHits = affectedTargets(graphChain, 'deck', byId, canAffect);
  ok(
    deckHits.some((t) => t.key === 'card'),
    'deck star reaches card even when leather bag underlaps',
  );
}

process.exit(failed ? 1 : 0);
