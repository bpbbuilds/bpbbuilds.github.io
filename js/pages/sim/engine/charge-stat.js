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
 * @param {'speed' | 'buffAmp'} [mode]
 */
function chargedItemStatChange(piece, delta, mode = 'speed') {
  if (!piece || !(Number(delta) || 0)) return;
  // ConTrapTron.gd chargedItemStatChange → changeAmplificiationChancePercent_allBuffs
  if (mode === 'buffAmp') {
    piece.buffAmpChance = (Number(piece.buffAmpChance) || 0) + Number(delta);
    return;
  }
  addSpeed(piece, delta);
}

/**
 * Item.changeChargedItemStat — last/cur must already reflect this cell.
 * @param {ChargeTracker} tracker
 * @param {number} cellIndex
 * @param {number} flatVal
 * @param {number} valPerTile
 * @param {'speed' | 'buffAmp'} [mode]
 */
export function changeChargedItemStat(tracker, cellIndex, flatVal, valPerTile, mode = 'speed') {
  const flat = Number(flatVal) || 0;
  const per = Number(valPerTile) || 0;
  const idx = Number(cellIndex) || 0;
  const previousVal = flat + (idx - 2) * per;
  const newVal = previousVal + per;
  const last = tracker.lastChargedPiece;
  const cur = tracker.curChargedPiece;

  if (last) {
    if (!cur) {
      chargedItemStatChange(last, -previousVal, mode);
    } else if (cur === last) {
      chargedItemStatChange(cur, per, mode);
    } else {
      chargedItemStatChange(last, -previousVal, mode);
      chargedItemStatChange(cur, newVal, mode);
    }
  } else if (cur) {
    chargedItemStatChange(cur, newVal, mode);
  }
}

/**
 * ElectricalCharge.onNewCellEntered stat half — returns occupant before update.
 * @param {ChargeTracker} tracker
 * @param {number} cellIndex
 * @param {import('./pieces.js').CombatPiece | null | undefined} curPiece
 * @param {number} flatVal
 * @param {number} valPerTile
 * @param {'speed' | 'buffAmp'} [mode]
 * @returns {import('./pieces.js').CombatPiece | null}
 */
export function enterChargeCell(tracker, cellIndex, curPiece, flatVal, valPerTile, mode = 'speed') {
  const prevPiece = tracker.curChargedPiece;
  tracker.lastChargedPiece = tracker.curChargedPiece;
  tracker.curChargedPiece = curPiece || null;
  changeChargedItemStat(tracker, cellIndex, flatVal, valPerTile, mode);
  return prevPiece;
}
