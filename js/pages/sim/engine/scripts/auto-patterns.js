/**
 * Reusable auto-port patterns for Band I–P reviewed stubs.
 */

import { tryUseStamina } from '../actor.js';
import { gainStacks } from '../stacks.js';
import { getP1 } from '../params.js';
import { affectedTargets } from '../board-graph.js';
import { randInt, rollPercent } from '../rng.js';
import { basicCd, dealHit, HANDLERS } from './handlers.js';
import { PORT_HANDLERS } from './ports.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @param {string} stack */
export function startStack(stack) {
  /** @type {ScriptHandler} */
  return {
    handlerId: `start_${stack}`,
    family: 'start_buff',
    onCombatStart(piece, ctx) {
      const n = Math.max(1, Math.round(getP1(piece.params, 3)));
      if (stack === 'block') gainStacks(ctx.player, 'block', n);
      else gainStacks(ctx.player, /** @type {any} */ (stack), n);
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        target: 'player',
        amount: n,
        itemId: piece.itemId,
        label: `${piece.name}: +${n} ${stack}`,
        meta: { category: 'buff', script: true, handler: piece.itemId, auto: true },
      });
    },
  };
}

/** @param {string} stack @param {'player'|'dummy'} [target] */
export function cdGrant(stack, target = 'player') {
  /** @type {ScriptHandler} */
  return {
    handlerId: `cd_${stack}`,
    family: 'custom_cd',
    onCooldownEffect(piece, ctx) {
      const n = Math.max(1, Math.round(getP1(piece.params, 2)));
      const actor = target === 'dummy' ? ctx.dummy : ctx.player;
      if (stack === 'block') gainStacks(actor, 'block', n);
      else {
        gainStacks(actor, /** @type {any} */ (stack), n, {
          rng: ctx.rng,
          opponent: ctx.player,
        });
      }
      ctx.events.push({
        t: ctx.t,
        type: target === 'dummy' ? 'debuff' : 'buff',
        target,
        amount: n,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${n} ${stack}`,
        meta: {
          category: target === 'dummy' ? 'dot' : 'buff',
          script: true,
          handler: piece.itemId,
          auto: true,
        },
      });
      return true;
    },
  };
}

/** @param {string} stack @param {'player'|'dummy'} [target] */
export function onHitStack(stack, target = 'dummy') {
  /** @type {ScriptHandler} */
  return {
    handlerId: `onhit_${stack}`,
    family: 'on_hit',
    onCooldownEffect(piece, ctx) {
      const { t, player, dummy, events, rng } = ctx;
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
        label: `Script: ${piece.name}`,
        meta: { category: 'weapon', script: true, handler: piece.itemId, auto: true },
      });
      const raw = randInt(piece.damageMin, piece.damageMax, rng);
      const hit = dealHit(piece, ctx, raw);
      if (hit.hit) {
        const chance = piece.chance > 0 ? piece.chance : 100;
        if (chance < 100 && !rollPercent(chance, rng)) return true;
        const n = Math.max(1, Math.round(getP1(piece.params, 1)));
        const actor = target === 'dummy' ? dummy : player;
        gainStacks(actor, /** @type {any} */ (stack), n, {
          rng,
          opponent: player,
        });
        events.push({
          t: t + 0.008,
          type: target === 'dummy' ? 'debuff' : 'buff',
          target,
          amount: n,
          label: `${piece.name}: +${n} ${stack}`,
          meta: {
            category: 'dot',
            script: true,
            handler: piece.itemId,
            auto: true,
          },
        });
      }
      return true;
    },
  };
}

/** @type {ScriptHandler} */
export const weaponPermBonusOnHit = {
  handlerId: 'weapon_perm_bonus_on_hit',
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
      label: `Script: ${piece.name}`,
      meta: { category: 'weapon', script: true, handler: piece.itemId, auto: true },
    });
    const grow = Math.max(1, Math.round(getP1(piece.params, 1)));
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    const hit = dealHit(piece, ctx, raw);
    if (hit.hit) {
      const chance = Number(piece.chance) || 0;
      if (chance > 0 && !rollPercent(chance, rng)) return true;
      piece.damageBonus = (piece.damageBonus || 0) + grow;
      events.push({
        t: t + 0.008,
        type: 'buff',
        label: `${piece.name}: +${grow} permanent dmg`,
        meta: { category: 'buff', script: true, handler: piece.itemId, auto: true },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const precombatLinkDamage = {
  handlerId: 'precombat_link_damage',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const links = affectedTargets(
      ctx.graph,
      piece.placementKey,
      ctx.itemsById,
      ctx.canAffect,
    );
    const per = Math.max(1, Math.round(getP1(piece.params, 2)));
    const bonus = per * Math.max(0, links.length);
    piece.damageBonus = (piece.damageBonus || 0) + bonus;
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      amount: bonus,
      label: `${piece.name}: +${bonus} dmg (${links.length} links)`,
      meta: {
        category: 'adjacency',
        script: true,
        handler: piece.itemId,
        auto: true,
      },
    });
  },
  onCooldownEffect: basicCd.onCooldownEffect,
};

/** @type {ScriptHandler} */
export const auraSpeedOnly = {
  handlerId: 'aura_speed',
  family: 'synergy_aura',
  onCombatStart: PORT_HANDLERS.falcon_blade.onCombatStart,
  onCooldownEffect: basicCd.onCooldownEffect,
};

/** Unknown custom CD — activate pulse so the item is not silent. */
/** @type {ScriptHandler} */
export const cdActivate = {
  handlerId: 'cd_activate',
  family: 'custom_cd',
  onCooldownEffect(piece, ctx) {
    ctx.events.push({
      t: ctx.t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Script: ${piece.name} (approx)`,
      meta: {
        category: 'system',
        script: true,
        handler: piece.itemId,
        auto: true,
        approx: true,
      },
    });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const PATTERNS = {
  basic_cd: HANDLERS.basic_cd,
  double_strike: HANDLERS.double_strike,
  start_regen: HANDLERS.start_regen,
  start_max_hp: HANDLERS.start_max_hp,
  start_spikes: HANDLERS.start_spikes,
  pet_strike: HANDLERS.pet_strike,
  falcon_blade: PORT_HANDLERS.falcon_blade,
  hero_longsword: PORT_HANDLERS.hero_longsword,
  food_heal_stam: PORT_HANDLERS.banana,
  // Resolved via PORT_HANDLERS[id] in auto-ports.js when pattern === 'hand_port'
  hand_port: HANDLERS.basic_cd,
  cd_activate: cdActivate,
  start_vampirism: startStack('vampirism'),
  start_block: startStack('block'),
  start_mana: startStack('mana'),
  start_heat: startStack('heat'),
  start_lucky: startStack('lucky'),
  cd_mana: cdGrant('mana'),
  cd_lucky: cdGrant('lucky'),
  cd_regen: cdGrant('regeneration'),
  cd_heat: cdGrant('heat'),
  cd_cold: cdGrant('cold', 'dummy'),
  cd_poison: cdGrant('poison', 'dummy'),
  weapon_onhit_poison: onHitStack('poison'),
  weapon_onhit_heat: onHitStack('heat'),
  weapon_onhit_blind: onHitStack('blind'),
  weapon_onhit_vampirism: onHitStack('vampirism', 'player'),
  aura_damage: PORT_HANDLERS.hero_longsword,
  aura_speed: auraSpeedOnly,
  weapon_perm_bonus_on_hit: weaponPermBonusOnHit,
  precombat_link_damage: precombatLinkDamage,
};

/**
 * @param {string} itemId
 * @param {string} pattern
 * @returns {ScriptHandler}
 */
export function bindPattern(itemId, pattern) {
  const base = PATTERNS[pattern] || HANDLERS.basic_cd;
  return { ...base, handlerId: itemId };
}
