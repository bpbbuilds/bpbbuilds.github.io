/**
 * Band AK — combat bags (shop/storage bags stay noops — Phase 267).
 */

import { applyHealEfficiency, applyStaminaRegeneration } from '../actor-stats.js';
import { startBattleRage } from '../battle-rage.js';
import {
  BUFF_KEYS,
  cleanseRandomDebuffs,
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
} from '../buff-economy.js';
import { gainStacks } from '../stacks.js';
import { getItemsInside } from '../board-graph.js';
import { canEmitCharge, reEmitCharge } from '../charge-delivery.js';
import { gainMaxStaminaTemporary } from '../actor.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addEffectDurationFactor } from '../effect-duration.js';
import { addSpeed } from '../piece-stats.js';
import { rollItemChance } from '../chance.js';
import { isBagLike } from '../item-kind.js';
import {
  canBagAffectItem,
  hasInventoryDuration,
} from '../../../../shared/backpack-grid/can-affect.js';
import { itemHasType, pieceHasCombatCooldown, pushActivate, pushBuffGrants } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function insides(ctx, piece) {
  const keys = getItemsInside(ctx.graph, piece.placementKey);
  return (ctx.pieces || []).filter((p) => keys.includes(p.placementKey));
}

function hasBagtacular(ctx) {
  return (ctx.pieces || []).some((p) => p.itemId === 'bagtacular' && p.alive !== false);
}

/** StaminaSack.gd — +1 max stamina per sack in inventory; Bagtacular → regen in onPrepare. */
/** @type {ScriptHandler} */
export const staminaSackPort = {
  handlerId: 'stamina_sack',
  family: 'unique',
  onPrepare(piece, ctx) {
    if (!hasBagtacular(ctx)) return;
    const bag = ctx.itemsById.get('bagtacular');
    const pct =
      getPName(bag?.params, 'stamina', getPName(bag?.params, 'p2', 7)) / 100;
    if (pct) applyStaminaRegeneration(ctx.player, pct, ctx, piece);
  },
};

/** VineweaveBasket.gd — healing efficiency from insides (shop sales OOS). */
/** @type {ScriptHandler} */
export const vineweaveBasketPort = {
  handlerId: 'vineweave_basket',
  family: 'unique',
  onPrepare(piece, ctx) {
    const nature = insides(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'nature'),
    ).length;
    const amp =
      getPName(piece.params, 'healamp', 8) / 100 +
      (getPName(piece.params, 'ampbonus', 2) / 100) * nature;
    if (amp) applyHealEfficiency(ctx.player, amp, ctx, piece);
  },
};

/** PotionBelt.gd — linked potions: first buff, fourth cleanse, Bagtacular bonus. */
/** @type {ScriptHandler} */
export const potionBeltPort = {
  handlerId: 'potion_belt',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._beltN = 0;
    const byKey = new Map((ctx.pieces || []).map((other) => [other.placementKey, other]));
    piece._beltPotionKeys = new Set(
      getItemsInside(ctx.graph, piece.placementKey).filter((key) => {
        const other = byKey.get(key);
        return itemHasType(ctx.itemsById.get(other?.itemId), 'potion');
      }),
    );
    ctx.bus?.on?.('potion_emptied', (payload) => {
      const emptiedKey = payload?.piece?.placementKey;
      if (!emptiedKey || !piece._beltPotionKeys?.has(emptiedKey)) return;
      piece._beltN = (Number(piece._beltN) || 0) + 1;
      let buffs = 0;
      let active = false;
      if (piece._beltN === 1) buffs = 1;
      if (piece._beltN === 1) active = true;
      if (piece._beltN === 4) {
        cleanseRandomDebuffs(
          ctx.player,
          Math.trunc(getPName(piece.params, 'cleanse', getPName(piece.params, 'p1', 0))),
          ctx.rng,
        );
        active = true;
      }
      if (hasBagtacular(ctx)) {
        const bag = ctx.pieces?.find((p) => p.itemId === 'bagtacular' && p.alive !== false);
        const catalog = ctx.itemsById.get('bagtacular');
        buffs += Math.trunc(getPName(bag?.params || catalog?.params, 'buffs', getP3(catalog?.params, 0)));
        active = true;
      }
      if (buffs) {
        giveRandomBuffs(ctx.player, buffs, ctx.rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
      if (active) {
        pushActivate(
          piece,
          { ...ctx, t: Number(payload?.t) || ctx.t },
          'potion_belt',
          `Bag: ${piece.name}`,
          { force: true },
        );
      }
    });
  },
};

/** RangerBag.gd — crit% on damaging insides; lucky → more crit. */
/** @type {ScriptHandler} */
export const rangerBagPort = {
  handlerId: 'ranger_bag',
  family: 'unique',
  onPrepare(piece, ctx) {
    const catalog = ctx.itemsById.get(piece.itemId);
    const crit =
      catalog?.chance != null && Number.isFinite(Number(catalog.chance))
        ? Number(catalog.chance)
        : piece.chance != null && Number.isFinite(Number(piece.chance))
          ? Number(piece.chance)
          : 0;
    const perLuck =
      catalog?.chance2 != null && Number.isFinite(Number(catalog.chance2))
        ? Number(catalog.chance2)
        : piece.chance2 != null && Number.isFinite(Number(piece.chance2))
          ? Number(piece.chance2)
          : 0;
    piece._rangerInsideKeys = getItemsInside(ctx.graph, piece.placementKey);
    const cachedInsides = () =>
      (ctx.pieces || []).filter((other) => piece._rangerInsideKeys.includes(other.placementKey));
    for (const o of cachedInsides()) {
      o.critChance = (Number(o.critChance) || 0) + crit;
    }
    if (!piece._rangerInsideKeys.length) return;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'lucky' || !ch.amount) return;
      for (const o of cachedInsides()) {
        o.critChance = (Number(o.critChance) || 0) + ch.amount * perLuck;
      }
    });
  },
};

