/**
 * Band AK — combat bags (shop/storage bags stay noops — Phase 267).
 */

import { applyHealEfficiency, applyStaminaRegeneration } from '../actor-stats.js';
import { startBattleRage } from '../battle-rage.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { cleanseRandomDebuffs, giveRandomBuffs, grantStacks, onBuffChanged } from '../buff-economy.js';
import { gainStacks } from '../stacks.js';
import { getItemsInside } from '../board-graph.js';
import { reEmitCharge } from '../charge-delivery.js';
import { getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { itemHasType } from './ports-util.js';

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
  onPreCombatStart(piece, ctx) {
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
  onCombatStart(piece, ctx) {
    const nature = insides(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'nature'),
    ).length;
    const amp =
      getPName(piece.params, 'healamp', 8) / 100 +
      (getPName(piece.params, 'ampbonus', 2) / 100) * nature;
    if (amp) applyHealEfficiency(ctx.player, amp, ctx, piece);
  },
};

/** PotionBelt.gd — 1st emptied potion: random buff; 4th: cleanse. */
/** @type {ScriptHandler} */
export const potionBeltPort = {
  handlerId: 'potion_belt',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._beltN = 0;
    ctx.bus?.on?.('potion_emptied', () => {
      piece._beltN = (Number(piece._beltN) || 0) + 1;
      let buffs = 0;
      if (piece._beltN === 1) buffs = 1;
      if (piece._beltN === 4) {
        cleanseRandomDebuffs(
          ctx.player,
          Math.max(1, Math.round(getPName(piece.params, 'p1', 1))),
          ctx.rng,
        );
      }
      if (hasBagtacular(ctx)) buffs += 1;
      if (buffs) {
        giveRandomBuffs(ctx.player, buffs, ctx.rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
  },
};

/** RangerBag.gd — crit% on damaging insides; lucky → more crit. */
/** @type {ScriptHandler} */
export const rangerBagPort = {
  handlerId: 'ranger_bag',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const crit = Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 5;
    const perLuck =
      Number(ctx.itemsById.get(piece.itemId)?.chance2) || Number(piece.chance2) || 1;
    for (const o of insides(ctx, piece)) {
      if ((o.damageMax || 0) > 0 || o.kind === 'weapon') {
        o.critChance = (Number(o.critChance) || 0) + crit;
      }
    }
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'lucky' || !ch.amount) return;
      for (const o of insides(ctx, piece)) {
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
  onCombatStart(piece, ctx) {
    piece._rageArmed = false;
    const th = getPName(piece.params, 'healtht', 50) / 100 - 0.0001;
    const speed = getPName(piece.params, 'speed_rage', 20) / 100;
    const dr = getPName(piece.params, 'damresistance', 15);
    const dur = Math.max(1, getPName(piece.params, 'dur_rage', 4));
    ctx.bus?.on?.('player_damaged', (p) => {
      if (piece._rageArmed || !piece.alive) return;
      const player = ctx.player;
      if (player.maxHp <= 0 || player.hp / player.maxHp >= th) return;
      piece._rageArmed = true;
      startBattleRage(player, dur, p?.t ?? ctx.t, { bus: ctx.bus, sourceId: piece.itemId });
    });
    ctx.bus?.on?.('battle_rage_started', () => {
      if (dr) grantTimedResistancePct(ctx.player, dr, ctx.t + dur, 'berserker_bag');
      for (const o of insides(ctx, piece)) {
        if (Number(o.cooldown) > 0 && speed) addSpeed(o, speed);
      }
    });
    ctx.bus?.on?.('battle_rage_ended', () => {
      for (const o of insides(ctx, piece)) {
        if (Number(o.cooldown) > 0 && speed) addSpeed(o, -speed);
      }
    });
  },
};

/** BagofGiving.gd — class-item inside activate → temp max stamina. */
/** @type {ScriptHandler} */
export const bagOfGivingPort = {
  handlerId: 'bag_of_giving',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const stam = Math.max(1, Math.round(getPName(piece.params, 'stamina', 2)));
    ctx.bus?.on?.('potion_emptied', () => {});
    // Use piece activate via combat-activate bus if present; fallback: any inside CD fire
    const keys = new Set(getItemsInside(ctx.graph, piece.placementKey));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      const src = payload?.piece;
      if (!src || !keys.has(src.placementKey)) return;
      ctx.player.maxStamina = (Number(ctx.player.maxStamina) || 20) + stam;
    });
  },
};

