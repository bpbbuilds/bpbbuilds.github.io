/**
 * Refine grid metrics from bag-detector boxes and complete a Leather Bag 2×2 lattice.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canPlace,
  isBagItem,
  placementBodyCells,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';

/**
 * @param {number[]} xs
 */
function median(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Drop tiny / edge false bags (Fanny Pack scrap) when real 2×2 bags exist.
 * @param {{ id: string, confidence?: number, box?: { cx: number, cy: number, w: number, h: number } }[]} hints
 * @param {Map<string, object>} itemsById
 */
export function filterRealBagHints(hints, itemsById) {
  const withBody = hints
    .map((h) => {
      const item = itemsById.get(String(h.id));
      if (!item || !h.box || !isBagItem(item)) return null;
      const body = bodyBounds(shapeForItem(item, 0));
      const area = h.box.w * h.box.h;
      return { h, item, body, area };
    })
    .filter(Boolean);
  const big = withBody.filter((x) => x.body.w >= 2 && x.body.h >= 2 && x.area > 80 * 80);
  if (big.length < 2) return hints;
  const medArea = median(big.map((x) => x.area));
  return withBody
    .filter((x) => x.body.w >= 2 && x.body.h >= 2 && x.area >= medArea * 0.45)
    .map((x) => x.h);
}

/**
 * Override cell size / origin from 2×2 bag boxes (fabric grid often wrong on tight crops).
 * Origin is the top-left of the bag cluster so lattice slot (0,0) maps to the first bag.
 * @param {{ cellW: number, cellH: number, originX: number, originY: number, gridOk?: boolean }} metrics
 * @param {{ id: string, box?: { cx: number, cy: number, w: number, h: number } }[]} bagHints
 * @param {Map<string, object>} itemsById
 */
export function refineMetricsFromBagHints(metrics, bagHints, itemsById) {
  /** @type {number[]} */
  const cellSamples = [];
  /** @type {{ left: number, top: number }[]} */
  const corners = [];
  for (const h of bagHints) {
    const item = itemsById.get(String(h.id));
    if (!item || !h.box) continue;
    const body = bodyBounds(shapeForItem(item, 0));
    if (body.w < 2 || body.h < 2) continue;
    cellSamples.push(h.box.w / body.w, h.box.h / body.h);
    corners.push({
      left: h.box.cx - h.box.w / 2,
      top: h.box.cy - h.box.h / 2,
    });
  }
  if (cellSamples.length < 2 || corners.length < 2) return { ...metrics, refined: false };

  const cell = median(cellSamples);
  if (!(cell > 24 && cell < 220)) return { ...metrics, refined: false };

  const minLeft = Math.min(...corners.map((c) => c.left));
  const minTop = Math.min(...corners.map((c) => c.top));

  return {
    ...metrics,
    cellW: cell,
    cellH: cell,
    originX: minLeft,
    originY: minTop,
    refined: true,
  };
}

/**
 * Place 2×2 bags on a lattice from detector boxes (ignores fabric-grid snap errors).
 * @param {{ id: string, name?: string, confidence?: number, box?: { cx: number, cy: number, w: number, h: number } }[]} bagHints
 * @param {Map<string, object>} itemsById
 * @param {{ cellW: number, cellH: number, originX: number, originY: number }} metrics
 */
export function placeBagsOnDetectorLattice(bagHints, itemsById, metrics) {
  const { cellW, cellH, originX, originY } = metrics;
  /** @type {object[]} */
  const placed = [];
  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} */
  const bagsOut = [];

  /** @type {{ hint: (typeof bagHints)[0], item: object, lx: number, ly: number, bodyW: number, bodyH: number }[]} */
  const slots = [];
  for (const hint of bagHints) {
    const item = itemsById.get(String(hint.id));
    if (!item || !hint.box) continue;
    const body = bodyBounds(shapeForItem(item, 0));
    if (body.w < 2 || body.h < 2) continue;
    const left = hint.box.cx - hint.box.w / 2;
    const top = hint.box.cy - hint.box.h / 2;
    const lx = Math.round((left - originX) / (body.w * cellW));
    const ly = Math.round((top - originY) / (body.h * cellH));
    slots.push({ hint, item, lx, ly, bodyW: body.w, bodyH: body.h });
  }
  if (slots.length < 2) return null;

  const minLx = Math.min(...slots.map((s) => s.lx));
  const minLy = Math.min(...slots.map((s) => s.ly));
  slots.sort(
    (a, b) => (Number(b.hint.confidence) || 0) - (Number(a.hint.confidence) || 0),
  );

  for (const s of slots) {
    const x = (s.lx - minLx) * s.bodyW;
    const y = (s.ly - minLy) * s.bodyH;
    if (x < 0 || y < 0 || x + s.bodyW > BOARD_COLS || y + s.bodyH > BOARD_ROWS) continue;
    const cand = { x, y, r: 0 };
    if (!canPlace(s.item, cand, placed, itemsById, null, EDIT_MODE.BAG_LAYER)) continue;
    placed.push({
      id: String(s.item.id),
      ...cand,
      key: `lat-${bagsOut.length}`,
    });
    bagsOut.push({
      id: String(s.item.id),
      name: String(s.item.name || s.item.id),
      ...cand,
      score: Number(s.hint.confidence) || 0.5,
    });
  }

  if (bagsOut.length < 2) return null;

  const metricsPacked = {
    ...metrics,
    originX: originX + minLx * 2 * cellW,
    originY: originY + minLy * 2 * cellH,
    refined: true,
  };

  const completed = completeLeatherBagLattice(bagsOut, itemsById);
  console.info(
    '[screenshot] bags lattice-place',
    `n=${completed.length}`,
    `from=${bagHints.length}`,
  );
  return { bags: completed, metrics: metricsPacked };
}

