/**
 * Family combat script handlers (Band D) + shared dealHit (Band G damage pipeline).
 * Dedicated item ports live in ports.js — registry merges both.
 */

import { healActor, requestedHealAmount, tryUseStamina } from '../actor.js';
import { gainStacks } from '../stacks.js';
import { flushDeferredUnhealLog, logWeaponHitEvents } from '../log-chain.js';
import { dealDamage } from '../damage.js';
import { getP1 } from '../params.js';
import { affectedTargets } from '../board-graph.js';
import { randInt } from '../rng.js';
import { applyBonusDamageFactor } from '../piece-stats.js';

/**
 * @typedef {import('../pieces.js').CombatPiece} CombatPiece
 * @typedef {{
 *   t: number,
 *   player: import('../actor.js').SimActor,
 *   dummy: import('../actor.js').SimActor,
 *   rng: () => number,
 *   events: import('../../sim-events.js').SimEvent[],
 *   graph: import('../board-graph.js').BoardGraph,
 *   itemsById: Map<string, object>,
 *   canAffect: object | null,
 *   pieces?: CombatPiece[],
 *   allPieces?: CombatPiece[],
 *   deckIndex?: { i: number },
 *   cardKeys?: string[],
 *   bus?: { on: Function, emit: Function, reset: Function },
 *   fatigue?: { startAt: number, started: boolean, advanceTime?: Function },
 *   activatePiece?: Function,
 * }} ScriptCtx
 */

/**
 * @typedef {{
 *   handlerId: string,
 *   family: string,
 *   onPrepare?: (piece: CombatPiece, ctx: ScriptCtx) => void,
 *   onPreCombatStart?: (piece: CombatPiece, ctx: ScriptCtx) => void,
 *   onCombatStart?: (piece: CombatPiece, ctx: ScriptCtx) => void,
 *   onPostCombatStart?: (piece: CombatPiece, ctx: ScriptCtx) => void,
 *   emitCharge?: (piece: CombatPiece, ctx: ScriptCtx, speedFactor?: number) => void,
 *   onQueuedChargeTimeout?: (piece: CombatPiece, ctx: ScriptCtx) => void,
 *   onCooldownEffect?: (piece: CombatPiece, ctx: ScriptCtx) => boolean,
 *   onPeerActivated?: (
 *     listener: CombatPiece,
 *     activated: CombatPiece,
 *     ctx: ScriptCtx,
 *   ) => void,
 *   onChargeReceived?: (
 *     piece: CombatPiece,
 *     ctx: ScriptCtx,
 *     meta?: { pathId?: string, cellIndex?: number, emitterKey?: string },
 *   ) => void,
 *   onPreDealDamageEarly?: (piece: CombatPiece, ctx: ScriptCtx) => void,
 *   onDealtDamage?: (
 *     piece: CombatPiece,
 *     ctx: ScriptCtx,
 *     hit: { hit: boolean, healthDamage: number, raw: number, critical: boolean, missed: boolean },
 *   ) => void,
 * }} ScriptHandler
 */

/**
 * @param {CombatPiece} piece
 * @param {ScriptCtx} ctx
 * @param {number} raw
 * @param {string} [extraLabel]
 */
/**
 * @param {CombatPiece} piece
 * @param {ScriptCtx} ctx
 * @param {number} raw
 * @param {string} [extraLabel]
 * @param {{ ignoreBlock?: boolean, critChance?: number, skipSpikes?: boolean, canMiss?: boolean, isAttack?: boolean, isMelee?: boolean, vampiricItem?: boolean, canTriggerVampirism?: boolean }} [opts]
 */
