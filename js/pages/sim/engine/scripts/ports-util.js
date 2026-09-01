/**
 * Shared helpers for Band Y theme ports.
 */

import { eventSideForPiece } from '../vs-board.js';

/**
 * @param {object | null | undefined} item
 * @param {string} needle
 */
export function itemHasType(item, needle) {
  if (!item) return false;
  const n = needle.toLowerCase();
  if (String(item.type || '')
    .toLowerCase()
    .includes(n)) {
    return true;
  }
  const extra = item.extraTypes;
  if (Array.isArray(extra) && extra.some((x) => String(x).toLowerCase().includes(n))) {
    return true;
  }
  const tags = item.tags;
  if (Array.isArray(tags) && tags.some((x) => String(x).toLowerCase().includes(n))) {
    return true;
  }
  return false;
}

/**
 * @param {import('../sim-events.js').SimEvent[] | object[]} events
 * @param {object} piece
 * @param {import('../actor.js').SimActor} player
 * @param {number} t
 * @param {string} handler
 * @param {Record<string, number>} picked
 * @param {number} [baseOff]
 * @param {'player'|'dummy'} [target]
 */
export function pushBuffGrants(
  events,
  piece,
  player,
  t,
  handler,
  picked,
  baseOff = 0.002,
  target,
) {
  const side = target ?? eventSideForPiece(piece);
  let off = baseOff;
  for (const [stack, amount] of Object.entries(picked || {})) {
    events.push({
      t: t + off,
      type: 'buff',
      actor: side,
      target: side,
      amount,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${amount} ${stack}`,
      meta: {
        category: 'buff',
        stack,
        script: true,
        handler,
        [stack]:
          side === 'player'
            ? player.stacks[/** @type {any} */ (stack)]
            : undefined,
      },
    });
    off += 0.002;
  }
}

/**
 * True if a bag (or other piece) has a combat cooldown loop.
 * Passive bags (Fanny Pack) must not log Activation; Relic Case / Toolbox may.
 * @param {object} piece
 */
export function pieceHasCombatCooldown(piece) {
  if (!piece) return false;
  const base = Number(piece.baseCooldown) || 0;
  const cd = Number(piece.cooldown) || 0;
  return (base > 0 && base < 500) || (cd > 0 && cd < 500);
}

/**
 * @param {object} piece
 * @param {object} ctx
 * @param {string} handler
 * @param {string} [label]
 */
export function pushActivate(piece, ctx, handler, label) {
  if (piece?.kind === 'bag' && !pieceHasCombatCooldown(piece)) {
    return;
  }
  piece._activationLogged = true;
  const actor = eventSideForPiece(piece);
  ctx.events.push({
    t: ctx.t,
    type: 'activate',
    actor,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: label || `${piece.name}`,
    meta: {
      category: 'system',
      script: true,
      handler,
      combatStart: ctx.combatStartSeq != null,
    },
  });
}

/** Item.onAfterEffectFinished() — deactivate CD; consume() → activate unless opted out. */
export function afterEffectFinished(
  piece,
  ctx,
  handler,
  { activate = true, consume = true, label = '' } = {},
) {
  if (activate) {
    pushActivate(piece, ctx, handler, label || `${piece.name}`);
  }
  piece._cdLocked = true;
  piece.cooldown = 999;
  piece.triggerTime = 999;
  if (consume) {
    piece.alive = false;
    piece.charges = 0;
  }
}
