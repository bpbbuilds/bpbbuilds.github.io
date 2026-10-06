/**
 * Band AP 244 — leftover `cd_lucky` MAP items → `.gd` ports.
 * Leaf Badge stays in ports-an-accessories.js (HAND only).
 */

import {
  BUFF_KEYS,
  DEBUFF_KEYS,
  cleanseRandomDebuffs,
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  spendStacks,
  stealRandomBuff,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { PLAYER_STAMINA_REGEN, giveStamina } from '../actor.js';
import { applyStaminaRegeneration } from '../actor-stats.js';
import { scheduleStatChargePath } from '../charge-delivery.js';
import { buildScriptChargePath, chargeEnterSchedule } from '../charge-path.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { itemHasType, afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';
import { applyFoodPrepareSpeed } from './food-helpers.js';
import { recordPieceMod, withStatSource } from '../stat-mods.js';
import { eventSideForPiece } from '../vs-board.js';
import { canAffectColor } from '../../../../shared/backpack-grid/can-affect.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function linkedByColor(ctx, piece, color) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) =>
    links.some((l) => l.key === o.placementKey && (!color || l.color === color)),
  );
}

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

function debuffStacks(actor) {
  let n = 0;
  for (const k of DEBUFF_KEYS) n += getStackAmount(actor, /** @type {any} */ (k));
  return n;
}

function countTypes(ctx, piece) {
  const counts = { nature: 0, ice: 0, holy: 0, dark: 0, spell: 0 };
  for (const o of linked(ctx, piece)) {
    const item = ctx.itemsById.get(o.itemId);
    if (itemHasType(item, 'nature')) counts.nature += 1;
    if (itemHasType(item, 'ice')) counts.ice += 1;
    if (itemHasType(item, 'holy')) counts.holy += 1;
    if (itemHasType(item, 'dark')) counts.dark += 1;
    if (itemHasType(item, 'spell')) counts.spell += 1;
  }
  return counts;
}

/** Broccoli.gd — if lucky ≥ luckt regen else lucky; activate. */
const broccoliPort = {
  handlerId: 'broccoli',
  family: 'food',
  onPrepare(piece, ctx) {
    // Broccoli inherits Food.prepare(), which grants +10% speed per linked
    // food item before cooldowns are armed.
    applyFoodPrepareSpeed(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP1(piece.params, 2))));
    const need = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP2(piece.params, 5))));
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', getP3(piece.params, 2))));
    pushActivate(piece, ctx, 'broccoli', `Food: ${piece.name}`);
    if (getStackAmount(ctx.player, 'lucky') >= need) {
      grantStacks(ctx.player, 'regeneration', regen, origin(piece));
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'buff',
        target: 'player',
        amount: regen,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${regen} regeneration`,
        meta: { category: 'buff', script: true, handler: 'broccoli', stack: 'regeneration' },
      });
    } else {
      grantStacks(ctx.player, 'lucky', luck, origin(piece));
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'buff',
        target: 'player',
        amount: luck,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${luck} lucky`,
        meta: { category: 'buff', script: true, handler: 'broccoli', stack: 'lucky' },
      });
    }
    return true;
  },
};

/** Broccotree.gd — always lucky; regen if over luckt; regen→stamina regen. */
const broccotreePort = {
  handlerId: 'broccotree',
  family: 'food',
  onPrepare(piece, ctx) {
    // Broccotree overrides Food.onPrepare in the source and therefore does
    // not inherit Food.prepare's food-speed aura. It uses baseStaminaRegen,
    // not any already-modified runtime stamina rate.
    const baseStam = PLAYER_STAMINA_REGEN;
    const perRegen =
      (getPName(piece.params, 'stamina', getPName(piece.params, 'p4', 1)) / 100) *
      baseStam;
    const origin = {
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      name: piece.name,
    };
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'regeneration' || !(ch.amount > 0) || !(perRegen > 0)) return;
      applyStaminaRegeneration(ctx.player, ch.amount * perRegen, ctx, origin);
    });
  },
  onCooldownEffect(piece, ctx) {
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP1(piece.params, 3))));
    const need = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP2(piece.params, 5))));
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', getP3(piece.params, 3))));
    pushActivate(piece, ctx, 'broccotree', `Food: ${piece.name}`);
    grantStacks(ctx.player, 'lucky', luck, origin(piece));
    ctx.events.push({
      t: ctx.t + 0.002,
      type: 'buff',
      target: 'player',
      amount: luck,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${luck} lucky`,
      meta: { category: 'buff', script: true, handler: 'broccotree', stack: 'lucky' },
    });
    if (getStackAmount(ctx.player, 'lucky') >= need) {
      grantStacks(ctx.player, 'regeneration', regen, origin(piece));
      ctx.events.push({
        t: ctx.t + 0.004,
        type: 'buff',
        target: 'player',
        amount: regen,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${regen} regeneration`,
        meta: { category: 'buff', script: true, handler: 'broccotree', stack: 'regeneration' },
      });
    }
    return true;
  },
};

