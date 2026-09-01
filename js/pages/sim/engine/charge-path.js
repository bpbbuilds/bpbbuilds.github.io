/**
 * ElectricalCharge path math — mirrors Items/ElectricalCharge.gd tween schedule.
 */

import {
  shapeForItem,
  bodyBounds,
  shapeMarkToBoard,
} from '../../../shared/backpack-grid/shape.js';

export { shapeMarkToBoard };

/** Game Battery.gd chargeCells length; web shape = body + 4 lightning. */
export const BATTERY_DUR_PER_TILE = 2;

/** Generator.gd — explicit sendCharge cells (not shape lightnings). */
export const GENERATOR_CHARGE_CELLS = [
  { x: -1, y: -1 },
  { x: -1, y: -2 },
  { x: -2, y: -3 },
  { x: -2, y: -4 },
  { x: -1, y: -5 },
  { x: 0, y: -5 },
];
export const CHARGE_FADE_DUR = 0.5;
export const CELL_PX_DEFAULT = 80;

/**
 * @typedef {{ x: number, y: number }} Cell
 * @typedef {{ t: number, x: number, y: number }} Waypoint
 * @typedef {{
 *   cellIndex: number,
 *   cell: string,
 *   boardX: number,
 *   boardY: number,
 *   enterT: number,
 *   cx: number,
 *   cy: number,
 *   targetKey?: string | null,
 * }} ChargeCellStep
 * @typedef {{
 *   pathId: string,
 *   startT: number,
 *   duration: number,
 *   durPerTile: number,
 *   cellPx: number,
 *   cells: ChargeCellStep[],
 *   waypoints: Waypoint[],
 *   startSize: number,
 *   endSize: number,
 * }} ChargePath
 */

/**
 * Local path cells for Battery-like column: body then lightnings by distance.
 * @param {object} item
 * @param {number} face
 * @returns {Cell[]}
 */
export function batteryLocalCells(item, face = 0) {
  const shape = shapeForItem(item, face);
  const body = shape.body[0] || { x: 0, y: 0 };
  const rest = [...(shape.lightnings || [])].sort((a, b) => {
    const da = Math.abs(a.x - body.x) + Math.abs(a.y - body.y);
    const db = Math.abs(b.x - body.x) + Math.abs(b.y - body.y);
    return da - db;
  });
  return [body, ...rest];
}

/**
 * @param {Cell[]} localCells rotated shape space
 * @param {{ x: number, y: number }} placement
 * @param {object} item
 * @param {number} face
 * @returns {{ boardX: number, boardY: number, cell: string, cx: number, cy: number }[]}
 */
/**
 * Rotate a script-local charge cell with item face (90° CW y-down, matches shape.js).
 * @param {{ x: number, y: number }} cell
 * @param {number} face
 */
export function rotateChargeLocal(cell, face) {
  let x = cell.x;
  let y = cell.y;
  const r = ((Number(face) || 0) % 4 + 4) % 4;
  for (let i = 0; i < r; i += 1) {
    const nx = -y;
    const ny = x;
    x = nx;
    y = ny;
  }
  return { x, y };
}

/**
 * Map Item.gd sendCharge local cells → board coords (placement anchor + rotated offset).
 * @param {Cell[]} localCells
 * @param {{ x?: number, y?: number, r?: number }} placement
 * @param {number} [cellPx]
 */
/**
 * Godot sendCharge `cells` are CollisionMap tile coords (see Item.getGlobalPointsForCells).
 * Web placement (x,y) is body AABB top-left; at face 0 the ref collision cell (-1,-1)
 * maps to that anchor for Generator/Battery-style emitters.
 * @param {Cell[]} collisionCells
 * @param {{ x?: number, y?: number, r?: number }} placement
 * @param {number} [cellPx]
 * @param {{ x: number, y: number }} [refCollision]
 */