export function dealHit(piece, ctx, raw, extraLabel, opts = {}) {
  const { t, player, dummy, rng, events } = ctx;
  let accuracy = piece.accuracy;
  const lucky = Number(player.stacks?.lucky) || 0;
  const blind = Number(player.stacks?.blind) || 0;
  accuracy = Math.max(0, Math.min(100, accuracy + (lucky - blind) * 5));

  const critChance = Math.max(
    piece.chanceTag === 'crit' && piece.chance > 0 ? piece.chance : 0,
    Number(piece.critChance) || 0,
    Number(opts.critChance) || 0,
  );
  const isAttack = opts.isAttack !== false;
  const rollAmount = () => {
    let extra = 0;
    for (const fn of piece._preDeal || []) {
      extra += Number(typeof fn === 'function' ? fn() : 0) || 0;
    }
    const base = typeof raw === 'function' ? Number(raw()) || 0 : raw;
    return applyBonusDamageFactor(
      piece,
      base +
        (piece.damageBonus || 0) +
        (piece.bonusDamage || 0) +
        (player.stacks.empower || 0) +
        extra,
    );
  };

  player._deferUnhealLog = true;
  dummy._deferUnhealLog = true;
  const res = dealDamage(player, dummy, {
    amount: rollAmount,
    originPiece: piece,
    onPreDealDamageEarly: (res) => ctx.notifyPreDealDamageEarly?.(piece, ctx, res),
    accuracy,
    canMiss: opts.canMiss !== false && !opts.ignoreBlock,
    canCrit: critChance > 0,
    critChance,
    isAttack,
    isMelee: opts.isMelee != null ? !!opts.isMelee : piece.damageKind !== 'ranged',
    skipSpikes: !!opts.skipSpikes,
    ignoreBlock: !!(opts.ignoreBlock || piece.spectral),
    vampiricItem: opts.vampiricItem !== undefined ? !!opts.vampiricItem : piece.vampiric,
    // Game DamageSource: Effect lacks CanTriggerVampirism; weapons have it.
    canTriggerVampirism:
      opts.canTriggerVampirism != null ? !!opts.canTriggerVampirism : isAttack,
    nowT: t,
    bus: ctx.bus,
    rng,
  });
  player._deferUnhealLog = false;
  dummy._deferUnhealLog = false;

  if (!res.hit) {
    events.push({
      t: t + 0.004,
      type: 'miss',
      actor: player.id,
      target: dummy.id,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name} missed`,
      meta: { category: 'damage', script: true, isAttack: true },
    });
    const missResult = { hit: false, healthDamage: 0, raw: 0, critical: false, missed: true };
    const n = res.attackEffectCount || 1;
    if (typeof ctx.notifyDealtDamage === 'function') {
      for (let i = 0; i < n; i += 1) ctx.notifyDealtDamage(piece, ctx, missResult);
    }
    ctx.bus?.emit?.('piece_dealt_damage', { piece, hit: missResult, t });
    ctx.bus?.emit?.('item_attacked', { piece, hit: missResult, t });
    return missResult;
  }

  const allocId = ctx.logChain?.nextId?.bind(ctx.logChain) || (() => 0);
  logWeaponHitEvents({
    t,
    piece,
    player,
    dummy,
    res,
    events,
    allocId,
    formatHitLabel: (name, raw, r) =>
      extraLabel ||
      `${name} hit${r.critical ? ' crit' : ''} for ${r.damage ?? raw}`,
  });

  const hitResult = {
    hit: true,
    healthDamage: res.healthDamage,
    damage: res.damage,
    raw: res.raw,
    critical: res.critical,
    missed: false,
  };
  const n = res.attackEffectCount || 1;
  if (typeof ctx.notifyDealtDamage === 'function') {
    for (let i = 0; i < n; i += 1) ctx.notifyDealtDamage(piece, ctx, hitResult);
  }
  ctx.bus?.emit?.('piece_dealt_damage', {
    piece,
    hit: hitResult,
    t,
  });
  ctx.bus?.emit?.('item_attacked', { piece, hit: hitResult, t });
  return hitResult;
}

/**
 * Item.dealEffectDamage / DamageSource.effectFlags:
 * CanBeBlocked + CanTriggerItems + CanCrit — not vamp, not spikes, not miss.
 * Goes through opponent.takeDamage only (no Character.dealDamage → applyVampirism).
 * Scales with character effectDmgFactor + piece.bonusDamageFactor.
 *
 * @param {CombatPiece} piece
 * @param {ScriptCtx} ctx
 * @param {number} raw
 * @param {{
 *   critChance?: number,
 *   ignoreBlock?: boolean,
 *   stealLife?: boolean,
 *   deferUnheal?: boolean,
 *   parentId?: string | number,
 * }} [opts]
 */
export function dealEffectDamage(piece, ctx, raw, opts = {}) {
  const { t, player, dummy, rng, events } = ctx;
  const typed = 1 + (Number(player.effectDmgFactor) || 0);
  const bonus = Number(piece.bonusDamageFactor);
  const bf = Number.isFinite(bonus) && bonus > 0 ? bonus : 1;
  const amount = Math.max(
    0,
    Math.round((Number(raw) || 0) * typed * bf),
  );
  const critChance = Math.max(
    Number(piece.critChance) || 0,
    Number(opts.critChance) || 0,
  );

  const deferUnheal = opts.deferUnheal === true;
  if (deferUnheal) {
    player._deferUnhealLog = true;
    dummy._deferUnhealLog = true;
  }
  const res = dealDamage(player, dummy, {
    amount,
    originPiece: piece,
    canMiss: false,
    canCrit: critChance > 0,
    critChance,
    isAttack: false,
    canTriggerVampirism: false,
    skipSpikes: true,
    ignoreBlock: !!opts.ignoreBlock,
    nowT: t,
    bus: ctx.bus,
    rng,
  });
  if (deferUnheal) {
    player._deferUnhealLog = false;
    dummy._deferUnhealLog = false;
  }

  /** @type {number | null} */
  let damageId = null;
  if (res.hit) {
    const allocId = ctx.logChain?.nextId?.bind(ctx.logChain) || (() => 0);
    damageId = allocId();
    const label = opts.stealLife
      ? `${piece.name} stealLife ${res.damage}`
      : `${piece.name} hit${res.critical ? ' crit' : ''} for ${res.damage}`;
    events.push({
      t,
      type: 'damage',
      actor: player.id,
      target: dummy.id,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: res.damage,
      label,
      meta: {
        category: 'damage',
        script: true,
        effect: true,
        eventId: damageId,
        raw: res.raw,
        damage: res.damage,
        healthDamage: res.healthDamage,
        blocked: res.blocked,
        reduced: res.reduced,
        critical: res.critical,
        ...(opts.parentId != null ? { parentId: opts.parentId } : {}),
        dummyHp: dummy.hp,
        playerHp: player.hp,
      },
    });
  }

  if (!res.hit) {
    return {
      hit: false,
      healthDamage: 0,
      damage: 0,
      raw: 0,
      critical: false,
      missed: true,
      damageId: null,
    };
  }
  return {
    hit: true,
    healthDamage: res.healthDamage,
    damage: res.damage,
    raw: res.raw,
    critical: res.critical,
    missed: false,
    damageId,
  };
}

/**
 * Character.loseHealth(amount, item) — direct self-health cost that must leave
 * the actor alive when the source item checks `currentHealth > amount`.
 * The event is kept in the shared damage stream for Combat Log/export/HUD
 * consumers, but is marked so the Damage Dealt meter does not count it.
 *
 * @param {CombatPiece} piece
 * @param {ScriptCtx} ctx
 * @param {number} amount
 * @returns {{ eventId: string | number | null, amount: number } | null}
 */
export function loseHealth(piece, ctx, amount) {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  if (!(n > 0) || !(ctx.player.hp > n)) return null;
  ctx.player.hp -= n;
  const eventId = ctx.logChain?.nextId?.() ?? null;
  ctx.events.push({
    t: ctx.t,
    type: 'damage',
    actor: ctx.player.id,
    target: ctx.player.id,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    amount: n,
    label: `${piece.name}: lost ${n} health`,
    meta: {
      category: 'damage',
      kind: 'self_health_cost',
      eventId,
      healthDamage: n,
      playerHp: ctx.player.hp,
    },
  });
  return { eventId, amount: n };
}

/**
 * Item.stealLife — Effect damage (no vamp / no spikes / no miss), then heal
 * nested under the damage event; Unhealing nests under the heal (game Combat Log).
 *
 * @param {CombatPiece} piece
 * @param {ScriptCtx} ctx
 * @param {number} raw
 * @param {number} [lifestealFactor]
 * @param {{ critChance?: number }} [opts]
 */
export function stealLife(piece, ctx, raw, lifestealFactor = 1, opts = {}) {
  const { t, player, dummy, events } = ctx;
  // Keep unheal deferred across effect hit + lifesteal heal (game nests under heal).
  player._deferUnhealLog = true;
  dummy._deferUnhealLog = true;
  const res = dealEffectDamage(piece, ctx, raw, {
    critChance: opts.critChance,
    stealLife: true,
  });

  /** @type {number | null} */
  let healId = null;
  if (res.hit) {
    const allocId = ctx.logChain?.nextId?.bind(ctx.logChain) || (() => 0);
    const ls = Number(lifestealFactor);
    const stealBase = Number(res.damage) || 0;
    if (stealBase > 0 && Number.isFinite(ls) && ls > 0) {
      const steal = Math.max(0, Math.round(stealBase * ls));
      if (steal > 0) {
        healActor(player, steal);
        const logged =
          Number(player._lastHeal?.loggedAmount) ||
          requestedHealAmount(player, steal);
        if (logged > 0) {
          if (player._lastHeal) player._lastHeal.meterAttached = true;
          healId = allocId();
          events.push({
            t: t + 0.002,
            type: 'heal',
            actor: player.id,
            target: player.id,
            amount: logged,
            itemId: piece.itemId,
            placementKey: piece.placementKey,
            label: `${piece.name}: lifesteal +${logged}`,
            meta: {
              category: 'heal',
              script: true,
              eventId: healId,
              parentId: res.damageId,
              playerHp: player.hp,
              loggedAmount: logged,
            },
          });
          flushDeferredUnhealLog(player, healId, events);
        }
      }
    }
  }

  player._deferUnhealLog = false;
  dummy._deferUnhealLog = false;

  if (!res.hit) {
    return { hit: false, healthDamage: 0, damage: 0, raw: 0, critical: false, missed: true };
  }
  return {
    hit: true,
    healthDamage: res.healthDamage,
    damage: res.damage,
    raw: res.raw,
    critical: res.critical,
    missed: false,
    damageId: res.damageId,
    healId,
  };
}

/** @type {ScriptHandler} */
export const basicCd = {
  handlerId: 'basic_cd',
  family: 'basic_weapon',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const stam = tryUseStamina(player, piece.staminaCost);
    if (stam === 'starve') {
      events.push({
        t,
        type: 'stamina',
        actor: 'player',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: piece.staminaCost,
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true },
      });
      return true;
    }
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Script: ${piece.name}`,
      meta: { category: 'weapon', script: true, handler: 'basic_cd' },
    });
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    dealHit(piece, ctx, raw);
    return true;
  },
};

