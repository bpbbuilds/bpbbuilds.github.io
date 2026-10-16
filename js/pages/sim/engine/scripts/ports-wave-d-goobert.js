/**
 * Band AG 196–197 — gooberts + crowns (peer / mana / invuln vs .gd).
 */

import {
  cleanseRandomDebuffs,
  giveMostBuffs,
  grantStacks,
  grantTemporaryStacks,
  useMana,
} from '../buff-economy.js';
import {
  grantBuffProtect,
  grantInvuln,
  healActor,
  isInvulnerable,
} from '../actor.js';
import { getP1, getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { gainStacks } from '../stacks.js';
import { addBonusDamage } from '../piece-stats.js';
import { affectedTargets } from '../board-graph.js';
import {
  setPieceInvulnBudget,
  spendPieceInvulnBudget,
} from '../timed-speed.js';
import { pushActivate, pushBuffGrants } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @param {import('../actor.js').SimActor} actor @param {number} nowT */
function isVulnerable(actor, nowT) {
  return !isInvulnerable(actor, nowT);
}

/**
 * @param {object} piece
 * @param {object} ctx
 * @param {string} handler
 * @param {number} heal
 * @param {{ activate?: boolean }} [opts]
 */
export function goobertHeal(piece, ctx, handler, heal, opts = {}) {
  healActor(ctx.player, heal);
  const logged = Number(ctx.player?._lastHeal?.loggedAmount) || 0;
  if (logged > 0) {
    const side = eventSideForPiece(piece);
    ctx.events.push({
      t: ctx.t + 0.003,
      type: 'heal',
      actor: side,
      target: side,
      amount: logged,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: heal +${logged}`,
      meta: {
        category: 'heal',
        script: true,
        handler,
        loggedAmount: logged,
        requestedHealAmount: heal,
        overheal: Math.max(0, Number(ctx.player?._lastHeal?.overheal) || 0),
      },
    });
  }
  if (opts.activate !== false) pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
  return true;
}

/**
 * Peer activation counter — Goobert.gd onItemActivated.
 * @param {object} piece
 * @param {object} ctx
 * @param {() => void} effect
 */
export function goobertPeerTick(piece, ctx, effect) {
  const need = getP1(piece.params, 0);
  piece._goobertActs = (piece._goobertActs || 0) + 1;
  if (piece._goobertActs !== need) return;
  piece._goobertActs = 0;
  effect();
}

/** @param {object} piece @param {object} ctx @param {string} handler @param {number} [damOverride] */
export function empowerLinkedWeapons(piece, ctx, handler, damOverride) {
  const dam = Math.max(0, Math.round(damOverride ?? getP6(piece.params, 2)));
  if (!dam) return;
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  for (const other of ctx.pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (other.empowerable === false) continue;
    if (!(other.damageMax > 0 || other.damageMin > 0)) continue;
    addBonusDamage(other, dam);
  }
  void handler;
}

/** @type {ScriptHandler} */
export const goobertPort = {
  handlerId: 'goobert',
  family: 'pet_like',
  onPrepare(piece) {
    piece._goobertActs = 0;
  },
  // Peer-only — no timed CD heal (would double-fire)
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      const heal = modifiedParamValue(
        listener,
        getPName(listener.params, 'heal', getP2(listener.params, 0)),
        'heal',
      );
      goobertHeal(listener, ctx, listener.itemId || 'goobert', heal);
    });
  },
};

/** @type {ScriptHandler} */
export const cupcakeGoobertPort = {
  handlerId: 'cupcake_goobert',
  family: 'pet_like',
  onPrepare(piece) {
    piece._goobertActs = 0;
  },
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      const heal = Math.max(1, Math.round(getPName(listener.params, 'heal', getP2(listener.params, 8))));
      goobertHeal(listener, ctx, 'cupcake_goobert', heal, { activate: false });
      const n = Math.max(1, Math.round(getPName(listener.params, 'buffs', getP3(listener.params, 1))));
      const picked = giveMostBuffs(ctx.player, n, ctx.rng, {
        originKey: listener.placementKey,
        originId: listener.itemId,
      });
      pushBuffGrants(ctx.events, listener, ctx.player, ctx.t, 'cupcake_goobert', picked, 0.005);
      pushActivate(listener, ctx, 'cupcake_goobert', `Pet: ${listener.name}`);
    });
  },
};

/** @type {ScriptHandler} */
export const lightGoobertPort = {
  handlerId: 'light_goobert',
  family: 'pet_like',
  onCombatStart(piece) {
    piece._goobertActs = 0;
  },
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      const heal = Math.max(1, Math.round(getPName(listener.params, 'heal', getP2(listener.params, 8))));
      goobertHeal(listener, ctx, 'light_goobert', heal);
      const blind = Math.max(1, Math.round(getP3(listener.params, 1)));
      const dur = Math.max(0.5, getPName(listener.params, 'dur_blind', 3));
      grantTemporaryStacks(ctx.dummy, 'blind', blind, dur, ctx.t, {
        originKey: listener.placementKey,
        originId: listener.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
    });
  },
};

/** @type {ScriptHandler} */
export const kingGoobertPort = {
  handlerId: 'king_goobert',
  family: 'pet_like',
  onCombatStart(piece) {
    piece._goobertActs = 0;
    setPieceInvulnBudget(piece, getPName(piece.params, 'charges', 2));
    piece._crownState = 'Inactive';
  },
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      const prot = Math.max(1, Math.round(getPName(listener.params, 'buffs', 1)));
      grantBuffProtect(ctx.player, prot);
      const heal = Math.max(1, Math.round(getPName(listener.params, 'heal', getP2(listener.params, 10))));
      goobertHeal(listener, ctx, 'king_goobert', heal);
      const manaCost = Math.max(1, Math.round(getPName(listener.params, 'mana', getP3(listener.params, 2))));
      if (
        spendPieceInvulnBudget(listener) &&
        isVulnerable(ctx.player, ctx.t) &&
        (ctx.player.stacks.mana || 0) >= manaCost
      ) {
        useMana(ctx.player, manaCost, {
          originKey: listener.placementKey,
          originId: listener.itemId,
        });
        const dur = Math.max(0.5, getPName(listener.params, 'dur_invu', getPName(listener.params, 'dur_invuln', 1.5)));
        grantInvuln(ctx.player, dur, ctx.t, {
          sourceId: listener.itemId,
          sourceKey: listener.placementKey,
          bus: ctx.bus,
        });
        listener._crownState = 'Active';
        ctx.events.push({
          t: ctx.t + 0.005,
          type: 'buff',
          target: 'player',
          amount: 1,
          label: `${listener.name}: Invuln ${dur}s`,
          meta: { category: 'buff', stack: 'invuln', script: true, handler: 'king_goobert' },
        });
      }
    });
  },
};

/** RainbowGoobertMage.gd — source-ordered peer effect with zero-safe parameters. */
function rainbowMageEffect(piece, ctx) {
  const handler = 'rainbow_goobert_mage';
  const block = Number(piece.block ?? ctx.itemsById.get(piece.itemId)?.block) || 0;
  if (block > 0) gainStacks(ctx.player, 'block', block);
  goobertHeal(
    piece,
    ctx,
    handler,
    getPName(piece.params, 'heal', getP2(piece.params, 0)),
    { activate: false },
  );

  const vamp = getP3(piece.params, 0);
  if (vamp > 0) {
    grantStacks(ctx.player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }

  const buffs = getP4(piece.params, 0);
  const picked = giveMostBuffs(ctx.player, buffs, ctx.rng, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, handler, picked, 0.004);

  const blind = getP5(piece.params, 0);
  if (blind > 0) gainStacks(ctx.dummy, 'blind', blind, { rng: ctx.rng, opponent: ctx.player });
  empowerLinkedWeapons(piece, ctx, handler, getP6(piece.params, 0));
  pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
}

/** RainbowGoobertRanger.gd — source-ordered peer effect with zero-safe parameters. */
function rainbowRangerEffect(piece, ctx) {
  const handler = 'rainbow_goobert_ranger';
  const block = Number(piece.block ?? ctx.itemsById.get(piece.itemId)?.block) || 0;
  if (block > 0) gainStacks(ctx.player, 'block', block);
  goobertHeal(
    piece,
    ctx,
    handler,
    getPName(piece.params, 'heal', getP2(piece.params, 0)),
    { activate: false },
  );

  const vamp = getP3(piece.params, 0);
  if (vamp > 0) {
    grantStacks(ctx.player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }

  const empower = getP4(piece.params, 0);
  if (empower > 0) {
    grantStacks(ctx.player, 'empower', empower, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }

  const blind = getP5(piece.params, 0);
  if (blind > 0) gainStacks(ctx.dummy, 'blind', blind, { rng: ctx.rng, opponent: ctx.player });
  empowerLinkedWeapons(piece, ctx, handler, getP6(piece.params, 0));
  pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
}

/** @type {ScriptHandler} */
export const rainbowGoobertMagePort = {
  handlerId: 'rainbow_goobert_mage',
  family: 'pet_like',
  onPrepare(piece) {
    piece._goobertActs = 0;
  },
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      rainbowMageEffect(listener, ctx);
    });
  },
};

/** @type {ScriptHandler} */
export const rainbowGoobertRangerPort = {
  handlerId: 'rainbow_goobert_ranger',
  family: 'pet_like',
  onPrepare(piece) {
    piece._goobertActs = 0;
  },
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      rainbowRangerEffect(listener, ctx);
    });
  },
};

/**
 * Crown mana → once-per-fight duration invuln.
 * @param {object} piece
 * @param {object} ctx
 * @param {string} handler
 */
function bindCrownManaTrigger(piece, ctx, handler) {
  piece._crownState = 'Inactive';
  const manaCost = Math.max(1, Math.round(getPName(piece.params, 'mana', getPName(piece.params, 'manat', 4))));
  const crownTime = (payload = {}) => {
    if (Number.isFinite(Number(payload.t))) return Number(payload.t);
    if (Number.isFinite(Number(piece._lastSimT))) return Number(piece._lastSimT);
    return Number(ctx.t) || 0;
  };
  const finishCrown = (nowT) => {
    if (
      piece._crownState === 'Active' &&
      piece._crownUsedAt != null &&
      nowT >= piece._crownUsedAt
    ) {
      piece._crownState = 'Used';
    }
  };
  piece._finishCrown = finishCrown;
  piece._tryCrownInvuln = (nowT, triggerEvent = null) => {
    const at = Number(nowT) || 0;
    finishCrown(at);
    if (piece._crownState !== 'Inactive') return;
    if (!isVulnerable(ctx.player, at)) return;
    if ((ctx.player.stacks.mana || 0) < manaCost) return;
    piece._crownState = 'Active';
    const dur = Math.max(
      0.5,
      getPName(piece.params, 'dur_invu', getPName(piece.params, 'dur_invuln', getP2(piece.params, 2))),
    );
    grantInvuln(ctx.player, dur, at, {
      sourceId: piece.itemId,
      sourceKey: piece.placementKey,
      bus: ctx.bus,
    });
    piece._crownUsedAt = at + dur;
    useMana(ctx.player, manaCost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      triggerEvent,
    });
    pushActivate(piece, { ...ctx, t: at }, handler, `Accessory: ${piece.name}`);
    ctx.events.push({
      t: at + 0.003,
      type: 'buff',
      target: 'player',
      amount: 1,
      label: `${piece.name}: Invuln ${dur}s`,
      meta: { category: 'buff', stack: 'invuln', script: true, handler },
    });
  };
  piece._crownWasInvulnerable = isInvulnerable(ctx.player, Number(ctx.t) || 0);
  piece._crownTick = (nowT) => {
    const at = Number(nowT) || 0;
    const wasInvulnerable = piece._crownWasInvulnerable;
    const currentlyInvulnerable = isInvulnerable(ctx.player, at);
    piece._crownWasInvulnerable = currentlyInvulnerable;
    finishCrown(at);
    if (wasInvulnerable && !currentlyInvulnerable) {
      piece._tryCrownInvuln(at, { actor: ctx.player, t: at, reason: 'invulnerable_end' });
    }
  };
  ctx.bus?.on?.('character_mana_changed', (payload = {}) => {
    if (payload.actor && payload.actor !== ctx.player) return;
    piece._tryCrownInvuln(crownTime(payload), payload);
  });
  ctx.bus?.on?.('character_invulnerable_end', (payload = {}) => {
    if (payload.actor && payload.actor !== ctx.player) return;
    piece._tryCrownInvuln(crownTime(payload), payload);
  });
}

/** @type {ScriptHandler} */
export const crownPort = {
  handlerId: 'crown',
  family: 'unique',
  onPrepare(piece, ctx) {
    bindCrownManaTrigger(piece, ctx, 'crown');
  },
  onTick(piece, ctx) {
    piece._crownTick?.(ctx.t);
  },
  onCooldownEffect(piece, ctx) {
    piece._lastSimT = ctx.t;
    cleanseRandomDebuffs(ctx.player, 1, ctx.rng, {
      availableDebuffs: ['blind'],
      cleanse: true,
      rng: ctx.rng,
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', getP3(piece.params, 8))));
    const healed = healActor(ctx.player, heal);
    if (healed > 0) {
      ctx.events.push({
        t: ctx.t + 0.005,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: heal +${healed}`,
        meta: { category: 'heal', script: true, handler: 'crown' },
      });
    }
    pushActivate(piece, ctx, 'crown', `Accessory: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const kingCrownPort = {
  handlerId: 'king_crown',
  family: 'unique',
  onCombatStart(piece, ctx) {
    bindCrownManaTrigger(piece, ctx, 'king_crown');
  },
  onTick(piece, ctx) {
    piece._crownTick?.(ctx.t);
  },
  onCooldownEffect(piece, ctx) {
    piece._lastSimT = ctx.t;
    if (piece._crownState === 'Active' && piece._crownUsedAt != null && ctx.t >= piece._crownUsedAt) {
      piece._crownState = 'Used';
    }
    pushActivate(piece, ctx, 'king_crown', `Accessory: ${piece.name}`);
    grantBuffProtect(ctx.player, 1);
    const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', getP3(piece.params, 10))));
    const healed = healActor(ctx.player, heal);
    if (healed > 0) {
      ctx.events.push({
        t: ctx.t + 0.005,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: heal +${healed}`,
        meta: { category: 'heal', script: true, handler: 'king_crown' },
      });
    }
    ctx.events.push({
      t: ctx.t + 0.006,
      type: 'buff',
      target: 'player',
      amount: 1,
      label: `${piece.name}: buff protect`,
      meta: { category: 'buff', script: true, handler: 'king_crown' },
    });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_D_GOOBERT_PORTS = {
  goobert: goobertPort,
  cupcake_goobert: cupcakeGoobertPort,
  light_goobert: lightGoobertPort,
  king_goobert: kingGoobertPort,
  rainbow_goobert_mage: rainbowGoobertMagePort,
  rainbow_goobert_ranger: rainbowGoobertRangerPort,
  crown: crownPort,
  king_crown: kingCrownPort,
};