export function collisionCellsToBoard(
  collisionCells,
  placement,
  cellPx = CELL_PX_DEFAULT,
  refCollision = { x: -1, y: -1 },
) {
  const px = Number(placement.x) || 0;
  const py = Number(placement.y) || 0;
  const face = Number(placement.r) || 0;
  const ref = rotateChargeLocal(refCollision, face);
  return collisionCells.map((c) => {
    const rc = rotateChargeLocal(c, face);
    const boardX = px + rc.x - ref.x;
    const boardY = py + rc.y - ref.y;
    return {
      boardX,
      boardY,
      cell: `${boardX},${boardY}`,
      cx: (boardX + 0.5) * cellPx,
      cy: (boardY + 0.5) * cellPx,
    };
  });
}

/**
 * @deprecated Wrong for Godot chargeCells — use collisionCellsToBoard or buildBatteryChargePath.
 * Kept for callers that already pass shape-local cells.
 */
export function scriptCellsToBoard(localCells, placement, cellPx = CELL_PX_DEFAULT) {
  const px = Number(placement.x) || 0;
  const py = Number(placement.y) || 0;
  const face = Number(placement.r) || 0;
  return localCells.map((c) => {
    const lc = rotateChargeLocal(c, face);
    const boardX = px + lc.x;
    const boardY = py + lc.y;
    return {
      boardX,
      boardY,
      cell: `${boardX},${boardY}`,
      cx: (boardX + 0.5) * cellPx,
      cy: (boardY + 0.5) * cellPx,
    };
  });
}

export function localCellsToBoard(localCells, placement, item, face, cellPx = CELL_PX_DEFAULT) {
  const shape = shapeForItem(item, face);
  const bounds = bodyBounds(shape);
  const px = Number(placement.x) || 0;
  const py = Number(placement.y) || 0;
  return localCells.map((c) => {
    const boardX = px + (c.x - bounds.minX);
    const boardY = py + (c.y - bounds.minY);
    return {
      boardX,
      boardY,
      cell: `${boardX},${boardY}`,
      cx: (boardX + 0.5) * cellPx,
      cy: (boardY + 0.5) * cellPx,
    };
  });
}

/**
 * Godot ElectricalCharge position keyframes (mid→center→mid).
 * @param {{ cx: number, cy: number }[]} centers
 * @param {number} duration total travel time
 * @returns {Waypoint[]}
 */
export function buildChargeWaypoints(centers, duration) {
  const n = centers.length;
  if (n < 2) {
    const c = centers[0] || { cx: 0, cy: 0 };
    return [{ t: 0, x: c.cx, y: c.cy }];
  }
  const halfCellDur = (0.5 * duration) / (n - 1);
  /** @type {Waypoint[]} */
  const wps = [];
  let delay = 0;

  for (let i = 0; i < n - 1; i++) {
    const midStart = {
      x: (centers[i].cx + centers[i + 1].cx) * 0.5,
      y: (centers[i].cy + centers[i + 1].cy) * 0.5,
    };
    if (i === 0) {
      wps.push({ t: 0, x: midStart.x, y: midStart.y });
    }
    const centerNext = { x: centers[i + 1].cx, y: centers[i + 1].cy };
    delay += halfCellDur;
    wps.push({ t: delay, x: centerNext.x, y: centerNext.y });

    const oldStart = midStart;
    let endPos;
    if (i === n - 2) {
      endPos = {
        x: centerNext.x + (centerNext.x - oldStart.x),
        y: centerNext.y + (centerNext.y - oldStart.y),
      };
    } else {
      endPos = {
        x: (centers[i + 1].cx + centers[i + 2].cx) * 0.5,
        y: (centers[i + 1].cy + centers[i + 2].cy) * 0.5,
      };
    }
    delay += halfCellDur;
    wps.push({ t: delay, x: endPos.x, y: endPos.y });
  }
  return wps;
}

/**
 * Cell-enter times matching onNewCellEntered callbacks.
 * Index 1 at t=0; then indices 2..n-1 every durPerTile.
 * @param {number} cellCount
 * @param {number} durPerTile
 * @returns {{ cellIndex: number, enterT: number }[]}
 */
