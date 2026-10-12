/** Source-backed ChessPiece capture/elimination effects. */

import { drainStamina, gainMaxStaminaTemporary, grantInvuln, grantStun } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import {
  cleanseRandomDebuffs,
  giveRandomBuffs,
  grantStacks,
  inflictRandomDebuffs,
  stealRandomBuff,
} from '../buff-economy.js';
import { getPName } from '../params.js';
import { effectDuration } from '../effect-duration.js';
import { addSpeed } from '../piece-stats.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { removeRandomBuffs } from './ports-wave-c-util.js';

/** @typedef {import('./handlers.js').ScriptHandler} ScriptHandler */

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

function captureCount(piece) {
  return Number(piece.numCaptures ?? piece._chessCaptures) || 0;
}

function changeMaxHealthGain(actor, amount, ctx, piece) {
  const delta = Number(amount) || 0;
  if (!delta) return;
  actor._maxHealthGain = (Number(actor._maxHealthGain) || 0) + delta;
  ctx.events?.push?.({
    t: (Number(ctx.t) || 0) + 0.0015,
    type: 'stat',
    actor: actor.id,
    amount: delta * 100,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `Max health gain changed by ${delta * 100}%`,
    meta: { category: 'stat', stat: 'max_health_gain', handler: piece.itemId },
  });
}

function changeAllItemsCritRate(piece, ctx, amount) {
  const delta = Number(amount) || 0;
  if (!delta) return;
  const changes = [];
  for (const other of ctx.pieces || []) {
    if (other.empowerable === false) continue;
    other.critChance = (Number(other.critChance) || 0) + delta;
    changes.push({ other, delta });
  }
  piece._chessCritChanges = changes;
  piece._chessCritUntil = (Number(ctx.t) || 0) + Math.max(0, getPName(piece.params, 'dur', 0));
}

function expireCritRate(piece, ctx) {
  if (!piece._chessCritChanges?.length || piece._chessCritUntil == null) return;
  if ((Number(ctx.t) || 0) + 1e-9 < piece._chessCritUntil) return;
  for (const { other, delta } of piece._chessCritChanges) {
    other.critChance = Math.max(0, (Number(other.critChance) || 0) - delta);
  }
  piece._chessCritChanges = null;
  piece._chessCritUntil = null;
}

/** @type {ScriptHandler} */
const blackBishopPort = {
  handlerId: 'black_bishop',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    inflictRandomDebuffs(ctx.dummy, Math.max(0, Math.round(getPName(piece.params, 'debuffs', 5))), ctx.rng, {
      ...origin(piece),
      opponent: ctx.player,
    });
  },
  onChessEliminated(piece, ctx) {
    applyHealEfficiency(ctx.dummy, -getPName(piece.params, 'healreduction', 20) / 100, ctx, piece);
    changeMaxHealthGain(ctx.dummy, -getPName(piece.params, 'healthreduction', 20) / 100, ctx, piece);
  },
};

/** @type {ScriptHandler} */
const blackKingPort = {
  handlerId: 'black_king',
  family: 'unique',
  presenceOnly: true,
  onPrepare(piece) {
    piece.numCaptures = 0;
  },
  onChessCapture(piece, ctx) {
    const speed = getPName(piece.params, 'speed', 5) / 100;
    for (const other of ctx.pieces || []) {
      if (other.kind === 'weapon' || String(other.itemType || '').toLowerCase().includes('weapon')) {
        addSpeed(other, speed);
      }
    }
  },
  onChessAnyPieceCaptured(piece, ctx, capturingPiece) {
    if (!String(capturingPiece.itemId || '').startsWith('black_')) return;
    const amount = captureCount(capturingPiece) === 1
      ? getPName(piece.params, 'buffs', 2)
      : 1;
    removeRandomBuffs(ctx.dummy, amount, ctx.rng, origin(piece));
  },
};

/** @type {ScriptHandler} */
const blackKnightPort = {
  handlerId: 'black_knight',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    grantStacks(ctx.player, 'vampirism', getPName(piece.params, 'vampirism', 3), origin(piece));
  },
  onChessEliminated(piece, ctx) {
    drainStamina(ctx.dummy, getPName(piece.params, 'stamina', 2.5), {
      events: ctx.events,
      t: ctx.t,
      actorSide: ctx.dummy.id,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      handler: piece.itemId,
    });
  },
};

/** @type {ScriptHandler} */
const blackPawnPort = {
  handlerId: 'black_pawn',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    grantStacks(ctx.player, 'mana', getPName(piece.params, 'mana', 3), origin(piece));
  },
  onChessEliminated(piece, ctx) {
    grantStacks(ctx.dummy, 'poison', getPName(piece.params, 'poison', 2), {
      ...origin(piece),
      rng: ctx.rng,
      opponent: ctx.player,
    });
  },
};

