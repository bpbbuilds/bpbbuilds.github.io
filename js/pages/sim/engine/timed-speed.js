/**
 * Timed speed buffs — Band AG helpers (holy_spear, thunder_drake, automanaton).
 */

import { addSpeed } from './piece-stats.js';

/**
 * Grant speed that reverts at `untilT`.
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {number} frac
 * @param {number} untilT
 * @param {string} [tag]
 */
export function grantTimedSpeed(piece, frac, untilT, tag = 'default') {
  const n = Number(frac) || 0;
  if (!n || !(untilT > 0)) return;
  if (!piece._timedSpeeds) piece._timedSpeeds = [];
  addSpeed(piece, n);
  piece._timedSpeeds.push({ frac: n, untilT, tag });
}

/**
 * Refresh or extend a tagged timed speed (thunder_drake style).
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {number} frac
 * @param {number} untilT
 * @param {string} tag
 */
export function refreshTimedSpeed(piece, frac, untilT, tag) {
  const list = piece._timedSpeeds || [];
  const existing = list.find((e) => e.tag === tag);
  if (existing) {
    // Keep frac; only extend expiry
    existing.untilT = Math.max(existing.untilT, untilT);
    return;
  }
  grantTimedSpeed(piece, frac, untilT, tag);
}

/**
 * Expire timed speeds at sim time `t`. Call once per tick from simulate loop.
 * @param {import('./pieces.js').CombatPiece[]} pieces
 * @param {number} t
 */
export function tickTimedSpeeds(pieces, t) {
  for (const piece of pieces || []) {
    const list = piece._timedSpeeds;
    if (!list?.length) continue;
    /** @type {typeof list} */
    const keep = [];
    for (const e of list) {
      if (t + 1e-9 >= e.untilT) {
        addSpeed(piece, -e.frac);
        piece._onTimedSpeedEnd?.(e.tag, e);
      } else keep.push(e);
    }
    piece._timedSpeeds = keep;
  }
}

/**
 * Piece-local invuln cast budget (King Goobert charges) — not actor hit-charges.
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {number} n
 */
export function setPieceInvulnBudget(piece, n) {
  piece.invulnBudget = Math.max(0, Math.round(Number(n) || 0));
}

/**
 * @param {import('./pieces.js').CombatPiece} piece
 * @returns {boolean}
 */
export function spendPieceInvulnBudget(piece) {
  if ((Number(piece.invulnBudget) || 0) <= 0) return false;
  piece.invulnBudget -= 1;
  return true;
}
