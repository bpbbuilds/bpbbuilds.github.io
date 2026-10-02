/**
 * Band Y Phase 143 — consumables still on activate.
 * Wave A: cupcake / pineapple / flame / lucky_piggy / protective_purse / holdall.
 */

import {
  giveMostBuffs,
  giveRandomBuffs,
  grantStacks,
  spendStacks,
} from '../buff-economy.js';
import { healActor, requestedHealAmount } from '../actor.js';
import { affectedTargets, getItemsInside } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { getScriptHandler } from './registry.js';
import { applyFoodPrepareSpeed, markFoodConsumed } from './food-helpers.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const sliceOfBreadPort = {
  handlerId: 'slice_of_bread',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'slice_of_bread', `Food: ${piece.name}`);
    const th = Math.max(1, Math.round(getPName(piece.params, 'staminat', getP1(piece.params, 5))));
    if ((Number(player.stamina) || 0) < th) {
      const stam = Math.max(1, Math.round(getPName(piece.params, 'stamina', getP2(piece.params, 3))));
      player.stamina = Math.min(player.maxStamina || 20, (player.stamina || 0) + stam);
      events.push({
        t: t + 0.004,
        type: 'stamina',
        target: 'player',
        amount: stam,
        label: `${piece.name}: +${stam} stamina`,
        meta: { category: 'stamina', script: true, handler: 'slice_of_bread' },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const heavyDrinkingPort = {
  handlerId: 'heavy_drinking',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { pieces, itemsById } = ctx;
    const potions = (pieces || []).filter(
      (p) =>
        p.placementKey !== piece.placementKey &&
        itemHasType(itemsById.get(p.itemId), 'potion'),
    );
    piece._drinkPotions = potions.map((p) => p.placementKey);
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    if (potions.length && speed) addSpeed(piece, potions.length * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, pieces, rng } = ctx;
    pushActivate(piece, ctx, 'heavy_drinking', `Skill: ${piece.name}`);
    const keys = piece._drinkPotions || [];
    if (keys.length) {
      const key = keys[Math.floor(rng() * keys.length)];
      const potion = (pieces || []).find((p) => p.placementKey === key);
      if (potion) {
        const h = getScriptHandler(potion.itemId);
        if (h?.onCooldownEffect) h.onCooldownEffect(potion, ctx);
        events.push({
          t: t + 0.004,
          type: 'info',
          label: `${piece.name}: trigger ${potion.name}`,
          meta: { category: 'system', script: true, handler: 'heavy_drinking' },
        });
      }
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const noRushPleasePort = {
  handlerId: 'no_rush_please',
  family: 'consumable',
  onCombatStart(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    const cold = Math.max(1, Math.round(getPName(piece.params, 'cold', getP1(piece.params, 2))));
    gainStacks(dummy, 'cold', cold, { rng, opponent: player });
    events.push({
      t,
      type: 'debuff',
      target: 'dummy',
      amount: cold,
      label: `${piece.name}: +${cold} Cold`,
      meta: { category: 'debuff', stack: 'cold', script: true, handler: 'no_rush_please' },
    });
    pushActivate(piece, ctx, 'no_rush_please', `Skill: ${piece.name}`);
  },
};

/** Platin Customer Card — shop-only; mark activate so not stub. */
/** @type {ScriptHandler} */
export const platinCustomerCardPort = {
  handlerId: 'platin_customer_card',
  family: 'unique',
  onCombatStart(piece, ctx) {
    pushActivate(piece, ctx, 'platin_customer_card', `Card: ${piece.name}`);
  },
};

/** @type {ScriptHandler} */
export const sandbagPort = {
  handlerId: 'sandbag',
  family: 'consumable',
  onCombatStart(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', getP1(piece.params, 2))));
    gainStacks(dummy, 'blind', blind, { rng, opponent: player });
    gainStacks(player, 'blind', blind);
    events.push({
      t,
      type: 'debuff',
      target: 'dummy',
      amount: blind,
      label: `${piece.name}: +${blind} Blind both`,
      meta: { category: 'debuff', stack: 'blind', script: true, handler: 'sandbag' },
    });
    pushActivate(piece, ctx, 'sandbag', `Skill: ${piece.name}`);
  },
};

/** @type {ScriptHandler} */
export const evilHatPort = {
  handlerId: 'evil_hat',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    pushActivate(piece, ctx, 'evil_hat', `Accessory: ${piece.name}`);
    const selfN = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP1(piece.params, 2))));
    const oppN = Math.max(1, Math.round(getPName(piece.params, 'buffs2', getP2(piece.params, 1))));
    const selfPicked = giveRandomBuffs(player, selfN, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'evil_hat', selfPicked);
    const oppPicked = giveRandomBuffs(dummy, oppN, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'evil_hat', oppPicked, 0.01, 'dummy');
    return true;
  },
};

/**
 * Cupcake.gd + Food.gd prepare —
 * prepare: +10% speed per food link; CD: heal() → giveMostBuffs(buffs) → activate().
 */
/** @type {ScriptHandler} */
export const cupcakePort = {
  handlerId: 'cupcake',
  family: 'food',
  onCombatStart(piece, ctx) {
    applyFoodPrepareSpeed(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    // Game heal() → getP_m("heal") (catalog heal = 10).
    const healAmt = Math.max(
      1,
      Math.round(getPName(piece.params, 'heal', getP1(piece.params, 10))),
    );
    const healed = healActor(player, healAmt);
    if (healed > 0 || (player._lastHeal && !player._lastHeal.meterAttached)) {
      const logged = Number(player._lastHeal?.loggedAmount) || healed;
      if (player._lastHeal) player._lastHeal.meterAttached = true;
      events.push({
        t: t + 0.002,
        type: 'heal',
        actor: 'player',
        target: 'player',
        amount: logged,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: heal +${logged}`,
        meta: { category: 'heal', script: true, handler: 'cupcake', playerHp: player.hp },
      });
    }
    // Game giveMostBuffs(numBuffs) — Item.giveStacks(..., self).
    const n = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP2(piece.params, 2))));
    const picked = giveMostBuffs(player, n, rng, {
      piece,
      originKey: piece.placementKey,
      originId: piece.itemId,
      t,
      silentLog: true,
    });
    pushBuffGrants(events, piece, player, t, 'cupcake', picked, 0.004);
    pushActivate(piece, ctx, 'cupcake', `Food: ${piece.name}`);
    return true;
  },
};

/** Pineapple.gd — heal + 1 Spikes. */
/** @type {ScriptHandler} */
export const pineapplePort = {
  handlerId: 'pineapple',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'pineapple', `Food: ${piece.name}`);
    const healAmt = Math.max(1, Math.round(getPName(piece.params, 'heal', getP1(piece.params, 8))));
    const healed = healActor(player, healAmt);
    if (healed > 0) {
      events.push({
        t: t + 0.002,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: heal +${healed}`,
        meta: { category: 'heal', script: true, handler: 'pineapple', playerHp: player.hp },
      });
    }
    const g = gainStacks(player, 'spikes', 1);
    if (g.gained > 0) {
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: g.gained,
        label: `${piece.name}: +${g.gained} Spikes`,
        meta: { category: 'buff', stack: 'spikes', script: true, handler: 'pineapple' },
      });
    }
    markFoodConsumed(piece, ctx, 'pineapple');
    return true;
  },
};