/** BerserkerBag.gd — low HP startBattleRage; insides speed + self %DR while raging. */
/** @type {ScriptHandler} */
export const berserkerBagPort = {
  handlerId: 'berserker_bag',
  family: 'unique',
  // BerserkerBag.gd connects during onPrepare, before start-of-battle damage.
  onPrepare(piece, ctx) {
    piece._rageArmed = false;
    const th = getPName(piece.params, 'healtht', getP1(piece.params, 50)) / 100 - 0.0001;
    const speed = getPName(piece.params, 'speed_rage', getP3(piece.params, 20)) / 100;
    const dr = getPName(piece.params, 'damresistance', getP4(piece.params, 15));
    const dur = Math.max(0, getPName(piece.params, 'dur_rage', getP2(piece.params, 4)));
    ctx.bus?.on?.('character_damaged', (p) => {
      if (p?.actor && p.actor !== ctx.player) return;
      if (piece._rageArmed || !piece.alive) return;
      const player = ctx.player;
      if (player.maxHp <= 0 || player.hp / player.maxHp >= th) return;
      piece._rageArmed = true;
      startBattleRage(player, dur, p?.t ?? ctx.t, { bus: ctx.bus, sourceId: piece.itemId });
      pushActivate(piece, ctx, 'berserker_bag', `Bag: ${piece.name}`);
    });
    ctx.bus?.on?.('battle_rage_started', (event) => {
      if (event?.actor && event.actor !== ctx.player) return;
      if (dr) ctx.player.damageResistancePct = (Number(ctx.player.damageResistancePct) || 0) + dr;
      for (const o of insides(ctx, piece)) {
        if (pieceHasCombatCooldown(o) && speed) addSpeed(o, speed);
      }
    });
    ctx.bus?.on?.('battle_rage_ended', (event) => {
      if (event?.actor && event.actor !== ctx.player) return;
      if (dr) ctx.player.damageResistancePct = Math.max(0, (Number(ctx.player.damageResistancePct) || 0) - dr);
      for (const o of insides(ctx, piece)) {
        if (pieceHasCombatCooldown(o) && speed) addSpeed(o, -speed);
      }
    });
  },
};

/** BagofGiving.gd — class-item inside activate → temp max stamina. */
/** @type {ScriptHandler} */
export const bagOfGivingPort = {
  handlerId: 'bag_of_giving',
  family: 'unique',
  onPrepare(piece) {
    piece._bagGivingReady = true;
  },
  onPeerActivated(listener, activated, ctx) {
    if (!listener._bagGivingReady) return;
    const bagItem = ctx.itemsById.get(listener.itemId) || listener;
    const activatedItem = ctx.itemsById.get(activated.itemId) || activated;
    if (!canBagAffectItem(bagItem, activatedItem, ctx.canAffect || {})) return;
    const stam = Math.max(1, Math.round(getPName(listener.params, 'stamina', 2)));
    gainMaxStaminaTemporary(ctx.player, stam);
    pushActivate(listener, ctx, 'bag_of_giving', `Bag: ${listener.name}`);
  },
};