/** @type {ScriptHandler} */
export const doubleStrike = {
  handlerId: 'double_strike',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    if (tryUseStamina(player, piece.staminaCost) === 'starve') {
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true },
      });
      return true;
    }
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Script: ${piece.name} (×2)`,
      meta: { category: 'weapon', script: true, handler: 'double_strike' },
    });
    const a = randInt(piece.damageMin, piece.damageMax, rng);
    const b = randInt(piece.damageMin, piece.damageMax, rng);
    dealHit(piece, { ...ctx, t: t + 0.01 }, a, `${piece.name} hit A`);
    dealHit(piece, { ...ctx, t: t + 0.02 }, b, `${piece.name} hit B`);
    return true;
  },
};

/** @type {ScriptHandler} */
/** Legacy family placeholder — does not invent Empower stacks. */
const empowerAura = {
  handlerId: 'empower_aura',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    events.push({
      t,
      type: 'info',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: aura (${links.length} links)`,
      meta: {
        category: 'adjacency',
        script: true,
        handler: 'empower_aura',
        links: links.length,
        approx: true,
      },
    });
  },
  onCooldownEffect: basicCd.onCooldownEffect,
};

/** @type {ScriptHandler} */
const speedAuraDouble = {
  handlerId: 'speed_aura_double',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speedPct = Math.max(1, getP1(piece.params, 15));
    events.push({
      t,
      type: 'buff',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: speedPct,
      label: `${piece.name}: haste aura ${speedPct}% (${links.length} items)`,
      meta: { category: 'adjacency', script: true, handler: 'speed_aura_double' },
    });
  },
  onCooldownEffect: doubleStrike.onCooldownEffect,
};

