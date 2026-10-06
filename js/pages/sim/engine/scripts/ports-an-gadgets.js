/**
 * Band AN — cubes / coil / trap / eat-o-matic / recombobulators.
 */

import { healActor } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import {
  cleanseRandomDebuffs,
  giveRandomBuffs,
  onBuffChanged,
  stealRandomBuff,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import {
  buildScriptChargePath,
  chargeEnterSchedule,
} from '../charge-path.js';
import { scheduleStatChargePath } from '../charge-delivery.js';
import { advanceCooldownSeconds } from '../cooldown.js';
import { getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** ConTrapTron.gd sendCharge paths (CollisionMap cells). */
const CON_TRAP_CELLS_1 = [
  { x: -1, y: -1 },
  { x: 0, y: -2 },
  { x: 1, y: -3 },
  { x: 2, y: -2 },
  { x: 2, y: -1 },
];
const CON_TRAP_CELLS_2 = [
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
];

function linkedCd(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter(
    (o) =>
      links.some((l) => l.key === o.placementKey) &&
      o.cooldown > 0 &&
      o.cooldown < 500,
  );
}

function firstLinkedCd(ctx, piece) {
  return linkedCd(ctx, piece)[0] || null;
}

/**
 * Dual sendCharge + buff-amp changeChargedItemStat (ConTrapTron.emitCharge).
 * @param {object} piece
 * @param {import('./handlers.js').ScriptCtx} ctx
 */
function emitConTrapCharges(piece, ctx) {
  const { t, events, graph, itemsById } = ctx;
  const item = itemsById.get(piece.itemId);
  const boardPiece = graph.pieces.get(piece.placementKey);
  if (!item || !boardPiece) return;
  const durPerTile = Math.max(0.01, getPName(piece.params, 'dur', 2));
  const flat = Number(piece.chance) || getPName(piece.params, 'chance', 50);
  const perTile = Number(piece.chance2) || getPName(piece.params, 'chance2', 10);
  const placement = {
    x: boardPiece.x,
    y: boardPiece.y,
    r: boardPiece.r,
    key: piece.placementKey,
  };
  const paths = [CON_TRAP_CELLS_1, CON_TRAP_CELLS_2];
  for (let i = 0; i < paths.length; i += 1) {
    const pathId = `contrap:${piece.placementKey}:${t}:${i}`;
    const path = buildScriptChargePath({
      pathId,
      item,
      placement,
      startT: t,
      collisionCells: paths[i],
      durPerTile,
    });
    if (!path) continue;
    for (const cell of path.cells) {
      const tk = graph.filled.get(cell.cell) || null;
      cell.targetKey = tk && tk !== piece.placementKey ? tk : null;
    }
    events.push({
      t,
      type: 'charge',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: charge`,
      meta: {
        category: 'charge',
        phase: 'start',
        pathId,
        chargePath: path,
        handler: 'con_trap_tron',
      },
    });
    scheduleStatChargePath(piece, ctx, {
      path,
      flat,
      perTile,
      mode: 'buffAmp',
    });
    const schedule = chargeEnterSchedule(path.cells.length, durPerTile);
    let lastKey = null;
    for (const step of schedule) {
      const cell = path.cells[step.cellIndex];
      const targetKey = cell?.targetKey ?? null;
      const targetPiece = targetKey
        ? (ctx.pieces || []).find((p) => p.placementKey === targetKey)
        : null;
      const enterAbs = t + step.enterT;
      if (targetKey !== lastKey) {
        if (targetPiece) {
          if (!targetPiece.pendingCharges) targetPiece.pendingCharges = [];
          targetPiece.pendingCharges.push({
            at: enterAbs,
            meta: { pathId, cellIndex: step.cellIndex, emitterKey: piece.placementKey },
          });
        }
        lastKey = targetKey;
      }
      events.push({
        t: enterAbs,
        type: 'charge',
        actor: 'player',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: targetPiece
          ? `${piece.name}: charge → ${targetPiece.name}`
          : `${piece.name}: charge cell`,
        meta: {
          category: 'charge',
          phase: 'cell',
          pathId,
          cellIndex: step.cellIndex,
          cell: cell?.cell,
          targetKey: targetKey || undefined,
          handler: 'con_trap_tron',
        },
      });
    }
  }
}

function cubeAdvance(target, ctx, piece) {
  if (!target) return;
  const base = getPName(piece.params, 'cdadvance', 2);
  const pen = 1 - getPName(piece.params, 'penalty', 50) / 100;
  ctx._cubeAdv = ctx._cubeAdv || new Map();
  const prior = ctx._cubeAdv.get(target.placementKey);
  const amt = prior && prior !== piece.placementKey ? base * pen : base;
  ctx._cubeAdv.set(target.placementKey, piece.placementKey);
  advanceCooldownSeconds(target, amt, ctx);
}

/** @type {import('./handlers.js').ScriptHandler} */
const chromeCubePort = {
  handlerId: 'chrome_cube',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._cube = false;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (piece._cube || !payload?.hit?.hit) return;
      if (ctx.dummy.maxHp <= 0 || ctx.dummy.hp / ctx.dummy.maxHp >= th) return;
      piece._cube = true;
      cubeAdvance(firstLinkedCd(ctx, piece), ctx, piece);
      applyHealEfficiency(
        ctx.dummy,
        -getPName(piece.params, 'healreduction', 50) / 100,
        ctx,
        piece,
      );
      piece.alive = false;
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const goldCubePort = {
  handlerId: 'gold_cube',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._cube = false;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._cube) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      piece._cube = true;
      cubeAdvance(firstLinkedCd(ctx, piece), ctx, piece);
      const regen = getStackAmount(ctx.player, 'regeneration');
      healActor(
        ctx.player,
        Math.max(1, Math.round(getPName(piece.params, 'heal', 8) + getPName(piece.params, 'heal_regen', 2) * regen)),
      );
      piece.alive = false;
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const bismuthCubePort = {
  handlerId: 'bismuth_cube',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._bisAcc = 0;
    piece._bisUses = 0;
    const need = Math.max(1, Math.round(getPName(piece.params, 'buffs', 4)));
    const max = Math.max(1, Math.round(getPName(piece.params, 'max', 3)));
    const target = firstLinkedCd(ctx, piece);
    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount > 0) || piece._bisUses >= max) return;
      piece._bisAcc += ch.amount;
      let n = 0;
      while (piece._bisAcc > need && piece._bisUses + n < max) {
        piece._bisAcc -= need;
        n += 1;
      }
      if (!n) return;
      piece._bisUses += n;
      if (target) {
        const base = getPName(piece.params, 'cdadvance', 2);
        const pen = 1 - getPName(piece.params, 'penalty', 50) / 100;
        ctx._cubeAdv = ctx._cubeAdv || new Map();
        const prior = ctx._cubeAdv.get(target.placementKey);
        const amt = prior && prior !== piece.placementKey ? base * pen : base;
        ctx._cubeAdv.set(target.placementKey, piece.placementKey);
        advanceCooldownSeconds(target, amt * n, ctx);
      }
      giveRandomBuffs(ctx.player, n, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const coilPort = {
  handlerId: 'coil',
  family: 'unique',
  onPrepare(piece) {
    piece._coilN = 0;
  },
  onChargeReceived(piece, ctx) {
    const max = Math.max(1, Math.round(getPName(piece.params, 'max', 4)));
    if (piece._coilN >= max) return;
    piece._coilN += 1;
    stealRandomBuff(ctx.dummy, ctx.player, Math.max(1, Math.round(getPName(piece.params, 'buffs', 1))), ctx.rng, {
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
      meta: { category: 'system', script: true, handler: 'coil', miniActivate: true },
    });
    if (piece._coilN >= max) {
      piece.consumed = true;
      piece.alive = false;
    }
  },
};

/**
 * ConTrapTron.gd — speed malus on first CD link; below HP% emit dual charges
 * (buff-amp on path) + advance linked CD.
 * @type {import('./handlers.js').ScriptHandler}
 */
const conTrapTronPort = {
  handlerId: 'con_trap_tron',
  family: 'unique',
  onPreCombatStart(piece, ctx) {
    piece._trap = false;
    const malus = getPName(piece.params, 'speed', 10) / 100;
    const target = firstLinkedCd(ctx, piece);
    if (target && malus) addSpeed(target, -malus);
  },
  onCombatStart(piece, ctx) {
    const th = getPName(piece.params, 'healtht', 70) / 100 - 0.0001;
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (piece._trap || !piece.alive) return;
      const maxHp = Number(ctx.player.maxHp) || 0;
      if (!(maxHp > 0)) return;
      const rel = (Number(ctx.player.hp) || 0) / maxHp;
      if (!(rel < th)) return;
      piece._trap = true;
      const t = payload?.t ?? ctx.t;
      const prevT = ctx.t;
      ctx.t = t;
      pushActivate(piece, ctx, 'con_trap_tron', `Gadget: ${piece.name}`);
      emitConTrapCharges(piece, ctx);
      ctx.bus?.emit?.('charge_emitted', { piece, t });
      const linked = firstLinkedCd(ctx, piece);
      if (linked) {
        let adv = getPName(piece.params, 'cdadvance_base', 2);
        if (linked.kind !== 'weapon') {
          adv += getPName(piece.params, 'cdadvance_bonus', 3);
        }
        advanceCooldownSeconds(linked, adv, ctx);
      }
      ctx.t = prevT;
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const eatOMaticPort = {
  handlerId: 'eat_o_matic',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const foods = (ctx.pieces || []).filter((o) => itemHasType(ctx.itemsById.get(o.itemId), 'food'));
    const primary = linkedCd(ctx, piece).find((o) => itemHasType(ctx.itemsById.get(o.itemId), 'food')) || foods[0];
    piece._eatPrimary = primary;
    if (primary) addSpeed(primary, getPName(piece.params, 'speed', 20) / 100);
    piece._eatOthers = foods.filter((f) => f !== primary);
  },
  onChargeReceived(piece) {
    const primary = piece._eatPrimary;
    if (primary) addSpeed(primary, getPName(piece.params, 'speed2', 15) / 100);
    for (const f of piece._eatOthers || []) addSpeed(f, getPName(piece.params, 'speed3', 8) / 100);
  },
};

function recombPort(id) {
  return {
    handlerId: id,
    family: 'unique',
    onCooldownEffect(piece, ctx) {
      // Shop fuse out of scope — combat CD: 1 buff + 1 cleanse (Recombobulator.gd).
      giveRandomBuffs(ctx.player, 1, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      cleanseRandomDebuffs(ctx.player, 1, ctx.rng, {});
      pushActivate(piece, ctx, id, `Gadget: ${piece.name}`);
      return true;
    },
  };
}

/** @type {Record<string, import('./handlers.js').ScriptHandler>} */
export const AN_GADGET_PORTS = {
  chrome_cube: chromeCubePort,
  gold_cube: goldCubePort,
  bismuth_cube: bismuthCubePort,
  coil: coilPort,
  con_trap_tron: conTrapTronPort,
  eat_o_matic: eatOMaticPort,
  stable_recombobulator: recombPort('stable_recombobulator'),
  unstable_recombobulator: recombPort('unstable_recombobulator'),
};
