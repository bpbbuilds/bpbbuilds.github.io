/**
 * Band Y Phase 144 — board/speed/charge/weapon outliers.
 */

import { tryUseStamina } from '../actor.js';
import {
  cleanseRandomDebuffs,
  grantStacks,
  onBuffChanged,
  useRegeneration,
} from '../buff-economy.js';
import { affectedTargets, getItemsInside } from '../board-graph.js';
import {
  BATTERY_DUR_PER_TILE,
  buildBatteryChargePath,
  buildGeneratorChargePath,
  buildScriptChargePath,
  chargeEnterSchedule,
} from '../charge-path.js';
import { scheduleStatChargePath } from '../charge-delivery.js';
import { advanceCooldownSeconds, isCooldownActive } from '../cooldown.js';
import { getP, getP1, getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { addSpeed, changeVaryingDamage, modifiedCooldown } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { canBagAffectItem } from '../../../../shared/backpack-grid/can-affect.js';
import { itemHasType, afterEffectFinished, pushActivate } from './ports-util.js';
import { weaponStrike } from './ports-wave-c-util.js';
import { greatswordPort } from './ports-al-weapons.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** CogBadge.gd sendCharge collision map, in source order. */
const COG_BADGE_CHARGE_CELLS = [
  { x: -1, y: -1 },
  { x: -1, y: -2 },
  { x: -1, y: -3 },
  { x: -1, y: -4 },
  { x: -2, y: -3 },
  { x: -3, y: -2 },
  { x: -4, y: -1 },
  { x: -3, y: 0 },
  { x: -2, y: 1 },
  { x: -1, y: 2 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 2, y: -1 },
  { x: 1, y: -2 },
];

/**
 * @param {object} piece
 * @param {import('./handlers.js').ScriptCtx} ctx
 * @param {string} handler
 * @param {{ collisionCells?: { x: number, y: number }[], generatorPath?: boolean, emitBus?: boolean, speedFactor?: number }} [opts]
 */
function emitBatteryCharge(piece, ctx, handler, opts = {}) {
  const { t, events, graph, itemsById } = ctx;
  const item = itemsById.get(piece.itemId);
  const boardPiece = graph.pieces.get(piece.placementKey);
  if (!item || !boardPiece) return;
  const flat = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
  const perTile = getPName(piece.params, 'speed2', getP2(piece.params, 5)) / 100;
  const speedFactor = Math.max(0.01, Number(opts.speedFactor) || 1);
  const durPerTile =
    (getPName(piece.params, 'dur', BATTERY_DUR_PER_TILE) || BATTERY_DUR_PER_TILE) /
    speedFactor;
  const pathId = `charge:${piece.placementKey}:${t}:${speedFactor}`;
  const placement = {
    x: boardPiece.x,
    y: boardPiece.y,
    r: boardPiece.r,
    key: piece.placementKey,
  };
  const path = opts.generatorPath
    ? buildGeneratorChargePath({
        pathId,
        item,
        placement,
        startT: t,
        durPerTile,
      })
    : opts.collisionCells?.length
    ? buildScriptChargePath({
        pathId,
        item,
        placement,
        startT: t,
        collisionCells: opts.collisionCells,
        durPerTile,
      })
    : buildBatteryChargePath({
        pathId,
        item,
        placement,
        startT: t,
        durPerTile,
      });
  if (!path) return;
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
    meta: { category: 'charge', phase: 'start', pathId, chargePath: path, handler },
  });
  const schedule = chargeEnterSchedule(path.cells.length, durPerTile);
  scheduleStatChargePath(piece, ctx, { path, flat, perTile });
  /** @type {string | null} */
  let lastKey = null;
  for (const step of schedule) {
    const cell = path.cells[step.cellIndex];
    const targetKey = cell?.targetKey ?? null;
    const targetPiece = targetKey
      ? (ctx.pieces || []).find((p) => p.placementKey === targetKey)
      : null;
    const enterAbs = t + step.enterT;

    if (targetKey !== lastKey) {
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
          phase: step.cellIndex >= path.cells.length ? 'end' : 'cell',
          pathId,
          cellIndex: step.cellIndex,
          cell: cell?.cell,
          targetKey: targetKey || undefined,
          targetItemId: targetPiece?.itemId,
          handler,
        },
      });
      lastKey = targetKey;
    }
  }

  if (opts.emitBus !== false && handler === 'generator') {
    ctx.bus?.emit?.('charge_emitted', { piece, t });
  }
}

