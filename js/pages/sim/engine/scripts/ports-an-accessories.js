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
import { rarityPriority } from '../item-kind.js';
import { getStackAmount } from '../stacks.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { dealEffectDamage } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { superiorRingPort } from './ports-ring.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { rollPercent } from '../rng.js';
import { removeBlock } from './ports-wave-c-util.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function ropeSecondaryTarget(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect)
    .filter((link) => link.color === 'secondary');
  return (ctx.pieces || [])
    .filter((other) => {
      if (!links.some((link) => link.key === other.placementKey)) return false;
      // Rope.canAffect_secondary() is Item.hasCooldown(), which uses the
      // catalog descriptor rather than the current simulator trigger loop.
      return Number(ctx.itemsById.get(other.itemId)?.cooldown) > 0;
    })
    .at(-1) || null;
}

function ropeSpeedParams(piece) {
  return {
    per: Math.max(0, getPName(piece.params, 'speed', getP1(piece.params, 0)) / 100),
    cap: Math.max(0, getPName(piece.params, 'max', getP3(piece.params, 0)) / 100),
    duration: Math.max(0, getPName(piece.params, 'dur', getP2(piece.params, 0))),
  };
}

function expireRopeSpeed(listener, ctx) {
  const target = listener._ropeTarget;
  if (!target) return;
  const { per, cap } = ropeSpeedParams(listener);
  const total = Math.max(0, (Number(target._ropeSpeedupTotal) || 0) - per);
  target._ropeSpeedupTotal = total;
  const left = cap - total;
  if (left > 0 && per > 0) addSpeed(target, -Math.min(left, per));
}

function chanceOf(piece, ctx, key = 'chance', fb = 20) {
  const item = ctx.itemsById.get(piece.itemId);
  const n = Number(item?.[key] ?? piece.chance);
  return Number.isFinite(n) && n >= 0 ? n : fb;
}

function canHolyCollarAffect(other, item) {
  if (other?.canActivate === false) return false;
  return Boolean(other?.canActivate || (Number(other?.cooldown) > 0 && Number(other.cooldown) < 500) || item?.canActivate === true);
}

function baseChanceOf(piece, ctx, key) {
  const n = Number(ctx.itemsById.get(piece.itemId)?.[key]);
  return Number.isFinite(n) ? n : 0;
}

function canDamageTarget(ctx, other) {
  const item = ctx.itemsById.get(other.itemId);
  return (Number(item?.damageMin) || 0) > 0 || itemHasType(item, 'lifesteal');
}

function acornCollarTargets(ctx, piece) {
  return linked(ctx, piece).filter((other) => canDamageTarget(ctx, other));
}

/** @type {ScriptHandler} */
const acornCollarPort = {
  handlerId: 'acorn_collar',
  family: 'unique',
  // RangerCollar.prepare() captures damage-capable targets and applies one
  // Acorn Ace stamina factor per copy before AcornCollar.gd binds Lucky.
  onPrepare(piece, ctx) {
    const targets = acornCollarTargets(ctx, piece);
    const ace = ctx.itemsById.get('acorn_ace');
    const aceCount = (ctx.pieces || []).filter((other) => other.itemId === 'acorn_ace').length;
    const staminaReduction = -aceCount * getPName(ace?.params, 'stamina', 10) / 100;
    if (staminaReduction) {
      for (const other of targets) multiplyStaminaCost(other, staminaReduction);
    }
    if (!targets.length) return;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'lucky' || !ch.amount) return;
      const per = chanceOf(piece, ctx);
      for (const other of targets) {
        other.critChance = (Number(other.critChance) || 0) + ch.amount * per;
      }
    });
  },
};

