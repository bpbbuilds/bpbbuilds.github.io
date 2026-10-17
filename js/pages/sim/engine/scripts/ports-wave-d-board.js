/**
 * Band AG 202–203 — board set deepened; chess_board permanent combat noop.
 */

import { giveRandomBuffs, grantStacks } from '../buff-economy.js';
import { affectedTargets, neighborKeys } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import { advanceCooldownPercent, deactivateCooldown, isCooldownActive } from '../cooldown.js';
import { runCardInheritedHook } from './card-chain.js';
import { afterEffectFinished, itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { runWeaponInheritedHook } from './ports-wave-c-util.js';
import { getScriptHandler } from './registry.js';
import { magicRingPort } from './ports-ring.js';
import { multiplyBuffsLimit } from './ports-ai-d.js';

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

/** MagicMirror.gd — Holy reflect scaling; CD multiply buffs. */
function applyMagicMirrorReflect(piece, ctx) {
  if (piece._magicMirrorReflectApplied) return;
  piece._magicMirrorReflectApplied = true;
  const catalog = ctx.itemsById.get(piece.itemId);
  const baseChance = Number.isFinite(Number(piece.chance))
    ? Number(piece.chance)
    : Number.isFinite(Number(catalog?.chance))
      ? Number(catalog.chance)
      : getPName(piece.params, 'reflect', getP1(piece.params, 0));
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  let holy = 0;
  for (const other of ctx.pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (itemHasType(ctx.itemsById.get(other.itemId), 'holy')) holy += 1;
  }
  const perHoly = Number.isFinite(Number(piece.chance2))
    ? Number(piece.chance2)
    : Number.isFinite(Number(catalog?.chance2))
      ? Number(catalog.chance2)
      : getPName(piece.params, 'chance2', getP2(piece.params, 0));
  const chance = baseChance + holy * perHoly;
  ctx.player.debuffReflectChance = (ctx.player.debuffReflectChance || 0) + chance;
  ctx.events.push({
    t: ctx.t,
    type: 'info',
    label: `${piece.name}: +${chance}% debuff reflect`,
    meta: { category: 'system', script: true, handler: 'magic_mirror' },
  });
}

/** @type {ScriptHandler} */
export const magicMirrorPort = {
  handlerId: 'magic_mirror',
  family: 'unique',
  onPrepare(piece, ctx) {
    applyMagicMirrorReflect(piece, ctx);
  },
  onCombatStart(piece, ctx) {
    applyMagicMirrorReflect(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    const fraction = getPName(piece.params, 'buffs', getP1(piece.params, 0)) / 100;
    const cap = Math.trunc(getPName(piece.params, 'max', getP2(piece.params, 0)));
    const granted = multiplyBuffsLimit(ctx.player, fraction, cap, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'magic_mirror', granted);
    afterEffectFinished(piece, ctx, 'magic_mirror', { label: `Spell: ${piece.name}` });
    return true;
  },
};

/** PlasticCube.gd — single adj; % CD advance + cubeAdvanced penalty. */
/** @type {ScriptHandler} */
export const plasticCubePort = {
  handlerId: 'plastic_cube',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { player, pieces, graph, itemsById, canAffect } = ctx;
    // PlasticCube.gd stops its own cooldown before advancing the target, then
    // onAfterEffectFinished consumes it after the target and Spikes effects.
    deactivateCooldown(piece);
    const pct = getPName(piece.params, 'cdadvance', getP1(piece.params, 20));
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const targetKey = links.find((link) => {
      const candidate = (pieces || []).find((other) => other.placementKey === link.key);
      return candidate && isCooldownActive(candidate);
    })?.key;
    const target = targetKey
      ? (pieces || []).find((other) => other.placementKey === targetKey)
      : null;
    if (target) {
      if (!player._cubeAdvanced) player._cubeAdvanced = new Map();
      const repeated = player._cubeAdvanced.has(target.placementKey);
      const penalty = getPName(piece.params, 'penalty', getPName(piece.params, 'p5', 50));
      const amount = repeated ? pct * (1 - penalty / 100) : pct;
      if (!repeated) player._cubeAdvanced.set(target.placementKey, piece.placementKey);
      advanceCooldownPercent(target, amount, ctx);
    }
    const spikes = getPName(piece.params, 'spikes', getP2(piece.params, 1));
    grantStacks(player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    afterEffectFinished(piece, ctx, 'plastic_cube', {
      consume: true,
      label: `Accessory: ${piece.name}`,
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
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    let n = 0;
    for (const other of ctx.pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const h = getScriptHandler(other.itemId);
      if (!h?.onCombatStart) continue;
      // Item.repeatCombatStart() is the complete source lifecycle, not just
      // the derived onCombatStart callback.
      if (other.kind === 'weapon') {
        runWeaponInheritedHook(other, ctx, 'pre_combat_start', h.onPreCombatStart);
      } else if (other.kind === 'card') {
        runCardInheritedHook(other, ctx, 'pre_combat_start', h.onPreCombatStart);
      } else {
        h.onPreCombatStart?.(other, ctx);
      }
      if (other.kind === 'weapon') {
        runWeaponInheritedHook(other, ctx, 'combat_start', h.onCombatStart);
      } else {
        h.onCombatStart(other, ctx);
      }
      h.onPostCombatStart?.(other, ctx);
      n += 1;
    }
    ctx.events.push({
      t: ctx.t + 0.003,
      type: 'info',
      label: `${piece.name}: repeated start ×${n}`,
      meta: { category: 'system', script: true, handler: 'repeater' },
    });
    // Repeater.gd calls onAfterEffectFinished(), whose default consumes the
    // one-shot accessory after all affected items have been replayed.
    afterEffectFinished(piece, ctx, 'repeater', { label: `Accessory: ${piece.name}` });
    return true;
  },
};

/** SlimeTime.gd — full activate gooberts (onItemActivated semantics). */
/** @type {ScriptHandler} */
export const slimeTimePort = {
  handlerId: 'slime_time',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    let n = 0;
    for (const other of ctx.pieces || []) {
      if (other.side && piece.side && other.side !== piece.side) continue;
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
    pushActivate(piece, ctx, 'slime_time', `Accessory: ${piece.name}`);
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
