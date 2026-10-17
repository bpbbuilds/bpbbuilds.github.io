/**
 * Band AO — leftover skills (coverage hole + girl_power).
 */

import { healActor } from '../actor.js';
import {
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  spendStacks,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { rollItemChance, rollItemChance2 } from '../chance.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addAccuracy, addBonusDamageFactor, addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { giveTempMaxHp } from './ports-ap-start.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { rollPercent } from '../rng.js';
import { isBagLike } from '../item-kind.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function linkedEntries(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return links.map((link) => {
    const target = (ctx.pieces || []).find((candidate) => candidate.placementKey === link.key);
    return target ? { link, target, item: ctx.itemsById.get(target.itemId) } : null;
  }).filter(Boolean);
}

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

/**
 * Item.getNumEmptyAffectedCells — count empty inventory slots, not merely
 * unoccupied board coordinates. A bag's cells are available slots; only a
 * placed non-bag item makes one of those cells non-empty.
 * @param {ScriptCtx} ctx
 * @param {import('../pieces.js').CombatPiece} piece
 * @param {string} color
 */
function emptyAffectedCells(ctx, piece, color) {
  const source = ctx.graph?.pieces?.get(piece.placementKey);
  if (!source) return 0;
  const bagCells = new Set();
  for (const boardPiece of ctx.graph.pieces.values()) {
    if (!isBagLike(ctx.itemsById.get(boardPiece.id))) continue;
    for (const cell of boardPiece.cells || []) bagCells.add(cell);
  }
  let count = 0;
  for (const mark of source.affectCells || []) {
    if (mark.color !== color || !bagCells.has(mark.cell)) continue;
    const targetKey = ctx.graph.filled.get(mark.cell);
    if (!targetKey) {
      count += 1;
      continue;
    }
    const target = ctx.graph.pieces.get(targetKey);
    if (target && isBagLike(ctx.itemsById.get(target.id))) count += 1;
  }
  return count;
}

