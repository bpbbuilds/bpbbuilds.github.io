/**
 * Mechanical / nature board ports (Battery line, Bloodthorne, Yggdrasil, …).
 */

import { healActor, tryUseStamina } from '../actor.js';
import { cleanseRandomDebuffs, grantStacks, onBuffChanged, useRegeneration } from '../buff-economy.js';
import { gainStacks, loseStacks } from '../stacks.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamageFromBuffChange } from '../piece-stats.js';
import { affectedTargets } from '../board-graph.js';
import { randInt, shuffleInPlace } from '../rng.js';
import {
  advanceCooldownSeconds,
  isCooldownActive,
} from '../cooldown.js';
import { dealHit } from './handlers.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { emitBatterySpark } from '../charge-delivery.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** Battery — emitCharge spark path + timed addSpeed on cells. */
/** @type {ScriptHandler} */
export const batteryPort = {
  handlerId: 'battery',
  family: 'unique',
  emitCharge(piece, ctx, speedFactor = 1) {
    emitBatterySpark(piece, ctx, speedFactor);
  },
  onCombatStart(piece, ctx) {
    emitBatterySpark(piece, ctx, 1);
    ctx.bus?.emit?.('charge_emitted', { piece, t: ctx.t });
  },
};

/**
 * Tesla Coil — Exclusive/TeslaCoil.gd
 * Collect charges → spend advancing ally CDs (★ first), then live advances.
 */
/** @type {ScriptHandler} */
export const teslaCoilPort = {
  handlerId: 'tesla_coil',
  family: 'custom_cd',
  onCombatStart(piece, ctx) {
    const { events, t, graph, itemsById, canAffect, pieces, rng } = ctx;
    const starLinks = affectedTargets(
      graph,
      piece.placementKey,
      itemsById,
      canAffect,
    ).filter((link) => {
      const p = (pieces || []).find((x) => x.placementKey === link.key);
      return p && isCooldownActive(p) && p.placementKey !== piece.placementKey;
    });
    /** @type {string[]} */
    const starKeys = starLinks.map((l) => l.key);
    shuffleInPlace(starKeys, rng);

    /** @type {string[]} */
    const otherKeys = [];
    const seen = new Set(starKeys);
    seen.add(piece.placementKey);
    for (const p of pieces || []) {
      if (seen.has(p.placementKey)) continue;
      if (!isCooldownActive(p)) continue;
      otherKeys.push(p.placementKey);
    }
    shuffleInPlace(otherKeys, rng);

    piece.tesla = {
      collectCharges: true,
      numCollectedCharges: 0,
      advanceItemCounter: 0,
      itemsToAdvance: [...starKeys, ...otherKeys],
      consumed: false,
    };

    events.push({
      t,
      type: 'info',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: queue ${piece.tesla.itemsToAdvance.length} item(s)`,
      meta: {
        category: 'system',
        script: true,
        handler: 'tesla_coil',
        phase: 'tesla_prepare',
        queue: piece.tesla.itemsToAdvance.slice(),
        starCount: starKeys.length,
      },
    });
  },

  onChargeReceived(piece, ctx) {
    const st = piece.tesla;
    if (!st || st.consumed) return;
    const { t, events } = ctx;

    if (st.collectCharges) {
      st.numCollectedCharges += 1;
      events.push({
        t,
        type: 'activate',
        actor: 'player',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: ${st.numCollectedCharges} charge(s)`,
        meta: {
          category: 'system',
          script: true,
          handler: 'tesla_coil',
          phase: 'charge_received',
          teslaCharges: st.numCollectedCharges,
          miniActivate: true,
        },
      });
      return;
    }

    advanceTeslaTarget(piece, ctx);
  },

  onCooldownEffect(piece, ctx) {
    const st = piece.tesla;
    if (!st) {
      ctx.events.push({
        t: ctx.t,
        type: 'activate',
        actor: 'player',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name} activated.`,
        meta: { category: 'system', script: true, handler: 'tesla_coil' },
      });
      return true;
    }

    st.collectCharges = false;
    const batch = st.numCollectedCharges;
    for (let i = 0; i < batch; i += 1) {
      advanceTeslaTarget(piece, ctx);
    }

    ctx.events.push({
      t: ctx.t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: spent ${batch} charge(s)`,
      meta: {
        category: 'system',
        script: true,
        handler: 'tesla_coil',
        phase: 'tesla_spend',
        teslaCharges: batch,
        queueDone: st.advanceItemCounter >= st.itemsToAdvance.length,
      },
    });

    if (st.advanceItemCounter >= st.itemsToAdvance.length) {
      st.consumed = true;
    }
    // If queue remains, normal CD loop re-activates and spends another batch.
    return true;
  },
};

/**
 * @param {import('../pieces.js').CombatPiece} piece
 * @param {import('./handlers.js').ScriptCtx} ctx
 */
function advanceTeslaTarget(piece, ctx) {
  const st = piece.tesla;
  if (!st || st.consumed) return;
  const cdAdvance = getPName(piece.params, 'cdadvance', getP1(piece.params, 3));
  const amount = Number(cdAdvance) || 3;
  const pieces = ctx.pieces || [];

  while (st.advanceItemCounter < st.itemsToAdvance.length) {
    const key = st.itemsToAdvance[st.advanceItemCounter];
    st.advanceItemCounter += 1;
    const target = pieces.find((p) => p.placementKey === key);
    if (!target || !isCooldownActive(target)) continue;

    const before = target.triggerTime;
    advanceCooldownSeconds(target, amount, ctx);
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      actor: 'player',
      target: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount,
      label: `${piece.name}: −${amount}s CD → ${target.name}`,
      meta: {
        category: 'buff',
        script: true,
        handler: 'tesla_coil',
        phase: 'tesla_advance',
        targetKey: target.placementKey,
        targetItemId: target.itemId,
        cdAdvance: amount,
        triggerBefore: before,
        triggerAfter: target.triggerTime,
        miniActivate: true,
      },
    });

    if (st.advanceItemCounter >= st.itemsToAdvance.length) {
      st.consumed = true;
    }
    return;
  }
  st.consumed = true;
}

