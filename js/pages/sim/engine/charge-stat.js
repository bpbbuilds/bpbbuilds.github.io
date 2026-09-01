/**
 * Item.changeChargedItemStat speed parity — tracker only (no deliver/leave).
 */

import { addSpeed } from './piece-stats.js';

/**
 * @typedef {{
 *   lastChargedPiece: import('./pieces.js').CombatPiece | null,
 *   curChargedPiece: import('./pieces.js').CombatPiece | null,
 * }} ChargeTracker
 */

/** @type {Map<string, ChargeTracker>} */
const activeTrackers = new Map();

export function clearChargeTrackers() {
  activeTrackers.clear();
}

/**
 * @param {string} pathId
 * @returns {ChargeTracker}
 */
export function registerChargePath(pathId) {
  const tracker = { lastChargedPiece: null, curChargedPiece: null };
  activeTrackers.set(pathId, tracker);
  return tracker;
}

/**
 * @param {string} pathId
 * @returns {ChargeTracker | undefined}
 */
export function getChargeTracker(pathId) {
  return activeTrackers.get(pathId);
}

/**
 * @param {string} pathId
 */
export function unregisterChargePath(pathId) {
  activeTrackers.delete(pathId);
}

/**
 * @param {import('./pieces.js').CombatPiece | null | undefined} piece
 * @param {number} delta
 */
function chargedItemStatChange(piece, delta) {
  if (!piece || !(Number(delta) || 0)) return;
  addSpeed(piece, delta);
}

/**
 * Item.changeChargedItemStat — last/cur must already reflect this cell.
 * @param {ChargeTracker} tracker
 * @param {number} cellIndex
 * @param {number} flatVal
 * @param {number} valPerTile
 */
export function changeChargedItemStat(tracker, cellIndex, flatVal, valPerTile) {
  const flat = Number(flatVal) || 0;
  const per = Number(valPerTile) || 0;
  const idx = Number(cellIndex) || 0;
  const previousVal = flat + (idx - 2) * per;
  const newVal = previousVal + per;
  const last = tracker.lastChargedPiece;
  const cur = tracker.curChargedPiece;

  if (last) {
    if (!cur) {
      chargedItemStatChange(last, -previousVal);
    } else if (cur === last) {
      chargedItemStatChange(cur, per);
    } else {
      chargedItemStatChange(last, -previousVal);
      chargedItemStatChange(cur, newVal);
    }
  } else if (cur) {
    chargedItemStatChange(cur, newVal);
  }
}

/**
 * ElectricalCharge.onNewCellEntered stat half — returns occupant before update.
 * @param {ChargeTracker} tracker
 * @param {number} cellIndex
 * @param {import('./pieces.js').CombatPiece | null | undefined} curPiece
 * @param {number} flatVal
 * @param {number} valPerTile
 * @returns {import('./pieces.js').CombatPiece | null}
 */
export function enterChargeCell(tracker, cellIndex, curPiece, flatVal, valPerTile) {
  const prevPiece = tracker.curChargedPiece;
  tracker.lastChargedPiece = tracker.curChargedPiece;
  tracker.curChargedPiece = curPiece || null;
  changeChargedItemStat(tracker, cellIndex, flatVal, valPerTile);
  return prevPiece;
}