/**
 * If 2–3 Leather (2×2) bags sit on a rectangular lattice, fill missing corners.
 * @param {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} bagsOut
 * @param {Map<string, object>} itemsById
 */
export function completeLeatherBagLattice(bagsOut, itemsById) {
  const leather = [...itemsById.values()].find(
    (it) => String(it.name || '') === 'Leather Bag' && isBagItem(it),
  );
  if (!leather) return bagsOut;

  const twos = bagsOut.filter((b) => {
    const it = itemsById.get(String(b.id));
    if (!it) return false;
    const body = bodyBounds(shapeForItem(it, b.r || 0));
    return body.w === 2 && body.h === 2;
  });
  if (twos.length < 2 || twos.length > 3) return bagsOut;

  let x0 = Math.min(...twos.map((b) => b.x));
  let y0 = Math.min(...twos.map((b) => b.y));
  let x1 = Math.max(...twos.map((b) => b.x));
  let y1 = Math.max(...twos.map((b) => b.y));
  if (x1 === x0) x1 = x0 + 2;
  if (y1 === y0) y1 = y0 + 2;
  if (x1 - x0 !== 2 || y1 - y0 !== 2) return bagsOut;

  /** @type {Set<string>} */
  const occupied = new Set(twos.map((b) => `${b.x},${b.y}`));
  const slots = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ];
  const missing = slots.filter(([x, y]) => !occupied.has(`${x},${y}`));
  if (!missing.length || missing.length > 2) return bagsOut;

  const placed = bagsOut.map((b, i) => ({
    id: String(b.id),
    x: b.x,
    y: b.y,
    r: b.r || 0,
    key: `lat-${i}`,
  }));
  const out = bagsOut.slice();
  for (const [x, y] of missing) {
    const cand = { x, y, r: 0 };
    if (x < 0 || y < 0 || x + 2 > BOARD_COLS || y + 2 > BOARD_ROWS) continue;
    if (!canPlace(leather, cand, placed, itemsById, null, EDIT_MODE.BAG_LAYER)) continue;
    const keys = placementBodyCells(leather, cand).map((c) => `${c.x},${c.y}`);
    const clash = placed.some((p) => {
      const it = itemsById.get(String(p.id));
      if (!it) return false;
      return placementBodyCells(it, p).some((c) => keys.includes(`${c.x},${c.y}`));
    });
    if (clash) continue;
    placed.push({ id: String(leather.id), ...cand, key: `lat-${placed.length}` });
    out.push({
      id: String(leather.id),
      name: 'Leather Bag',
      ...cand,
      score: 0.4,
    });
  }
  if (out.length !== bagsOut.length) {
    console.info(
      '[screenshot] bags lattice',
      `+${out.length - bagsOut.length}`,
      `→${out.length}`,
    );
  }
  return out;
}