/** SewingCase.gd — crafted insides: speed. */
/** @type {ScriptHandler} */
export const sewingCasePort = {
  handlerId: 'sewing_case',
  family: 'unique',
  onPrepare(piece, ctx) {
    const speed =
      getPName(piece.params, 'speed', getP1(piece.params, 15)) / 100;
    const bagItem = ctx.itemsById.get(piece.itemId) || piece;
    const rawChance =
      piece.chance != null ? piece.chance : bagItem.chance;
    const chance = Number.isFinite(Number(rawChance)) ? Number(rawChance) : 0;
    for (const o of insides(ctx, piece)) {
      const item = ctx.itemsById.get(o.itemId);
      if (!item) continue;
      const target = { ...item, ...o, params: o.params || item.params };
      if (!canBagAffectItem(bagItem, target, ctx.canAffect || {})) continue;
      if (speed) addSpeed(o, speed);
      if (!chance) continue;
      o.buffAmplificationChances = o.buffAmplificationChances || {};
      for (const stack of BUFF_KEYS) {
        o.buffAmplificationChances[stack] =
          (Number(o.buffAmplificationChances[stack]) || 0) + chance;
      }
    }
  },
};

/** StorageCoffin.gd — inside activate chance → poison. */
/** @type {ScriptHandler} */
export const storageCoffinPort = {
  handlerId: 'storage_coffin',
  family: 'unique',
  onPrepare(piece, ctx) {
    const catalog = ctx.itemsById.get(piece.itemId) || piece;
    const chance = Number.isFinite(Number(piece.chance))
      ? Number(piece.chance)
      : Number(catalog.chance) || 0;
    const keys = new Set(
      insides(ctx, piece)
        .filter((inside) => {
          const item = ctx.itemsById.get(inside.itemId) || inside;
          return inside.canActivate !== false &&
            item.canActivate !== false &&
            !isBagLike(item);
        })
        .map((inside) => inside.placementKey),
    );
    piece._storageCoffinBound = true;
    ctx.bus?.on?.('piece_activated', (payload) => {
      const activated = payload?.piece;
      if (!activated || !keys.has(activated.placementKey)) return;
      if (!rollItemChance(piece, ctx.rng, chance)) return;
      gainStacks(ctx.dummy, 'poison', 1, {
        rng: ctx.rng,
        opponent: ctx.player,
        originKey: piece.placementKey,
        originId: piece.itemId,
        t: payload?.t ?? ctx.t,
      });
      pushBuffGrants(ctx.events, piece, ctx.player, payload?.t ?? ctx.t, 'storage_coffin', {
        poison: 1,
      }, 0.002, 'dummy');
    });
  },
  // Compatibility for direct callers that used the old lifecycle slot; the
  // production simulator binds this source onPrepare hook first.
  onCombatStart(piece, ctx) {
    if (!piece._storageCoffinBound) this.onPrepare(piece, ctx);
  },
};

/**
 * EngineerBox.gd — insides that emitCharge: queue + restart delay timer;
 * timeout pops one and emitCharge(speed/100). Does not addSpeed on batteries.
 */
/** @type {ScriptHandler} */
export const engineerBoxPort = {
  handlerId: 'engineer_box',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._engQueue = [];
    piece._engTimerAt = null;
    piece._engEmitters = new Set(
      insides(ctx, piece)
        .filter((item) => canEmitCharge(item))
        .map((item) => item.placementKey),
    );
    ctx.bus?.on?.('charge_emitted', (payload) => {
      const emitter = payload?.piece;
      if (!emitter?.placementKey || piece.alive === false) return;
      if (!piece._engEmitters?.has(emitter.placementKey)) return;
      if (!piece._engQueue) piece._engQueue = [];
      piece._engQueue.push(emitter.placementKey);
      const rawDelay = Number(getPName(piece.params, 'delay', 5));
      const delay = Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 5;
      const signalT = Number.isFinite(Number(payload?.t)) ? Number(payload.t) : ctx.t;
      piece._engTimerAt = signalT + delay;
    });
  },
  onQueuedChargeTimeout(piece, ctx) {
    piece._engTimerAt = null;
    const key = piece._engQueue?.shift();
    if (!key) return;
    const emitter = (ctx.pieces || []).find((p) => p.placementKey === key);
    const speedFactor = getPName(piece.params, 'speed', 150) / 100;
    reEmitCharge(emitter, ctx, speedFactor);
  },
  onCombatEnd(piece) {
    piece._engTimerAt = null;
    piece._engQueue = [];
    piece._engEmitters = new Set();
  },
};

function bagChance(piece, ctx, fallback = 15) {
  return (
    Number(ctx.itemsById.get(piece.itemId)?.chance) ||
    Number(piece.chance) ||
    getPName(piece.params, 'chance', fallback)
  );
}

/** PuzzlebagS.gd — insides that gainsBuffs: all-buffs amp chance. */
export const puzzlebagSPort = {
  handlerId: 'puzzlebag_s',
  family: 'unique',
  onPrepare(piece, ctx) {
    const catalog = ctx.itemsById.get(piece.itemId);
    const rawChance = catalog?.chance ?? piece.chance ?? 0;
    const amp = Number.isFinite(Number(rawChance)) ? Number(rawChance) : 0;
    if (!amp) return;
    for (const o of insides(ctx, piece)) {
      const targetCatalog = ctx.itemsById.get(o.itemId);
      const target = targetCatalog
        ? { ...targetCatalog, ...o, params: o.params || targetCatalog.params }
        : o;
      if (!canBagAffectItem({ id: 'puzzlebag_s' }, target, ctx.canAffect || {})) continue;
      o.buffAmpChance = (Number(o.buffAmpChance) || 0) + amp;
    }
  },
};

