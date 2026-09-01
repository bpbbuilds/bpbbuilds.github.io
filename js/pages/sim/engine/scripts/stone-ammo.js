/**
 * Stone.gd ammunition + BagofStones.gd UP-1 stars.
 * Bag shape JSON has no star cells; stars are getCellsInLine(UP, 1).
 */

import { itemHasType } from './ports-util.js';

export const BAG_OF_STONES_ID = 'bag_of_stones';

export const STONE_THROW_IDS = new Set([
  'stone',
  'artifact_stone_cold',
  'artifact_stone_heat',
  'artifact_stone_death',
]);

/** Game setBagOfStones() */
export const BAG_STONE_AMMO = 9000;

/**
 * @param {object | null | undefined} item
 */
export function itemHasStoneTag(item) {
  if (!item) return false;
  if (itemHasType(item, 'stone')) return true;
  const tags = item.tags;
  if (Array.isArray(tags) && tags.some((t) => String(t).toLowerCase() === 'stone')) {
    return true;
  }
  return STONE_THROW_IDS.has(String(item.id || ''));
}

/**
 * @param {object} piece
 */
export function initStoneAmmo(piece) {
  if (piece.ammunition == null) piece.ammunition = 1;
}

/**
 * @param {object} piece
 */
export function consumeStoneAmmo(piece) {
  piece.charges = 0;
  piece.alive = false;
  piece.cooldown = 999;
  piece.triggerTime = 999;
}

/**
 * @param {object} piece
 * @returns {boolean} true if this throw consumed the last ammo
 */
export function spendStoneAmmo(piece) {
  initStoneAmmo(piece);
  piece.ammunition -= 1;
  if (piece.ammunition <= 0) {
    consumeStoneAmmo(piece);
    return true;
  }
  return false;
}

/**
 * Cell immediately above a bag body cell (Godot Vector2.UP, y-down grid).
 * @param {string} cell
 */
export function cellAbove(cell) {
  const [xs, ys] = String(cell).split(',');
  const x = Number(xs);
  const y = Number(ys);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return `${x},${y - 1}`;
}

/**
 * Placement keys of Stone-tagged items sitting on a bag's UP-1 stars.
 * @param {import('../board-graph.js').BoardGraph} graph
 * @param {string} bagKey
 * @param {Map<string, object>} itemsById
 * @returns {Set<string>}
 */
export function bagStarStoneKeys(graph, bagKey, itemsById) {
  /** @type {Set<string>} */
  const keys = new Set();
  const bag = graph?.pieces?.get(bagKey);
  if (!bag) return keys;
  const occupied = new Set(bag.cells || []);
  for (const cell of bag.cells || []) {
    const up = cellAbove(cell);
    if (!up || occupied.has(up)) continue;
    const targetKey = graph.filled.get(up);
    if (!targetKey || targetKey === bagKey) continue;
    const tp = graph.pieces.get(targetKey);
    const item = tp ? itemsById.get(tp.id) : null;
    if (itemHasStoneTag(item) || STONE_THROW_IDS.has(tp?.id)) keys.add(targetKey);
  }
  return keys;
}

/**
 * @param {import('../board-graph.js').BoardGraph | null | undefined} graph
 * @param {string} stoneKey
 * @param {Map<string, object> | undefined} itemsById
 */
export function bagStarsThisStone(graph, stoneKey, itemsById) {
  if (!graph || !itemsById) return false;
  for (const [key, bp] of graph.pieces) {
    if (bp.id !== BAG_OF_STONES_ID) continue;
    if (bagStarStoneKeys(graph, key, itemsById).has(stoneKey)) return true;
  }
  return false;
}

/**
 * BagofStones.onPrepare — setBagOfStones on starred Stone tags.
 * @param {object} bagPiece
 * @param {object} ctx
 */
export function applyBagOfStones(bagPiece, ctx) {
  const graph = ctx.graph;
  const itemsById = ctx.itemsById || ctx.itemsById;
  const pieces = ctx.pieces || [];
  if (!graph || !itemsById) return;
  const keys = bagStarStoneKeys(graph, bagPiece.placementKey, itemsById);
  for (const piece of pieces) {
    if (!keys.has(piece.placementKey)) continue;
    piece.ammunition = BAG_STONE_AMMO;
  }
}