/** @type {ScriptHandler} */
export const springLoaderPort = {
  handlerId: 'spring_loader',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const slow = getPName(piece.params, 'speed1', getP1(piece.params, 10)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (slow) addSpeed(other, -slow);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'spring_loader', `Accessory: ${piece.name}`);
    const speed1 = getPName(piece.params, 'speed1', getP1(piece.params, 10)) / 100;
    const speed2 = getPName(piece.params, 'speed2', getP2(piece.params, 15)) / 100;
    const adv = Math.max(0, getPName(piece.params, 'cd', getP3(piece.params, 1)));
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      addSpeed(other, speed1 + speed2);
      if (adv > 0) advanceCooldownSeconds(other, adv, ctx);
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: spring pulse`,
      meta: { category: 'adjacency', script: true, handler: 'spring_loader' },
    });
    afterEffectFinished(piece, ctx, 'spring_loader', { activate: false });
    return true;
  },
};

/** @type {ScriptHandler} */
export const puzzleBadgePort = {
  handlerId: 'puzzle_badge',
  family: 'unique',
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const slow = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (slow) addSpeed(other, -slow);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'puzzle_badge', `Badge: ${piece.name}`);
    const slow = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const fast = getPName(piece.params, 'speed2', getP2(piece.params, 20)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      addSpeed(other, slow + fast);
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: speed pulse`,
      meta: { category: 'adjacency', script: true, handler: 'puzzle_badge' },
    });
    afterEffectFinished(piece, ctx, 'puzzle_badge', { activate: false });
    return true;
  },
};

/** @type {ScriptHandler} */
export const puzzleboxPort = {
  handlerId: 'puzzlebox',
  family: 'unique',
  onPrepare(piece, ctx) {
    const { graph, pieces, itemsById, canAffect } = ctx;
    const slow = getPName(piece.params, 'speed', getP1(piece.params, 0)) / 100;
    for (const key of getItemsInside(graph, piece.placementKey)) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      const catalog = itemsById.get(other?.itemId);
      const target = catalog
        ? { ...catalog, ...other, params: other.params || catalog.params }
        : other;
      if (other && canBagAffectItem({ id: 'puzzlebox' }, target, canAffect || {}) && slow) {
        addSpeed(other, -slow);
      }
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, pieces, itemsById, canAffect } = ctx;
    const slow = getPName(piece.params, 'speed', getP1(piece.params, 0)) / 100;
    const fast = getPName(piece.params, 'speed2', getP2(piece.params, 0)) / 100;
    for (const key of getItemsInside(graph, piece.placementKey)) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      const catalog = itemsById.get(other?.itemId);
      const target = catalog
        ? { ...catalog, ...other, params: other.params || catalog.params }
        : other;
      if (other && canBagAffectItem({ id: 'puzzlebox' }, target, canAffect || {})) {
        addSpeed(other, slow + fast);
      }
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: inside speed pulse`,
      meta: { category: 'adjacency', script: true, handler: 'puzzlebox' },
    });
    afterEffectFinished(piece, ctx, 'puzzlebox');
    return true;
  },
};

/** TimeDilator.gd — prepare: slow all weapons (both sides); CD: haste highest-CD active item. */
/** @type {ScriptHandler} */
export const timeDilatorPort = {
  handlerId: 'time_dilator',
  family: 'unique',
  onPrepare(piece, ctx) {
    // TimeDilator.gd runs this before cooldowns are armed and resets its
    // alternating activation-sound counter for each combat.
    piece._timeDilatorTickI = 0;
    const slow = getPName(piece.params, 'slow', getP1(piece.params, 30)) / 100;
    if (!slow) return;
    for (const other of ctx.allPieces || ctx.pieces || []) {
      if (!isCombatWeapon(other, ctx.itemsById)) continue;
      addSpeed(other, -slow);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, pieces, player } = ctx;
    const speedUp = getPName(piece.params, 'speed', getP2(piece.params, 6)) / 100;
    let slowest = null;
    let slowestCd = 0;
    for (const other of pieces || []) {
      if (!isCooldownActive(other)) continue;
      const cd = modifiedCooldown(other, player?.stacks);
      if (cd > slowestCd) {
        slowestCd = cd;
        slowest = other;
      }
    }
    piece._timeDilatorTickI = (Number(piece._timeDilatorTickI) || 0) + 1;
    const soundPitch = piece._timeDilatorTickI % 2 === 0 ? 1 : 0.7;
    if (slowest && speedUp) {
      addSpeed(slowest, speedUp);
      events.push({
        t: t + 0.004,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: haste → ${slowest.name}`,
        meta: {
          category: 'buff',
          script: true,
          handler: 'time_dilator',
          targetKey: slowest.placementKey,
          targetItemId: slowest.itemId,
          speedUp,
          modifiedCd: slowestCd,
          tickI: piece._timeDilatorTickI,
          soundPitch,
        },
      });
    }
    return true;
  },
};

