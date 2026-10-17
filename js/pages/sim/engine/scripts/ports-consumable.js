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
import { giveStamina, healActor, requestedHealAmount } from '../actor.js';
import { affectedTargets, getItemsInside } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import {
  itemHasType,
  pushActivate,
  pushBuffGrants,
  triggerFirstAffectedPotion,
} from './ports-util.js';
import { applyFoodPrepareSpeed } from './food-helpers.js';
import { changeReflectStacks } from '../actor-stats.js';
import { modifiedParamValue } from '../placement-instance.js';
import { eventSideForPiece } from '../vs-board.js';
import { recordPieceMod } from '../stat-mods.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

/** @type {ScriptHandler} */
export const sliceOfBreadPort = {
  handlerId: 'slice_of_bread',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const th = modifiedParamValue(
      piece,
      getPName(piece.params, 'staminat', getP1(piece.params, 2.5)),
      'staminat',
    );
    if ((Number(player.stamina) || 0) < th) {
      const stam = modifiedParamValue(
        piece,
        getPName(piece.params, 'stamina', getP2(piece.params, 0.5)),
        'stamina',
      );
      const before = Number(player.stamina) || 0;
      giveStamina(player, stam);
      const gained = (Number(player.stamina) || 0) - before;
      if (gained > 0) {
        events.push({
          t: t + 0.004,
          type: 'stamina',
          target: 'player',
          amount: gained,
          label: `${piece.name}: +${gained} stamina`,
          meta: { category: 'stamina', script: true, handler: 'slice_of_bread' },
        });
      }
    }
    pushActivate(piece, ctx, 'slice_of_bread', `Food: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const heavyDrinkingPort = {
  handlerId: 'heavy_drinking',
  family: 'unique',
  onPrepare(piece, ctx) {
    const { pieces, itemsById } = ctx;
    const potions = (pieces || []).filter(
      (p) =>
        p.placementKey !== piece.placementKey &&
        eventSideForPiece(p) === eventSideForPiece(piece) &&
        itemHasType(itemsById.get(p.itemId), 'potion'),
    );
    piece._drinkPotions = potions.map((p) => p.placementKey);
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const links = affectedTargets(ctx.graph, piece.placementKey, itemsById, ctx.canAffect);
    const affectedPotionCount = links.filter((link) =>
      itemHasType(itemsById.get(link.id), 'potion'),
    ).length;
    if (affectedPotionCount && speed) addSpeed(piece, affectedPotionCount * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, pieces, rng } = ctx;
    const keys = piece._drinkPotions || [];
    if (keys.length) {
      const key = keys[Math.floor(rng() * keys.length)];
      const potion = (pieces || []).find((p) => p.placementKey === key);
      if (potion) {
        // Potion.triggerPotion() applies the effect without consuming the
        // potion or advancing its cooldown. The per-potion callback is the
        // simulator's source-shaped equivalent of that API.
        if (typeof potion._potionTrigger === 'function') {
          potion._potionTrigger({ ...ctx, t });
          events.push({
            t: t + 0.004,
            type: 'info',
            actor: eventSideForPiece(potion),
            itemId: potion.itemId,
            placementKey: potion.placementKey,
            label: `${potion.name}: mini activate`,
            meta: {
              category: 'system',
              script: true,
              handler: 'heavy_drinking',
              miniActivate: true,
              triggeredBy: piece.itemId,
            },
          });
        }
      }
    }
    // HeavyDrinking.gd calls activate() after triggerPotion()/miniActivate().
    pushActivate(piece, ctx, 'heavy_drinking', `Skill: ${piece.name}`);
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
  onPreCombatStart(piece, ctx) {
    const n = linked(ctx, piece).filter((o) => {
      const rarity = String(ctx.itemsById.get(o.itemId)?.rarity || '').toLowerCase();
      return rarity === 'legendary' || rarity === 'godly';
    }).length;
    changeReflectStacks(
      ctx.player,
      n * getP2(piece.params, 2),
      ctx,
      piece,
    );
    pushActivate(piece, ctx, 'platin_customer_card', `Card: ${piece.name}`);
  },
  onCombatStart(piece, ctx) {
    // PlatinCustomerCard.gd intentionally leaves onCombatStart empty.
  },
};

/** @type {ScriptHandler} */
function sandbagParams(piece) {
  return {
    damageResistance: getP1(piece.params, 0),
    duration: getPName(piece.params, 'dur', getP2(piece.params, 0)),
    blind: getPName(piece.params, 'blind', getP3(piece.params, 0)),
  };
}

function armSandbagResistance(actor, pct, untilT, tag) {
  const list = actor._timedResists || (actor._timedResists = []);
  const existing = list.find((entry) => entry.tag === tag);
  if (existing) {
    existing.untilT = untilT;
    return;
  }
  if (Number(pct) || 0) {
    grantTimedResistancePct(actor, pct, untilT, tag);
  } else {
    list.push({ pct: 0, untilT, tag });
  }
}

function finishSandbag(piece, ctx, tag, endedTag) {
  if (endedTag !== tag || piece._sandbagEnded) return;
  piece._sandbagEnded = true;
  piece._sandbagBuffsActive = 0;
  ctx.player._sandbagActive = false;
}

function bindSandbagExpiry(actor, piece, ctx, tag) {
  const previous = actor._onTimedResistEnd;
  actor._onTimedResistEnd = (endedTag, entry) => {
    previous?.(endedTag, entry);
    finishSandbag(piece, ctx, tag, endedTag);
  };
}

export const sandbagPort = {
  handlerId: 'sandbag',
  family: 'consumable',
  onPrepare(piece) {
    piece._sandbagBuffsActive = 0;
    piece._sandbagEnded = false;
  },
  onPreCombatStart(piece, ctx) {
    const { player, dummy, t } = ctx;
    const { damageResistance, duration } = sandbagParams(piece);
    const tag = piece._sandbagTag || `sandbag:${piece.placementKey}`;
    const untilT = t + duration;
    piece._sandbagTag = tag;
    piece._sandbagUntil = untilT;
    if (!player._sandbagActive) {
      player._sandbagActive = true;
      piece._sandbagBuffsActive = 1;
      armSandbagResistance(player, damageResistance, untilT, tag);
      armSandbagResistance(dummy, damageResistance, untilT, tag);
      bindSandbagExpiry(player, piece, ctx, tag);
      bindSandbagExpiry(dummy, piece, ctx, tag);
    } else if (piece._sandbagBuffsActive > 0) {
      armSandbagResistance(player, damageResistance, untilT, tag);
      armSandbagResistance(dummy, damageResistance, untilT, tag);
    }
  },
  onCombatStart(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    const { blind } = sandbagParams(piece);
    const origin = { originKey: piece.placementKey, originId: piece.itemId };
    const opponentGrant = grantStacks(dummy, 'blind', blind, { ...origin, rng, opponent: player });
    const ownerGrant = grantStacks(player, 'blind', blind, origin);
    if (opponentGrant.gained > 0) {
      pushBuffGrants(events, piece, player, t, 'sandbag', { blind: opponentGrant.gained }, 0.002, 'dummy');
    }
    if (ownerGrant.gained > 0) {
      pushBuffGrants(events, piece, player, t, 'sandbag', { blind: ownerGrant.gained }, 0.004, 'player');
    }
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
  onPrepare(piece, ctx) {
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
  onPrepare(piece, ctx) {
    applyFoodPrepareSpeed(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const healAmt = getPName(piece.params, 'heal', getP1(piece.params, 8));
    const healed = healActor(player, healAmt);
    if (healed > 0 || (player._lastHeal && !player._lastHeal.meterAttached)) {
      const logged = Number(player._lastHeal?.loggedAmount) || healed;
      if (player._lastHeal) player._lastHeal.meterAttached = true;
      events.push({
        t: t + 0.002,
        type: 'heal',
        target: 'player',
        amount: logged,
        label: `${piece.name}: heal +${logged}`,
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
    // Pineapple.gd calls activate(), not consume(); it remains a cooldown Food.
    pushActivate(piece, ctx, 'pineapple', `Food: ${piece.name}`);
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

/** LuckyPiggy.gd — prepare multiplicative chance; start Lucky + activate. */
/** @type {ScriptHandler} */
export const luckyPiggyPort = {
  handlerId: 'lucky_piggy',
  family: 'unique',
  onPrepare(piece, ctx) {
    const bonus = getP3(piece.params, 0);
    if (!bonus) return;
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    for (const other of ctx.pieces || []) {
      if (!links.some((link) => link.key === other.placementKey)) continue;
      const item = ctx.itemsById.get(other.itemId);
      if (!(Number(other.chance ?? item?.chance) > 0)) continue;
      other.bonusChanceMult = (Number(other.bonusChanceMult) || 0) + bonus;
      recordPieceMod(other, { stat: 'chance', amount: bonus / 100, unit: 'factor' });
    }
  },
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const luck = getP2(piece.params, 0);
    grantStacks(player, 'lucky', luck, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (luck > 0) {
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
    }
    pushActivate(piece, ctx, 'lucky_piggy', `Accessory: ${piece.name}`);
  },
};

/** ProtectivePurse.gd — start Block (bag power). */
/** @type {ScriptHandler} */
export const protectivePursePort = {
  handlerId: 'protective_purse',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const purseCatalog = ctx.itemsById.get(piece.itemId);
    let block = Math.max(
      0,
      Math.round(Number(piece.blockGrant) || Number(purseCatalog?.block) || getPName(piece.params, 'block', getP1(piece.params, 0))),
    );
    const bagtacular = (ctx.pieces || []).find(
      (other) => other.itemId === 'bagtacular' && other.alive !== false,
    );
    if (bagtacular) {
      const catalog = ctx.itemsById.get('bagtacular');
      block += Math.max(
        0,
        Math.round(getPName(bagtacular.params || catalog?.params, 'block', getP1(bagtacular.params || catalog?.params, 0))),
      );
    }
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
    // ProtectivePurse.gd calls activate() even though this bag has no combat
    // cooldown; record the source visual event without pushActivate's bag guard.
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Bag: ${piece.name}`,
      meta: { category: 'bag', script: true, handler: 'protective_purse' },
    });
  },
};

