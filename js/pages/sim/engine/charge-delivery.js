/**
 * Charge pulse helper — Band AF 192.
 * Lives beside charge-delivery; uses late-bound handler resolve to avoid
 * ports → charge → registry → ports cycles.
 */

import { affectedTargets, neighborKeys } from './board-graph.js';
import { addSpeed } from './piece-stats.js';
import {
  BATTERY_DUR_PER_TILE,
  buildBatteryChargePath,
  chargeEnterSchedule,
} from './charge-path.js';
import { getP1, getP2, getPName } from './params.js';
import { withStatSource } from './stat-mods.js';
import {
  clearChargeTrackers,
  enterChargeCell,
  getChargeTracker,
  registerChargePath,
  unregisterChargePath,
} from './charge-stat.js';

/** @type {null | ((id: string) => import('./scripts/handlers.js').ScriptHandler | null | undefined)} */
let resolveHandler = null;

/**
 * Called once from registry after HANDLERS are ready.
 * @param {(id: string) => import('./scripts/handlers.js').ScriptHandler | null | undefined} fn
 */
export function bindChargeHandlerResolve(fn) {
  resolveHandler = fn;
}

/**
 * @param {{
 *   at: number,
 *   pathId: string,
 *   cellIndex: number,
 *   cellCount: number,
 *   targetKey?: string | null,
 *   flat: number,
 *   perTile: number,
 *   emitterKey?: string,
 * }} job
 * @param {{ pieces?: object[] }} worldCtx
 * @param {(piece: object) => import('./scripts/handlers.js').ScriptCtx} actCtx
 */
export function processChargeJob(job, worldCtx, actCtx) {
  const tracker = getChargeTracker(job.pathId);
  if (!tracker) return;

  const pieces = worldCtx.pieces || [];
  const targetPiece = job.targetKey
    ? pieces.find((p) => p.placementKey === job.targetKey)
    : null;
  const meta = {
    pathId: job.pathId,
    cellIndex: job.cellIndex,
    emitterKey: job.emitterKey,
  };

  const emitter = job.emitterKey
    ? pieces.find((p) => p.placementKey === job.emitterKey)
    : null;

  let prevPiece = null;
  withStatSource(emitter, () => {
    prevPiece = enterChargeCell(
      tracker,
      job.cellIndex,
      targetPiece,
      job.flat,
      job.perTile,
    );
  });
  const prevKey = prevPiece?.placementKey ?? null;
  const nextKey = targetPiece?.placementKey ?? null;
  if (prevKey !== nextKey) {
    if (prevPiece) leaveCharge(prevPiece, actCtx(prevPiece), meta);
    if (targetPiece) deliverCharge(targetPiece, actCtx(targetPiece), meta);
  }

  if (job.cellIndex >= job.cellCount) {
    unregisterChargePath(job.pathId);
  }
}

/**
 * Queue changeChargedItemStat + chargeLeft/chargeReceived jobs for a sendCharge path.
 * @param {object} emitter
 * @param {import('./scripts/handlers.js').ScriptCtx & { chargeJobs?: object[] }} ctx
 * @param {{
 *   path: import('./charge-path.js').ChargePath,
 *   flat: number,
 *   perTile: number,
 * }} opts
 */
export function scheduleStatChargePath(emitter, ctx, opts) {
  const { path, flat, perTile } = opts;
  const jobs = ctx.chargeJobs;
  if (!path || !Array.isArray(jobs)) return;

  registerChargePath(path.pathId);
  const cellCount = path.cells.length;
  const schedule = chargeEnterSchedule(cellCount, path.durPerTile);
  for (const step of schedule) {
    const cell = path.cells[step.cellIndex];
    jobs.push({
      at: ctx.t + step.enterT,
      pathId: path.pathId,
      cellIndex: step.cellIndex,
      cellCount,
      targetKey: cell?.targetKey ?? null,
      flat,
      perTile,
      emitterKey: emitter.placementKey,
    });
  }
}

export { clearChargeTrackers };

/**
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {import('./scripts/handlers.js').ScriptCtx} ctx
 * @param {{ pathId?: string, cellIndex?: number, emitterKey?: string }} [meta]
 */
export function deliverCharge(piece, ctx, meta = {}) {
  if (!piece?.alive) return;
  piece.numCharges = (piece.numCharges || 0) + 1;
  const script = resolveHandler?.(piece.itemId);
  script?.onChargeReceived?.(piece, ctx, meta);
}