function chanceOf(piece, ctx, fb = 20) {
  const item = ctx.itemsById.get(piece.itemId);
  const n = Number(item?.chance ?? piece.chance);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

function instanceChance(piece, ctx, fallback = 20) {
  const item = ctx.itemsById.get(piece.itemId);
  const raw = piece.chance != null ? piece.chance : item?.chance;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function instanceChance2(piece, ctx, fallback = 0) {
  const item = ctx.itemsById.get(piece.itemId);
  const raw = piece.chance2 != null ? piece.chance2 : item?.chance2;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Bagtacular.gd — presence-only; bags already sniff this id. */
const bagtacularPort = {
  handlerId: 'bagtacular',
  family: 'unique',
  // Bagtacular has no combat hook of its own. Its canAffect_global hook is
  // represented by a presence-only piece so the four affected bag handlers
  // can discover it during prepare/start-of-battle scans.
  presenceOnly: true,
};

const acornAcePort = {
  handlerId: 'acorn_ace',
  family: 'unique',
  // AcornAce.gd applies the Critwood Staff modifier during onPrepare, before
  // initial cooldowns are armed.
  onPrepare(piece, ctx) {
    const fac = -getPName(piece.params, 'stamina2', 15) / 100;
    for (const o of ctx.pieces || []) {
      if (o.itemId !== 'critwood_staff') continue;
      multiplyStaminaCost(o, fac);
    }
  },
};

const arcaneIntellectPort = {
  handlerId: 'arcane_intellect',
  family: 'unique',
  // ArcaneIntellect.gd applies Magic cooldown speed in onPrepare.
  onPrepare(piece, ctx) {
    const spd = getPName(piece.params, 'speed', 12) / 100;
    for (const o of linked(ctx, piece)) {
      if (!itemHasType(ctx.itemsById.get(o.itemId), 'magic')) continue;
      if (o.cooldown > 0 && o.cooldown < 500) addSpeed(o, spd);
    }
  },
};

const buyTheHolyLightPort = {
  handlerId: 'buy_the_holy_light',
  family: 'unique',
  // BuytheHolyLight.gd adds speed during onPrepare. Lamps are a global
  // exception to the ordinary Holy+cooldown canAffect rule, so they must be
  // buffed even when their own cooldown is absent.
  onPrepare(piece, ctx) {
    const spd = getPName(piece.params, 'speed', 12) / 100;
    for (const o of linked(ctx, piece)) {
      const item = ctx.itemsById.get(o.itemId);
      const lamp = o.itemId === 'oil_lamp' || o.itemId === 'djinn_lamp';
      if (!(itemHasType(item, 'holy') || lamp)) continue;
      if (lamp || (o.cooldown > 0 && o.cooldown < 500)) addSpeed(o, spd);
    }
  },
};

const chessMasterPort = {
  handlerId: 'chess_master',
  family: 'unique',
  onPrepare(piece, ctx) {
    const spd = getPName(piece.params, 'speed', 20) / 100;
    const board = (ctx.pieces || []).find((p) => p.itemId === 'chess_board');
    if (board) addSpeed(board, spd);
  },
};

const criticalPoisonPort = {
  handlerId: 'critical_poison',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._cpAcc = 0;
    const th = Math.max(1, Math.round(getPName(piece.params, 'damt', 12)));
    const poi = Math.max(1, Math.round(getPName(piece.params, 'poison', 1)));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit) return;
      if (!linked(ctx, piece).some((o) => o === payload.piece)) return;
      piece._cpAcc += payload.hit.damage || payload.hit.healthDamage || 0;
      const n = Math.floor(piece._cpAcc / th);
      if (n <= 0) return;
      piece._cpAcc %= th;
      grantStacks(ctx.dummy, 'poison', n * poi, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'lucky' || !ch.amount) return;
      ctx.dummy.poisonCritChance =
        (Number(ctx.dummy.poisonCritChance) || 0) + ch.amount * chanceOf(piece, ctx);
    });
  },
};

const dualWieldingPort = {
  handlerId: 'dual_wielding',
  family: 'unique',
  onPrepare(piece, ctx) {
    const weapons = (ctx.pieces || []).filter(
      (o) =>
        o.kind === 'weapon' &&
        (Number.isFinite(Number(o.baseStaminaCost))
          ? Number(o.baseStaminaCost)
          : Number(o.staminaCost) || 0) > 0,
    );
    piece._dualWieldingActive = weapons.length === 2;
    if (!piece._dualWieldingActive) return;
    const spd = getPName(piece.params, 'speed', 15) / 100;
    const stam = getPName(piece.params, 'stamina', 20) / 100;
    for (const o of weapons) {
      addSpeed(o, spd);
      multiplyStaminaCost(o, -stam);
    }
  },
};

const extraBagsPort = {
  handlerId: 'extra_bags',
  family: 'unique',
  // ExtraBags.gd applies this before cooldowns are armed. Its four secondary
  // diamonds count empty inventory slots, while primary cooldown items receive
  // the resulting speed multiplier.
  onPrepare(piece, ctx) {
    const empty = emptyAffectedCells(ctx, piece, 'secondary');
    const spd = getPName(piece.params, 'speed', 0) / 100;
    const total = empty * spd;
    if (!(total > 0)) return;
    for (const o of linked(ctx, piece)) {
      addSpeed(o, total);
    }
  },
};

