/**
 * Band AP 245 — leftover `cd_regen` MAP items → `.gd` ports.
 */

import { healActor } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import {
  grantStacks,
  grantTemporaryStacks,
  onBuffChanged,
  spendStacks,
  useLucky,
  useMana,
  useRegeneration,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import {
  itemHasType,
  afterEffectFinished,
  pushActivate,
  pieceHasCombatCooldown,
} from './ports-util.js';
import { removeRandomBuffs } from './ports-wave-c-util.js';
import { rollPercent } from '../rng.js';
import { giveTempMaxHp } from './ports-ap-start.js';
import { applyFoodPrepareSpeed } from './food-helpers.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

const LAB = {
  luckt: 1,
  heatt: 4,
  heat_bonus: 1,
  heat: 4,
  spikest: 6,
  spikes_bonus: 1,
  spikes: 8,
  regent: 8,
  regen_bonus: 1,
  regen: 10,
  vampirism: 12,
  vamp_bonus: 1,
  vampt: 10,
  empower_bonus: 1,
  empower: 14,
};

function labTypes(ctx, piece) {
  const counts = { fire: 0, nature: 0, holy: 0, vampiric: 0, engineer: 0 };
  for (const o of linked(ctx, piece)) {
    const item = ctx.itemsById.get(o.itemId);
    if (itemHasType(item, 'fire')) counts.fire += 1;
    if (itemHasType(item, 'nature')) counts.nature += 1;
    if (itemHasType(item, 'holy')) counts.holy += 1;
    if (itemHasType(item, 'vampiric') || o.vampiric) counts.vampiric += 1;
    if (String(item?.class || '') === 'Engineer') counts.engineer += 1;
  }
  return counts;
}

/** BurningBanner.gd — holy activate → temp blind; CD strip dummy buffs + regen. */
const burningBannerPort = {
  handlerId: 'burning_banner',
  family: 'unique',
  onPrepare(piece, ctx) {
    const ch2 = Number(ctx.itemsById.get(piece.itemId)?.chance2) || 25;
    ctx.dummy.debuffCleanseProtectChance =
      (Number(ctx.dummy.debuffCleanseProtectChance) || 0) + ch2;
    ctx.player.buffCleanseProtectChance =
      (Number(ctx.player.buffCleanseProtectChance) || 0) + ch2;
    const dur = getPName(piece.params, 'dur_blind', getP1(piece.params, 5));
    const chance = Number(ctx.itemsById.get(piece.itemId)?.chance) || 80;
    // BurningBanner.gd caches getAffectedItems() and connects only to holy
    // items which can activate.  Do the same during prepare so later board
    // mutations cannot change the listener set.
    piece._burningBannerTargets = linked(ctx, piece).filter((other) =>
      itemHasType(ctx.itemsById.get(other.itemId), 'holy') &&
      (other.kind === 'weapon' || pieceHasCombatCooldown(other)),
    );
    ctx.bus?.on?.('piece_activated', (payload) => {
      const other = payload?.piece;
      if (!other || other === piece) return;
      if (!(piece._burningBannerTargets || []).some((o) => o === other)) return;
      if (!rollPercent(chance, ctx.rng)) return;
      grantTemporaryStacks(ctx.dummy, 'blind', 1, dur, ctx.t, origin(piece));
    });
  },
  onCooldownEffect(piece, ctx) {
    removeRandomBuffs(
      ctx.dummy,
      Math.max(1, Math.round(getPName(piece.params, 'buffs', getP2(piece.params, 2)))),
      ctx.rng,
      origin(piece),
    );
    grantStacks(
      ctx.player,
      'regeneration',
      Math.max(1, Math.round(getPName(piece.params, 'regen', getP3(piece.params, 2)))),
      origin(piece),
    );
    // Item.doCooldownEffect applies both effects before activating.
    pushActivate(piece, ctx, 'burning_banner', `Accessory: ${piece.name}`);
    return true;
  },
};

/** GingerbreadMan.gd — start max HP; CD spend luck/heat/mana → empower + regen + max HP. */
const gingerbreadManPort = {
  handlerId: 'gingerbread_man',
  family: 'food',
  // GingerbreadMan.gd extends Food without overriding prepare(). Keep the
  // inherited Food.prepare food-link haste in the dedicated handler.
  onPrepare(piece, ctx) {
    applyFoodPrepareSpeed(piece, ctx);
  },
  onCombatStart(piece, ctx) {
    const hp = Math.max(1, Math.round(getPName(piece.params, 'maxhealth', getP1(piece.params, 40))));
    giveTempMaxHp(piece, ctx, 'gingerbread_man', hp);
    pushActivate(piece, ctx, 'gingerbread_man', `Food: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const luckN = Math.max(1, Math.round(getP2(piece.params, 1)));
    const heatN = Math.max(1, Math.round(getP3(piece.params, 1)));
    const manaN = Math.max(1, Math.round(getP4(piece.params, 1)));
    if (
      getStackAmount(ctx.player, 'lucky') >= luckN &&
      getStackAmount(ctx.player, 'heat') >= heatN &&
      getStackAmount(ctx.player, 'mana') >= manaN
    ) {
      useLucky(ctx.player, luckN, origin(piece));
      spendStacks(ctx.player, 'heat', heatN, origin(piece));
      useMana(ctx.player, manaN, origin(piece));
      grantStacks(
        ctx.player,
        'empower',
        Math.max(1, Math.round(getPName(piece.params, 'empower', 1))),
        origin(piece),
      );
      grantStacks(
        ctx.player,
        'regeneration',
        Math.max(1, Math.round(getPName(piece.params, 'regen', 3))),
        origin(piece),
      );
      const extra = Math.max(
        1,
        Math.round(getPName(piece.params, 'maxhealth_use', 20)),
      );
      giveTempMaxHp(piece, ctx, 'gingerbread_man', extra);
    }
    // GingerbreadMan.gd always activates, after its gated effects.
    pushActivate(piece, ctx, 'gingerbread_man', `Food: ${piece.name}`);
    return true;
  },
};

/** HeartContainer.gd — CD +1 regen; at regent spend regen → max HP, empower, heal amp. */
const heartContainerPort = {
  handlerId: 'heart_container',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._heartOn = false;
    const need = Math.max(1, Math.round(getP2(piece.params, 7)));
    onBuffChanged(ctx.player, (ch) => {
      if (piece._heartOn || ch.stack !== 'regeneration' || !(ch.amount > 0)) return;
      if (getStackAmount(ctx.player, 'regeneration') < need) return;
      piece._heartOn = true;
      const reactionCtx = { ...ctx, t: Number(ctx.player._simT) || ctx.t };
      useRegeneration(ctx.player, need, origin(piece));
      const hp = Math.max(1, Math.round(getPName(piece.params, 'maxhealth', getP3(piece.params, 100))));
      giveTempMaxHp(piece, reactionCtx, 'heart_container', hp);
      grantStacks(
        ctx.player,
        'empower',
        Math.max(1, Math.round(getPName(piece.params, 'empower', getP4(piece.params, 2)))),
        origin(piece),
      );
      applyHealEfficiency(ctx.player, getPName(piece.params, 'healamp', 15) / 100, reactionCtx, piece);
    });
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'heart_container', `Accessory: ${piece.name}`);
    grantStacks(
      ctx.player,
      'regeneration',
      Math.max(1, Math.round(getPName(piece.params, 'regen', getP1(piece.params, 1)))),
      origin(piece),
    );
    return true;
  },
};

/** Laboratory.gd — 5-phase spend/convert then consume. */
const laboratoryPort = {
  handlerId: 'laboratory',
  family: 'unique',
  onPreCombatStart(piece, ctx) {
    piece._labPhase = 0;
    piece._labTypes = labTypes(ctx, piece);
  },
  onCooldownEffect(piece, ctx) {
    piece._labPhase = (Number(piece._labPhase) || 0) + 1;
    const phase = piece._labPhase;
    const types = piece._labTypes || labTypes(ctx, piece);
    const p = ctx.player;
    if (phase === 1 && getStackAmount(p, 'lucky') >= LAB.luckt) {
      useLucky(p, LAB.luckt, origin(piece));
      grantStacks(p, 'heat', LAB.heat + types.fire * LAB.heat_bonus, origin(piece));
    } else if (phase === 2 && getStackAmount(p, 'heat') >= LAB.heatt) {
      spendStacks(p, 'heat', LAB.heatt, origin(piece));
      grantStacks(p, 'spikes', LAB.spikes + types.nature * LAB.spikes_bonus, origin(piece));
    } else if (phase === 3 && getStackAmount(p, 'spikes') >= LAB.spikest) {
      spendStacks(p, 'spikes', LAB.spikest, origin(piece));
      grantStacks(p, 'regeneration', LAB.regen + types.holy * LAB.regen_bonus, origin(piece));
    } else if (phase === 4 && getStackAmount(p, 'regeneration') >= LAB.regent) {
      useRegeneration(p, LAB.regent, origin(piece));
      grantStacks(p, 'vampirism', LAB.vampirism + types.vampiric * LAB.vamp_bonus, origin(piece));
    } else if (phase === 5 && getStackAmount(p, 'vampirism') >= LAB.vampt) {
      spendStacks(p, 'vampirism', LAB.vampt, origin(piece));
      grantStacks(p, 'empower', LAB.empower + types.engineer * LAB.empower_bonus, origin(piece));
    }
    if (phase >= 5) {
      afterEffectFinished(piece, ctx, 'laboratory');
    } else {
      pushActivate(piece, ctx, 'laboratory', `Accessory: ${piece.name}`);
      piece.baseCooldown = phase >= 4 ? 4 : 2;
    }
    return true;
  },
};

/** Pot.gd — food/potion speed; CD heat+regen consume; potion empty → heal. */
const potPort = {
  handlerId: 'pot',
  family: 'unique',
  onPrepare(piece, ctx) {
    const potions = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'potion'),
    );
    const foods = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'food'),
    );
    piece._potFood = foods.length;
    const spd = getPName(piece.params, 'speed', 50) / 100;
    addSpeed(piece, spd * (potions.length + foods.length));
    ctx.bus?.on?.('potion_emptied', (payload) => {
      const other = payload?.piece;
      if (!other || other.placementKey === piece.placementKey) return;
      if (!itemHasType(ctx.itemsById.get(other.itemId), 'potion')) return;
      if (!linked(ctx, piece).some((o) => o.placementKey === other.placementKey)) return;
      const heal =
        getPName(piece.params, 'heal', 10) +
        getPName(piece.params, 'heal_food', 2) * (Number(piece._potFood) || 0);
      const got = healActor(ctx.player, Math.max(1, Math.round(heal)));
      if (got > 0) {
        ctx.events.push({
          t: ctx.t,
          type: 'heal',
          target: 'player',
          amount: got,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${got} HP`,
          meta: { category: 'heal', script: true, handler: 'pot' },
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    grantStacks(
      ctx.player,
      'heat',
      Math.max(1, Math.round(getPName(piece.params, 'heat', getP3(piece.params, 6)))),
      origin(piece),
    );
    grantStacks(
      ctx.player,
      'regeneration',
      Math.max(1, Math.round(getPName(piece.params, 'regen', getP4(piece.params, 6)))),
      origin(piece),
    );
    afterEffectFinished(piece, ctx, 'pot');
    return true;
  },
};

/** SliceofToast.gd — low stamina → stam, else regen. */
const sliceOfToastPort = {
  handlerId: 'slice_of_toast',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const th = getPName(piece.params, 'staminat', getP1(piece.params, 2.5));
    pushActivate(piece, ctx, 'slice_of_toast', `Food: ${piece.name}`);
    if ((Number(ctx.player.stamina) || 0) < th) {
      const stam = getPName(piece.params, 'stamina', getP2(piece.params, 0.5));
      const next = (Number(ctx.player.stamina) || 0) + stam;
      const cap = Number(ctx.player.maxStamina);
      ctx.player.stamina = cap > 0 ? Math.min(cap, next) : next;
    } else {
      grantStacks(
        ctx.player,
        'regeneration',
        Math.max(1, Math.round(getPName(piece.params, 'regen', getP3(piece.params, 1)))),
        origin(piece),
      );
    }
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AP_REGEN_PORTS = {
  burning_banner: burningBannerPort,
  gingerbread_man: gingerbreadManPort,
  heart_container: heartContainerPort,
  laboratory: laboratoryPort,
  pot: potPort,
  slice_of_toast: sliceOfToastPort,
};