export function chargeEnterSchedule(cellCount, durPerTile = BATTERY_DUR_PER_TILE) {
  /** @type {{ cellIndex: number, enterT: number }[]} */
  const out = [];
  if (cellCount < 2) return out;
  // i==0: onNewCellEntered(1) immediately; final index clears curChargedItem (GD end callback).
  out.push({ cellIndex: 1, enterT: 0 });
  for (let cellIndex = 2; cellIndex <= cellCount; cellIndex += 1) {
    out.push({ cellIndex, enterT: (cellIndex - 1) * durPerTile });
  }
  return out;
}

/**
 * Generator sendCharge path from shape lightning tiles (matches board hover marks).
 * @param {object} item
 * @param {{ x?: number, y?: number, r?: number }} placement
 * @param {number} [cellPx]
 */
export function generatorPathBoardCells(item, placement, cellPx = CELL_PX_DEFAULT) {
  const face = ((Number(placement.r) || 0) % 4 + 4) % 4;
  const up = shapeForItem(item, 0);
  const upBounds = bodyBounds(up);
  if (!up.lightnings?.length || !up.body?.length) return null;

  const mark = (c) =>
    shapeMarkToBoard(
      item,
      placement,
      c.x - upBounds.minX,
      c.y - upBounds.minY,
      cellPx,
    );

  const bodyBoard = up.body.map(mark);
  const lightningBoard = up.lightnings.map(mark);

  /** @type {(a: { boardX: number, boardY: number }, b: typeof a) => number} */
  const outwardSort =
    face === 1
      ? (a, b) => a.boardX - b.boardX || a.boardY - b.boardY
      : face === 3
        ? (a, b) => b.boardX - a.boardX || a.boardY - b.boardY
        : face === 2
          ? (a, b) => a.boardY - b.boardY || a.boardX - b.boardX
          : (a, b) => b.boardY - a.boardY || a.boardX - b.boardX;

  const sorted = [...lightningBoard].sort(outwardSort);
  const first = sorted[0];
  let origin = bodyBoard[0];
  let best = Infinity;
  for (const b of bodyBoard) {
    const d = Math.abs(b.boardX - first.boardX) + Math.abs(b.boardY - first.boardY);
    if (d < best) {
      best = d;
      origin = b;
    }
  }

  /** @type {ReturnType<typeof shapeMarkToBoard>[]} */
  const path = [origin];
  const seen = new Set([origin.cell]);
  for (const step of sorted) {
    if (seen.has(step.cell)) continue;
    path.push(step);
    seen.add(step.cell);
  }
  return path.length >= 2 ? path : null;
}

/**
 * @param {{
 *   pathId: string,
 *   item: object,
 *   placement: { x?: number, y?: number, r?: number, key: string },
 *   startT: number,
 *   durPerTile?: number,
 *   cellPx?: number,
 *   startSize?: number,
 *   endSize?: number,
 * }} opts
 * @returns {ChargePath | null}
 */
export function buildGeneratorChargePath(opts) {
  const cellPx = opts.cellPx ?? CELL_PX_DEFAULT;
  const durPerTile = opts.durPerTile ?? BATTERY_DUR_PER_TILE;
  const board = generatorPathBoardCells(opts.item, opts.placement, cellPx);
  if (!board || board.length < 2) return null;
  const duration = durPerTile * (board.length - 1);
  const waypoints = buildChargeWaypoints(board, duration);
  const schedule = chargeEnterSchedule(board.length, durPerTile);
  /** @type {ChargeCellStep[]} */
  const cells = board.map((b, cellIndex) => {
    const hit = schedule.find((s) => s.cellIndex === cellIndex);
    return {
      cellIndex,
      cell: b.cell,
      boardX: b.boardX,
      boardY: b.boardY,
      enterT: hit ? hit.enterT : cellIndex === 0 ? 0 : (cellIndex - 1) * durPerTile,
      cx: b.cx,
      cy: b.cy,
    };
  });
  return {
    pathId: opts.pathId,
    startT: opts.startT,
    duration,
    durPerTile,
    cellPx,
    cells,
    waypoints,
    startSize: opts.startSize ?? 0.5,
    endSize: opts.endSize ?? 1.5,
  };
}