/**
 * Item.chargeLeft — decrement numCharges and run onChargeLeft.
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {import('./scripts/handlers.js').ScriptCtx} ctx
 * @param {{ pathId?: string, cellIndex?: number, emitterKey?: string }} [meta]
 */
export function leaveCharge(piece, ctx, meta = {}) {
  if (!piece?.alive) return;
  if ((piece.numCharges || 0) <= 0) return;
  piece.numCharges = Math.max(0, (piece.numCharges || 0) - 1);
  const script = resolveHandler?.(piece.itemId);
  script?.onChargeLeft?.(piece, ctx, meta);
}

/**
 * @param {object} piece
 * @param {import('./scripts/handlers.js').ScriptCtx} ctx
 * @param {{ speedBoost?: number, label?: string }} [opts]
 */
export function emitChargePulse(piece, ctx, opts = {}) {
  const { graph, itemsById, canAffect, pieces, events, t } = ctx;
  const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
  const neigh = new Set(neighborKeys(graph, piece.placementKey) || []);
  let n = 0;
  for (const other of pieces || []) {
    if (other.placementKey === piece.placementKey) continue;
    const linked =
      links.some((l) => l.key === other.placementKey) || neigh.has(other.placementKey);
    if (!linked) continue;
    deliverCharge(other, ctx, {
      pathId: `pulse:${piece.placementKey}:${t}`,
      emitterKey: piece.placementKey,
    });
    if (opts.speedBoost) addSpeed(other, opts.speedBoost);
    n += 1;
  }
  events.push({
    t: t + 0.004,
    type: 'info',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: opts.label || `${piece.name}: charge pulse ×${n}`,
    meta: {
      category: 'system',
      script: true,
      handler: piece.itemId,
      chargePulse: true,
      targets: n,
    },
  });
  return n;
}

/**
 * Battery-style path charge (lightning_staff / sendCharge).
 * Schedules pendingCharges on occupants; optional per-cell hook for dam.
 * @param {object} piece
 * @param {import('./scripts/handlers.js').ScriptCtx} ctx
 * @param {{
 *   durPerTile?: number,
 *   onCellEnter?: (target: object | null, step: object, cell: object) => void,
 *   label?: string,
 * }} [opts]
 */
