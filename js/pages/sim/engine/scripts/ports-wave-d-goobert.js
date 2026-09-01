/**
 * Band AG 196–197 — gooberts + crowns (peer / mana / invuln vs .gd).
 */

import {
  giveMostBuffs,
  grantStacks,
  grantTemporaryStacks,
  onBuffChanged,
  useMana,
} from '../buff-economy.js';
import {
  grantBuffProtect,
  grantInvuln,
  healActor,
  isInvulnerable,
} from '../actor.js';
import { getP1, getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { gainStacks } from '../stacks.js';
import { addBonusDamage } from '../piece-stats.js';
import { affectedTargets } from '../board-graph.js';
import {
  setPieceInvulnBudget,
  spendPieceInvulnBudget,
} from '../timed-speed.js';
import { pushActivate, pushBuffGrants } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @param {import('../actor.js').SimActor} actor @param {number} nowT */
function isVulnerable(actor, nowT) {
  return !isInvulnerable(actor, nowT);
}

/** @param {object} piece @param {object} ctx @param {string} handler @param {number} heal */
export function goobertHeal(piece, ctx, handler, heal) {
  pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
  const healed = healActor(ctx.player, heal);
  if (healed > 0) {
    ctx.events.push({
      t: ctx.t + 0.003,
      type: 'heal',
      target: 'player',
      amount: healed,
      label: `${piece.name}: heal +${healed}`,
      meta: { category: 'heal', script: true, handler },
    });
  }
  return true;
}

/**
 * Peer activation counter — Goobert.gd onItemActivated.
 * @param {object} piece
 * @param {object} ctx
 * @param {() => void} effect
 */
export function goobertPeerTick(piece, ctx, effect) {
  const need = Math.max(1, Math.round(getP1(piece.params, 3)));
  piece._goobertActs = (piece._goobertActs || 0) + 1;
  if (piece._goobertActs < need) return;
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
  onCombatStart(piece) {
    piece._goobertActs = 0;
  },
  // Peer-only — no timed CD heal (would double-fire)
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      const heal = Math.max(1, Math.round(getPName(listener.params, 'heal', getP2(listener.params, 8))));
      goobertHeal(listener, ctx, 'goobert', heal);
    });
  },
};

/** @type {ScriptHandler} */
export const cupcakeGoobertPort = {
  handlerId: 'cupcake_goobert',
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
      goobertHeal(listener, ctx, 'cupcake_goobert', heal);
      const n = Math.max(1, Math.round(getPName(listener.params, 'buffs', getP3(listener.params, 1))));
      const picked = giveMostBuffs(ctx.player, n, ctx.rng, {
        originKey: listener.placementKey,
        originId: listener.itemId,
      });
      pushBuffGrants(ctx.events, listener, ctx.player, ctx.t, 'cupcake_goobert', picked, 0.005);
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
        grantInvuln(ctx.player, dur, ctx.t);
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

/** @param {object} piece @param {object} ctx @param {string} handler @param {'mage'|'ranger'} mode */
function rainbowEffect(piece, ctx, handler, mode) {
  pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
  const block = Math.max(1, Math.round(piece.blockGrant || getPName(piece.params, 'block', 8)));
  gainStacks(ctx.player, 'block', block);
  const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 10))));
  healActor(ctx.player, heal);
  const vamp = Math.max(1, Math.round(getP3(piece.params, 1)));
  grantStacks(ctx.player, 'vampirism', vamp, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  if (mode === 'mage') {
    const num = Math.max(1, Math.round(getP4(piece.params, 2)));
    const picked = giveMostBuffs(ctx.player, num, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, handler, picked, 0.004);
  } else {
    const emp = Math.max(1, Math.round(getP4(piece.params, 2)));
    grantStacks(ctx.player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }
  const blind = Math.max(1, Math.round(getP5(piece.params, 1)));
  gainStacks(ctx.dummy, 'blind', blind, { rng: ctx.rng, opponent: ctx.player });
  empowerLinkedWeapons(piece, ctx, handler);
  return true;
}

/** @type {ScriptHandler} */
export const rainbowGoobertMagePort = {
  handlerId: 'rainbow_goobert_mage',
  family: 'pet_like',
  onCombatStart(piece) {
    piece._goobertActs = 0;
  },
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      rainbowEffect(listener, ctx, 'rainbow_goobert_mage', 'mage');
    });
  },
};

/** @type {ScriptHandler} */
export const rainbowGoobertRangerPort = {
  handlerId: 'rainbow_goobert_ranger',
  family: 'pet_like',
  onCombatStart(piece) {
    piece._goobertActs = 0;
  },
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      rainbowEffect(listener, ctx, 'rainbow_goobert_ranger', 'ranger');
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
  piece._tryCrownInvuln = (nowT) => {
    if (piece._crownState !== 'Inactive') return;
    if (!isVulnerable(ctx.player, nowT)) return;
    if ((ctx.player.stacks.mana || 0) < manaCost) return;
    piece._crownState = 'Active';
    useMana(ctx.player, manaCost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const dur = Math.max(
      0.5,
      getPName(piece.params, 'dur_invu', getPName(piece.params, 'dur_invuln', getP2(piece.params, 2))),
    );
    grantInvuln(ctx.player, dur, nowT);
    piece._crownUsedAt = nowT + dur;
    pushActivate(piece, { ...ctx, t: nowT }, handler, `Accessory: ${piece.name}`);
    ctx.events.push({
      t: nowT + 0.003,
      type: 'buff',
      target: 'player',
      amount: 1,
      label: `${piece.name}: Invuln ${dur}s`,
      meta: { category: 'buff', stack: 'invuln', script: true, handler },
    });
  };
  onBuffChanged(ctx.player, (ch) => {
    if (ch.stack !== 'mana') return;
    // ctx.t may be stale; prefer last known sim time on piece
    piece._tryCrownInvuln(Number(piece._lastSimT) || ctx.t);
  });
  piece._tryCrownInvuln(ctx.t);
}

/** @type {ScriptHandler} */
export const crownPort = {
  handlerId: 'crown',
  family: 'unique',
  onCombatStart(piece, ctx) {
    bindCrownManaTrigger(piece, ctx, 'crown');
  },
  onCooldownEffect(piece, ctx) {
    piece._lastSimT = ctx.t;
    if (piece._crownState === 'Active' && piece._crownUsedAt != null && ctx.t >= piece._crownUsedAt) {
      piece._crownState = 'Used';
    }
    piece._tryCrownInvuln?.(ctx.t);
    pushActivate(piece, ctx, 'crown', `Accessory: ${piece.name}`);
    loseBlindOne(ctx.player);
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
    return true;
  },
};

/** @param {import('../actor.js').SimActor} player */
function loseBlindOne(player) {
  if ((player.stacks.blind || 0) > 0) {
    player.stacks.blind = Math.max(0, player.stacks.blind - 1);
  }
}

/** @type {ScriptHandler} */
export const kingCrownPort = {
  handlerId: 'king_crown',
  family: 'unique',
  onCombatStart(piece, ctx) {
    bindCrownManaTrigger(piece, ctx, 'king_crown');
  },
  onCooldownEffect(piece, ctx) {
    piece._lastSimT = ctx.t;
    if (piece._crownState === 'Active' && piece._crownUsedAt != null && ctx.t >= piece._crownUsedAt) {
      piece._crownState = 'Used';
    }
    piece._tryCrownInvuln?.(ctx.t);
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