/**
 * ChargeSplitter.gd — CD: if heat ≥ heatt spend+lucky+block; always onAfterEffectFinished.
 * First charge received: activate + split pulse; cells amp buff chance.
 */
const CHARGE_SPLITTER_CELLS_1 = [
  { x: -1, y: -1 }, { x: -2, y: -1 }, { x: -2, y: 0 },
  { x: -2, y: 1 }, { x: -3, y: 1 }, { x: -4, y: 1 }, { x: -4, y: 0 },
];
const CHARGE_SPLITTER_CELLS_2 = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 0, y: -2 },
  { x: 0, y: -3 }, { x: 1, y: -3 }, { x: 2, y: -3 }, { x: 2, y: -2 },
];

/** ChargeSplitter.gd's two explicit sendCharge paths. */
function emitChargeSplitterCharges(piece, ctx) {
  const item = ctx.itemsById.get(piece.itemId);
  const boardPiece = ctx.graph?.pieces?.get(piece.placementKey);
  if (!item || !boardPiece) return;
  const durPerTile = Math.max(0.01, getPName(piece.params, 'dur', 2));
  const flat = Number(piece.chance) || getPName(piece.params, 'chance', 10);
  const perTile = Number(piece.chance2) || getPName(piece.params, 'chance2', 5);
  const placement = { x: boardPiece.x, y: boardPiece.y, r: boardPiece.r, key: piece.placementKey };
  const paths = [CHARGE_SPLITTER_CELLS_1, CHARGE_SPLITTER_CELLS_2];
  for (let i = 0; i < paths.length; i += 1) {
    const pathId = `charge-splitter:${piece.placementKey}:${ctx.t}:${i}`;
    const path = buildScriptChargePath({ pathId, item, placement, startT: ctx.t, collisionCells: paths[i], durPerTile });
    if (!path) continue;
    for (const cell of path.cells) {
      const targetKey = ctx.graph.filled.get(cell.cell) || null;
      const targetPiece = targetKey ? ctx.graph.pieces.get(targetKey) : null;
      const targetItem = targetPiece ? ctx.itemsById.get(targetPiece.id) : null;
      const accepts = targetItem && canAffectColor(
        ctx.canAffect?.rulesById || null,
        item,
        targetItem,
        'lightning',
        ctx.canAffect || {},
      );
      cell.targetKey = targetKey && targetKey !== piece.placementKey && accepts ? targetKey : null;
    }
    const actor = eventSideForPiece(piece);
    ctx.events.push({
      t: ctx.t,
      type: 'charge',
      actor,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: sendCharge`,
      meta: { category: 'charge', phase: 'start', pathId, chargePath: path, handler: 'charge_splitter' },
    });
    scheduleStatChargePath(piece, ctx, { path, flat, perTile, mode: 'buffAmp' });
    let lastKey = null;
    for (const step of chargeEnterSchedule(path.cells.length, durPerTile)) {
      const cell = path.cells[step.cellIndex];
      const targetKey = cell?.targetKey || null;
      const targetPiece = targetKey ? (ctx.pieces || []).find((p) => p.placementKey === targetKey) : null;
      const enterT = ctx.t + step.enterT;
      if (targetKey !== lastKey) {
        if (targetPiece) {
          targetPiece.pendingCharges = targetPiece.pendingCharges || [];
          targetPiece.pendingCharges.push({ at: enterT, meta: { pathId, cellIndex: step.cellIndex, emitterKey: piece.placementKey } });
        }
        lastKey = targetKey;
      }
      ctx.events.push({
        t: enterT,
        type: 'charge',
        actor,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: targetPiece ? `${piece.name}: charge → ${targetPiece.name}` : `${piece.name}: charge cell`,
        meta: { category: 'charge', phase: 'cell', pathId, cellIndex: step.cellIndex, cell: cell?.cell, targetKey: targetKey || undefined, handler: 'charge_splitter' },
      });
    }
  }
}

const chargeSplitterPort = {
  handlerId: 'charge_splitter',
  family: 'unique',
  onPrepare(piece) {
    piece._splitterFired = false;
  },
  onChargeReceived(piece, ctx) {
    if (piece._splitterFired) return;
    piece._splitterFired = true;
    pushActivate(piece, ctx, 'charge_splitter', `Accessory: ${piece.name}`);
    emitChargeSplitterCharges(piece, ctx);
    ctx.bus?.emit?.('charge_emitted', { piece, t: ctx.t });
  },
  onCooldownEffect(piece, ctx) {
    const need = Math.max(1, Math.round(getPName(piece.params, 'heatt', getP1(piece.params, 3))));
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP2(piece.params, 5))));
    if (getStackAmount(ctx.player, 'heat') >= need) {
      spendStacks(ctx.player, 'heat', need, origin(piece));
      grantStacks(ctx.player, 'lucky', luck, origin(piece));
      const block =
        Number(ctx.itemsById.get(piece.itemId)?.block) ||
        Math.max(1, Math.round(getPName(piece.params, 'block', 30)));
      grantStacks(ctx.player, 'block', block, origin(piece));
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'buff',
        target: 'player',
        amount: luck,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${luck} lucky, +${block} block`,
        meta: { category: 'buff', script: true, handler: 'charge_splitter', stack: 'lucky' },
      });
    }
    afterEffectFinished(piece, ctx, 'charge_splitter');
    return true;
  },
};