/**
 * @param {{
 *   pathId: string,
 *   item: object,
 *   placement: { x?: number, y?: number, r?: number, key: string },
 *   startT: number,
 *   collisionCells: Cell[],
 *   durPerTile?: number,
 *   cellPx?: number,
 *   startSize?: number,
 *   endSize?: number,
 * }} opts
 * @returns {ChargePath | null}
 */
export function buildScriptChargePath(opts) {
  const cellPx = opts.cellPx ?? CELL_PX_DEFAULT;
  const durPerTile = opts.durPerTile ?? BATTERY_DUR_PER_TILE;
  const collision = opts.collisionCells || [];
  if (collision.length < 2) return null;
  const board = collisionCellsToBoard(collision, opts.placement, cellPx);
  const duration = durPerTile * (board.length - 1);
  const waypoints = buildChargeWaypoints(board, duration);
  const schedule = chargeEnterSchedule(board.length, durPerTile);
  /** @type {ChargeCellStep[]} */
  const cells = board.map((b, cellIndex) => {
    const hit = schedule.find((s) => s.cellIndex === cellIndex);
    return {
      cellIndex,
      cell: b.cell,
      boardX: b.boardX,
      boardY: b.boardY,
      enterT: hit ? hit.enterT : cellIndex === 0 ? 0 : (cellIndex - 1) * durPerTile,
      cx: b.cx,
      cy: b.cy,
    };
  });
  return {
    pathId: opts.pathId,
    startT: opts.startT,
    duration,
    durPerTile,
    cellPx,
    cells,
    waypoints,
    startSize: opts.startSize ?? 0.5,
    endSize: opts.endSize ?? 1.5,
  };
}

export function buildBatteryChargePath(opts) {
  const face = Number(opts.placement.r) || 0;
  const cellPx = opts.cellPx ?? CELL_PX_DEFAULT;
  const durPerTile = opts.durPerTile ?? BATTERY_DUR_PER_TILE;
  const local = batteryLocalCells(opts.item, face);
  if (local.length < 2) return null;
  const board = localCellsToBoard(local, opts.placement, opts.item, face, cellPx);
  const duration = durPerTile * (board.length - 1);
  const waypoints = buildChargeWaypoints(board, duration);
  const schedule = chargeEnterSchedule(board.length, durPerTile);
  /** @type {ChargeCellStep[]} */
  const cells = board.map((b, cellIndex) => {
    const hit = schedule.find((s) => s.cellIndex === cellIndex);
    return {
      cellIndex,
      cell: b.cell,
      boardX: b.boardX,
      boardY: b.boardY,
      enterT: hit ? hit.enterT : cellIndex === 0 ? 0 : (cellIndex - 1) * durPerTile,
      cx: b.cx,
      cy: b.cy,
    };
  });
  return {
    pathId: opts.pathId,
    startT: opts.startT,
    duration,
    durPerTile,
    cellPx,
    cells,
    waypoints,
    startSize: opts.startSize ?? 0.5,
    endSize: opts.endSize ?? 1.5,
  };
}

/**
 * Interpolate spark position at local time (0…duration).
 * @param {Waypoint[]} waypoints
 * @param {number} localT
 */
export function sampleWaypoint(waypoints, localT) {
  if (!waypoints.length) return { x: 0, y: 0, u: 0 };
  if (localT <= waypoints[0].t) {
    return { x: waypoints[0].x, y: waypoints[0].y, u: 0 };
  }
  const last = waypoints[waypoints.length - 1];
  if (localT >= last.t) {
    return { x: last.x, y: last.y, u: 1 };
  }
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (localT >= a.t && localT <= b.t) {
      const span = b.t - a.t || 1;
      const u = (localT - a.t) / span;
      return {
        x: a.x + (b.x - a.x) * u,
        y: a.y + (b.y - a.y) * u,
        u: localT / (last.t || 1),
      };
    }
  }
  return { x: last.x, y: last.y, u: 1 };
}