/** Holdall.gd — start Block × items inside. */
/** @type {ScriptHandler} */
export const holdallPort = {
  handlerId: 'holdall',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById } = ctx;
    const inside = getItemsInside(graph, piece.placementKey).filter((key) => {
      const target = graph.pieces.get(key);
      return String(itemsById.get(target?.id)?.class || 'Neutral') === 'Neutral';
    });
    const catalog = itemsById.get(piece.itemId);
    const rawBlock = piece.block != null ? piece.block : catalog?.block;
    const block = Math.max(0, Math.round(Number(rawBlock) || 0)) * inside.length;
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
    pushActivate(piece, ctx, 'holdall', `Bag: ${piece.name}`, { force: true });
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
    0,
    modifiedParamValue(
      piece,
      getPName(piece.params, 'heal', getP2(piece.params, withRegen ? 24 : 12)),
      'heal',
    ),
  );
  const cleanse = Math.max(
    0,
    Math.round(getPName(piece.params, 'cleanse', getP3(piece.params, 4))),
  );
  const regen = withRegen
    ? Math.max(0, Math.round(getPName(piece.params, 'regen', getP4(piece.params, 3))))
    : 0;
  const applyEffect = (t) => {
    const player = ctx.player;
    healActor(player, healAmt);
    const logged = requestedHealAmount(player, healAmt);
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
        cleanse: true,
        rng: ctx.rng,
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
  };
  piece._potionTrigger = ({ t = ctx.t } = {}) => applyEffect(t);
  ctx.bus?.on?.('character_damaged', (payload) => {
    if (payload?.actor && payload.actor !== ctx.player) return;
    if (!piece.alive || piece.charges === 0) return;
    const player = ctx.player;
    const rel = player.maxHp > 0 ? player.hp / player.maxHp : 1;
    if (rel >= th) return;
    const t = payload.t ?? ctx.t;
    // Potion.consumePotion empties first, so effects or linked callbacks cannot
    // re-enter this potion while the source trigger chain is running.
    piece.alive = false;
    piece.charges = 0;
    applyEffect(t);
    triggerFirstAffectedPotion(piece, ctx, t);
    ctx.bus?.emit?.('potion_emptied', { piece, t });
    pushActivate(piece, { ...ctx, t }, handler, `Potion: ${piece.name}`, { consume: true });
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
  // HealthPotion.gd connects during onPrepare, before any combat-start item
  // can damage the owner (Dark Lantern is the important case).
  onPrepare(piece, ctx) {
    bindHealthPotionDrink(piece, ctx, false);
  },
};

/** StrongHealthPotion.gd — same drink + getP4 Regeneration. */
/** @type {ScriptHandler} */
export const strongHealthPotionPort = {
  handlerId: 'strong_health_potion',
  family: 'consumable',
  deferStartActivate: true,
  onPrepare(piece, ctx) {
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