/** Flute.gd — start speed × affected; CD pick block / stamina / lucky, no immediate repeat. */
const flutePort = {
  handlerId: 'flute',
  family: 'unique',
  onPrepare(piece, ctx) {
    const n = linked(ctx, piece).length;
    const spd = getP3(piece.params, 10) / 100;
    if (n && spd) addSpeed(piece, spd * n);
    piece._fluteOpts = [0, 1, 2];
  },
  onCooldownEffect(piece, ctx) {
    let opts = piece._fluteOpts;
    if (!Array.isArray(opts) || !opts.length) opts = [0, 1, 2];
    const pick = opts[Math.floor(ctx.rng() * opts.length)] ?? 0;
    if (pick === 0) {
      const block = Number(ctx.itemsById.get(piece.itemId)?.block) || 14;
      gainStacks(ctx.player, 'block', block);
    } else if (pick === 1) {
      const stam = Math.max(1, Math.round(getP1(piece.params, 2)));
      const before = Number(ctx.player.stamina) || 0;
      giveStamina(ctx.player, stam);
      const gained = Math.max(0, (Number(ctx.player.stamina) || 0) - before);
      if (gained > 0) {
        ctx.events.push({
          t: ctx.t,
          type: 'stamina',
          actor: eventSideForPiece(piece),
          amount: gained,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${gained} stamina`,
          meta: { category: 'stamina', kind: 'gained', script: true, handler: 'flute' },
        });
      }
    } else {
      const luck = Math.max(1, Math.round(getP2(piece.params, 2)));
      grantStacks(ctx.player, 'lucky', luck, origin(piece));
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'buff',
        target: 'player',
        amount: luck,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${luck} lucky`,
        meta: { category: 'buff', script: true, handler: 'flute', stack: 'lucky' },
      });
    }
    // Flute.gd activates after the selected grant.
    pushActivate(piece, ctx, 'flute', `Accessory: ${piece.name}`);
    piece._fluteOpts = [0, 1, 2].filter((x) => x !== pick);
    return true;
  },
};

/** FortunasKiss.gd — prepare addBonusChance; CD lucky until luckt else random buffs (no Lucky). */
const fortunasKissPort = {
  handlerId: 'fortunas_kiss',
  family: 'unique',
  onPrepare(piece, ctx) {
    const bonus = getPName(piece.params, 'chance', getP1(piece.params, 35));
    withStatSource(piece, () => {
      for (const o of linked(ctx, piece).filter((other) => {
        const item = ctx.itemsById.get(other.itemId);
        const chance = Number(other.chance ?? item?.chance);
        return Number.isFinite(chance) && chance > 0;
      })) {
        o.bonusChanceMult = (Number(o.bonusChanceMult) || 0) + bonus;
        recordPieceMod(o, { stat: 'chance', amount: Number(bonus) / 100, unit: 'factor' });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const need = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP2(piece.params, 5))));
    if (getStackAmount(ctx.player, 'lucky') >= need) {
      const picked = giveRandomBuffs(ctx.player, 1, ctx.rng, {
        ...origin(piece),
        availableBuffs: BUFF_KEYS.filter((k) => k !== 'lucky'),
      });
      pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'fortunas_kiss', picked);
    } else {
      grantStacks(ctx.player, 'lucky', 1, origin(piece));
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'buff',
        target: 'player',
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 lucky`,
        meta: { category: 'buff', script: true, handler: 'fortunas_kiss', stack: 'lucky' },
      });
    }
    // FortunasKiss.gd activates after its lucky/random-buff branch.
    pushActivate(piece, ctx, 'fortunas_kiss', `Skill: ${piece.name}`);
    return true;
  },
};

/** LightFlower.gd — buff-cleanse-protect from holy stars; CD spend mana → cleanse, then luck+regen if none left. */
const lightFlowerPort = {
  handlerId: 'light_flower',
  family: 'unique',
  onPrepare(piece, ctx) {
    const item = ctx.itemsById.get(piece.itemId);
    const ch = Number(item?.chance) || 20;
    const ch2 = Number(item?.chance2) || 5;
    const holy = linkedByColor(ctx, piece, 'secondary').filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'holy'),
    ).length;
    ctx.player.buffCleanseProtectChance =
      (Number(ctx.player.buffCleanseProtectChance) || 0) + ch + ch2 * holy;
  },
  onCooldownEffect(piece, ctx) {
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 1))));
    const debuffs = Math.max(1, Math.round(getPName(piece.params, 'debuffs', getP2(piece.params, 3))));
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP3(piece.params, 1))));
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', getPName(piece.params, 'p4', 1))));
    if (getStackAmount(ctx.player, 'mana') >= need) {
      useMana(ctx.player, need, origin(piece));
      cleanseRandomDebuffs(ctx.player, debuffs, ctx.rng, origin(piece));
      if (debuffStacks(ctx.player) === 0) {
        grantStacks(ctx.player, 'regeneration', regen, origin(piece));
        grantStacks(ctx.player, 'lucky', luck, origin(piece));
        ctx.events.push({
          t: ctx.t + 0.002,
          type: 'buff',
          actor: eventSideForPiece(piece),
          target: eventSideForPiece(piece),
          amount: luck,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${luck} lucky, +${regen} regeneration`,
          meta: { category: 'buff', script: true, handler: 'light_flower', stack: 'lucky' },
        });
      }
    }
    pushActivate(piece, ctx, 'light_flower', `Spell: ${piece.name}`);
    return true;
  },
};