/** @type {ScriptHandler} */
const holyCollarPort = {
  handlerId: 'holy_collar',
  family: 'unique',
  onPrepare(piece, ctx) {
    const targets = linked(ctx, piece).filter((other) =>
      canHolyCollarAffect(other, ctx.itemsById.get(other.itemId)),
    );
    piece._holyCollarTargets = new Set(targets.map((other) => other.placementKey));
    if (!targets.length) return;
    onBuffChanged(ctx.player, (ch) => {
      if ((ch.stack !== 'lucky' && ch.stack !== 'regeneration') || !ch.amount) return;
      const per = baseChanceOf(piece, ctx, 'chance2');
      for (const o of targets) {
        o.critChance = (Number(o.critChance) || 0) + ch.amount * per;
      }
    });
  },
  onPeerActivated(listener, activated, ctx) {
    if (!listener._holyCollarTargets?.has(activated?.placementKey)) return;
    if (!rollPercent(chanceOf(listener, ctx), ctx.rng)) return;
    const luck = Math.max(0, Math.round(getPName(listener.params, 'luck', getP1(listener.params, 1))));
    const regen = Math.max(0, Math.round(getPName(listener.params, 'regen', getP2(listener.params, 1))));
    if (luck > 0) grantStacks(ctx.player, 'lucky', luck, {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
    if (regen > 0) grantStacks(ctx.player, 'regeneration', regen, {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      actor: eventSideForPiece(listener),
      itemId: listener.itemId,
      placementKey: listener.placementKey,
      label: `${listener.name}: mini activate`,
      meta: { category: 'system', script: true, handler: 'holy_collar', miniActivate: true },
    });
  },
};

/** @type {ScriptHandler} */
const magicCollarPort = {
  handlerId: 'magic_collar',
  family: 'unique',
  onPrepare(piece, ctx) {
    if (piece._magicCollarPrepared) return;
    piece._magicCollarPrepared = true;
    piece._magicCollarTargets = new Set(linked(ctx, piece).map((other) => other.placementKey));
    // MagicCollar.gd connects each empowered weapon's `attacked` signal.
    // The simulator exposes that item-scoped signal as `item_attacked`; the
    // broader piece_dealt_damage signal also fires for effect damage and would
    // over-trigger the collar compared with the game.
    ctx.bus?.on?.('item_attacked', (payload) => {
      if (!payload?.hit?.hit) return;
      const host = payload.piece;
      if (!host || !piece._magicCollarTargets?.has(host.placementKey)) return;
      const luck = Math.max(0, getStackAmount(ctx.player, 'lucky'));
      if (!rollPercent(chanceOf(piece, ctx) * luck, ctx.rng)) return;
      const mana = Math.trunc(getPName(piece.params, 'mana', getP1(piece.params, 0)));
      const granted = grantStacks(ctx.player, 'mana', mana, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        actor: eventSideForPiece(piece),
        target: eventSideForPiece(piece),
        amount: granted.gained ?? mana,
        label: `${piece.name}: +${granted.gained ?? mana} Mana`,
        meta: { category: 'buff', stack: 'mana', script: true, handler: 'magic_collar' },
      });
      ctx.events.push({
        t: ctx.t,
        type: 'info',
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'magic_collar', miniActivate: true },
      });
    });
  },
  onCombatStart(piece, ctx) {
    if (!piece._magicCollarPrepared) this.onPrepare(piece, ctx);
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
  onPrepare(piece, ctx) {
    const maxLs = getPName(piece.params, 'max', getP2(piece.params, 25)) / 100;
    const targets = linked(ctx, piece);
    if (!targets.length) return;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'vampirism' || !ch.amount) return;
      const per = chanceOf(piece, ctx) / 100;
      for (const o of targets) {
        o.critChance = (Number(o.critChance) || 0) + ch.amount * per * 100;
      }
    });
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      const damage = Number(payload?.hit?.damage ?? payload?.hit?.healthDamage) || 0;
      if (!payload?.hit?.hit || damage <= 0) return;
      if (!targets.some((o) => o === payload.piece)) return;
      const luck = Math.max(1, getStackAmount(ctx.player, 'lucky'));
      const fac = Math.min(
        maxLs,
        (getPName(piece.params, 'lifesteal', getP1(piece.params, 5)) / 100) * luck,
      );
      if (fac > 0) healActor(ctx.player, Math.max(1, damage * fac));
    });
  },
};