/** @type {ScriptHandler} */
const blackQueenPort = {
  handlerId: 'black_queen',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    const amount = captureCount(piece) === 1
      ? getPName(piece.params, 'buffs', 4)
      : 1;
    stealRandomBuff(ctx.dummy, ctx.player, amount, ctx.rng, origin(piece));
  },
  onChessEliminated(piece, ctx) {
    grantStun(ctx.dummy, effectDuration(piece, 'dur', 1.3), ctx.t, {
      rng: ctx.rng,
      events: ctx.events,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      handler: piece.itemId,
    });
  },
};

/** @type {ScriptHandler} */
const blackRookPort = {
  handlerId: 'black_rook',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    grantStacks(ctx.player, 'spikes', getPName(piece.params, 'spikes', 3), origin(piece));
  },
  onChessEliminated(piece, ctx) {
    changeAllItemsCritRate(piece, ctx, getPName(piece.params, 'crit', 35));
  },
  onTick(piece, ctx) {
    expireCritRate(piece, ctx);
  },
};

/** @type {ScriptHandler} */
const whiteBishopPort = {
  handlerId: 'white_bishop',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    cleanseRandomDebuffs(ctx.player, getPName(piece.params, 'cleanse', 10), ctx.rng, origin(piece));
  },
  onChessEliminated(piece, ctx) {
    applyHealEfficiency(ctx.player, getPName(piece.params, 'healamp', 25) / 100, ctx, piece);
  },
};

/** @type {ScriptHandler} */
const whiteKingPort = {
  handlerId: 'white_king',
  family: 'unique',
  presenceOnly: true,
  onPrepare(piece) {
    piece.numCaptures = 0;
  },
  onChessCapture(piece, ctx) {
    grantStacks(ctx.player, 'empower', getPName(piece.params, 'empower', 1), origin(piece));
  },
  onChessAnyPieceCaptured(piece, ctx, capturingPiece) {
    if (!String(capturingPiece.itemId || '').startsWith('white_')) return;
    const amount = captureCount(capturingPiece) === 1
      ? getPName(piece.params, 'buffs', 2)
      : 1;
    giveRandomBuffs(ctx.player, amount, ctx.rng, origin(piece));
  },
};

/** @type {ScriptHandler} */
const whiteKnightPort = {
  handlerId: 'white_knight',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    const speed = getPName(piece.params, 'speed', 50) / 100;
    if (typeof ctx.board?.addSpeed === 'function') ctx.board.addSpeed(speed);
    else ctx.chessBoardSpeed = (Number(ctx.chessBoardSpeed) || 0) + speed;
  },
  onChessEliminated(piece, ctx) {
    gainMaxStaminaTemporary(ctx.player, getPName(piece.params, 'stamina', 2.5));
  },
};

/** @type {ScriptHandler} */
const whitePawnPort = {
  handlerId: 'white_pawn',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    grantStacks(ctx.player, 'regeneration', getPName(piece.params, 'regen', 2), origin(piece));
  },
  onChessEliminated(piece, ctx) {
    grantStacks(ctx.player, 'lucky', getPName(piece.params, 'luck', 1), origin(piece));
  },
};

/** @type {ScriptHandler} */
const whiteQueenPort = {
  handlerId: 'white_queen',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    const heat = captureCount(piece) === 1
      ? getPName(piece.params, 'heat1', 8)
      : getPName(piece.params, 'heat2', 2);
    grantStacks(ctx.player, 'heat', heat, origin(piece));
  },
  onChessEliminated(piece, ctx) {
    grantInvuln(ctx.player, getPName(piece.params, 'dur', 1.3), ctx.t, {
      sourceId: piece.itemId,
      bus: ctx.bus,
    });
  },
};

/** @type {ScriptHandler} */
const whiteRookPort = {
  handlerId: 'white_rook',
  family: 'unique',
  presenceOnly: true,
  onChessCapture(piece, ctx) {
    grantStacks(ctx.player, 'block', piece.blockGrant || getPName(piece.params, 'block', 35), origin(piece));
  },
  onChessEliminated(piece, ctx) {
    grantTimedResistancePct(
      ctx.player,
      getPName(piece.params, 'dam', 35),
      (Number(ctx.t) || 0) + getPName(piece.params, 'dur', 3),
      piece.itemId,
    );
  },
};

/** @type {Record<string, ScriptHandler>} */
export const CHESS_PORTS = {
  black_bishop: blackBishopPort,
  black_king: blackKingPort,
  black_knight: blackKnightPort,
  black_pawn: blackPawnPort,
  black_queen: blackQueenPort,
  black_rook: blackRookPort,
  white_bishop: whiteBishopPort,
  white_king: whiteKingPort,
  white_knight: whiteKnightPort,
  white_pawn: whitePawnPort,
  white_queen: whiteQueenPort,
  white_rook: whiteRookPort,
};