/** Flame.gd — start +1 Heat, consume. */
/** @type {ScriptHandler} */
export const flamePort = {
  handlerId: 'flame',
  family: 'consumable',
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'heat', 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushActivate(piece, ctx, 'flame', `${piece.name}`);
    piece.alive = false;
    piece.charges = 0;
  },
};

/** LuckyPiggy.gd — start Lucky; bump chance on affectable neighbors. */
/** @type {ScriptHandler} */
export const luckyPiggyPort = {
  handlerId: 'lucky_piggy',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP2(piece.params, 1))));
    grantStacks(player, 'lucky', luck, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const bonus = Math.max(
      0,
      Number(getPName(piece.params, 'chance', getP3(piece.params, 0))) || 0,
    );
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (bonus && other.chance != null) {
        other.chance = Math.min(100, (Number(other.chance) || 0) + bonus);
      }
    }
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: luck,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${luck} Lucky`,
      meta: { category: 'buff', stack: 'lucky', script: true, handler: 'lucky_piggy' },
    });
  },
};

/** ProtectivePurse.gd — start Block (bag power). */
/** @type {ScriptHandler} */
export const protectivePursePort = {
  handlerId: 'protective_purse',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 8)));
    gainStacks(player, 'block', block);
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'protective_purse' },
    });
  },
};

/** Holdall.gd — start Block × items inside. */
/** @type {ScriptHandler} */
export const holdallPort = {
  handlerId: 'holdall',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph } = ctx;
    const inside = getItemsInside(graph, piece.placementKey);
    const per = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 4)));
    const block = per * inside.length;
    if (block <= 0) return;
    gainStacks(player, 'block', block);
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${block} Block (${inside.length} inside)`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'holdall' },
    });
  },
};