/**
 * @param {object} piece
 * @param {Map<string, object>} itemsById
 */
function isCombatWeapon(piece, itemsById) {
  if (piece?.kind === 'weapon') return true;
  return itemHasType(itemsById?.get?.(piece?.itemId), 'weapon');
}

/** @type {ScriptHandler} */
export const bigBloodthornePort = {
  handlerId: 'big_bloodthorne',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    // BigBloodthorne.gd inherits Greatsword.gd, whose empower state is set in
    // Item.prepare rather than at combat start.
    greatswordPort.onCombatStart(piece, ctx);
    const per = Math.max(0, Math.round(getPName(piece.params, 'dam', getP(piece.params, 6, 1))));
    onBuffChanged(ctx.player, (change) => {
      if (change.stack !== 'vampirism' && change.stack !== 'spikes') return;
      changeVaryingDamage(piece, (Number(change.amount) || 0) * per, {
        via: change.stack,
        originKey: change.originKey,
        originId: change.originId,
      });
    });
  },
  onPreDealDamageEarly(piece, ctx, damageRes) {
    if (damageRes && !damageRes.hit) return;
    const { player } = ctx;
    const need = Math.max(1, Math.round(getPName(piece.params, 'regent', getP4(piece.params, 3))));
    if ((Number(player.stacks.regeneration) || 0) < need) return;
    if (
      useRegeneration(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return;
    }
    const vamp = Math.max(1, Math.round(getPName(piece.params, 'vampirism', getP5(piece.params, 1))));
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP6(piece.params, 1))));
    grantStacks(player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'big_bloodthorne');
  },
};