/** PuzzlebagZ.gd — insides that inflictsDebuffs: all-debuffs amp chance. */
export const puzzlebagZPort = {
  handlerId: 'puzzlebag_z',
  family: 'unique',
  onPrepare(piece, ctx) {
    const catalog = ctx.itemsById.get(piece.itemId);
    const rawChance = catalog?.chance ?? piece.chance ?? 0;
    const amp = Number.isFinite(Number(rawChance)) ? Number(rawChance) : 0;
    if (!amp) return;
    for (const o of insides(ctx, piece)) {
      const targetCatalog = ctx.itemsById.get(o.itemId);
      const target = targetCatalog
        ? { ...targetCatalog, ...o, params: o.params || targetCatalog.params }
        : o;
      if (!canBagAffectItem({ id: 'puzzlebag_z' }, target, ctx.canAffect || {})) continue;
      o.debuffAmpChance = (Number(o.debuffAmpChance) || 0) + amp;
    }
  },
};

/**
 * PuzzlebagT.gd (display: Puzzlebag of Energy) —
 * onPrepare: insides that usesBuffs; refund `buff%` of *used* buff spends
 * (fractional accrual). giveStacks origin is the bag (Combat Log / meter).
 */
/** @type {ScriptHandler} */
export const puzzlebagTPort = {
  handlerId: 'puzzlebag_t',
  family: 'unique',
  onPrepare(piece, ctx) {
    const refund = getPName(piece.params, 'buff', 0) / 100;
    const keys = new Set();
    for (const o of insides(ctx, piece)) {
      const catalog = ctx.itemsById.get(o.itemId);
      const target = catalog
        ? { ...catalog, ...o, params: o.params || catalog.params }
        : o;
      if (!canBagAffectItem({ id: 'puzzlebag_t' }, target, ctx.canAffect || {})) continue;
      keys.add(o.placementKey);
    }
    if (!keys.size) return;
    /** @type {Record<string, number>} */
    piece._usedStacks = {};
    for (const k of BUFF_KEYS) piece._usedStacks[k] = 0;
    onBuffChanged(ctx.player, (ch) => {
      if (piece._bagRefunding) return;
      if (!(ch.amount < 0) || !ch.used || !ch.originKey || !keys.has(ch.originKey)) return;
      const buffType = String(ch.stack || '');
      if (!BUFF_KEYS.includes(buffType)) return;
      const used = Math.abs(ch.amount);
      piece._usedStacks[buffType] =
        (Number(piece._usedStacks[buffType]) || 0) + used * refund;
      const toRefund = Math.round(piece._usedStacks[buffType]);
      if (!(toRefund > 0)) return;
      piece._usedStacks[buffType] -= toRefund;
      piece._bagRefunding = true;
      try {
        grantStacks(ctx.player, buffType, toRefund, {
          piece,
          originKey: piece.placementKey,
          originId: piece.itemId,
          t: ctx.t,
          silentLog: true,
        });
        pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'puzzlebag_t', {
          [buffType]: toRefund,
        });
      } finally {
        piece._bagRefunding = false;
      }
    });
  },
};

/** PuzzlebagJ.gd — insides with inventory duration: bump `dur`. */
export const puzzlebagJPort = {
  handlerId: 'puzzlebag_j',
  family: 'unique',
  onPrepare(piece, ctx) {
    const bonus = getPName(piece.params, 'bonusdur', 0) / 100;
    if (!bonus) return;
    for (const o of insides(ctx, piece)) {
      const cat = ctx.itemsById.get(o.itemId);
      const target = cat
        ? { ...cat, ...o, params: o.params || cat.params }
        : o;
      if (!hasInventoryDuration(target)) continue;
      addEffectDurationFactor(o, bonus);
    }
  },
};

export const AK_BAG_PORTS = {
  stamina_sack: staminaSackPort,
  vineweave_basket: vineweaveBasketPort,
  potion_belt: potionBeltPort,
  ranger_bag: rangerBagPort,
  berserker_bag: berserkerBagPort,
  bag_of_giving: bagOfGivingPort,
  sewing_case: sewingCasePort,
  storage_coffin: storageCoffinPort,
  engineer_box: engineerBoxPort,
  puzzlebag_s: puzzlebagSPort,
  puzzlebag_z: puzzlebagZPort,
  puzzlebag_t: puzzlebagTPort,
  puzzlebag_j: puzzlebagJPort,
};
