/**
 * Band AN — leftover accessories / amulets / collars / badges.
 */

import { healActor } from '../actor.js';
import {
  BUFF_KEYS,
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  spendStacks,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { startBattleRage } from '../battle-rage.js';
import { advanceCooldownSeconds, isCooldownActive } from '../cooldown.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { dealHit } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { superiorRingPort } from './ports-ring.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { rollPercent } from '../rng.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function chanceOf(piece, ctx, key = 'chance', fb = 20) {
  const item = ctx.itemsById.get(piece.itemId);
  const n = Number(item?.[key] ?? piece.chance);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

/** @type {ScriptHandler} */
const acornCollarPort = {
  handlerId: 'acorn_collar',
  family: 'unique',
  onCombatStart(piece, ctx) {
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'lucky' || !ch.amount) return;
      const per = chanceOf(piece, ctx) / 100;
      for (const o of linked(ctx, piece)) {
        if ((Number(o.damageMax) || 0) <= 0 && o.kind !== 'weapon') continue;
        o.critChance = (Number(o.critChance) || 0) + ch.amount * per * 100;
      }
    });
  },
};

/** @type {ScriptHandler} */
const holyCollarPort = {
  handlerId: 'holy_collar',
  family: 'unique',
  onCombatStart(piece, ctx) {
    onBuffChanged(ctx.player, (ch) => {
      if ((ch.stack !== 'lucky' && ch.stack !== 'regeneration') || !ch.amount) return;
      const per = chanceOf(piece, ctx, 'chance2', 5) / 100;
      for (const o of linked(ctx, piece)) {
        if (!(o.cooldown > 0 && o.cooldown < 500)) continue;
        o.critChance = (Number(o.critChance) || 0) + ch.amount * per * 100;
      }
    });
  },
  onPeerActivated(listener, activated, ctx) {
    if (!rollPercent(chanceOf(listener, ctx), ctx.rng)) return;
    grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getPName(listener.params, 'luck', 1))), {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
    grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getPName(listener.params, 'regen', 1))), {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
  },
};

/** @type {ScriptHandler} */
const magicCollarPort = {
  handlerId: 'magic_collar',
  family: 'unique',
  onCombatStart(piece, ctx) {
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit) return;
      const host = payload.piece;
      if (!linked(ctx, piece).some((o) => o === host)) return;
      const luck = Math.max(1, getStackAmount(ctx.player, 'lucky'));
      if (!rollPercent(chanceOf(piece, ctx) * luck, ctx.rng)) return;
      grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getPName(piece.params, 'mana', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
  },
};

/** @type {ScriptHandler} */
const spikedCollarPort = {
  handlerId: 'spiked_collar',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const extra = getPName(piece.params, 'dur_rage', 2);
    ctx.player._battleRageDur = (Number(ctx.player._battleRageDur) || 0) + extra;
    ctx.bus?.on?.('battle_rage_started', () => {
      grantStacks(ctx.player, 'spikes', Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 2)))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushActivate(piece, ctx, 'spiked_collar', `Accessory: ${piece.name}`);
    });
  },
};

/** @type {ScriptHandler} */
const vampiricCollarPort = {
  handlerId: 'vampiric_collar',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const maxLs = getPName(piece.params, 'max', 25) / 100;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'vampirism' || !ch.amount) return;
      const per = chanceOf(piece, ctx) / 100;
      for (const o of linked(ctx, piece)) {
        o.critChance = (Number(o.critChance) || 0) + ch.amount * per * 100;
      }
    });
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit || !payload.hit.healthDamage) return;
      if (!linked(ctx, piece).some((o) => o === payload.piece)) return;
      const luck = Math.max(1, getStackAmount(ctx.player, 'lucky'));
      const fac = Math.min(maxLs, (getPName(piece.params, 'lifesteal', 5) / 100) * luck);
      if (fac > 0) healActor(ctx.player, Math.max(1, Math.ceil(payload.hit.healthDamage * fac)));
    });
  },
};

