/**
 * Band AG 202–203 — board set deepened; chess_board permanent combat noop.
 */

import { giveRandomBuffs, grantStacks } from '../buff-economy.js';
import { affectedTargets, moveBoardPiece, neighborKeys } from '../board-graph.js';
import { dispatchChessCaptureSequence } from '../chess.js';
import { getP1, getP2, getPName } from '../params.js';
import { advanceCooldownPercent, deactivateCooldown, isCooldownActive } from '../cooldown.js';
import { runCardInheritedHook } from './card-chain.js';
import { afterEffectFinished, itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { runWeaponInheritedHook } from './ports-wave-c-util.js';
import { getScriptHandler } from './registry.js';
import { magicRingPort } from './ports-ring.js';
import { multiplyBuffsLimit } from './ports-ai-d.js';
import { shuffleInPlace } from '../rng.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** ChessBoard.gd — doCooldownEffect runs capture/move AI. Sim defers that AI (Phase 267). */
function isChessPiece(piece, ctx) {
  const item = ctx.itemsById.get(piece?.itemId);
  return String(item?.type || '').toLowerCase().includes('chess piece');
}

function chessColor(piece) {
  return String(piece?.itemId || '').startsWith('black_') ? 0 : 1;
}

function chessBoardWorld(piece, ctx) {
  const ownerIsThem = piece?.side === 'them';
  const ownerPieces = ctx.pieces || [];
  const emptyGraph = { pieces: new Map(), filled: new Map() };
  return {
    you: ownerIsThem ? ctx.dummy : ctx.player,
    them: ownerIsThem ? ctx.player : ctx.dummy,
    youGraph: ownerIsThem ? emptyGraph : ctx.graph,
    themGraph: ownerIsThem ? ctx.graph : emptyGraph,
    youPieces: ownerIsThem ? [] : ownerPieces,
    themPieces: ownerIsThem ? ownerPieces : [],
    youDeck: { i: 0 },
    themDeck: { i: 0 },
    youCardKeys: [],
    themCardKeys: [],
    t: ctx.t,
    rng: ctx.rng,
    events: ctx.events,
    itemsById: ctx.itemsById,
    canAffect: ctx.canAffect,
    activatePiece: ctx.activatePiece,
    bus: ctx.bus,
    fatigue: ctx.fatigue,
    board: ctx.board,
    notifyDealtDamage: ctx.notifyDealtDamage,
    notifyPreDealDamageEarly: ctx.notifyPreDealDamageEarly,
    notifyPreDealDamageLate: ctx.notifyPreDealDamageLate,
    logChain: ctx.logChain,
    chargeJobs: [],
  };
}

function chessPiecesForColor(ctx, color) {
  return (ctx.pieces || []).filter(
    (piece) => piece.alive !== false && isChessPiece(piece, ctx) && chessColor(piece) === color,
  );
}

function chessTargetAt(ctx, cell) {
  const key = ctx.graph?.filled?.get(cell);
  if (!key) return null;
  const target = (ctx.pieces || []).find(
    (candidate) => candidate.placementKey === key && candidate.alive !== false,
  );
  return target && isChessPiece(target, ctx) ? target : null;
}

function chessMoveCells(piece, ctx) {
  return [...(ctx.graph?.pieces?.get(piece.placementKey)?.affectCells || [])]
    .map((mark) => mark.cell)
    .filter(Boolean);
}

function chessPieceCanBeBlocked(piece) {
  return !String(piece?.itemId || '').endsWith('_knight');
}

function chessPathBlocked(piece, targetCell, ctx) {
  if (!chessPieceCanBeBlocked(piece)) return false;
  const boardPiece = ctx.graph?.pieces?.get(piece.placementKey);
  if (!boardPiece?.cells?.length) return false;
  const [fromX, fromY] = boardPiece.cells[0].split(',').map(Number);
  const [toX, toY] = targetCell.split(',').map(Number);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.max(Math.abs(dx), Math.abs(dy));
  if (length <= 1) return false;
  const stepX = dx / length;
  const stepY = dy / length;
  for (let i = 1; i < length; i += 1) {
    const cell = `${fromX + i * stepX},${fromY + i * stepY}`;
    const blocker = chessTargetAt(ctx, cell);
    if (blocker) return true;
  }
  return false;
}

function findChessCapture(activePieces, ctx, bestCapture) {
  let best = null;
  let bestScore = -10000;
  for (const piece of activePieces) {
    const cells = shuffleInPlace(chessMoveCells(piece, ctx), ctx.rng || Math.random);
    for (const targetCell of cells) {
      const target = chessTargetAt(ctx, targetCell);
      if (!target || chessColor(target) === chessColor(piece)) continue;
      if (!bestCapture) return { capturing: piece, eliminated: target, targetCell };
      const targetItem = ctx.itemsById.get(target.itemId);
      let score = Number(targetItem?.cost);
      if (!Number.isFinite(score)) score = 0;
      if (chessPathBlocked(piece, targetCell, ctx)) score -= 100;
      if (score > bestScore) {
        bestScore = score;
        best = { capturing: piece, eliminated: target, targetCell };
      }
    }
  }
  return best;
}

function moveChessPiece(piece, targetCell, ctx) {
  const graphPiece = ctx.graph?.pieces?.get(piece.placementKey);
  const fromCell = graphPiece?.cells?.[0] || null;
  if (!fromCell || !moveBoardPiece(ctx.graph, piece.placementKey, targetCell)) return false;
  piece._chessCell = targetCell;
  ctx.events.push({
    t: ctx.t,
    type: 'info',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name}: moved ${fromCell} -> ${targetCell}`,
    meta: {
      category: 'chess',
      script: true,
      handler: 'chess_board',
      event: 'piece_moved',
      fromCell,
      toCell: targetCell,
    },
  });
  return true;
}

function captureChessPiece(board, capture, ctx) {
  const { capturing, eliminated, targetCell } = capture;
  const eliminatedGraphPiece = ctx.graph?.pieces?.get(eliminated.placementKey);
  for (const cell of eliminatedGraphPiece?.cells || []) {
    if (ctx.graph.filled.get(cell) === eliminated.placementKey) ctx.graph.filled.delete(cell);
  }
  eliminated.captured = true;
  if (!moveBoardPiece(ctx.graph, capturing.placementKey, targetCell)) return false;
  capturing._chessCell = targetCell;

  // ChessBoard.gd calls activate() before ChessPiece.onPieceCaptured().
  pushActivate(board, ctx, 'chess_board', `Board: ${board.name}`);
  dispatchChessCaptureSequence(capturing, eliminated, chessBoardWorld(board, ctx));
  ctx.events.push({
    t: ctx.t,
    type: 'info',
    itemId: board.itemId,
    placementKey: board.placementKey,
    label: `${board.name}: ${capturing.name} captured ${eliminated.name}`,
    meta: {
      category: 'chess',
      script: true,
      handler: 'chess_board',
      event: 'piece_captured',
      capturingKey: capturing.placementKey,
      eliminatedKey: eliminated.placementKey,
    },
  });
  return true;
}

/** @type {ScriptHandler} */
export const chessBoardPort = {
  handlerId: 'chess_board',
  family: 'unique',
  onPrepare(piece) {
    piece._chessTurnColor = 1;
  },
  onCooldownEffect(piece, ctx) {
    const color = piece._chessTurnColor === 0 ? 0 : 1;
    const activePieces = shuffleInPlace(
      chessPiecesForColor(ctx, color),
      ctx.rng || Math.random,
    );
    const hasChessMaster = (ctx.pieces || []).some((candidate) => candidate.itemId === 'chess_master');
    const capture = findChessCapture(activePieces, ctx, hasChessMaster);
    if (!(capture && captureChessPiece(piece, capture, ctx))) {
      for (const chessPiece of activePieces) {
        const cells = shuffleInPlace(chessMoveCells(chessPiece, ctx), ctx.rng || Math.random);
        const targetCell = cells.find((cell) => !ctx.graph.filled.has(cell));
        if (targetCell && moveChessPiece(chessPiece, targetCell, ctx)) break;
      }
      // ChessBoard.gd does not call activate() for a move or a no-op turn.
      // Keep the scheduler alive without fabricating an activation event.
      piece._activationLogged = true;
    }
    piece._chessTurnColor = color === 1 ? 0 : 1;
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
