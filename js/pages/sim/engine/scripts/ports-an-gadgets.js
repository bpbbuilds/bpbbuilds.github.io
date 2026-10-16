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
import { modifiedParamValue } from '../placement-instance.js';
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
      (() => {
        const descriptorCd = Number(ctx.itemsById?.get?.(o.itemId)?.cooldown);
        const cooldown = Number.isFinite(descriptorCd) ? descriptorCd : Number(o.cooldown);
        return Number.isFinite(cooldown) && cooldown !== 0;
      })(),
  );
}

function linkedPrimaryFood(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect)
    .filter((link) => link.color === 'primary');
  return (ctx.pieces || []).filter(
    (o) =>
      links.some((link) => link.key === o.placementKey) &&
      itemHasType(ctx.itemsById.get(o.itemId), 'food'),
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
function emitConTrapCharges(piece, ctx, speedFactor = 1) {
  const { t, events, graph, itemsById } = ctx;
  const item = itemsById.get(piece.itemId);
  const boardPiece = graph.pieces.get(piece.placementKey);
  if (!item || !boardPiece) return;
  const factor = Math.max(0.01, Number(speedFactor) || 1);
  const durPerTile = Math.max(0.01, getPName(piece.params, 'dur', 2) / factor);
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
const bindChromeCube = (piece, ctx) => {
  if (piece._chromeCubeBound) return;
  piece._chromeCubeBound = true;
  piece._cube = false;
  // ChromeCube.gd resolves getFirstAffectedItem() once in onPrepare.
  piece._chromeCubeTarget = firstLinkedCd(ctx, piece);
  // ChromeCube.gd computes healthThreshold as getP("healtht") / 100 - 0.0001.
  const th = getPName(piece.params, 'healtht', 50) / 100 - 0.0001;
  const onOpponentDamaged = (payload = {}) => {
    if (payload.actor && payload.actor !== ctx.dummy) return;
    // damage.js emits Character.character_damaged with `hit: boolean`; keep
    // compatibility with direct signal fixtures that pass a DamageResult.
    const hit =
      typeof payload.hit === 'object' ? Boolean(payload.hit?.hit) : Boolean(payload.hit);
    if (piece._cube || !hit) return;
    if (ctx.dummy.maxHp <= 0 || ctx.dummy.hp / ctx.dummy.maxHp >= th) return;
    piece._cube = true;
    cubeAdvance(piece._chromeCubeTarget, ctx, piece);
    applyHealEfficiency(
      ctx.dummy,
      -getPName(piece.params, 'healreduction', 50) / 100,
      ctx,
      piece,
    );
    piece.alive = false;
  };
  // ChromeCube.gd binds opponent.character_damaged during onPrepare.
  ctx.bus?.on?.('character_damaged', onOpponentDamaged);
};
const chromeCubePort = {
  handlerId: 'chrome_cube',
  family: 'unique',
  onPrepare: bindChromeCube,
};

/** @type {import('./handlers.js').ScriptHandler} */
const goldCubePort = {
  handlerId: 'gold_cube',
  family: 'unique',
  // GoldCube.gd connects during onPrepare.
  onPrepare(piece, ctx) {
    piece._cube = false;
    piece._goldCubeTarget = firstLinkedCd(ctx, piece);
    const th = getPName(piece.params, 'healtht', 50) / 100 - 0.0001;
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      if (piece._cube) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      piece._cube = true;
      cubeAdvance(piece._goldCubeTarget, ctx, piece);
      const regen = getStackAmount(ctx.player, 'regeneration');
      const heal =
        modifiedParamValue(piece, getPName(piece.params, 'heal', 0), 'heal') +
        modifiedParamValue(piece, getPName(piece.params, 'heal_regen', 0), 'heal_regen') * regen;
      healActor(ctx.player, heal);
      pushActivate(piece, ctx, 'gold_cube', `Cube: ${piece.name}`, { consume: true });
      piece.alive = false;
      piece.charges = 0;
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const bismuthCubePort = {
  handlerId: 'bismuth_cube',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._bisAcc = 0;
    piece._bisUses = 0;
    const need = Math.max(1, Math.round(getPName(piece.params, 'buffs', 4)));
    const max = Math.max(1, Math.round(getPName(piece.params, 'max', 3)));
    piece._bisTarget = firstLinkedCd(ctx, piece);
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
      const target = piece._bisTarget;
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
      ctx.events.push({
        t: ctx.t,
        type: 'activate',
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'bismuth_cube', miniActivate: true },
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
  emitCharge(piece, ctx, speedFactor = 1) {
    pushActivate(piece, ctx, 'con_trap_tron', `Gadget: ${piece.name}`);
    emitConTrapCharges(piece, ctx, speedFactor);
  },
  // ConTrapTron.gd applies its speed malus and connects during onPrepare.
  onPrepare(piece, ctx) {
    piece._trap = false;
    const malus = getPName(piece.params, 'speed', 10) / 100;
    const target = firstLinkedCd(ctx, piece);
    // ConTrapTron.gd resolves getFirstAffectedItem() during onPrepare and
    // reuses that same item when the health threshold later fires.
    piece._trapTarget = target;
    if (target && malus) addSpeed(target, -malus);
    const th = getPName(piece.params, 'healtht', 70) / 100 - 0.0001;
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
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
      const linked = piece._trapTarget;
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
  onPrepare(piece, ctx) {
    piece._eatArmState = 'off';
    const primary = linkedPrimaryFood(ctx, piece)[0] || null;
    piece._eatPrimary = primary;
    if (primary) addSpeed(primary, getPName(piece.params, 'speed', 10) / 100);
    piece._eatOthers = (ctx.pieces || []).filter(
      (o) => o !== primary && itemHasType(ctx.itemsById.get(o.itemId), 'food'),
    );
  },
  onCombatStart(piece) {
    if (piece._eatArmState !== 'fast') piece._eatArmState = 'slow';
  },
  onChargeReceived(piece) {
    if (Number(piece.numCharges) !== 1) return;
    const primary = piece._eatPrimary;
    const foodSpeed = getPName(piece.params, 'speed', 10) / 100;
    const chargedSpeed = getPName(piece.params, 'speed2', 15) / 100;
    if (primary) addSpeed(primary, chargedSpeed - foodSpeed);
    for (const f of piece._eatOthers || []) {
      addSpeed(f, getPName(piece.params, 'speed3', 8) / 100);
    }
    piece._eatArmState = 'fast';
  },
  onChargeLeft(piece) {
    if (Number(piece.numCharges) !== 0) return;
    const primary = piece._eatPrimary;
    const foodSpeed = getPName(piece.params, 'speed', 10) / 100;
    const chargedSpeed = getPName(piece.params, 'speed2', 15) / 100;
    if (primary) addSpeed(primary, foodSpeed - chargedSpeed);
    for (const f of piece._eatOthers || []) {
      addSpeed(f, -getPName(piece.params, 'speed3', 8) / 100);
    }
    piece._eatArmState = 'slow';
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
      // Recombobulator.gd extends Item and has no gadget-specific projection.
      pushActivate(piece, ctx, id, `Accessory: ${piece.name}`);
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
