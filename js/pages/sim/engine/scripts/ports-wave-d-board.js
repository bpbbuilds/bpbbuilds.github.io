/**
 * Band AG 202–203 — board set deepened; chess_board permanent combat noop.
 */

import {
  giveRandomBuffs,
  grantStacks,
  BUFF_KEYS,
} from '../buff-economy.js';
import { affectedTargets, neighborKeys } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import { advanceCooldownSeconds, isCooldownActive } from '../cooldown.js';
import { getStackAmount } from '../stacks.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { getScriptHandler } from './registry.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** ChessBoard.gd — doCooldownEffect runs capture/move AI. Sim defers that AI (Phase 267). */
/** @type {ScriptHandler} */
export const chessBoardPort = {
  handlerId: 'chess_board',
  family: 'unique',
  onCombatStart(piece, ctx) {
    pushActivate(piece, ctx, 'chess_board', `Board: ${piece.name}`);
    ctx.events.push({
      t: ctx.t + 0.002,
      type: 'info',
      label: `${piece.name}: chess AI deferred (game has combat CD; sim does not move pieces)`,
      meta: { category: 'system', script: true, handler: 'chess_board', noop: true },
    });
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'chess_board', `Board: ${piece.name}`);
    return true;
  },
};

/**
 * MagicRing.gd — crafted Start / Every / PlayerLow / OppoLow scaled stacks.
 * Params: start, every, playerlow, oppolow (counts); stacks via p1.
 */
/** @type {ScriptHandler} */
export const magicRingPort = {
  handlerId: 'magic_ring',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._ringTick = 0;
    const n = Math.max(1, Math.round(getPName(piece.params, 'start', getP1(piece.params, 2))));
    const picked = giveRandomBuffs(ctx.player, n, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'magic_ring', picked);
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'magic_ring', `Accessory: ${piece.name}`);
    piece._ringTick = (piece._ringTick || 0) + 1;
    const every = Math.max(1, Math.round(getPName(piece.params, 'every', getP2(piece.params, 1))));
    grantStacks(ctx.player, 'mana', every, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const plow = getPName(piece.params, 'playerlow', 0.35);
    const olow = getPName(piece.params, 'oppolow', 0.35);
    const relP = ctx.player.maxHp > 0 ? ctx.player.hp / ctx.player.maxHp : 1;
    const relD = ctx.dummy.maxHp > 0 ? ctx.dummy.hp / ctx.dummy.maxHp : 1;
    if (relP < plow) {
      giveRandomBuffs(ctx.player, 1, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (relD < olow) {
      grantStacks(ctx.dummy, 'poison', 1, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
    }
    return true;
  },
};

/** MagicMirror.gd — Holy reflect scaling; CD multiply buffs. */
/** @type {ScriptHandler} */
export const magicMirrorPort = {
  handlerId: 'magic_mirror',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const base = getPName(piece.params, 'reflect', getP1(piece.params, 25));
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    let holy = 0;
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (itemHasType(ctx.itemsById.get(other.itemId), 'holy')) holy += 1;
    }
    const chance = base + holy * 5;
    ctx.player.debuffReflectChance = (ctx.player.debuffReflectChance || 0) + chance;
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: +${chance}% debuff reflect`,
      meta: { category: 'system', script: true, handler: 'magic_mirror' },
    });
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'magic_mirror', `Accessory: ${piece.name}`);
    const cap = Math.max(1, Math.round(getPName(piece.params, 'cap', 5)));
    for (const k of BUFF_KEYS) {
      const have = getStackAmount(ctx.player, /** @type {any} */ (k));
      if (have <= 0) continue;
      const add = Math.min(have, cap);
      grantStacks(ctx.player, k, add, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** PlasticCube.gd — single adj; % CD advance + cubeAdvanced penalty. */
/** @type {ScriptHandler} */
export const plasticCubePort = {
  handlerId: 'plastic_cube',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, pieces, graph } = ctx;
    pushActivate(piece, ctx, 'plastic_cube', `Accessory: ${piece.name}`);
    const pct = getPName(piece.params, 'cd', getP1(piece.params, 20)) / 100;
    const neigh = new Set(neighborKeys(graph, piece.placementKey) || []);
    /** @type {object | null} */
    let target = null;
    for (const other of pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!isCooldownActive(other)) continue;
      if (neigh.size && !neigh.has(other.placementKey)) continue;
      target = other;
      break;
    }
    if (target) {
      const period = Math.max(0.35, Number(target.cooldown) || 1);
      let sec = period * pct;
      if (target._cubeAdvanced) sec *= 0.5;
      advanceCooldownSeconds(target, sec, player.stacks);
      target._cubeAdvanced = true;
    }
    const spikes = Math.max(1, Math.round(getP2(piece.params, 1)));
    grantStacks(player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.003,
      type: 'info',
      label: target
        ? `${piece.name}: advanced ${target.name} ${(pct * 100).toFixed(0)}%`
        : `${piece.name}: no target`,
      meta: { category: 'system', script: true, handler: 'plastic_cube' },
    });
    return true;
  },
};

/** Repeater.gd — adj start-of-battle items only. */
/** @type {ScriptHandler} */
export const repeaterPort = {
  handlerId: 'repeater',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'repeater', `Accessory: ${piece.name}`);
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    let n = 0;
    for (const other of ctx.pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const h = getScriptHandler(other.itemId);
      if (!h?.onCombatStart) continue;
      h.onCombatStart(other, ctx);
      n += 1;
    }
    ctx.events.push({
      t: ctx.t + 0.003,
      type: 'info',
      label: `${piece.name}: repeated start ×${n}`,
      meta: { category: 'system', script: true, handler: 'repeater' },
    });
    return true;
  },
};

/** SlimeTime.gd — full activate gooberts (onItemActivated semantics). */
/** @type {ScriptHandler} */
export const slimeTimePort = {
  handlerId: 'slime_time',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'slime_time', `Accessory: ${piece.name}`);
    let n = 0;
    for (const other of ctx.pieces || []) {
      const id = String(other.itemId || '');
      if (!id.includes('goobert')) continue;
      const h = getScriptHandler(other.itemId);
      // Prefer peer tick (Goobert activation bus); else full activatePiece
      if (h?.onPeerActivated) {
        h.onPeerActivated(other, piece, ctx);
        n += 1;
      } else if (typeof ctx.activatePiece === 'function') {
        ctx.activatePiece(other, ctx);
        n += 1;
      }
    }
    ctx.events.push({
      t: ctx.t + 0.003,
      type: 'info',
      label: `${piece.name}: goobert activate ×${n}`,
      meta: { category: 'system', script: true, handler: 'slime_time' },
    });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_D_BOARD_PORTS = {
  chess_board: chessBoardPort,
  magic_ring: magicRingPort,
  magic_mirror: magicMirrorPort,
  plastic_cube: plasticCubePort,
  repeater: repeaterPort,
  slime_time: slimeTimePort,
};
