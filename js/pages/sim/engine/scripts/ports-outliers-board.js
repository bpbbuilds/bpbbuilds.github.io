/**
 * Band Y Phase 144 — board/speed/charge/weapon outliers.
 */

import { tryUseStamina } from '../actor.js';
import {
  cleanseRandomDebuffs,
  grantStacks,
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
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamage, addSpeed, modifiedCooldown } from '../piece-stats.js';
import { randInt } from '../rng.js';
import { gainStacks } from '../stacks.js';
import { dealHit } from './handlers.js';
import { itemHasType, afterEffectFinished, pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * @param {object} piece
 * @param {import('./handlers.js').ScriptCtx} ctx
 * @param {string} handler
 * @param {{ collisionCells?: { x: number, y: number }[], generatorPath?: boolean, emitBus?: boolean }} [opts]
 */
function emitBatteryCharge(piece, ctx, handler, opts = {}) {
  const { t, events, graph, itemsById } = ctx;
  const item = itemsById.get(piece.itemId);
  const boardPiece = graph.pieces.get(piece.placementKey);
  if (!item || !boardPiece) return;
  const flat = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
  const perTile = getPName(piece.params, 'speed2', getP2(piece.params, 5)) / 100;
  const durPerTile = getPName(piece.params, 'dur', BATTERY_DUR_PER_TILE) || BATTERY_DUR_PER_TILE;
  const pathId = `charge:${piece.placementKey}:${t}`;
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
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const slow = getPName(piece.params, 'slow', getP1(piece.params, 10)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (slow) addSpeed(other, -slow);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'puzzle_badge', `Badge: ${piece.name}`);
    const slow = getPName(piece.params, 'slow', getP1(piece.params, 10)) / 100;
    const fast = getPName(piece.params, 'fast', getP2(piece.params, 20)) / 100;
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
  onCombatStart(piece, ctx) {
    const { graph, pieces } = ctx;
    const slow = getPName(piece.params, 'slow', getP1(piece.params, 10)) / 100;
    for (const key of getItemsInside(graph, piece.placementKey)) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      if (other && slow) addSpeed(other, -slow);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, pieces } = ctx;
    pushActivate(piece, ctx, 'puzzlebox', `Bag: ${piece.name}`);
    const slow = getPName(piece.params, 'slow', getP1(piece.params, 10)) / 100;
    const fast = getPName(piece.params, 'fast', getP2(piece.params, 20)) / 100;
    for (const key of getItemsInside(graph, piece.placementKey)) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      if (other) addSpeed(other, slow + fast);
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: inside speed pulse`,
      meta: { category: 'adjacency', script: true, handler: 'puzzlebox' },
    });
    afterEffectFinished(piece, ctx, 'puzzlebox', { activate: false });
    return true;
  },
};

/** TimeDilator.gd — prepare: slow all weapons (both sides); CD: haste highest-CD active item. */
/** @type {ScriptHandler} */
export const timeDilatorPort = {
  handlerId: 'time_dilator',
  family: 'unique',
  onCombatStart(piece, ctx) {
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
  onCombatStart(piece, ctx) {
    const per = Math.max(0, Math.round(getPName(piece.params, 'dam', getP1(piece.params, 1))));
    const vamp = Number(ctx.player.stacks.vampirism) || 0;
    const spikes = Number(ctx.player.stacks.spikes) || 0;
    if (per > 0) addBonusDamage(piece, (vamp + spikes) * per);
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
      return true;
    }
    pushActivate(piece, ctx, 'big_bloodthorne', `Weapon: ${piece.name}`);
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    const hit = dealHit(piece, ctx, raw);
    if (hit.hit) {
      const need = Math.max(1, Math.round(getPName(piece.params, 'regent', getP2(piece.params, 3))));
      if ((Number(player.stacks.regeneration) || 0) >= need) {
        if (
          useRegeneration(player, need, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          }).spent > 0
        ) {
          const vamp = Math.max(1, Math.round(getPName(piece.params, 'vampirism', 1)));
          const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', 1)));
          grantStacks(player, 'vampirism', vamp, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          grantStacks(player, 'spikes', spikes, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          events.push({
            t: t + 0.01,
            type: 'buff',
            target: 'player',
            amount: vamp,
            label: `${piece.name}: Regen→Vamp/Spikes`,
            meta: { category: 'buff', script: true, handler: 'big_bloodthorne' },
          });
        }
      }
    }
    return true;
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
    // Gap: opponent changeDebuffProtectionChance (cleanse-protect) — engine has no cleanseProtectionChance.
    const chance = Math.max(0, Number(piece.chance) || getPName(piece.params, 'chance', 0));
    if (chance > 0 && tagged > 0) {
      events.push({
        t: t + 0.01,
        type: 'info',
        label: `${piece.name}: Holy→Dark ×${tagged} (opp cleanse-protect unsupported)`,
        meta: { category: 'adjacency', script: true, handler: 'corrupted_armor', gap: 'cleanseProtection' },
      });
    } else if (tagged > 0) {
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
    pushActivate(piece, ctx, 'corrupted_armor', `Armor: ${piece.name}`);
    const moved = Math.max(1, Math.round(getPName(piece.params, 'moved', getP1(piece.params, 1))));
    const cleansed = cleanseRandomDebuffs(player, moved, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    let n = 0;
    for (const [stack, amount] of Object.entries(cleansed || {})) {
      gainStacks(dummy, /** @type {any} */ (stack), amount, { rng, opponent: player });
      n += amount;
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: move ${n} debuff(s)`,
      meta: { category: 'system', script: true, handler: 'corrupted_armor' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const generatorPort = {
  handlerId: 'generator',
  family: 'unique',
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
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'cog_badge', `Badge: ${piece.name}`);
    emitBatteryCharge(piece, ctx, 'cog_badge');
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
