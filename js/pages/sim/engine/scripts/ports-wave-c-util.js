/**
 * Band AE Wave C — shared weapon CD helpers.
 */

import { tryUseStamina } from '../actor.js';
import { BUFF_KEYS, spendStacks, stealStack } from '../buff-economy.js';
import { getStackAmount } from '../stacks.js';
import { dealHit } from './handlers.js';
import { randInt } from '../rng.js';
import { pushActivate } from './ports-util.js';

export { rollItemChance, rollItemChance2 } from '../chance.js';

/**
 * Weapon.gd inherits Item's prepare/pre-combat/combat-start lifecycle. Keep
 * that base path explicit even though concrete weapon ports supply their own
 * item hooks.
 *
 * @param {object} piece
 * @param {object} ctx
 * @param {'prepare'|'pre_combat_start'|'combat_start'} phase
 * @param {((piece: object, ctx: object) => void) | undefined} hook
 */
export function runWeaponInheritedHook(piece, ctx, phase, hook) {
  if (phase === 'prepare') {
    piece.chanceRng?.reset?.();
    piece.damageRangeRng?.reset?.();
  }
  return hook?.(piece, ctx);
}

/**
 * @param {object} piece
 * @param {object} ctx
 * @param {string} handler
 * @param {{
 *   beforeDeal?: (raw: number, piece: object, ctx: object) =>
 *     number | { raw?: number, ignoreBlock?: boolean, critChance?: number } | void,
   * onPreDealDamageEarly?: (res: object) => void,
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
    {
      ...hitOpts,
      skipSpikes: !!opts.skipSpikes,
      onPreDealDamageEarly: opts.onPreDealDamageEarly,
    },
  );
  // Weapon.gd.attack(): dealDamage() returns the hit result before activate().
  pushActivate(piece, ctx, handler, opts.label || `Weapon: ${piece.name}`);
  if (typeof opts.afterHit === 'function') opts.afterHit(hit, piece, ctx);
  return true;
}

/** Weapon.gd's inherited cooldown implementation. */
export const weaponBasePort = {
  handlerId: 'weapon',
  family: 'basic_weapon',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'weapon');
  },
};

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
 * Item.getStackFraction() — choose a rounded fraction of every available
 * buff, capped by `limit`, then remove the distributed integer amount.  The
 * remainder ordering follows the game's BUFF_KEYS order for deterministic
 * ties.
 */
function fractionPlan(actor, fraction, limit) {
  const rows = BUFF_KEYS.map((stack, index) => {
    const amount = Math.max(0, Number(getStackAmount(actor, /** @type {any} */ (stack))) || 0);
    const exact = amount * Math.max(0, Number(fraction) || 0);
    return { stack, index, exact, base: Math.floor(exact), remainder: exact - Math.floor(exact) };
  }).filter((row) => row.base > 0 || row.remainder > 0);
  const roundedTotal = Math.round(rows.reduce((sum, row) => sum + row.exact, 0));
  let total = Math.min(Math.max(0, Math.round(limit)), roundedTotal);
  if (!total) return [];
  for (const row of rows) {
    row.take = Math.min(row.base, Math.max(0, Number(getStackAmount(actor, /** @type {any} */ (row.stack))) || 0));
    total -= row.take;
  }
  rows.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const row of rows) {
    if (total <= 0) break;
    const available = Math.max(0, Math.floor(Number(getStackAmount(actor, /** @type {any} */ (row.stack))) || 0) - row.take);
    if (available <= 0) continue;
    row.take += 1;
    total -= 1;
  }
  return rows.filter((row) => row.take > 0).map(({ stack, take }) => ({ stack, take }));
}

/** Remove a source-accurate fraction of an actor's buffs. */
export function removeBuffsFraction(actor, fraction, limit, rng, opts = {}) {
  const removed = {};
  for (const { stack, take } of fractionPlan(actor, fraction, limit)) {
    const result = spendStacks(actor, stack, take, { ...opts, hostileStrip: true, rng });
    if (result.spent > 0) removed[stack] = result.spent;
  }
  return removed;
}

/** Steal a source-accurate fraction of buffs from `from` to `to`. */
export function stealBuffsFraction(from, to, fraction, limit, rng, opts = {}) {
  const stolen = {};
  for (const { stack, take } of fractionPlan(from, fraction, limit)) {
    const result = stealStack(from, to, stack, take, { ...opts, rng });
    if (result.stolen > 0) stolen[stack] = result.stolen;
  }
  return stolen;
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
