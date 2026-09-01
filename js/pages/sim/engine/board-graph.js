/**
 * Board occupancy + adjacency / canAffect links for combat.
 */

import {
  shapeForItem,
  bodyBounds,
  shapeMarkToBoard,
} from '../../../shared/backpack-grid/shape.js';
import {
  canAffectColor,
  isAffectingDistinct,
} from '../../../shared/backpack-grid/can-affect.js';
import { isBagLike } from './item-kind.js';

/**
 * @typedef {{
 *   key: string,
 *   id: string,
 *   x: number,
 *   y: number,
 *   r: number,
 *   gems?: string[],
 *   cells: string[],
 *   affectCells: { cell: string, color: 'primary'|'secondary' }[],
 * }} BoardPiece
 */

/**
 * @typedef {{
 *   pieces: Map<string, BoardPiece>,
 *   filled: Map<string, string>,
 * }} BoardGraph
 */

/**
 * Game Inventory keeps bagCells separate from filledCells (items). Stars /
 * getItemsInCells only see items — bags must not steal item cells in `filled`.
 * @param {Map<string, string>} filled
 * @param {string} cell
 * @param {string} key
 * @param {boolean} bag
 */
function claimFilledCell(filled, cell, key, bag) {
  if (!bag) {
    filled.set(cell, key);
    return;
  }
  // Bags only fill empty cells — never overwrite an item already claimed.
  if (!filled.has(cell)) filled.set(cell, key);
}

/**
 * @param {{ id: string, x: number, y: number, r?: number, key: string, gems?: string[] }[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {BoardGraph}
 */
export function buildBoardGraph(placements, itemsById) {
  /** @type {Map<string, BoardPiece>} */
  const pieces = new Map();
  /** @type {Map<string, string>} */
  const filled = new Map();

  /** @type {{ p: typeof placements[0], item: object, bag: boolean }[]} */
  const pending = [];
  for (const p of placements || []) {
    const item = itemsById.get(p.id);
    if (!item) continue;
    pending.push({ p, item, bag: isBagLike(item) });
  }
  // Bags first (under), then items overwrite — matches filledCells vs bagCells.
  pending.sort((a, b) => Number(b.bag) - Number(a.bag) || 0);

  for (const { p, item, bag } of pending) {
    const face = Number(p.r) || 0;
    const placement = { x: Number(p.x) || 0, y: Number(p.y) || 0, r: face };
    const up = shapeForItem(item, 0);
    const upBounds = bodyBounds(up);
    /** @type {string[]} */
    const cells = [];
    for (const c of up.body) {
      const { cell } = shapeMarkToBoard(
        item,
        placement,
        c.x - upBounds.minX,
        c.y - upBounds.minY,
      );
      cells.push(cell);
    }
    /** @type {BoardPiece['affectCells']} */
    const affectCells = [];
    for (const c of up.stars || []) {
      const { cell } = shapeMarkToBoard(
        item,
        placement,
        c.x - upBounds.minX,
        c.y - upBounds.minY,
      );
      affectCells.push({ cell, color: 'primary' });
    }
    for (const c of up.diamonds || []) {
      const { cell } = shapeMarkToBoard(
        item,
        placement,
        c.x - upBounds.minX,
        c.y - upBounds.minY,
      );
      affectCells.push({ cell, color: 'secondary' });
    }
    pieces.set(p.key, {
      key: p.key,
      id: p.id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: face,
      gems: Array.isArray(p.gems) ? p.gems : undefined,
      cells,
      affectCells,
    });
    for (const cell of cells) {
      claimFilledCell(filled, cell, p.key, bag);
    }
  }

  return { pieces, filled };
}

/**
 * Orthogonal neighbors of a piece (body-adjacent other pieces).
 * @param {BoardGraph} graph
 * @param {string} placementKey
 * @returns {string[]}
 */
export function neighborKeys(graph, placementKey) {
  const piece = graph.pieces.get(placementKey);
  if (!piece) return [];
  /** @type {Set<string>} */
  const found = new Set();
  for (const cell of piece.cells) {
    const [x, y] = cell.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const other = graph.filled.get(`${x + dx},${y + dy}`);
      if (other && other !== placementKey) found.add(other);
    }
  }
  return [...found];
}

/**
 * Items this source can affect via star/diamond rules (or body-neighbor fallback).
 * @param {BoardGraph} graph
 * @param {string} sourceKey
 * @param {Map<string, object>} itemsById
 * @param {import('../../../shared/backpack-grid/can-affect.js').CanAffectData | null} canAffect
 * @returns {{ key: string, id: string, color: string, via: 'rule'|'adjacent' }[]}
 */
export function affectedTargets(graph, sourceKey, itemsById, canAffect) {
  const sourcePiece = graph.pieces.get(sourceKey);
  if (!sourcePiece) return [];
  const sourceItem = itemsById.get(sourcePiece.id);
  if (!sourceItem) return [];

  /** @type {Map<string, { key: string, id: string, color: string, via: 'rule'|'adjacent' }>} */
  const hits = new Map();
  const rulesById = canAffect?.rulesById || null;

  if (sourcePiece.affectCells.length) {
    /** @type {Set<string>} */
    const checked = new Set();
    /** @type {Set<string>} */
    const distinctIds = new Set();
    for (const { cell, color } of sourcePiece.affectCells) {
      const targetKey = graph.filled.get(cell);
      if (!targetKey || targetKey === sourceKey) continue;
      if (checked.has(targetKey)) continue;
      checked.add(targetKey);
      const targetPiece = graph.pieces.get(targetKey);
      const targetItem = targetPiece
        ? itemsById.get(targetPiece.id)
        : null;
      if (!targetItem) continue;
      if (rulesById) {
        const distinct = isAffectingDistinct(rulesById, sourceItem, color);
        const ok = canAffectColor(
          rulesById,
          sourceItem,
          targetItem,
          color,
          canAffect || {},
        );
        if (!ok) continue;
        if (distinct) {
          if (distinctIds.has(targetItem.id)) continue;
          distinctIds.add(targetItem.id);
        }
      }
      hits.set(targetKey, {
        key: targetKey,
        id: targetItem.id,
        color,
        via: 'rule',
      });
    }
  }

  // Body-adjacent fallback only when the piece has no star/diamond marks (matches
  // getAffectedItems() — amulets/skills never buff neighbors by body touch alone).
  if (!sourcePiece.affectCells.length) {
    for (const key of neighborKeys(graph, sourceKey)) {
      if (hits.has(key)) continue;
      const tp = graph.pieces.get(key);
      if (!tp) continue;
      hits.set(key, {
        key,
        id: tp.id,
        color: 'adjacent',
        via: 'adjacent',
      });
    }
  }

  return [...hits.values()];
}

/**
 * Placement keys of items whose cells sit in this bag's footprint (cargo).
 * @param {BoardGraph} graph
 * @param {string} bagKey
 * @returns {string[]}
 */
export function getItemsInside(graph, bagKey) {
  const bag = graph.pieces.get(bagKey);
  if (!bag) return [];
  /** @type {Set<string>} */
  const found = new Set();
  for (const cell of bag.cells) {
    const other = graph.filled.get(cell);
    if (other && other !== bagKey) found.add(other);
  }
  // Also: items whose body cells overlap any bag cell (filled may prefer item key)
  for (const [key, piece] of graph.pieces) {
    if (key === bagKey) continue;
    for (const cell of piece.cells) {
      if (bag.cells.includes(cell)) {
        found.add(key);
        break;
      }
    }
  }
  return [...found];
}
