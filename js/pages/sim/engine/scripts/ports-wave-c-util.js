/**
 * Band AE Wave C — shared weapon CD helpers.
 */

import { tryUseStamina } from '../actor.js';
import { BUFF_KEYS, spendStacks } from '../buff-economy.js';
import { getStackAmount } from '../stacks.js';
import { dealHit } from './handlers.js';
import { randInt } from '../rng.js';
import { pushActivate } from './ports-util.js';

export { rollItemChance, rollItemChance2 } from '../chance.js';

/**
 * @param {object} piece
 * @param {object} ctx
 * @param {string} handler
 * @param {{
 *   beforeDeal?: (raw: number, piece: object, ctx: object) =>
 *     number | { raw?: number, ignoreBlock?: boolean, critChance?: number } | void,
   * afterHit?: (hit: object, piece: object, ctx: object) => void,
   *   label?: string,
 * }} [opts]
 * @returns {boolean} true if starved / handled
 */
export function weaponStrike(piece, ctx, handler, opts = {}) {
  const { t, player, events, rng } = ctx;
  if (!opts.skipStamina) {
    if (tryUseStamina(player, piece.staminaCost) === 'starve') {
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true, handler },
      });
      // false → combat-activate must not pushActivate / notifyPeer (game OOS ≠ activate)
      return false;
    }
  }
  pushActivate(piece, ctx, handler, opts.label || `Weapon: ${piece.name}`);
  /** @type {{ ignoreBlock?: boolean, critChance?: number }} */
  let hitOpts = {};
  /** @type {((raw: number) => number) | null} */
  let tweakRaw = null;
  if (typeof opts.beforeDeal === 'function') {
    // Game onPreDealDamage_early mutates the already-rolled DamageResult.
    // Callers that only apply side effects (stones) return void — keep the roll.
    tweakRaw = (rolled) => {
      const mod = opts.beforeDeal(rolled, piece, ctx);
      if (typeof mod === 'number' && Number.isFinite(mod)) return mod;
      if (mod && typeof mod === 'object') {
        if (mod.ignoreBlock) hitOpts.ignoreBlock = true;
        if (mod.critChance != null) hitOpts.critChance = mod.critChance;
        if (mod.raw != null) return Number(mod.raw);
      }
      return rolled;
    };
  }
  const hit = dealHit(
    piece,
    ctx,
    () => {
      let raw = randInt(piece.damageMin, piece.damageMax, rng);
      if (tweakRaw) raw = tweakRaw(raw);
      return raw;
    },
    undefined,
    { ...hitOpts, skipSpikes: !!opts.skipSpikes },
  );
  if (typeof opts.afterHit === 'function') opts.afterHit(hit, piece, ctx);
  return true;
}

/**
 * Empty affect cells for spear-style block strip.
 * @param {object} ctx
 * @param {object} piece
 */
export function countEmptyAffectCells(ctx, piece) {
  const bp = ctx.graph?.pieces?.get(piece.placementKey);
  if (!bp?.affectCells?.length) return 0;
  let n = 0;
  for (const { cell } of bp.affectCells) {
    if (!ctx.graph.filled.has(cell)) n += 1;
  }
  return n;
}

/**
 * Remove N random buff stacks from actor (opponent strip).
 * @param {import('../actor.js').SimActor} actor
 * @param {number} num
 * @param {() => number} rng
 * @param {object} [opts]
 */
export function removeRandomBuffs(actor, num, rng, opts = {}) {
  const n = Math.max(0, Math.round(num));
  /** @type {Record<string, number>} */
  const removed = {};
  for (let i = 0; i < n; i++) {
    const pool = BUFF_KEYS.filter((k) => getStackAmount(actor, /** @type {any} */ (k)) > 0);
    if (!pool.length) break;
    const choice = pool[Math.floor(rng() * pool.length)] || pool[0];
    const { spent } = spendStacks(actor, choice, 1, { ...opts, hostileStrip: true, rng });
    if (spent > 0) removed[choice] = (removed[choice] || 0) + spent;
  }
  return removed;
}

/**
 * Strip block from dummy (Item.removeBlock). Credits stripped amount as
 * Damage Dealt and logs "Removed N block". Skip if dummy has 0 block.
 * @param {import('../actor.js').SimActor} dummy
 * @param {number} amount
 * @param {import('./handlers.js').ScriptCtx} [ctx]
 * @param {import('./handlers.js').CombatPiece} [piece]
 */
export function removeBlock(dummy, amount, ctx, piece) {
  const n = Math.max(0, Math.round(amount));
  if (n <= 0) return 0;
  const have = Math.max(
    Number(dummy.block) || 0,
    getStackAmount(dummy, /** @type {any} */ ('block')) || 0,
  );
  const take = Math.min(have, n);
  if (take <= 0) return 0;
  dummy.block = have - take;

  const events = ctx?.events;
  if (events && take > 0) {
    const t = Number(ctx.t) || 0;
    const name = piece?.name || 'Item';
    const itemId = piece?.itemId;
    const placementKey = piece?.placementKey;
    events.push({
      t: t + 0.002,
      type: 'debuff',
      actor: 'player',
      target: 'dummy',
      itemId,
      placementKey,
      amount: -take,
      label: `Removed ${take} block (${name})`,
      meta: {
        category: 'debuff',
        stack: 'block',
        script: true,
        kind: 'block_strip',
        handler: piece?.handlerId || itemId,
      },
    });
    events.push({
      t: t + 0.0025,
      type: 'damage',
      actor: 'player',
      target: 'dummy',
      itemId,
      placementKey,
      amount: take,
      label: `Removed ${take} block (${name})`,
      meta: {
        category: 'damage',
        script: true,
        kind: 'block_strip',
        stack: 'block',
        healthDamage: 0,
        damage: take,
      },
    });
  }
  return take;
}
