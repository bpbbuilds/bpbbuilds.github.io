/**
 * Band AI Wave A — food / potion deepenings that outgrew theme port files.
 */

import {
  grantStacks,
  giveRandomBuffs,
  grantTemporaryStacks,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { healActor } from '../actor.js';
import { dealDamage } from '../damage.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { itemHasType, afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * BowlOfTreats.gd — onPrepare: pets get doubleActivationChance; CD: random buffs + pet speed.
 * @type {ScriptHandler}
 */
export const bowlOfTreatsPort = {
  handlerId: 'bowl_of_treats',
  family: 'food',
  onCombatStart(piece, ctx) {
    piece._bowlSpeedGiven = 0;
    const chance = Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 0;
    if (!(chance > 0)) return;
    const { pieces, itemsById } = ctx;
    for (const other of pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      const typ = String(itemsById.get(other.itemId)?.type || '').toLowerCase();
      if (!(other.kind === 'pet' || typ.includes('pet'))) continue;
      other.doubleActivationChance =
        (Number(other.doubleActivationChance) || 0) + chance / 100;
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng, graph, itemsById, canAffect, pieces } = ctx;
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Food: ${piece.name}`,
      meta: { category: 'consumable', script: true, handler: 'bowl_of_treats' },
    });
    const num = Math.max(1, Math.round(getP1(piece.params, 2)));
    const picked = giveRandomBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'bowl_of_treats', picked);

    const given = Number(piece._bowlSpeedGiven) || 0;
    const step = getPName(piece.params, 'foodspeed', getP2(piece.params, 25)) / 100;
    const maxBonus = getP3(piece.params, 100) / 100;
    if (given < maxBonus && step > 0) {
      const cur = Math.min(step, maxBonus - given);
      const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
      for (const link of links) {
        const other = (pieces || []).find((p) => p.placementKey === link.key);
        if (!other) continue;
        const typ = String(itemsById.get(other.itemId)?.type || '').toLowerCase();
        if (!(other.kind === 'pet' || typ.includes('pet'))) continue;
        addSpeed(other, cur);
      }
      piece._bowlSpeedGiven = given + cur;
    }
    return true;
  },
};

/**
 * HeroicPotion.gd — character_pre_use_stamina: if starving, consume → stamina + empower.
 * @type {ScriptHandler}
 */
export const heroicPotionPort = {
  handlerId: 'heroic_potion',
  family: 'consumable',
  /** Skip items-live / CD activate — wait for stamina starvation. */
  deferStartActivate: true,
  onCombatStart(piece, ctx) {
    // Keep out of the CD loop even if catalog lists a cooldown.
    if (piece.cooldown > 0 && piece.cooldown < 500) {
      piece.cooldown = 999;
      piece.triggerTime = 999;
    }
    ctx.bus?.on?.('pre_use_stamina', (payload) => {
      if (!piece.alive || piece.charges === 0) return;
      const amount = Number(payload?.amount) || 0;
      if (!(amount > 0)) return;
      const player = ctx.player;
      if ((Number(player.stamina) || 0) + 1e-9 >= amount) return;
      triggerHeroicPotion(piece, ctx, payload?.t ?? ctx.t);
    });
  },
  onCooldownEffect(piece, ctx) {
    triggerHeroicPotion(piece, ctx, ctx.t);
    return true;
  },
};

/**
 * @param {object} piece
 * @param {import('./handlers.js').ScriptCtx} ctx
 * @param {number} t
 */
function triggerHeroicPotion(piece, ctx, t) {
  if (!piece.alive || piece.charges === 0) return;
  const stam = Math.max(1, Math.round(getP1(piece.params, 4)));
  const emp = Math.max(1, Math.round(getP2(piece.params, 2)));
  const player = ctx.player;
  player.stamina = Math.min(player.maxStamina || 20, (player.stamina || 0) + stam);
  grantStacks(player, 'empower', emp, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  piece.alive = false;
  piece.charges = 0;
  ctx.events.push({
    t: t + 0.001,
    type: 'stamina',
    target: 'player',
    amount: stam,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name}: +${stam} stamina`,
    meta: { category: 'stamina', script: true, handler: 'heroic_potion' },
  });
  ctx.events.push({
    t: t + 0.002,
    type: 'buff',
    target: 'player',
    amount: emp,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name}: +${emp} Empower`,
    meta: { category: 'buff', stack: 'empower', script: true, handler: 'heroic_potion' },
  });
  ctx.events.push({
    t: t + 0.003,
    type: 'info',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name} consumed`,
    meta: { category: 'consumable', script: true, handler: 'heroic_potion' },
  });
}

/** LightningPotion.gd — CD consume: effect damage + temp Blind + heal × holy secondary. */
/** @type {ScriptHandler} */
export const lightningPotionPort = {
  handlerId: 'lightning_potion',
  family: 'custom_cd',
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng, graph, itemsById, canAffect } = ctx;
    pushActivate(piece, ctx, 'lightning_potion', `Potion: ${piece.name}`);

    const dam = Math.max(
      1,
      Math.round(piece.damageMin || getPName(piece.params, 'dam', getP1(piece.params, 5))),
    );
    const res = dealDamage(player, dummy, {
      amount: dam,
      canMiss: false,
      canCrit: false,
      isAttack: false,
      nowT: t,
      rng,
    });
    events.push({
      t: t + 0.003,
      type: 'damage',
      actor: 'player',
      target: 'dummy',
      amount: res.healthDamage,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: ${res.healthDamage} effect dmg`,
      meta: {
        category: 'damage',
        script: true,
        handler: 'lightning_potion',
        effect: true,
        dummyHp: dummy.hp,
      },
    });

    const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', getP2(piece.params, 2))));
    const dur = Math.max(0.5, getPName(piece.params, 'dur_blind', getP3(piece.params, 3)));
    grantTemporaryStacks(dummy, 'blind', blind, dur, t, {
      rng,
      opponent: player,
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'debuff',
      target: 'dummy',
      amount: blind,
      label: `${piece.name}: +${blind} Blind (${dur}s)`,
      meta: {
        category: 'debuff',
        stack: 'blind',
        script: true,
        handler: 'lightning_potion',
        temp: true,
        duration: dur,
      },
    });

    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let holy = 0;
    for (const link of links) {
      if (link.color !== 'secondary') continue;
      if (itemHasType(itemsById.get(link.id), 'holy')) holy += 1;
    }
    const healPer = Math.max(0, Math.round(getPName(piece.params, 'heal', 4)));
    if (holy > 0 && healPer > 0) {
      const healed = healActor(player, healPer * holy);
      if (healed > 0) {
        events.push({
          t: t + 0.005,
          type: 'heal',
          target: 'player',
          amount: healed,
          label: `${piece.name}: +${healed} HP (${holy} holy)`,
          meta: { category: 'heal', script: true, handler: 'lightning_potion' },
        });
      }
    }

    afterEffectFinished(piece, ctx, 'lightning_potion', { activate: false });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AI_A_PORTS = {
  bowl_of_treats: bowlOfTreatsPort,
  heroic_potion: heroicPotionPort,
  lightning_potion: lightningPotionPort,
};
