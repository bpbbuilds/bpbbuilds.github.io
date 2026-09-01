/**
 * Character.takeDamage attackEffectCount + Bow.onWeaponAttacked.
 * Item.rollDoubleAttackEffect = Util.flip(doubleAttackEffectChance).
 */

import { affectedTargets } from './board-graph.js';

/**
 * @param {object} piece
 * @param {() => number} rng
 * @returns {0 | 1}
 */
export function rollDoubleAttackEffect(piece, rng) {
  const p = Number(piece?.doubleAttackEffectChance) || 0;
  if (p <= 0 || typeof rng !== 'function') return 0;
  return rng() < p ? 1 : 0;
}

/**
 * @param {object | null | undefined} piece
 * @param {() => number} rng
 */
export function attackEffectCount(piece, rng) {
  if (!piece) return 1;
  return 1 + rollDoubleAttackEffect(piece, rng);
}

/**
 * @param {object} piece
 * @param {() => number} rng
 * @param {(i: number, n: number) => void} fn
 */
export function forAttackEffects(piece, rng, fn) {
  const n = attackEffectCount(piece, rng);
  for (let i = 0; i < n; i += 1) fn(i, n);
  return n;
}

/**
 * Bow.getFirstAffectedItem — first canAffect weapon on stars (fallback adjacency).
 * @param {import('./scripts/handlers.js').ScriptCtx} ctx
 * @param {object} bow
 */
export function firstAffectedWeapon(ctx, bow) {
  const links = affectedTargets(
    ctx.graph,
    bow.placementKey,
    ctx.itemsById,
    ctx.canAffect,
  );
  for (const o of ctx.pieces || []) {
    if (o.placementKey === bow.placementKey) continue;
    if (!links.some((l) => l.key === o.placementKey)) continue;
    const item = ctx.itemsById.get(o.itemId);
    const isW =
      o.kind === 'weapon' || /weapon/i.test(String(item?.type || ''));
    if (isW) return o;
  }
  return null;
}

/**
 * Item.dealDamage emits "attacked" once; Bow scripts roll their own attackEffectCount.
 * @param {object} bow
 * @param {import('./scripts/handlers.js').ScriptCtx} ctx
 * @param {(payload: { piece: object, hit: object, t?: number }) => void} onAttacked
 */
export function listenLinkedWeaponAttacked(bow, ctx, onAttacked) {
  const w = firstAffectedWeapon(ctx, bow);
  if (!w || typeof ctx.bus?.on !== 'function') return;
  const key = w.placementKey;
  ctx.bus.on('item_attacked', (payload) => {
    if (payload?.piece?.placementKey !== key) return;
    onAttacked(payload);
  });
}
