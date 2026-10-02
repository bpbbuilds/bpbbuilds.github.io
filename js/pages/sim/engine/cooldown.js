/**
 * Cooldown advance helpers — mirrors Item.adjustCooldown / trigger / _physics_process.
 */

import { pieceSpeed } from './piece-stats.js';
import { pushItemOverlayEvent } from './item-fx-log.js';

/**
 * Item.adjustCooldown — ±5% jitter on catalog CD (player); foe band slightly tighter.
 * Returns jittered **base CD units** (before speed), matching Godot.
 *
 * @param {number} baseCd
 * @param {() => number} rng 0..1
 * @param {{ opponent?: boolean }} [opts]
 */
export function adjustCooldown(baseCd, rng, opts = {}) {
  const base = Number(baseCd);
  if (!(Number.isFinite(base) && base > 0) || base >= 500) return base;
  const lo = opts.opponent ? 0.975 : 0.95;
  const hi = 1.05;
  const u = typeof rng === 'function' ? rng() : 0.5;
  const factor = lo + Math.max(0, Math.min(1, u)) * (hi - lo);
  return Math.max(0.01, base * factor);
}

/**
 * Game iterationCooldown after adjustCooldown (not divided by getSpeed).
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {() => number} rng
 * @param {{ opponent?: boolean }} [opts]
 */
export function rollIterationCooldown(piece, rng, opts = {}) {
  const base = Number(piece.baseCooldown ?? piece.cooldown) || 0;
  if (!(base > 0) || base >= 500) return base;
  return adjustCooldown(base, rng, opts);
}

/**
 * Item.getModifiedCooldown — iteration / getSpeed (display / tips).
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {{ heat?: number, cold?: number } | null | undefined} stacks
 * @param {number} [iteration]
 */
export function modifiedCooldownFromIteration(piece, stacks, iteration) {
  const iter = Number(iteration ?? piece._iterationCd ?? piece.baseCooldown) || 0;
  if (!(iter > 0) || iter >= 500) return iter;
  return Math.max(0.35, iter / pieceSpeed(piece, stacks));
}

/**
 * Sync piece.cooldown display row from _iterationCd + live speed.
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {{ heat?: number, cold?: number } | null | undefined} stacks
 */
export function syncModifiedCooldown(piece, stacks) {
  if (!(piece?.cooldown > 0) || piece.cooldown >= 500) return;
  piece.cooldown = modifiedCooldownFromIteration(piece, stacks, piece._iterationCd);
}

/**
 * Next wall-clock period: adjustCooldown(base) / getSpeed(stacks).
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {{ heat?: number, cold?: number } | null | undefined} stacks
 * @param {() => number} rng
 * @param {{ opponent?: boolean }} [opts]
 */
export function nextCooldownPeriod(piece, stacks, rng, opts = {}) {
  const iter = rollIterationCooldown(piece, rng, opts);
  return modifiedCooldownFromIteration(piece, stacks, iter);
}

/**
 * Arm (or re-arm) a piece's remaining CD with fresh jitter.
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {{ heat?: number, cold?: number } | null | undefined} stacks
 * @param {() => number} rng
 * @param {{ opponent?: boolean, replaceRemaining?: boolean }} [opts]
 */
export function armPieceCooldown(piece, stacks, rng, opts = {}) {
  if (!(piece?.cooldown > 0) || piece.cooldown >= 500) return;
  const iter = rollIterationCooldown(piece, rng, opts);
  piece._iterationCd = iter;
  syncModifiedCooldown(piece, stacks);
  if (opts.replaceRemaining !== false) {
    piece.triggerTime = iter;
  }
}

/**
 * Item.trigger — roll iteration, add to triggerTime, refresh display CD.
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {{ heat?: number, cold?: number } | null | undefined} stacks
 * @param {() => number} rng
 * @param {{ opponent?: boolean }} [opts]
 */
export function rearmAfterTrigger(piece, stacks, rng, opts = {}) {
  const iter = rollIterationCooldown(piece, rng, opts);
  piece._iterationCd = iter;
  piece.triggerTime += iter;
  syncModifiedCooldown(piece, stacks);
  return iter;
}

/**
 * Advance remaining CD by wall-clock seconds (sim already bakes Battery
 * haste into cooldown length — do not multiply by getSpeed()).
 *
 * Prefer `ctx.activatePiece` (set by simulate) to avoid import cycles.
 *
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {number} amount seconds
 * @param {import('./scripts/handlers.js').ScriptCtx & {
 *   activatePiece?: typeof import('./combat-activate.js').activatePiece,
 * }} ctx
 * @returns {boolean} whether an advance was applied
 */
export function advanceCooldownSeconds(piece, amount, ctx) {
  if (!piece?.alive || !(piece.cooldown > 0) || piece.cooldown >= 500) {
    return false;
  }
  const sec = Number(amount);
  if (!(Number.isFinite(sec) && sec > 0)) return false;
  if (piece._cdAdvanceDepth) return false;

  // Game advanceCooldownSeconds: subtract raw amount from triggerTime (iteration units).
  piece.triggerTime -= sec;
  piece._cdAdvanceDepth = (piece._cdAdvanceDepth || 0) + 1;
  try {
    const activate = ctx.activatePiece;
    if (typeof activate !== 'function') return true;

    // ctx.player is side-flipped for opp pieces (ctxForPiece) — use that owner.
    const stacks = ctx.player?.stacks;
    let guard = 0;
    while (
      piece.triggerTime <= 0 &&
      piece.alive &&
      !ctx.player?.dead &&
      !ctx.dummy?.dead &&
      guard < 32
    ) {
      guard += 1;
      const ok = activate(piece, ctx);
      rearmAfterTrigger(piece, stacks, ctx.rng, {
        opponent: piece.side === 'them',
      });
      if (!ok && piece.charges == null) break;
    }
  } finally {
    piece._cdAdvanceDepth = Math.max(0, (piece._cdAdvanceDepth || 1) - 1);
  }
  if (isCooldownActive(piece)) {
    pushItemOverlayEvent(piece, {
      type: 'cooldown',
      amount: sec,
      label: `${sec}s cooldown`,
      meta: { category: 'item_label', kind: 'advance' },
    });
  }
  return true;
}

/**
 * Game isCooldownActive — piece is on the combat CD loop.
 * @param {import('./pieces.js').CombatPiece} piece
 */
export function isCooldownActive(piece) {
  return Boolean(
    piece?.alive && piece.cooldown > 0 && piece.cooldown < 500,
  );
}