/** SewingCase.gd — crafted insides: speed. */
/** @type {ScriptHandler} */
export const sewingCasePort = {
  handlerId: 'sewing_case',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const speed = getPName(piece.params, 'speed', 15) / 100;
    for (const o of insides(ctx, piece)) {
      const item = ctx.itemsById.get(o.itemId);
      const crafted = itemHasType(item, 'crafted') || item?.shop === 'crafted';
      if (crafted && speed && Number(o.cooldown) > 0) addSpeed(o, speed);
    }
  },
};

/** StorageCoffin.gd — inside activate chance → poison. */
/** @type {ScriptHandler} */
export const storageCoffinPort = {
  handlerId: 'storage_coffin',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const chance =
      Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 25;
    const keys = new Set(getItemsInside(ctx.graph, piece.placementKey));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      const src = payload?.piece;
      if (!src || !keys.has(src.placementKey)) return;
      if (ctx.rng() * 100 >= chance) return;
      gainStacks(ctx.dummy, 'poison', 1, { rng: ctx.rng, opponent: ctx.player });
    });
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
  onPreCombatStart(piece, ctx) {
    piece._engQueue = [];
    piece._engTimerAt = null;
    ctx.bus?.on?.('charge_emitted', (payload) => {
      const emitter = payload?.piece;
      if (!emitter?.placementKey || piece.alive === false) return;
      const inside = new Set(getItemsInside(ctx.graph, piece.placementKey));
      if (!inside.has(emitter.placementKey)) return;
      if (!piece._engQueue) piece._engQueue = [];
      piece._engQueue.push(emitter.placementKey);
      const delay = Math.max(0, Number(getPName(piece.params, 'delay', 5)) || 5);
      piece._engTimerAt = ctx.t + delay;
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
  onCombatStart(piece, ctx) {
    const amp = bagChance(piece, ctx, 15);
    if (!amp) return;
    for (const o of insides(ctx, piece)) {
      o.buffAmpChance = (Number(o.buffAmpChance) || 0) + amp;
    }
  },
};

/** PuzzlebagZ.gd — insides that inflictsDebuffs: all-debuffs amp chance. */
export const puzzlebagZPort = {
  handlerId: 'puzzlebag_z',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const amp = bagChance(piece, ctx, 15);
    if (!amp) return;
    for (const o of insides(ctx, piece)) {
      o.debuffAmpChance = (Number(o.debuffAmpChance) || 0) + amp;
    }
  },
};

/** PuzzlebagT.gd — insides that usesBuffs: refund a fraction of spent buffs. */
export const puzzlebagTPort = {
  handlerId: 'puzzlebag_t',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const refund = getPName(piece.params, 'buff', 20) / 100;
    const acc = {};
    const keys = new Set(getItemsInside(ctx.graph, piece.placementKey));
    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount < 0) || !ch.used || !ch.originKey || !keys.has(ch.originKey)) return;
      const stack = String(ch.stack || '');
      if (!stack) return;
      acc[stack] = (acc[stack] || 0) + Math.abs(ch.amount) * refund;
      const n = Math.round(acc[stack]);
      if (n <= 0) return;
      acc[stack] -= n;
      grantStacks(ctx.player, stack, n, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
  },
};

/** PuzzlebagJ.gd — insides with inventory duration: bump `dur`. */
export const puzzlebagJPort = {
  handlerId: 'puzzlebag_j',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const bonus = getPName(piece.params, 'bonusdur', 20) / 100;
    if (!bonus) return;
    for (const o of insides(ctx, piece)) {
      const cat = ctx.itemsById.get(o.itemId);
      const dur = o.params?.dur ?? cat?.params?.dur;
      if (dur == null) continue;
      o.params = { ...o.params, dur: Number(dur) * (1 + bonus) };
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