export function emitPathCharge(piece, ctx, opts = {}) {
  const { graph, itemsById, events, t, pieces } = ctx;
  const item = itemsById.get(piece.itemId);
  const boardPiece = graph.pieces.get(piece.placementKey);
  if (!item || !boardPiece) return null;

  const durPerTile = opts.durPerTile ?? BATTERY_DUR_PER_TILE;
  const pathId = `path:${piece.placementKey}:${t}`;
  const path = buildBatteryChargePath({
    pathId,
    item,
    placement: {
      x: boardPiece.x,
      y: boardPiece.y,
      r: boardPiece.r,
      key: piece.placementKey,
    },
    startT: t,
    durPerTile,
  });
  if (!path) return null;

  for (const cell of path.cells) {
    const tk = graph.filled.get(cell.cell) || null;
    cell.targetKey = tk && tk !== piece.placementKey ? tk : null;
  }

  events.push({
    t,
    type: 'charge',
    actor: 'player',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: opts.label || `${piece.name}: sendCharge`,
    meta: { category: 'charge', phase: 'start', pathId, chargePath: path, handler: piece.itemId },
  });

  const schedule = chargeEnterSchedule(path.cells.length, durPerTile);
  let lastChargeKey = null;
  for (const step of schedule) {
    const cell = path.cells[step.cellIndex];
    if (!cell) continue;
    const targetKey = cell.targetKey || null;
    const targetPiece = targetKey
      ? (pieces || []).find((p) => p.placementKey === targetKey)
      : null;
    const enterAbs = t + step.enterT;

    if (targetKey !== lastChargeKey) {
      if (targetPiece) {
        if (!targetPiece.pendingCharges) targetPiece.pendingCharges = [];
        targetPiece.pendingCharges.push({
          at: enterAbs,
          meta: { pathId, cellIndex: step.cellIndex, emitterKey: piece.placementKey },
        });
      }
      lastChargeKey = targetKey;
    }

    opts.onCellEnter?.(targetPiece || null, step, cell);

    events.push({
      t: enterAbs,
      type: 'charge',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: targetPiece
        ? `${piece.name}: charge → ${targetPiece.name}`
        : `${piece.name}: charge cell`,
      meta: {
        category: 'charge',
        phase: 'cell',
        pathId,
        cellIndex: step.cellIndex,
        cell: cell.cell,
        targetKey: targetKey || undefined,
        handler: piece.itemId,
      },
    });
  }

  events.push({
    t: t + path.duration,
    type: 'charge',
    actor: 'player',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name}: charge end`,
    meta: { category: 'charge', phase: 'end', pathId, handler: piece.itemId },
  });

  return path;
}

/**
 * Battery.gd emitCharge(speedFactor) — sendCharge duration is divided by speedFactor.
 * Does not addSpeed on the battery. Callers emit `charge_emitted` after the combat-start pulse.
 * @param {object} piece
 * @param {object} ctx
 * @param {number} [speedFactor]
 */
export function emitBatterySpark(piece, ctx, speedFactor = 1) {
  const { t, events, graph, itemsById } = ctx;
  const factor = Math.max(0.01, Number(speedFactor) || 1);
  const item = itemsById.get(piece.itemId);
  const boardPiece = graph?.pieces?.get(piece.placementKey);
  events.push({
    t,
    type: 'activate',
    actor: 'player',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name} activated.`,
    meta: {
      category: 'system',
      script: true,
      handler: 'battery',
      emitCharge: true,
      speedFactor: factor,
    },
  });
  if (!item || !boardPiece) return null;

  const flat = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
  const perTile = getPName(piece.params, 'speed2', getP2(piece.params, 5)) / 100;
  const baseDur = getPName(piece.params, 'dur', BATTERY_DUR_PER_TILE) || BATTERY_DUR_PER_TILE;
  const durPerTile = baseDur / factor;
  const pathId = `charge:${piece.placementKey}:${t}:${factor}`;

  const path = buildBatteryChargePath({
    pathId,
    item,
    placement: {
      x: boardPiece.x,
      y: boardPiece.y,
      r: boardPiece.r,
      key: piece.placementKey,
    },
    startT: t,
    durPerTile,
  });
  if (!path) return null;

  for (const cell of path.cells) {
    const tk = graph.filled.get(cell.cell) || null;
    cell.targetKey = tk && tk !== piece.placementKey ? tk : null;
  }

  events.push({
    t,
    type: 'charge',
    actor: 'player',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name}: charge`,
    meta: {
      category: 'charge',
      phase: 'start',
      pathId,
      chargePath: path,
      handler: 'battery',
      speedFactor: factor,
    },
  });

  const schedule = chargeEnterSchedule(path.cells.length, durPerTile);
  scheduleStatChargePath(piece, ctx, { path, flat, perTile });
  let lastChargeKey = null;
  for (const step of schedule) {
    const cell = path.cells[step.cellIndex];
    const targetKey = cell?.targetKey ?? null;
    const targetPiece = targetKey
      ? (ctx.pieces || []).find((p) => p.placementKey === targetKey)
      : null;
    const speedFrac = flat + (step.cellIndex - 1) * perTile;
    const enterAbs = t + step.enterT;

    if (targetKey !== lastChargeKey) {
      lastChargeKey = targetKey;
    }

    events.push({
      t: enterAbs,
      type: 'charge',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: targetPiece
        ? `${piece.name}: charge → ${targetPiece.name}`
        : `${piece.name}: charge cell`,
      meta: {
        category: 'charge',
        phase: step.cellIndex >= path.cells.length ? 'end' : 'cell',
        pathId,
        cellIndex: step.cellIndex,
        cell: cell?.cell,
        targetKey: targetKey || undefined,
        targetItemId: targetPiece?.itemId,
        hastePct: targetPiece ? Math.round(speedFrac * 100) : undefined,
        handler: 'battery',
        speedFactor: factor,
      },
    });
  }

  events.push({
    t: t + path.duration,
    type: 'charge',
    actor: 'player',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name}: charge end`,
    meta: { category: 'charge', phase: 'end', pathId, handler: 'battery', speedFactor: factor },
  });
  return path;
}

/**
 * Item.emitCharge(speedFactor) for delayed Port-O-Charger re-emit.
 * @param {object} piece
 * @param {object} ctx
 * @param {number} [speedFactor]
 */
export function reEmitCharge(piece, ctx, speedFactor = 1) {
  if (!piece?.alive) return;
  if (piece.itemId === 'battery') {
    emitBatterySpark(piece, ctx, speedFactor);
    return;
  }
  const script = resolveHandler?.(piece.itemId);
  if (typeof script?.emitCharge === 'function') {
    script.emitCharge(piece, ctx, speedFactor);
  }
}