/** Ultima.gd — spell stars speed; CD type grants then onAfterEffectFinished. */
const ultimaPort = {
  handlerId: 'ultima',
  family: 'unique',
  onPrepare(piece, ctx) {
    const types = piece._ultimaTypes = countTypes(ctx, piece);
    const spd = getPName(piece.params, 'speed', getPName(piece.params, 'p5', 75)) / 100;
    if (types.spell > 0 && spd) addSpeed(piece, spd * types.spell);
  },
  onCooldownEffect(piece, ctx) {
    const types = piece._ultimaTypes || countTypes(ctx, piece);
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP1(piece.params, 2))));
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP2(piece.params, 2))));
    const cold = Math.max(1, Math.round(getPName(piece.params, 'cold', getP3(piece.params, 2))));
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', getPName(piece.params, 'p4', 3))));
    const blockEach = Number(ctx.itemsById.get(piece.itemId)?.block) || 15;
    if (types.nature > 0) {
      grantStacks(ctx.player, 'lucky', types.nature * luck, origin(piece));
      grantStacks(ctx.player, 'spikes', types.nature * spikes, origin(piece));
    }
    if (types.ice > 0) {
      gainStacks(ctx.player, 'block', types.ice * blockEach);
      grantStacks(ctx.dummy, 'cold', types.ice * cold, origin(piece));
    }
    if (types.holy > 0) {
      grantStacks(ctx.player, 'regeneration', types.holy * regen, origin(piece));
    }
    if (types.dark > 0) {
      stealRandomBuff(ctx.dummy, ctx.player, types.dark, ctx.rng, origin(piece));
    }
    afterEffectFinished(piece, ctx, 'ultima');
    return true;
  },
};

/** Wisp.gd inventory: nature speed; CD luck+regen then consume. Weapon socket is gem-sockets.js. */
const wispPort = {
  handlerId: 'wisp',
  family: 'unique',
  onPrepare(piece, ctx) {
    const n = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'nature'),
    ).length;
    const spd = getPName(piece.params, 'speed', getP3(piece.params, 10)) / 100;
    if (n && spd) addSpeed(piece, spd * n);
  },
  onCooldownEffect(piece, ctx) {
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP1(piece.params, 10))));
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', getP2(piece.params, 10))));
    grantStacks(ctx.player, 'lucky', luck, origin(piece));
    grantStacks(ctx.player, 'regeneration', regen, origin(piece));
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'buff',
        actor: eventSideForPiece(piece),
        target: eventSideForPiece(piece),
      amount: luck,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${luck} lucky, +${regen} regeneration`,
      meta: { category: 'buff', script: true, handler: 'wisp', stack: 'lucky' },
    });
    afterEffectFinished(piece, ctx, 'wisp');
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AP_LUCKY_PORTS = {
  broccoli: broccoliPort,
  broccotree: broccotreePort,
  charge_splitter: chargeSplitterPort,
  flute: flutePort,
  fortunas_kiss: fortunasKissPort,
  light_flower: lightFlowerPort,
  ultima: ultimaPort,
  wisp: wispPort,
};