/** Robodog — CD: Lucky + Heat. */
/** @type {ScriptHandler} */
export const robodogPort = {
  handlerId: 'robodog',
  family: 'custom_cd',
  onCooldownEffect(piece, ctx) {
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP1(piece.params, 1))));
    const heat = Math.max(0, Math.round(getPName(piece.params, 'heat', getP2(piece.params, 1))));
    gainStacks(ctx.player, 'lucky', luck);
    if (heat > 0) gainStacks(ctx.player, 'heat', heat);
    // Prefer ports-ai-c2 robodog (grantStacks); this MECH copy must not add a summary buff.
    return true;
  },
};

/** Bloodthorne.gd — onPrepare: vamp/spikes → varying damage; onPreDealDamage_early convert regen. */
/** @type {ScriptHandler} */
export const bloodthornePort = {
  handlerId: 'bloodthorne',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'vampirism' && ch.stack !== 'spikes') return;
      if (!ch.amount) return;
      addBonusDamageFromBuffChange(piece, ch);
    });
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    const need = Math.max(1, Math.round(getP1(piece.params, 3)));
    if ((ctx.player.stacks.regeneration || 0) < need) return;
    useRegeneration(ctx.player, need, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const vamp = Math.max(1, Math.round(getP2(piece.params, 1)));
    const spikes = Math.max(1, Math.round(getP3(piece.params, 1)));
    grantStacks(ctx.player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(ctx.player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    if (tryUseStamina(player, piece.staminaCost) === 'starve') {
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true },
      });
      return false;
    }
    pushActivate(piece, ctx, 'bloodthorne', `Weapon: ${piece.name}`);
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    dealHit(piece, ctx, raw);
    return true;
  },
};

/** Yggdrasil Leaf — start: Mana + Regen × Nature links. */
/** @type {ScriptHandler} */
export const yggdrasilLeafPort = {
  handlerId: 'yggdrasil_leaf',
  family: 'synergy_aura',
  onPrepare(piece, ctx) {
    piece._manaUsed = 0;
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP3(piece.params, 5))));
    onBuffChanged(ctx.player, (change) => {
      if (change.stack !== 'mana' || change.amount >= 0 || !change.used) return;
      piece._manaUsed += -change.amount;
      const activations = Math.floor(piece._manaUsed / need);
      if (activations <= 0) return;
      piece._manaUsed %= need;
      healActor(ctx.player, Math.max(1, Math.round(getPName(piece.params, 'heal', 20))) * activations);
      cleanseRandomDebuffs(
        ctx.player,
        Math.max(1, Math.round(getPName(piece.params, 'cleanse', 2))) * activations,
        ctx.rng,
        { originKey: piece.placementKey, originId: piece.itemId },
      );
      pushActivate(piece, ctx, 'yggdrasil_leaf', `Accessory: ${piece.name}`);
    });
  },
  onCombatStart(piece, ctx) {
    const links = affectedTargets(
      ctx.graph,
      piece.placementKey,
      ctx.itemsById,
      ctx.canAffect,
    );
    const n = Math.max(0, links.filter((link) => itemHasType(ctx.itemsById.get(link.id), 'nature')).length);
    const mana = Math.max(0, Math.round(getP1(piece.params, 1) * n));
    const regen = Math.max(0, Math.round(getP2(piece.params, 1) * n));
    if (mana > 0) gainStacks(ctx.player, 'mana', mana);
    if (regen > 0) gainStacks(ctx.player, 'regeneration', regen);
    pushActivate(piece, ctx, 'yggdrasil_leaf', `Accessory: ${piece.name}`);
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: 'player',
      amount: regen || mana,
      itemId: piece.itemId,
      label: `${piece.name}: +${mana} Mana +${regen} Regen (${n} Nature)`,
      meta: { category: 'buff', script: true, handler: 'yggdrasil_leaf' },
    });
  },
};

/**
 * Cog.gd — giveBlock(getBlock() * getNumAffectedItems()); activate().
 * Star/canAffect only (isCrafted) — do not use body-adjacent fallback from affectedTargets.
 */
/** @type {ScriptHandler} */
export const cogPort = {
  handlerId: 'cog',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const allLinks = affectedTargets(
      ctx.graph,
      piece.placementKey,
      ctx.itemsById,
      ctx.canAffect,
    );
    // Game getNumAffectedItems = star/rule cells only; adjacent supplement is sim-only.
    const links = allLinks.filter((l) => l.via === 'rule');
    const per = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 5)));
    const n = per * Math.max(0, links.length);
    const side = eventSideForPiece(piece);
    const owner = side === 'dummy' ? ctx.dummy : ctx.player;
    if (n > 0) {
      pushActivate(piece, ctx, 'cog', `Accessory: ${piece.name}`);
      gainStacks(owner, 'block', n);
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        actor: side,
        target: side,
        amount: n,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${n} Block (${links.length} crafted)`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'cog' },
      });
    }
  },
};

/** @type {Record<string, ScriptHandler>} */
export const MECH_PORTS = {
  battery: batteryPort,
  tesla_coil: teslaCoilPort,
  robodog: robodogPort,
  bloodthorne: bloodthornePort,
  // mecha_bat → ports-ai-c.js (MechaBat.gd: lucky/stamina branches + charged lifesteal)
  yggdrasil_leaf: yggdrasilLeafPort,
  cog: cogPort,
};