const heartOfTheCardsPort = {
  handlerId: 'heart_of_the_cards',
  family: 'unique',
  onPrepare(piece, ctx) {
    const regen = Math.trunc(getPName(piece.params, 'regen', getP1(piece.params, 1)));
    const mana = Math.trunc(getPName(piece.params, 'mana', getP2(piece.params, 1)));
    const need = Math.trunc(getPName(piece.params, 'pos', getP3(piece.params, 3)));
    ctx.bus?.on?.('piece_activated', (payload) => {
      const activated = payload?.piece;
      if (!activated || !itemHasType(ctx.itemsById.get(activated.itemId), 'card')) return;
      if (activated.side != null && piece.side != null && activated.side !== piece.side) return;
      const eventCtx = { ...ctx, t: Number(payload?.t) || ctx.t };
      grantStacks(ctx.player, 'regeneration', regen, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const pos = Number(activated._chainPos);
      if (Number.isFinite(pos) && pos + 1 >= need) {
        grantStacks(ctx.player, 'mana', mana, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
      pushActivate(piece, eventCtx, 'heart_of_the_cards', `Skill: ${piece.name}`);
    });
  },
};

const investmentOpportunityPort = {
  handlerId: 'investment_opportunity',
  family: 'unique',
  onPrepare(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const hasExtractedRules = Boolean(ctx.canAffect?.rulesById);
    const keys = new Set((ctx.pieces || []).filter((other) => {
      const link = links.find((candidate) => candidate.key === other.placementKey);
      if (!link) return false;
      // With extracted rules, affectedTargets already evaluated source
      // `usesBuffs()`. The fallback keeps isolated regressions source-faithful.
      if (hasExtractedRules) return true;
      const item = ctx.itemsById.get(other.itemId) || other;
      return other.usesBuffs === true || item.usesBuffs === true ||
        Boolean(ctx.canAffect?.usesBuffsIds?.has?.(other.itemId));
    }).map((other) => other.placementKey));
    piece._investmentAffectedKeys = keys;
    piece._investmentHealthAcc = 0;
    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount < 0) || !ch.used || !ch.originKey || !keys.has(ch.originKey)) return;
      const maxHealth = modifiedParamValue(
        piece,
        getPName(piece.params, 'maxhealth', getP2(piece.params, 2)),
        'maxhealth',
      );
      piece._investmentHealthAcc += Math.abs(ch.amount) * maxHealth;
      const health = Math.round(piece._investmentHealthAcc);
      piece._investmentHealthAcc -= health;
      const currentT = Number(ctx.player._simT);
      const reactionCtx = {
        ...ctx,
        t: Number.isFinite(currentT) ? currentT : ctx.t,
      };
      giveTempMaxHp(piece, reactionCtx, 'investment_opportunity', health);
      ctx.events.push({
        t: reactionCtx.t,
        type: 'info',
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'investment_opportunity', miniActivate: true },
      });
    });
  },
};

const kingOfTheBlingPort = {
  handlerId: 'king_of_the_bling',
  family: 'unique',
  onPrepare(piece, ctx) {
    const rawChance = ctx.itemsById.get(piece.itemId)?.chance ?? piece.chance;
    const ch = Number.isFinite(Number(rawChance)) ? Number(rawChance) : 0;
    for (const o of linked(ctx, piece)) {
      if (piece.side != null && o.side !== piece.side) continue;
      if (o.itemId !== 'magic_ring' && o.itemId !== 'superior_ring') continue;
      o.buffAmpChance = (Number(o.buffAmpChance) || 0) + ch;
      o.debuffAmpChance = (Number(o.debuffAmpChance) || 0) + ch;
    }
  },
};

const markswomanPort = {
  handlerId: 'markswoman',
  family: 'unique',
  onPrepare(piece, ctx) {
    const dam = getPName(piece.params, 'dam', getP1(piece.params, 10)) / 100;
    const spd = getPName(piece.params, 'speed', getP2(piece.params, 10)) / 100;
    const acc = getPName(piece.params, 'acc', getP3(piece.params, 5));
    for (const o of linked(ctx, piece)) {
      const item = ctx.itemsById.get(o.itemId);
      if (!itemHasType(item, 'ranged')) continue;
      addSpeed(o, spd);
      if (canBeEmpoweredPiece(o)) {
        if (dam) addBonusDamageFactor(o, dam);
        if (acc) addAccuracy(o, acc);
      }
    }
  },
};