/** @type {ScriptHandler} */
export const corruptedArmorPort = {
  handlerId: 'corrupted_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    const block = Math.max(1, Math.round(piece.blockGrant || getPName(piece.params, 'block', 8)));
    gainStacks(player, 'block', block);
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'corrupted_armor' },
    });
    // CorruptedArmor.gd: Holy linked → addDynamicType(Dark). Tag piece._dynamicTypes for piece-aware readers.
    // Gap: catalog canAffect / itemHasType do not see runtime dynamic types.
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let tagged = 0;
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      const holy = itemHasType(item, 'holy');
      const dark = itemHasType(item, 'dark');
      if (holy && !dark) {
        const dyn = Array.isArray(other._dynamicTypes) ? other._dynamicTypes : [];
        if (!dyn.some((x) => String(x).toLowerCase() === 'dark')) dyn.push('dark');
        other._dynamicTypes = dyn;
        tagged += 1;
      }
    }
    const chance = Math.max(0, Number(piece.chance) || getPName(piece.params, 'chance', 0));
    if (chance > 0 && links.length > 0) {
      ctx.dummy.debuffCleanseProtectChance =
        (Number(ctx.dummy.debuffCleanseProtectChance) || 0) + chance * links.length;
    }
    if (tagged > 0) {
      events.push({
        t: t + 0.01,
        type: 'info',
        label: `${piece.name}: Holy→Dark ×${tagged}`,
        meta: { category: 'adjacency', script: true, handler: 'corrupted_armor' },
      });
    }
    pushActivate(piece, ctx, 'corrupted_armor', `Armor: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    const moved = Math.max(1, Math.round(getPName(piece.params, 'moved', getP1(piece.params, 1))));
    const cleansed = cleanseRandomDebuffs(player, moved, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      cleanse: true,
    });
    let n = 0;
    for (const [stack, amount] of Object.entries(cleansed || {})) {
      gainStacks(dummy, /** @type {any} */ (stack), amount, {
        rng,
        opponent: player,
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      n += amount;
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: move ${n} debuff(s)`,
      meta: { category: 'system', script: true, handler: 'corrupted_armor' },
    });
    pushActivate(piece, ctx, 'corrupted_armor', `Armor: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const generatorPort = {
  handlerId: 'generator',
  family: 'unique',
  emitCharge(piece, ctx, speedFactor = 1) {
    pushActivate(piece, ctx, 'generator', `Accessory: ${piece.name}`);
    emitBatteryCharge(piece, ctx, 'generator', {
      generatorPath: true,
      emitBus: false,
      speedFactor,
    });
  },
  onCombatStart(piece, ctx) {
    pushActivate(piece, ctx, 'generator', `Accessory: ${piece.name}`);
    emitBatteryCharge(piece, ctx, 'generator', { generatorPath: true });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    if (tryUseStamina(player, Math.max(1, piece.staminaCost || 1)) === 'starve') {
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true },
      });
      return true;
    }
    pushActivate(piece, ctx, 'generator', `Accessory: ${piece.name}`);
    emitBatteryCharge(piece, ctx, 'generator', { generatorPath: true });
    return true;
  },
};

/** @type {ScriptHandler} */
export const cogBadgePort = {
  handlerId: 'cog_badge',
  family: 'unique',
  emitCharge(piece, ctx, speedFactor = 1) {
    pushActivate(piece, ctx, 'cog_badge', `Badge: ${piece.name}`);
    emitBatteryCharge(piece, ctx, 'cog_badge', {
      collisionCells: COG_BADGE_CHARGE_CELLS,
      emitBus: false,
      speedFactor,
    });
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'cog_badge', `Badge: ${piece.name}`);
    emitBatteryCharge(piece, ctx, 'cog_badge', {
      collisionCells: COG_BADGE_CHARGE_CELLS,
      emitBus: false,
    });
    // CogBadge.gd emits charge_emitted after its own activation so listeners
    // (and the source EventBus ordering) observe the completed charge send.
    ctx.bus?.emit?.('charge_emitted', { piece, t: ctx.t });
    afterEffectFinished(piece, ctx, 'cog_badge', { activate: false, consume: false });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const OUTLIER_BOARD_PORTS = {
  spring_loader: springLoaderPort,
  puzzle_badge: puzzleBadgePort,
  puzzlebox: puzzleboxPort,
  time_dilator: timeDilatorPort,
  big_bloodthorne: bigBloodthornePort,
  corrupted_armor: corruptedArmorPort,
  generator: generatorPort,
  cog_badge: cogBadgePort,
};