/**
 * HealthPotion.gd / StrongHealthPotion.gd — drink at HP threshold.
 * Strong: also giveRegeneration(getP4()).
 * @param {import('../pieces.js').CombatPiece} piece
 * @param {import('./handlers.js').ScriptCtx} ctx
 * @param {boolean} withRegen
 */
function bindHealthPotionDrink(piece, ctx, withRegen) {
  const handler = withRegen ? 'strong_health_potion' : 'health_potion';
  const th = getPName(piece.params, 'p1', getP1(piece.params, 50)) / 100;
  const healAmt = Math.max(
    1,
    Math.round(getPName(piece.params, 'heal', getP2(piece.params, withRegen ? 24 : 12))),
  );
  const cleanse = Math.max(
    0,
    Math.round(getPName(piece.params, 'cleanse', getP3(piece.params, 4))),
  );
  const regen = withRegen
    ? Math.max(0, Math.round(getPName(piece.params, 'regen', getP4(piece.params, 3))))
    : 0;
  ctx.bus?.on?.('player_damaged', (payload) => {
    if (!piece.alive || piece.charges === 0) return;
    if (!payload?.hit || !(payload.healthDamage > 0)) return;
    const player = ctx.player;
    const rel = player.maxHp > 0 ? player.hp / player.maxHp : 1;
    if (rel >= th - 1e-9) return;
    const t = payload.t ?? ctx.t;
    healActor(player, healAmt);
    const logged = requestedHealAmount(player, healAmt);
    pushActivate(piece, { ...ctx, t }, handler, `Potion: ${piece.name}`, { consume: true });
    ctx.events.push({
      t: t + 0.001,
      type: 'heal',
      target: 'player',
      amount: logged || healAmt,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: heal ${healAmt}`,
      meta: { category: 'heal', script: true, handler },
    });
    if (regen > 0) {
      grantStacks(player, 'regeneration', regen, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      ctx.events.push({
        t: t + 0.0015,
        type: 'buff',
        target: 'player',
        amount: regen,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${regen} Regeneration`,
        meta: { category: 'buff', script: true, handler, stack: 'regeneration' },
      });
    }
    if (cleanse > 0) {
      const spent = spendStacks(player, 'poison', cleanse, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (spent?.spent > 0) {
        ctx.events.push({
          t: t + 0.002,
          type: 'info',
          label: `${piece.name}: cleanse ${spent.spent} Poison`,
          meta: { category: 'system', script: true, handler },
        });
      }
    }
    piece.alive = false;
    piece.charges = 0;
    ctx.bus?.emit?.('potion_emptied', { piece, t });
    ctx.events.push({
      t: t + 0.003,
      type: 'info',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name} consumed`,
      meta: { category: 'consumable', script: true, handler },
    });
  });
}

/** HealthPotion.gd — on damaged, if HP < p1% consume: heal + cleanse poison. */
/** @type {ScriptHandler} */
export const healthPotionPort = {
  handlerId: 'health_potion',
  family: 'consumable',
  /** Skip items-live activatePiece — wait for HP threshold. */
  deferStartActivate: true,
  onCombatStart(piece, ctx) {
    bindHealthPotionDrink(piece, ctx, false);
  },
};

/** StrongHealthPotion.gd — same drink + getP4 Regeneration. */
/** @type {ScriptHandler} */
export const strongHealthPotionPort = {
  handlerId: 'strong_health_potion',
  family: 'consumable',
  deferStartActivate: true,
  onCombatStart(piece, ctx) {
    bindHealthPotionDrink(piece, ctx, true);
  },
};

/** @type {Record<string, ScriptHandler>} */
export const CONSUMABLE_PORTS = {
  slice_of_bread: sliceOfBreadPort,
  heavy_drinking: heavyDrinkingPort,
  no_rush_please: noRushPleasePort,
  platin_customer_card: platinCustomerCardPort,
  sandbag: sandbagPort,
  evil_hat: evilHatPort,
  cupcake: cupcakePort,
  pineapple: pineapplePort,
  flame: flamePort,
  lucky_piggy: luckyPiggyPort,
  protective_purse: protectivePursePort,
  holdall: holdallPort,
  health_potion: healthPotionPort,
  strong_health_potion: strongHealthPotionPort,
};