/** LeafBadge.gd — CD giveLucky(1)+activate; lucky → crit% on canDamage links. */
const leafBadgePort = {
  handlerId: 'leaf_badge',
  family: 'unique',
  onCombatStart(piece, ctx) {
    if (!linked(ctx, piece).length) return;
    const per = chanceOf(piece, ctx, 'chance', 2) / 100;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'lucky' || !ch.amount) return;
      for (const o of linked(ctx, piece)) {
        if ((Number(o.damageMax) || 0) <= 0 && o.kind !== 'weapon') continue;
        o.critChance = (Number(o.critChance) || 0) + ch.amount * per * 100;
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    // grantStacks already combat-logs; do not also push a buff (Lucky meter double-count).
    grantStacks(ctx.player, 'lucky', 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      t: ctx.t,
    });
    pushActivate(piece, ctx, 'leaf_badge', `Accessory: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
const amuletOfDarknessPort = {
  handlerId: 'amulet_of_darkness',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._darkAcc = 0;
    const th = Math.max(1, Math.round(getPName(piece.params, 'damt', getP1(piece.params, 20))));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit || payload.piece !== piece) return;
      piece._darkAcc += payload.hit.healthDamage || 0;
      const n = Math.floor(piece._darkAcc / th);
      if (n <= 0) return;
      piece._darkAcc %= th;
      for (let i = 0; i < n; i++) {
        const pool = ['poison', 'blind', 'cold'];
        grantStacks(ctx.dummy, pool[Math.floor(ctx.rng() * pool.length)] || 'poison', 1, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
  },
  onPeerActivated(listener, _activated, ctx) {
    if (!rollPercent(chanceOf(listener, ctx), ctx.rng)) return;
    const dam = Math.max(1, Math.round(getPName(listener.params, 'dam', getP1(listener.params, 4))));
    dealHit(listener, ctx, dam, '', { ignoreBlock: true });
  },
};

/** @type {ScriptHandler} */
const amuletOfFeastingPort = {
  handlerId: 'amulet_of_feasting',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const spd = getPName(piece.params, 'foodspeed', getP1(piece.params, 15)) / 100;
    for (const o of linked(ctx, piece)) {
      if (!itemHasType(ctx.itemsById.get(o.itemId), 'food')) continue;
      addSpeed(o, spd);
    }
  },
};

/** @type {ScriptHandler} */
const starOfCouragePort = {
  handlerId: 'star_of_courage',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const fac = -getPName(piece.params, 'stamina', getP1(piece.params, 20)) / 100;
    for (const o of ctx.pieces || []) {
      if (o.kind !== 'weapon' && !(Number(o.damageMax) > 0)) continue;
      multiplyStaminaCost(o, fac);
    }
  },
};

/** @type {ScriptHandler} */
const piercingArrowPort = {
  handlerId: 'piercing_arrow',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const sev = getP1(piece.params, 15) / 100;
    const strip = Math.max(1, Math.round(getP2(piece.params, 2)));
    for (const o of linked(ctx, piece)) {
      if (!canBeEmpoweredPiece(o)) continue;
      o.critSeverity = (Number(o.critSeverity) || 0) + sev;
    }
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.critical) return;
      if (!linked(ctx, piece).some((x) => x === payload.piece)) return;
      spendStacks(ctx.dummy, 'block', strip, {});
    });
  },
  onPeerActivated(listener, _a, ctx) {
    if (!rollPercent(chanceOf(listener, ctx), ctx.rng)) return;
    grantStacks(ctx.player, 'lucky', 1, {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
  },
};

/** @type {ScriptHandler} */
const poisonIvyPort = {
  handlerId: 'poison_ivy',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const n = linked(ctx, piece).filter((o) => itemHasType(ctx.itemsById.get(o.itemId), 'nature')).length;
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.poison =
      (Number(ctx.player.stackResist.poison) || 0) + chanceOf(piece, ctx) * Math.max(1, n);
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'spikes' || !(ch.amount > 0)) return;
      grantStacks(ctx.dummy, 'poison', ch.amount * Math.max(1, Math.round(getP4(piece.params, 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
    onBuffChanged(ctx.dummy, (ch) => {
      if (ch.stack !== 'poison') return;
      const need = Math.max(1, Math.round(getP1(piece.params, 8)));
      if (getStackAmount(ctx.dummy, 'poison') >= need && !piece._ivyAmp) {
        piece._ivyAmp = true;
        ctx.dummy.damageResistancePct =
          (Number(ctx.dummy.damageResistancePct) || 0) - getP2(piece.params, 10);
      }
    });
  },
};

/** LuckyCat.gd — gold-value shop thresholds; combat uses linked count as stand-in. Gap: shop gold. */
/** @type {ScriptHandler} */
const luckyCatPort = {
  handlerId: 'lucky_cat',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const gold = linked(ctx, piece).length;
    const g1 = getPName(piece.params, 'gold1', 8);
    const g2 = getPName(piece.params, 'gold2', 16);
    if (gold > g1) {
      ctx.player.critResistance = (Number(ctx.player.critResistance) || 0) + chanceOf(piece, ctx);
    }
    if (gold > g2) {
      const spd = getPName(piece.params, 'speed', 10) / 100;
      for (const o of ctx.pieces || []) {
        if (!(o.cooldown > 0 && o.cooldown < 500)) continue;
        addSpeed(o, spd);
      }
    }
  },
};

/** ManaOrb.gd — Game.getBuffs() with Mana erased. */
const MANA_ORB_BUFFS = BUFF_KEYS.filter((k) => k !== 'mana');

/** @type {ScriptHandler} */
const manaOrbPort = {
  handlerId: 'mana_orb',
  family: 'unique',
  /** ManaOrb.onPrepare — reset before Mana Mastery combat-start bonus. */
  onPreCombatStart(piece) {
    piece._bonusBuffs = 0;
    piece._orbFired = false;
  },
  onCombatStart(piece, ctx) {
    piece._orbFired = false;
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', 35)));
    const buffs = Math.max(1, Math.round(getPName(piece.params, 'buffs', 20)));
    onBuffChanged(ctx.player, (ch) => {
      // Game onManaChanged(amount, …): only on mana gain.
      if (piece._orbFired || ch.stack !== 'mana' || !(ch.amount > 0)) return;
      if (getStackAmount(ctx.player, 'mana') < need) return;
      piece._orbFired = true;
      const totalBuffs = buffs + (Number(piece._bonusBuffs) || 0);
      const { spent } = useMana(ctx.player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        t: ctx.t,
      });
      if (!(spent > 0)) return;
      giveRandomBuffs(ctx.player, totalBuffs, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        availableBuffs: MANA_ORB_BUFFS,
      });
      pushActivate(piece, ctx, 'mana_orb', `Accessory: ${piece.name}`);
    });
  },
  onPeerActivated(listener, _a, ctx) {
    if (!rollPercent(chanceOf(listener, ctx), ctx.rng)) return;
    grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getP1(listener.params, 1))), {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
  },
};

/** @type {ScriptHandler} */
const megaCloverPort = {
  handlerId: 'mega_clover',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._megaFired = false;
    const need = Math.max(1, Math.round(getPName(piece.params, 'luckneeded', 8)));
    const n = Math.max(1, Math.round(getPName(piece.params, 'buffs', 3)));
    onBuffChanged(ctx.player, (ch) => {
      if (piece._megaFired || ch.stack !== 'lucky') return;
      if (getStackAmount(ctx.player, 'lucky') < need) return;
      piece._megaFired = true;
      giveRandomBuffs(ctx.player, n, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushActivate(piece, ctx, 'mega_clover', `Accessory: ${piece.name}`);
    });
  },
};

/** @type {ScriptHandler} */
const twinePort = {
  handlerId: 'twine',
  family: 'unique',
  onPeerActivated(listener, _a, ctx) {
    const n2 = linked(ctx, listener).length;
    const ch = chanceOf(listener, ctx) + n2 * chanceOf(listener, ctx, 'chance2', 5);
    if (!rollPercent(ch, ctx.rng)) return;
    const hp = Math.max(1, Math.round(getPName(listener.params, 'health', 4)));
    ctx.player.maxHp += hp;
    ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + hp);
    pushActivate(listener, ctx, 'twine', `Accessory: ${listener.name}`);
  },
};

/** @type {ScriptHandler} */
const ropePort = {
  handlerId: 'rope',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const cdItems = linked(ctx, piece).filter((o) => o.cooldown > 0 && o.cooldown < 500);
    piece._ropeTarget = cdItems[0] || null;
    const per = getPName(piece.params, 'speed', 8) / 100;
    const cap = getPName(piece.params, 'max', 40) / 100;
    piece._ropeAcc = 0;
  },
  onPeerActivated(listener, _a, ctx) {
    const target = listener._ropeTarget;
    if (!target) return;
    const per = getPName(listener.params, 'speed', 8) / 100;
    const cap = getPName(listener.params, 'max', 40) / 100;
    const left = cap - (Number(listener._ropeAcc) || 0);
    if (left <= 0) return;
    const add = Math.min(left, per);
    listener._ropeAcc = (Number(listener._ropeAcc) || 0) + add;
    addSpeed(target, add);
  },
};

/** @type {ScriptHandler} */
const twineBadgePort = {
  handlerId: 'twine_badge',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const spd = getPName(piece.params, 'speed', 10) / 100;
    for (const o of linked(ctx, piece)) {
      addSpeed(o, spd);
    }
  },
};

/** @type {ScriptHandler} */
const wolfBadgePort = {
  handlerId: 'wolf_badge',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._wolf = false;
    const th = getP1(piece.params, 50) / 100;
    const rageSpd = getP3(piece.params, 15) / 100;
    const dr = getP4(piece.params, 15);
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._wolf) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      piece._wolf = true;
      startBattleRage(ctx.player, getPName(piece.params, 'dur', 4), ctx.t, {
        bus: ctx.bus,
        sourceId: piece.itemId,
      });
      pushActivate(piece, ctx, 'wolf_badge', `Accessory: ${piece.name}`);
    });
    ctx.bus?.on?.('battle_rage_started', () => {
      grantTimedResistancePct(ctx.player, dr, ctx.player.battleRageUntil || ctx.t + 4, 'wolf_badge');
      for (const o of linked(ctx, piece)) {
        if (o.cooldown > 0 && o.cooldown < 500) addSpeed(o, rageSpd);
      }
    });
  },
};

/** TimePendant.gd — Every CDs: advance first ★ item that has an active CD. */
/** @type {ScriptHandler} */
const timePendantPort = {
  handlerId: 'time_pendant',
  family: 'custom_cd',
  onCooldownEffect(piece, ctx) {
    const sec = getPName(piece.params, 'cdadvance', getP1(piece.params, 1));
    const links = affectedTargets(
      ctx.graph,
      piece.placementKey,
      ctx.itemsById,
      ctx.canAffect,
    );
    const target = (ctx.pieces || []).find(
      (o) =>
        links.some((l) => l.key === o.placementKey) && isCooldownActive(o),
    );
    if (target && sec > 0) {
      const before = target.triggerTime;
      advanceCooldownSeconds(target, sec, ctx);
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        actor: 'player',
        target: 'player',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: sec,
        label: `${piece.name}: −${sec}s CD → ${target.name}`,
        meta: {
          category: 'buff',
          script: true,
          handler: 'time_pendant',
          stack: 'cooldown_advance',
          targetKey: target.placementKey,
          targetItemId: target.itemId,
          triggerBefore: before,
          triggerAfter: target.triggerTime,
          miniActivate: true,
        },
      });
    }
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AN_ACCESSORY_PORTS = {
  acorn_collar: acornCollarPort,
  holy_collar: holyCollarPort,
  magic_collar: magicCollarPort,
  spiked_collar: spikedCollarPort,
  vampiric_collar: vampiricCollarPort,
  amulet_of_darkness: amuletOfDarknessPort,
  amulet_of_feasting: amuletOfFeastingPort,
  star_of_courage: starOfCouragePort,
  piercing_arrow: piercingArrowPort,
  leaf_badge: leafBadgePort,
  poison_ivy: poisonIvyPort,
  lucky_cat: luckyCatPort,
  mana_orb: manaOrbPort,
  mega_clover: megaCloverPort,
  twine: twinePort,
  rope: ropePort,
  twine_badge: twineBadgePort,
  wolf_badge: wolfBadgePort,
  superior_ring: superiorRingPort,
  time_pendant: timePendantPort,
};