/** LeafBadge.gd — CD giveLucky(1)+activate; lucky → crit% on canDamage links. */
const leafBadgePort = {
  handlerId: 'leaf_badge',
  family: 'unique',
  onPrepare(piece, ctx) {
    const targets = () => linked(ctx, piece).filter((other) => canDamageTarget(ctx, other));
    if (!targets().length) return;
    const per = chanceOf(piece, ctx, 'chance', 2) / 100;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'lucky' || !ch.amount) return;
      for (const o of targets()) {
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
  // AmuletofDarkness.gd binds both listeners in onPrepare, before start-time
  // activations can produce effect damage.
  onPrepare(piece, ctx) {
    piece._darkAcc = 0;
    const th = Math.max(1, Math.round(getPName(piece.params, 'damt', getP1(piece.params, 20))));
    ctx.bus?.on?.('character_damaged', (payload) => {
      const damage = payload?.damage;
      if (payload?.actor !== ctx.dummy || !payload?.hit || damage?.damageSource?.isEffectDamage !== true) return;
      piece._darkAcc += damage.damage || 0;
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
    dealEffectDamage(listener, ctx, dam);
    pushActivate(listener, ctx, 'amulet_of_darkness', `Accessory: ${listener.name}`);
  },
};

/** @type {ScriptHandler} */
const amuletOfFeastingPort = {
  handlerId: 'amulet_of_feasting',
  family: 'unique',
  // AmuletofFeasting.gd applies Food speed in onPrepare so affected Food
  // cooldowns are armed with the adjusted value.
  onPrepare(piece, ctx) {
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
  onPrepare(piece, ctx) {
    const fac = -getPName(piece.params, 'stamina', getP2(piece.params, 0)) / 100;
    for (const o of ctx.pieces || []) {
      if (!itemHasType(ctx.itemsById.get(o.itemId), 'weapon')) continue;
      multiplyStaminaCost(o, fac);
    }
  },
};

/** @type {ScriptHandler} */
const piercingArrowPort = {
  handlerId: 'piercing_arrow',
  family: 'unique',
  onPrepare(piece, ctx) {
    const sev = getP1(piece.params, 15) / 100;
    const rawStrip = Number(getP2(piece.params, 2));
    const strip = Number.isFinite(rawStrip) ? Math.trunc(rawStrip) : 2;
    for (const o of linked(ctx, piece)) {
      if (!canBeEmpoweredPiece(o)) continue;
      o.critSeverity = (Number(o.critSeverity) || 0) + sev;
    }
    for (const weapon of linked(ctx, piece)) {
      weapon._preDealLate ||= [];
      weapon._preDealLate.push((res) => {
        if (res?.critical) removeBlock(ctx.dummy, strip, ctx, weapon);
      });
    }
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
  onPrepare(piece, ctx) {
    const n = linked(ctx, piece).filter((o) => itemHasType(ctx.itemsById.get(o.itemId), 'nature')).length;
    piece._ivyAmp = false;
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.poison =
      (Number(ctx.player.stackResist.poison) || 0) + chanceOf(piece, ctx) * n;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'spikes' || !(ch.amount > 0)) return;
      grantStacks(ctx.dummy, 'poison', ch.amount * Math.max(1, Math.round(getP4(piece.params, 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      ctx.events.push({
        t: ctx.t,
        type: 'activate',
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'poison_ivy', miniActivate: true },
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
  onPrepare(piece, ctx) {
    const gold = linked(ctx, piece).reduce(
      (sum, other) => sum + (Number(ctx.itemsById.get(other.itemId)?.cost) || 0),
      0,
    );
    const g1 = getPName(piece.params, 'gold1', getP2(piece.params, 0));
    const g2 = getPName(piece.params, 'gold2', getP3(piece.params, 0));
    piece._luckyCatState = gold > g2 ? 'two' : gold > g1 ? 'one' : 'none';
    if (gold > g1) {
      ctx.player.critResistance = (Number(ctx.player.critResistance) || 0) + chanceOf(piece, ctx);
    }
    if (gold > g2) {
      const spd = getPName(piece.params, 'speed', getP4(piece.params, 0)) / 100;
      for (const o of ctx.pieces || []) {
        const item = ctx.itemsById.get(o.itemId);
        if (rarityPriority(item) < 4 || !(Number(item?.cooldown) > 0)) continue;
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
  onPrepare(piece) {
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
  onPrepare(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    piece._twineMaxHealth = Math.trunc(getP1(piece.params, 0));
    piece._twineTriggers = new Set(links.filter((link) => link.color === 'primary').map((link) => link.key));
    piece._twineSecondaryCount = links.filter((link) => link.color === 'secondary').length;
  },
  onPeerActivated(listener, activated, ctx) {
    if (!listener._twineTriggers?.has(activated?.placementKey)) return;
    const n2 = Number(listener._twineSecondaryCount) || 0;
    const ch = baseChanceOf(listener, ctx, 'chance') + n2 * baseChanceOf(listener, ctx, 'chance2');
    if (!rollPercent(ch, ctx.rng)) return;
    const hp = Number(listener._twineMaxHealth) || 0;
    if (hp > 0) {
      ctx.player.maxHp += hp;
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + hp);
    }
    pushActivate(listener, ctx, 'twine', `Accessory: ${listener.name}`);
  },
};

/** @type {ScriptHandler} */
const ropePort = {
  handlerId: 'rope',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._ropeTarget = ropeSecondaryTarget(ctx, piece);
    piece._ropeSpeedupTotal = 0;
    const previous = piece._onTimedSpeedEnd;
    piece._onTimedSpeedEnd = (tag, event) => {
      previous?.(tag, event);
      if (tag === 'rope_expire') expireRopeSpeed(piece, ctx);
    };
  },
  onPeerActivated(listener, activated, ctx) {
    const target = listener._ropeTarget;
    if (!target) return;
    const links = affectedTargets(ctx.graph, listener.placementKey, ctx.itemsById, ctx.canAffect);
    if (!links.some((link) => link.key === activated?.placementKey && link.color !== 'secondary')) return;
    const { per, cap, duration } = ropeSpeedParams(listener);
    const total = Number(target._ropeSpeedupTotal) || 0;
    const left = cap - total;
    if (left > 0 && per > 0) addSpeed(target, Math.min(left, per));
    // Game.dictAdd() records the full per-trigger amount even when the visible
    // speed is capped; the timeout later subtracts that same amount.
    target._ropeSpeedupTotal = total + per;
    if (duration > 0) {
      const untilT = ctx.t + duration;
      const listenerTimers = listener._timedSpeeds || (listener._timedSpeeds = []);
      const existing = listenerTimers.find((entry) => entry.tag === 'rope_expire');
      if (existing) existing.untilT = untilT;
      else listenerTimers.push({ frac: 0, untilT, tag: 'rope_expire' });
    }
    ctx.events.push({
      t: ctx.t + 0.001,
      type: 'info',
      itemId: listener.itemId,
      placementKey: listener.placementKey,
      label: `${listener.name}: mini activate`,
      meta: {
        category: 'system',
        script: true,
        handler: 'rope',
        miniActivate: true,
        targetKey: target.placementKey,
      },
    });
  },
};

/** @type {ScriptHandler} */
const twineBadgePort = {
  handlerId: 'twine_badge',
  family: 'unique',
  onPrepare(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const speed = getP1(piece.params, 0) / 100;
    const chanceRaw = Number(piece.chance ?? ctx.itemsById.get(piece.itemId)?.chance);
    const amp = Number.isFinite(chanceRaw) ? chanceRaw : 0;
    for (const link of links) {
      const other = (ctx.pieces || []).find((candidate) => candidate.placementKey === link.key);
      if (!other) continue;
      if (speed) addSpeed(other, speed);
      if (amp) other.buffAmpChance = (Number(other.buffAmpChance) || 0) + amp;
    }
  },
};

/** @type {ScriptHandler} */
const wolfBadgePort = {
  handlerId: 'wolf_badge',
  family: 'unique',
  // WolfBadge.gd connects its damage and rage listeners during onPrepare.
  onPrepare(piece, ctx) {
    piece._wolf = false;
    const th = getP1(piece.params, 50) / 100;
    const rageSpd = getP3(piece.params, 15) / 100;
    const dr = getP4(piece.params, 15);
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
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
    // Item.getFirstAffectedItem() selects the first affected star in source
    // order, then the source checks that one item's active-CD state. It does
    // not skip an inactive first target to search later stars.
    const firstTarget = links
      .map((link) => (ctx.pieces || []).find((o) => o.placementKey === link.key))
      .find(Boolean);
    const target = firstTarget && isCooldownActive(firstTarget) ? firstTarget : null;
    if (target && sec > 0) {
      const before = target.triggerTime;
      advanceCooldownSeconds(target, sec, ctx);
      const side = eventSideForPiece(piece);
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        actor: side,
        target: side,
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
