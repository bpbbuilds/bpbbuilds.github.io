/**
 * Shared helpers for Band Y theme ports.
 */

import { eventSideForPiece } from '../vs-board.js';
import { affectedTargets } from '../board-graph.js';

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
  const dynamic = item._dynamicTypes;
  if (Array.isArray(dynamic) && dynamic.some((x) => String(x).toLowerCase().includes(n))) {
    return true;
  }
  return false;
}

/**
 * Potion.triggerPotion() applies the first linked Potion's effect without
 * consuming it; miniActivate() is visual-only. Ports expose that effect as a
 * piece-local callback so chained potions do not go through cooldown/charge
 * consumption a second time.
 *
 * @param {object} piece
 * @param {object} ctx
 * @param {number} [t]
 * @returns {boolean}
 */
export function triggerFirstAffectedPotion(piece, ctx, t = ctx.t) {
  if (!ctx?.graph || !ctx.itemsById) return false;
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  const target = (ctx.pieces || []).find((candidate) =>
    links.some((link) => link.key === candidate.placementKey) &&
    candidate.placementKey !== piece.placementKey &&
    typeof candidate._potionTrigger === 'function',
  );
  if (!target) return false;
  target._potionTrigger({ ...ctx, t });
  ctx.events.push({
    t: t + 0.001,
    type: 'info',
    itemId: target.itemId,
    placementKey: target.placementKey,
    label: `${target.name}: mini activate`,
    meta: { category: 'system', script: true, miniActivate: true, triggeredBy: piece.itemId },
  });
  return true;
}

/**
 * Item.getTypeMultiplicity(type) for the extracted overrides that count as
 * more than one type. Most items contribute one when they have the type;
 * Phoenix2 / Molten Greatsword / Molten Spear2 override Fire multiplicity in
 * the source with their named `fire` parameter.
 *
 * @param {object | null | undefined} item
 * @param {string} needle
 */
export function itemTypeMultiplicity(item, needle) {
  if (!itemHasType(item, needle)) return 0;
  const id = String(item?.id || item?.itemId || '').toLowerCase();
  if (String(needle).toLowerCase() === 'fire' &&
      (id === 'phoenix2' || id === 'molten_greatsword' || id === 'molten_spear2')) {
    const params = item?.params || {};
    const value = Number(params.fire ?? params.p3);
    // The extracted getTypeMultiplicity returns int(getP("fire")); preserve
    // explicit zero (and truncation) instead of silently turning it into one.
    if (Number.isFinite(value)) return Math.trunc(value);
  }
  return 1;
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
export function pushActivate(piece, ctx, handler, label, extra) {
  if (piece?.kind === 'bag' && !pieceHasCombatCooldown(piece) && !extra?.force) {
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
      ...(extra && typeof extra === 'object'
        ? Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'force'))
        : {}),
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
    pushActivate(
      piece,
      ctx,
      handler,
      label || `${piece.name}`,
      consume ? { consume: true } : undefined,
    );
  }
  piece._cdLocked = true;
  piece.cooldown = 999;
  piece.triggerTime = 999;
  if (consume) {
    piece.alive = false;
    piece.charges = 0;
  }
}