/** @type {ScriptHandler} */
const startRegen = {
  handlerId: 'start_regen',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const amount = Math.max(1, Math.round(getP1(piece.params, Math.max(3, piece.blockGrant || 4))));
    gainStacks(player, 'regeneration', amount);
    piece.alive = false;
    piece.charges = 0;
    events.push({
      t,
      type: 'buff',
      actor: 'player',
      target: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount,
      label: `${piece.name}: +${amount} Regeneration (consumed)`,
      meta: { category: 'hot', script: true, handler: 'start_regen' },
    });
  },
};

/** @type {ScriptHandler} */
const startMaxHp = {
  handlerId: 'start_max_hp',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const gain = Math.max(15, Math.round(getP1(piece.params, Math.round(player.maxHp * 0.1))));
    player.maxHp += gain;
    player.hp += gain;
    events.push({
      t,
      type: 'heal',
      actor: 'player',
      target: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: gain,
      label: `${piece.name}: +${gain} max HP`,
      meta: {
        category: 'heal',
        script: true,
        handler: 'start_max_hp',
        playerHp: player.hp,
      },
    });
  },
};

/** @type {ScriptHandler} */
const poisonWeapon = {
  handlerId: 'poison_weapon',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    const handled = basicCd.onCooldownEffect?.(piece, ctx);
    if (handled) {
      const amount = Math.max(1, Math.round(getP1(piece.params, 2)));
      gainStacks(ctx.dummy, 'poison', amount, {
        rng: ctx.rng,
        opponent: ctx.player,
      });
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'debuff',
        actor: 'player',
        target: 'dummy',
        amount,
        label: `${piece.name}: +${amount} Poison`,
        meta: { category: 'dot', script: true, handler: 'poison_weapon' },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
const startSpikes = {
  handlerId: 'start_spikes',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const amount = Math.max(1, Math.round(getP1(piece.params, piece.spikes || 4)));
    gainStacks(player, 'spikes', amount);
    if (piece.blockGrant > 0) gainStacks(player, 'block', piece.blockGrant);
    events.push({
      t,
      type: 'buff',
      actor: 'player',
      target: 'player',
      amount,
      label: `${piece.name}: +${amount} Spikes`,
      meta: { category: 'buff', script: true, handler: 'start_spikes' },
    });
  },
};

/** @type {ScriptHandler} */
const petStrike = {
  handlerId: 'pet_strike',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    const { t, events, rng } = ctx;
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Pet: ${piece.name}`,
      meta: { category: 'pet', script: true, handler: 'pet_strike' },
    });
    const raw = randInt(
      Math.max(4, piece.damageMin || 6),
      Math.max(8, piece.damageMax || 10),
      rng,
    );
    dealHit(piece, ctx, raw);
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const HANDLERS = {
  basic_cd: basicCd,
  double_strike: doubleStrike,
  empower_aura: empowerAura,
  speed_aura_double: speedAuraDouble,
  start_regen: startRegen,
  start_max_hp: startMaxHp,
  poison_weapon: poisonWeapon,
  start_spikes: startSpikes,
  pet_strike: petStrike,
};

export const FAMILY_DEFAULT_HANDLER = {
  basic_weapon: 'basic_cd',
  weapon_base: 'basic_cd',
  custom_cd: 'basic_cd',
  synergy_aura: 'empower_aura',
  start_buff: 'start_regen',
  on_hit: 'basic_cd',
  pet_like: 'pet_strike',
  food: 'start_regen',
};