const piggyPinataPort = {
  handlerId: 'piggy_pinata',
  family: 'unique',
  onPrepare(piece, ctx) {
    const ch = chanceOf(piece, ctx);
    for (const o of linked(ctx, piece)) {
      if ((Number(o.damageMax) || 0) <= 0 && o.kind !== 'weapon') continue;
      o.critChance = (Number(o.critChance) || 0) + ch;
    }
  },
};

/**
 * SpicyBanana.gd —
 * starred Banana/Mananana activate → rollChance → +heat + activate;
 * every `stamina` stamina spent → heal(heal) (fractional accrual).
 * (Shop banana weight boost is out-of-combat — skipped.)
 */
const spicyBananaPort = {
  handlerId: 'spicy_banana',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._stamAcc = 0;
    const rawHeat = Number(getPName(piece.params, 'heat', getP1(piece.params, 0)));
    const heat = Number.isFinite(rawHeat) ? Math.trunc(rawHeat) : 0;
    const rawNeed = Number(getPName(piece.params, 'stamina', getP2(piece.params, 0)));
    const need = Number.isFinite(rawNeed) ? rawNeed : 0;
    const rawHeal = Number(getPName(piece.params, 'heal', getPName(piece.params, 'p3', 0)));
    const healPer = Number.isFinite(rawHeal)
      ? modifiedParamValue(piece, rawHeal, 'heal')
      : 0;
    piece._spicy = { heat, need, healPer };

    ctx.bus?.on?.('stamina_used', (payload) => {
      if (!piece.alive) return;
      if (payload?.actor && payload.actor !== ctx.player) return;
      const amt = Number(payload?.amount) || 0;
      if (!(amt > 0)) return;
      piece._stamAcc = (Number(piece._stamAcc) || 0) + amt;
      const ticks = need > 0 ? Math.floor(piece._stamAcc / need) : 0;
      if (!(ticks > 0)) return;
      piece._stamAcc -= ticks * need;
      const healAmt = ticks * healPer;
      const healed = healActor(ctx.player, healAmt);
      if (healed > 0 || (ctx.player._lastHeal && !ctx.player._lastHeal.meterAttached)) {
        const logged = Number(ctx.player._lastHeal?.loggedAmount) || healed;
        if (ctx.player._lastHeal) ctx.player._lastHeal.meterAttached = true;
        ctx.events.push({
          t: (Number(payload.t) || ctx.t) + 0.002,
          type: 'heal',
          actor: 'player',
          target: 'player',
          amount: logged,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: heal +${logged}`,
          meta: { category: 'heal', script: true, handler: 'spicy_banana' },
        });
      }
      // Game miniActivate() — VFX only; no Activations metric.
    });
  },
  onPeerActivated(listener, activated, ctx) {
    if (activated.itemId !== 'banana' && activated.itemId !== 'mananana') return;
    // Game rollChance() — catalog chance 75 (chanceTag heat is tip chrome).
    if (!rollItemChance(listener, ctx.rng)) return;
    const rawHeat = Number(
      listener._spicy?.heat ??
        getPName(listener.params, 'heat', getP1(listener.params, 0)),
    );
    const heat = Number.isFinite(rawHeat) ? Math.trunc(rawHeat) : 0;
    if (heat > 0) {
      grantStacks(ctx.player, 'heat', heat, {
        piece: listener,
        originKey: listener.placementKey,
        originId: listener.itemId,
        t: ctx.t,
        silentLog: true,
      });
      pushBuffGrants(ctx.events, listener, ctx.player, ctx.t, 'spicy_banana', {
        heat,
      });
    }
    pushActivate(listener, ctx, 'spicy_banana', `Skill: ${listener.name}`);
  },
};

const bindStoned = (piece, ctx) => {
  if (piece._stonedBound) return;
  piece._stonedBound = true;
  const fac = getPName(piece.params, 'blockfordam', 20) / 100;
  const dr = getPName(piece.params, 'damreduction', 15);
  const affectedKeys = new Set(
    (ctx.pieces || [])
      .filter((itemPiece) => {
        const item = ctx.itemsById.get(itemPiece.itemId);
        return itemHasType(item, 'stone') || itemPiece.itemId === 'stone_golem';
      })
      .map((itemPiece) => itemPiece.placementKey),
  );
  const checkBlock = () => {
    const has = getStackAmount(ctx.player, 'block') > 0;
    if (has === Boolean(piece._stoneDr)) return;
    piece._stoneDr = has;
    ctx.player.damageResistancePct =
      (Number(ctx.player.damageResistancePct) || 0) + (has ? dr : -dr);
  };
  // Stoned.gd connects each accepted inventory item's `attacked` signal.
  ctx.bus?.on?.('item_attacked', (payload) => {
    const src = payload?.piece;
    if (!src || !affectedKeys.has(src.placementKey) || !payload?.hit?.hit) return;
    const damage = Number(payload.hit.damage ?? payload.hit.healthDamage) || 0;
    const block = Math.ceil(damage * fac);
    if (block <= 0) return;
    gainStacks(ctx.player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t: payload?.t ?? ctx.t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'stoned' },
    });
    ctx.events.push({
      t: payload?.t ?? ctx.t,
      type: 'info',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: mini activate`,
      meta: { category: 'system', script: true, handler: 'stoned', miniActivate: true },
    });
  });
  const own = (payload = {}) => {
    if (payload.actor && payload.actor !== ctx.player) return;
    checkBlock();
  };
  ctx.bus?.on?.('character_block_changed', own);
  ctx.bus?.on?.('character_damaged', own);
};

const stonedPort = {
  handlerId: 'stoned',
  family: 'unique',
  // Stoned.gd connects its damage/block listeners during onPrepare.
  onPrepare: bindStoned,
  onCombatStart: bindStoned,
};

const uniquelyUniquePort = {
  handlerId: 'uniquely_unique',
  family: 'unique',
  onPrepare(piece, ctx) {
    const entries = linkedEntries(ctx, piece);
    const primary = entries.find(({ link, item }) =>
      link.color === 'primary' && Number(item?.cooldown) > 0,
    );
    if (!primary) return;
    const secondaryCount = entries.filter(({ link }) => link.color === 'secondary').length;
    const base = getP1(piece.params, 0) / 100;
    const bonus = getP2(piece.params, 0) / 100;
    addSpeed(primary.target, base + secondaryCount * bonus);
  },
};

const girlPowerPort = {
  handlerId: 'girl_power',
  family: 'unique',
  onPrepare(piece, ctx) {
    const n = linkedEntries(ctx, piece).filter(({ link }) => link.color === 'primary').length;
    const speed = getPName(piece.params, 'speed', getP3(piece.params, 0)) / 100;
    addSpeed(piece, speed * n);
  },
  onCooldownEffect(piece, ctx) {
    const emp = getStackAmount(ctx.player, 'empower');
    const regen = getStackAmount(ctx.player, 'regeneration');
    const a = Math.trunc(getPName(piece.params, 'empower', getP2(piece.params, 0)));
    const b = Math.trunc(getPName(piece.params, 'regen', getP1(piece.params, 0)));
    if (regen < emp) grantStacks(ctx.player, 'regeneration', b, origin(piece));
    else if (regen > emp) grantStacks(ctx.player, 'empower', a, origin(piece));
    else if (ctx.rng() < 0.5) grantStacks(ctx.player, 'regeneration', b, origin(piece));
    else grantStacks(ctx.player, 'empower', a, origin(piece));
    pushActivate(piece, ctx, 'girl_power', `Skill: ${piece.name}`);
    return true;
  },
};

const iceFlowerPort = {
  handlerId: 'ice_flower',
  family: 'unique',
  onPrepare(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const targetFor = (key) => (ctx.pieces || []).find((candidate) => candidate.placementKey === key);
    piece._iceFlowerPrimaryKeys = new Set(
      links
        .filter((link) => link.color === 'primary')
        .map((link) => targetFor(link.key))
        .filter((target) => itemHasType(ctx.itemsById.get(target?.itemId), 'weapon'))
        .map((target) => target.placementKey),
    );
    piece._iceFlowerSecondaryKeys = new Set(
      links
        .filter((link) => link.color === 'secondary')
        .map((link) => targetFor(link.key))
        .filter((target) => {
          const item = ctx.itemsById.get(target?.itemId);
          if (itemHasType(item, 'shield')) return true;
          if (!itemHasType(item, 'armor')) return false;
          if (target?.canActivate === false || item?.canActivate === false) return false;
          return Boolean(
            target?.canActivate ||
            (Number(target?.cooldown) > 0 && Number(target.cooldown) < 500) ||
            item?.canActivate === true,
          );
        })
        .map((target) => target.placementKey),
    );
    const need = Math.trunc(getPName(piece.params, 'manat', getP1(piece.params, 3)));
    const cold = Math.trunc(getPName(piece.params, 'cold', getP2(piece.params, 1)));
    ctx.bus?.on?.('item_attacked', (payload) => {
      if (!piece._iceFlowerPrimaryKeys?.has(payload?.piece?.placementKey)) return;
      if (getStackAmount(ctx.player, 'mana') < need) return;
      if (!rollItemChance(piece, ctx.rng)) return;
      useMana(ctx.player, need, { originKey: piece.placementKey, originId: piece.itemId });
      grantStacks(ctx.dummy, 'cold', cold, {
        rng: ctx.rng,
        opponent: ctx.player,
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      ctx.events.push({
        t: payload?.t ?? ctx.t,
        type: 'info',
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'ice_flower', miniActivate: true },
      });
    });
  },
  onPeerActivated(listener, activated, ctx) {
    if (!listener._iceFlowerSecondaryKeys?.has(activated?.placementKey)) return;
    const item = ctx.itemsById.get(activated.itemId);
    if (!itemHasType(item, 'shield') && !itemHasType(item, 'armor')) return;
    if (!rollItemChance2(listener, ctx.rng)) return;
    const mana = Math.trunc(getPName(listener.params, 'mana', getP3(listener.params, 1)));
    const block = Math.max(
      0,
      Math.round(Number(listener.blockGrant ?? ctx.itemsById.get(listener.itemId)?.block) || 0),
    );
    grantStacks(ctx.player, 'mana', mana, {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
    gainStacks(ctx.player, 'block', block, {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      actor: eventSideForPiece(listener),
      itemId: listener.itemId,
      placementKey: listener.placementKey,
      label: `${listener.name}: mini activate`,
      meta: { category: 'system', script: true, handler: 'ice_flower', miniActivate: true },
    });
  },
};

const solarisPort = {
  handlerId: 'solaris',
  family: 'unique',
  onPrepare(piece, ctx) {
    const heatAmp = instanceChance2(piece, ctx);
    for (const target of ctx.pieces || []) {
      target.buffAmplificationChances = target.buffAmplificationChances || {};
      target.buffAmplificationChances.heat =
        (Number(target.buffAmplificationChances.heat) || 0) + heatAmp;
    }
    const targets = linked(ctx, piece).filter((target) =>
      target.itemId === 'sun_shield' || target.itemId === 'sun_armor');
    const shieldKeys = new Set(
      targets.filter((target) => target.itemId === 'sun_shield').map((target) => target.placementKey),
    );
    const armorKeys = new Set(
      targets.filter((target) => target.itemId === 'sun_armor').map((target) => target.placementKey),
    );
    const heat = Math.trunc(getPName(piece.params, 'heat', 1));
    const block = Math.max(
      0,
      Math.round(piece.blockGrant ?? ctx.itemsById.get(piece.itemId)?.block ?? 0),
    );
    const origin = { originKey: piece.placementKey, originId: piece.itemId };
    ctx.bus?.on?.('afterBlock', (payload) => {
      if (!shieldKeys.has(payload?.piece?.placementKey)) return;
      if (!rollPercent(instanceChance(piece, ctx), ctx.rng)) return;
      grantStacks(ctx.player, 'heat', heat, origin);
      pushActivate(piece, ctx, 'solaris', `Skill: ${piece.name}`);
    });
    ctx.bus?.on?.('used_heat', (payload) => {
      if (!armorKeys.has(payload?.piece?.placementKey)) return;
      grantStacks(ctx.player, 'block', block, origin);
      ctx.events.push({
        t: payload?.t ?? ctx.t,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'solaris', miniActivate: true },
      });
    });
  },
};

const shieldedSkillPort = {
  handlerId: 'shielded',
  family: 'unique',
  onPrepare(piece, ctx) {
    const ch = getPName(piece.params, 'chance', 10);
    const spd = getPName(piece.params, 'speed', 10) / 100;
    for (const o of linked(ctx, piece)) {
      const item = ctx.itemsById.get(o.itemId);
      if (itemHasType(item, 'shield')) {
        o.bonusChanceAdd1 = (Number(o.bonusChanceAdd1) || 0) + ch;
      }
      else if (itemHasType(item, 'armor') && o.cooldown > 0) addSpeed(o, spd);
    }
  },
};

const smellyBarrierPort = {
  handlerId: 'smelly_barrier',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._blk = 0;
    const bonus = Math.trunc(modifiedParamValue(
      piece,
      getPName(piece.params, 'blockbonus', getP1(piece.params, 5)),
      'blockbonus',
    ));
    const need = Math.trunc(modifiedParamValue(
      piece,
      getPName(piece.params, 'blockt', getP2(piece.params, 13)),
      'blockt',
    ));
    const poi = modifiedParamValue(
      piece,
      getPName(piece.params, 'poison', getPName(piece.params, 'p3', 1)),
      'poison',
    );
    const links = linked(ctx, piece);
    piece._smellyBlockers = new Set(
      links.filter((o) => o.itemId !== 'garlic').map((o) => o.placementKey),
    );
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'block' || !(ch.amount > 0)) return;
      if (!piece._smellyBlockers?.has(ch.originKey)) return;
      piece._blk += ch.amount;
      if (!(need > 0) || piece._blk < need) return;
      const poison = (piece._blk / need) * poi;
      piece._blk %= need;
      grantStacks(ctx.dummy, 'poison', poison, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushActivate(piece, ctx, 'smelly_barrier', `Skill: ${piece.name}`);
    });
    for (const o of links) {
      if (o.itemId === 'garlic' && bonus) {
        o.blockGrant = (Number(o.blockGrant) || 0) + bonus;
      }
    }
  },
};

void giveRandomBuffs;
void healActor;
void spendStacks;

/** @type {Record<string, ScriptHandler>} */
export const AO_SKILL_PORTS = {
  bagtacular: bagtacularPort,
  acorn_ace: acornAcePort,
  arcane_intellect: arcaneIntellectPort,
  buy_the_holy_light: buyTheHolyLightPort,
  chess_master: chessMasterPort,
  critical_poison: criticalPoisonPort,
  dual_wielding: dualWieldingPort,
  extra_bags: extraBagsPort,
  heart_of_the_cards: heartOfTheCardsPort,
  investment_opportunity: investmentOpportunityPort,
  king_of_the_bling: kingOfTheBlingPort,
  markswoman: markswomanPort,
  piggy_pinata: piggyPinataPort,
  spicy_banana: spicyBananaPort,
  stoned: stonedPort,
  uniquely_unique: uniquelyUniquePort,
  girl_power: girlPowerPort,
  ice_flower: iceFlowerPort,
  solaris: solarisPort,
  shielded: shieldedSkillPort,
  smelly_barrier: smellyBarrierPort,
};
