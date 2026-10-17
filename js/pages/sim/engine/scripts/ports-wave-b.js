/**
 * Band AD Wave B — start grants, cold CDs, light pets/misc.
 */

import {
  BUFF_KEYS,
  advanceBuffThresholds,
  grantStacks,
  grantTemporaryStacks,
  onBuffChanged,
  spendStacks,
  useMana,
} from '../buff-economy.js';
import { changeBuffCleanseProtectChance, healActor, tryUseStamina } from '../actor.js';
import { affectedTargets, getItemsInside } from '../board-graph.js';
import { getP, getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addEffectDurationFactor } from '../effect-duration.js';
import { addBonusDamageFactor, addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount, loseStacks } from '../stacks.js';
import { applyEffectDmgFactor } from '../actor-stats.js';
import { dealEffectDamage, dealHit } from './handlers.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { afterEffectFinished, itemHasType, itemTypeMultiplicity, pushActivate } from './ports-util.js';
import { randInt } from '../rng.js';
import { eventSideForPiece } from '../vs-board.js';
import { leatherHelmPort } from './ports-ai-hard.js';
import { canBagAffectItem } from '../../../../shared/backpack-grid/can-affect.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * @param {object} ctx
 * @param {object} piece
 * @param {(other: object, item: object|undefined) => boolean} [pred]
 * @param {'primary'|'secondary'|'tertiary'|'lightning'} [color]
 */
function linkedCount(ctx, piece, pred, color = null) {
  const { graph, itemsById, canAffect, pieces } = ctx;
  const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
  let n = 0;
  for (const other of pieces || []) {
    if (!links.some((l) => l.key === other.placementKey && (!color || l.color === color))) continue;
    const item = itemsById.get(other.itemId);
    if (pred && !pred(other, item)) continue;
    n += 1;
  }
  return n;
}

/** magic_badge */
/** @type {ScriptHandler} */
export const magicBadgePort = {
  handlerId: 'magic_badge',
  family: 'start_buff',
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const rawAmp = Number.isFinite(Number(piece.chance))
      ? Number(piece.chance)
      : getPName(piece.params, 'chance', 0);
    const amp = Number.isFinite(rawAmp) ? rawAmp : 0;
    if (!amp) return;
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      other.buffAmplificationChances = other.buffAmplificationChances || {};
      other.buffAmplificationChances.mana =
        (Number(other.buffAmplificationChances.mana) || 0) + amp;
    }
  },
  onCombatStart(piece, ctx) {
    const mana = Math.trunc(getPName(piece.params, 'mana', getP1(piece.params, 0)));
    grantStacks(ctx.player, 'mana', mana, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: 'player',
      amount: mana,
      label: `${piece.name}: +${mana} Mana`,
      meta: { category: 'buff', stack: 'mana', script: true, handler: 'magic_badge' },
    });
    pushActivate(piece, ctx, 'magic_badge', `Accessory: ${piece.name}`);
  },
};

/** scholar_bag */
/** @type {ScriptHandler} */
export const scholarBagPort = {
  handlerId: 'scholar_bag',
  family: 'start_buff',
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, pieces, player } = ctx;
    const catalog = itemsById.get(piece.itemId);
    const amp = Math.max(0, Number(piece.chance ?? catalog?.chance) || 0);
    const prot = Math.max(0, Number(piece.chance2 ?? catalog?.chance2) || 0);
    const byKey = new Map((pieces || []).map((other) => [other.placementKey, other]));
    for (const key of getItemsInside(graph, piece.placementKey)) {
      const other = byKey.get(key);
      if (!other) continue;
      const targetCatalog = itemsById.get(other.itemId);
      const target = targetCatalog
        ? { ...targetCatalog, ...other, params: other.params || targetCatalog.params }
        : other;
      if (!canBagAffectItem({ id: 'scholar_bag' }, target, canAffect || {})) continue;
      if (amp) {
        other.buffAmplificationChances = other.buffAmplificationChances || {};
        other.buffAmplificationChances.mana =
          (Number(other.buffAmplificationChances.mana) || 0) + amp;
      }
    }
    if (prot) changeBuffCleanseProtectChance(player, 'mana', prot);
  },
  onCombatStart(piece, ctx) {
    const { player } = ctx;
    const mana = Math.trunc(getPName(piece.params, 'mana', getP1(piece.params, 0)));
    grantStacks(player, 'mana', mana, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: 'player',
      amount: mana,
      label: `${piece.name}: +${mana} Mana`,
      meta: { category: 'buff', stack: 'mana', script: true, handler: 'scholar_bag' },
    });
    pushActivate(piece, ctx, 'scholar_bag', `Bag: ${piece.name}`, { force: true });
  },
};

/** burning_spikes — start spikes+heat; spikes from linked → heat threshold. */
/** @type {ScriptHandler} */
export const burningSpikesPort = {
  handlerId: 'burning_spikes',
  family: 'start_buff',
  onPrepare(piece, ctx) {
    const { player, graph, itemsById, canAffect } = ctx;
    const need = Math.max(1, Math.round(getPName(piece.params, 'spikest', 5)));
    const heatFor = Math.max(0, Math.round(getPName(piece.params, 'heat2', 1)));
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    /** @type {Set<string>} */
    const affected = new Set(links.map((l) => l.key));
    piece._spikeState = { gained: 0, used: 0 };
    onBuffChanged(player, (ch) => {
      if (ch.stack !== 'spikes' || !(ch.amount > 0)) return;
      if (!ch.originKey || !affected.has(ch.originKey)) return;
      const ticks = advanceBuffThresholds(piece._spikeState, ch.amount, need, need);
      if (ticks.gainTicks > 0 && heatFor > 0) {
        const give = ticks.gainTicks * heatFor;
        grantStacks(player, 'heat', give, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
          ctx.events.push({
            t: ctx.t,
            type: 'buff',
          actor: eventSideForPiece(piece),
          target: eventSideForPiece(piece),
            amount: give,
          label: `${piece.name}: +${give} Heat`,
          meta: { category: 'buff', stack: 'heat', script: true, handler: 'burning_spikes' },
        });
      }
    });
  },
  onCombatStart(piece, ctx) {
    const { player } = ctx;
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 3))));
    const heat = Math.max(0, Math.round(getPName(piece.params, 'heat', getP2(piece.params, 2))));
    grantStacks(player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (heat) {
      grantStacks(player, 'heat', heat, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      actor: eventSideForPiece(piece),
      target: eventSideForPiece(piece),
      amount: spikes,
      label: `${piece.name}: +${spikes} Spikes / +${heat} Heat`,
      meta: { category: 'buff', script: true, handler: 'burning_spikes' },
    });
    pushActivate(piece, ctx, 'burning_spikes', `Skill: ${piece.name}`);
  },
};

/** stone_helm */
/** @type {ScriptHandler} */
export const stoneHelmPort = {
  handlerId: 'stone_helm',
  family: 'start_buff',
  onPrepare(piece, ctx) {
    piece._helmBuffsActive = 0;
    const catalog = ctx.itemsById.get(piece.itemId);
    const crit = Number.isFinite(Number(catalog?.chance))
      ? Number(catalog.chance)
      : Number(piece.chance) || 0;
    const stun = Number.isFinite(Number(catalog?.chance2))
      ? Number(catalog.chance2)
      : Number(piece.chance2) || 0;
    ctx.player.critResistance = (Number(ctx.player.critResistance) || 0) + crit;
    ctx.player.stunResistance = (Number(ctx.player.stunResistance) || 0) + stun;
  },
  onPreCombatStart(piece, ctx) {
    leatherHelmPort.onPreCombatStart(piece, ctx);
  },
  onCombatStart(piece, ctx) {
    const block = Number(piece.blockGrant ?? ctx.itemsById.get(piece.itemId)?.block ?? 0);
    const gained = block > 0 ? gainStacks(ctx.player, 'block', block).gained : 0;
    if (gained > 0) ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: 'player',
      amount: gained,
      label: `${piece.name}: +${gained} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'stone_helm' },
    });
    pushActivate(piece, ctx, 'stone_helm', `Armor: ${piece.name}`);
  },
};

/** fire_pit — maxHP × fire inside */
/** @type {ScriptHandler} */
export const firePitPort = {
  handlerId: 'fire_pit',
  family: 'unique',
  onPreCombatStart(piece, ctx) {
    const { player, graph, itemsById, events, t } = ctx;
    const inside = getItemsInside(graph, piece.placementKey);
    let fire = 0;
    for (const key of inside) {
      const p = (ctx.pieces || []).find((x) => x.placementKey === key);
      const item = p ? itemsById.get(p.itemId) : null;
      if (p && itemHasType(item, 'fire')) fire += itemTypeMultiplicity(item, 'fire');
    }
    const per = modifiedParamValue(
      piece,
      getPName(piece.params, 'maxhealth', getP1(piece.params, 5)),
      'maxhealth',
    );
    const hp = per * fire;
    player.maxHp += hp;
    player.hp += hp;
    if (hp !== 0) {
      events.push({
        t,
        type: 'heal',
        actor: eventSideForPiece(piece),
        target: eventSideForPiece(piece),
        amount: hp,
        label: `${piece.name}: +${hp} max HP (${fire} fire)`,
        meta: {
          category: 'heal',
          kind: 'maxHp',
          script: true,
          handler: 'fire_pit',
          playerHp: player.hp,
          maxHp: player.maxHp,
          affected: fire,
        },
      });
    }
    pushActivate(piece, { ...ctx, t }, 'fire_pit', `${piece.name}`);
  },
};

/** hardwood — commons: block × n; common melee get damage factor. */
/** @type {ScriptHandler} */
export const hardwoodPort = {
  handlerId: 'hardwood',
  family: 'unique',
  onPrepare(piece, ctx) {
    const damF = getPName(piece.params, 'dam', getP(piece.params, 0, 10)) / 100;
    let n = 0;
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      const r = String(item?.rarity || item?.Rarity || '').toLowerCase();
      if (!(r === 'common' || r === '0')) continue;
      n += 1;
      const melee =
        canBeEmpoweredPiece(other) &&
        (itemHasType(item, 'melee') ||
        String(item?.type || '')
            .toLowerCase()
            .includes('melee'));
      if (melee && damF) addBonusDamageFactor(other, damF);
    }
    piece._hardwoodCommons = n;
  },
  onCombatStart(piece, ctx) {
    const n = Math.max(0, Math.round(Number(piece._hardwoodCommons) || 0));
    if (n > 0) {
      const catalogBlock = Number(ctx.itemsById.get(piece.itemId)?.block);
      const per = Number.isFinite(Number(piece.blockGrant))
        ? Number(piece.blockGrant)
        : Number.isFinite(catalogBlock)
          ? catalogBlock
          : 0;
      const block = per * n;
      if (block > 0) {
        grantStacks(ctx.player, 'block', block, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        ctx.events.push({
          t: ctx.t,
          type: 'buff',
          target: 'player',
          amount: block,
          label: `${piece.name}: +${block} Block`,
          meta: { category: 'buff', stack: 'block', script: true, handler: 'hardwood' },
        });
      }
    }
    pushActivate(piece, ctx, 'hardwood', `${piece.name}`);
  },
};

/** mage_hat — common block / rare mana / epic opponent effect-dmg cut. */
/** @type {ScriptHandler} */
export const mageHatPort = {
  handlerId: 'mage_hat',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const commons = linkedCount(
      ctx,
      piece,
      (_o, item) => String(item?.rarity || '').toLowerCase() === 'common',
      'primary',
    );
    const rares = linkedCount(
      ctx,
      piece,
      (_o, item) => String(item?.rarity || '').toLowerCase() === 'rare',
      'secondary',
    );
    const epics = linkedCount(
      ctx,
      piece,
      (_o, item) => String(item?.rarity || '').toLowerCase() === 'epic',
      'tertiary',
    );
    const catalogBlock = Number(ctx.itemsById?.get(piece.itemId)?.block);
    const rawBlock = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : Number.isFinite(catalogBlock)
        ? catalogBlock
        : getP1(piece.params, 0);
    const blockPer = Number.isFinite(rawBlock) ? rawBlock : 0;
    const manaPer = Math.trunc(getPName(piece.params, 'mana', getP1(piece.params, 0)));
    const damRed = getPName(piece.params, 'damreduction', getP2(piece.params, 0)) / 100;
    if (commons > 0) {
      grantStacks(ctx.player, 'block', blockPer * commons, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (rares > 0) {
      grantStacks(ctx.player, 'mana', manaPer * rares, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (epics > 0 && damRed) {
      applyEffectDmgFactor(ctx.dummy, -damRed * epics, ctx, piece);
    }
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: commons ${commons} / rares ${rares} / epics ${epics}`,
      meta: { category: 'system', script: true, handler: 'mage_hat' },
    });
    pushActivate(piece, ctx, 'mage_hat', `Helmet: ${piece.name}`);
  },
};

/** time_melting — prepare dur amp on duration items; start heat. */
/** @type {ScriptHandler} */
export const timeMeltingPort = {
  handlerId: 'time_melting',
  family: 'start_buff',
  onPrepare(piece, ctx) {
    const rawBonus = Number(getPName(piece.params, 'bonusdur', getP2(piece.params, 10)));
    const bonusDur = Number.isFinite(rawBonus) ? rawBonus / 100 : 0;
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (!other.params) continue;
      if (!Object.keys(other.params).some((key) => /^dur(?:_|$)/i.test(key)) || !bonusDur) {
        continue;
      }
      addEffectDurationFactor(other, bonusDur);
    }
  },
  onCombatStart(piece, ctx) {
    const rawHeat = Number(getPName(piece.params, 'heat', getP1(piece.params, 0)));
    const heat = Number.isFinite(rawHeat) ? Math.trunc(rawHeat) : 0;
    grantStacks(ctx.player, 'heat', heat, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushActivate(piece, ctx, 'time_melting', `Skill: ${piece.name}`);
  },
};

/** cap_of_brilliance — mana amp on linked mana-gainers; start mana (+ helm block). */
/** @type {ScriptHandler} */
export const capOfBrilliancePort = {
  handlerId: 'cap_of_brilliance',
  family: 'start_buff',
  // CapofBrilliance.gd extends LeatherHelm and calls its onPrepare before
  // applying the Mana-gain aura. Keep the inherited resistances in the same
  // preparation phase so linked items see the finished cap before combat.
  onPrepare(piece, ctx) {
    const chance =
      Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 15;
    ctx.player.critResistance = (Number(ctx.player.critResistance) || 0) + chance;
    ctx.player.stunResistance = (Number(ctx.player.stunResistance) || 0) + chance;
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const amp = Math.max(0, Number(piece.chance2) || getPName(piece.params, 'chance2', 15));
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      other.buffAmpChance = (Number(other.buffAmpChance) || 0) + amp;
    }
  },
  onCombatStart(piece, ctx) {
    const mana = Math.max(1, Math.round(getPName(piece.params, 'mana', getP1(piece.params, 4))));
    grantStacks(ctx.player, 'mana', mana, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const block = Math.max(0, Math.round(piece.blockGrant || 0));
    if (block) {
      grantStacks(ctx.player, 'block', block, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    // Source order is giveMana() then LeatherHelm.onCombatStart().
    leatherHelmPort.onCombatStart(piece, ctx);
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: 'player',
      amount: mana,
      label: `${piece.name}: +${mana} Mana`,
      meta: { category: 'buff', stack: 'mana', script: true, handler: 'cap_of_brilliance' },
    });
  },
};

/** dragon_nest — start multi-buff; dragon/egg attacks heal. */
/** @type {ScriptHandler} */
export const dragonNestPort = {
  handlerId: 'dragon_nest',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { player, events, t, graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    /** @type {Set<string>} */
    const dragonKeys = new Set();
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      const id = String(other.itemId || '');
      const tags = String(item?.tags || item?.extraTypes || '').toLowerCase();
      if (
        id.includes('dragon') ||
        id.includes('egg') ||
        tags.includes('dragon') ||
        itemHasType(item, 'dragon')
      ) {
        dragonKeys.add(other.placementKey);
      }
    }
    const healPer = Math.max(1, Math.round(getPName(piece.params, 'heal', getP1(piece.params, 4))));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      const atk = payload?.piece;
      if (!atk) return;
      if (!dragonKeys.has(atk.placementKey)) return;
      const healed = healActor(player, healPer);
      if (healed > 0) {
        events.push({
          t: payload?.t ?? ctx.t,
          type: 'heal',
          target: 'player',
          amount: healed,
          label: `${piece.name}: heal +${healed}`,
          meta: { category: 'heal', script: true, handler: 'dragon_nest' },
        });
      }
      events.push({
        t: payload?.t ?? ctx.t,
        type: 'info',
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'dragon_nest', miniActivate: true },
      });
    });
    const luck = Math.max(0, Math.round(getP2(piece.params, 1)));
    const regen = Math.max(0, Math.round(getP3(piece.params, 1)));
    const mana = Math.max(0, Math.round(getP4(piece.params, 1)));
    const heat = Math.max(0, Math.round(getP(piece.params, 4, 1)));
    if (luck) grantStacks(player, 'lucky', luck, { originKey: piece.placementKey, originId: piece.itemId });
    if (regen) grantStacks(player, 'regeneration', regen, { originKey: piece.placementKey, originId: piece.itemId });
    if (mana) grantStacks(player, 'mana', mana, { originKey: piece.placementKey, originId: piece.itemId });
    if (heat) grantStacks(player, 'heat', heat, { originKey: piece.placementKey, originId: piece.itemId });
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: luck + regen + mana + heat,
      label: `${piece.name}: start buffs`,
      meta: { category: 'buff', script: true, handler: 'dragon_nest' },
    });
  },
};

/** amulet_of_steel — start block; linked blockers' block → empower threshold. */
/** @type {ScriptHandler} */
export const amuletOfSteelPort = {
  handlerId: 'amulet_of_steel',
  family: 'start_buff',
  // AmuletofSteel.gd initializes its accumulator and connects affected
  // gave_block signals in onPrepare, before start-time block grants.
  onPrepare(piece, ctx) {
    const { player, graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    /** @type {Set<string>} */
    const blockers = new Set(links.map((l) => l.key));
    const need = Math.max(1, Math.round(getPName(piece.params, 'blockt', 10)));
    const empPer = Math.max(1, Math.round(getPName(piece.params, 'empower', 1)));
    piece._steelState = { gained: 0, used: 0 };
    onBuffChanged(player, (ch) => {
      if (ch.stack !== 'block' || !(ch.amount > 0)) return;
      if (!ch.originKey || !blockers.has(ch.originKey)) return;
      const ticks = advanceBuffThresholds(piece._steelState, ch.amount, need, need);
      if (ticks.gainTicks > 0) {
        const emp = ticks.gainTicks * empPer;
        grantStacks(player, 'empower', emp, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        ctx.events.push({
          t: ctx.t,
          type: 'buff',
          target: 'player',
          amount: emp,
          label: `${piece.name}: +${emp} Empower`,
          meta: { category: 'buff', stack: 'empower', script: true, handler: 'amulet_of_steel' },
        });
      }
    });
  },
  onCombatStart(piece, ctx) {
    const { player } = ctx;
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 8)));
    grantStacks(player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'amulet_of_steel' },
    });
  },
};

/** wisdom_puppy */
/** @type {ScriptHandler} */
export const wisdomPuppyPort = {
  handlerId: 'wisdom_puppy',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const speed = getP2(piece.params, 5) / 100;
    const n = linkedCount(ctx, piece, (_o, item) => itemHasType(item, 'pet'));
    if (n && speed) addSpeed(piece, n * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'wisdom_puppy', `Pet: ${piece.name}`);
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 4)));
    gainStacks(player, 'block', block);
    const cold = Math.max(0, Math.round(getP1(piece.params, 1)));
    if (cold) loseStacks(player, 'cold', cold);
    events.push({
      t: t + 0.003,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'wisdom_puppy' },
    });
    return true;
  },
};

/** armored_wisdom_puppy */
/** @type {ScriptHandler} */
export const armoredWisdomPuppyPort = {
  handlerId: 'armored_wisdom_puppy',
  family: 'pet_like',
  // ArmoredWisdomPuppy.gd calls its Wisdom Puppy parent from onPrepare().
  onPrepare(piece, ctx) {
    piece._bonusBlock = 0;
    const speed = getP2(piece.params, 5) / 100;
    const n = linkedCount(ctx, piece, (_o, item) => itemHasType(item, 'pet'));
    if (n && speed) addSpeed(piece, n * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'armored_wisdom_puppy', `Pet: ${piece.name}`);
    const base = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 4)));
    const bonus = Math.max(0, Math.round(piece._bonusBlock || 0));
    gainStacks(player, 'block', base + bonus);
    const cold = Math.max(0, Math.round(getPName(piece.params, 'cold', getP1(piece.params, 1))));
    if (cold) loseStacks(player, 'cold', cold);
    piece._bonusBlock = bonus + Math.max(1, Math.round(getP3(piece.params, 1)));
    events.push({
      t: t + 0.003,
      type: 'buff',
      target: 'player',
      amount: base + bonus,
      label: `${piece.name}: +${base + bonus} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'armored_wisdom_puppy' },
    });
    return true;
  },
};

/** spell_scroll_frostbolt */
/** @type {ScriptHandler} */
export const spellScrollFrostboltPort = {
  handlerId: 'spell_scroll_frostbolt',
  family: 'unique',
  onPrepare(piece, ctx) {
    const ice = linkedCount(ctx, piece, (_o, item) => itemHasType(item, 'ice'));
    piece._frostUses = 0;
    piece._frostMax = Math.trunc(getP1(piece.params, 3)) + ice;
  },
  onCooldownEffect(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    const max = Number(piece._frostMax);
    const uses = piece._frostUses || 0;
    if (!(uses < max)) return true;
    // SpellScrollFrostbolt.gd: `descriptor.minDam` through dealEffectDamage.
    const catalogDamage = Number(ctx.itemsById.get(piece.itemId)?.damageMin);
    const raw = Number.isFinite(catalogDamage) ? catalogDamage : Number(piece.damageMin) || 0;
    const damageRes = dealEffectDamage(piece, ctx, raw);
    const cold = Math.trunc(getPName(piece.params, 'cold', getP3(piece.params, 2)));
    const dur = modifiedParamValue(
      piece,
      getPName(piece.params, 'dur_cold', getP2(piece.params, 3)),
      'dur_cold',
    );
    grantTemporaryStacks(dummy, 'cold', cold, dur, t, {
      rng,
      opponent: player,
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    piece._frostUses = uses + 1;
    events.push({
      t: t + 0.008,
      type: 'debuff',
      target: 'dummy',
      amount: cold,
      label: `${piece.name}: +${cold} Cold (${dur}s)`,
      meta: {
        category: 'debuff',
        script: true,
        handler: 'spell_scroll_frostbolt',
        damageId: damageRes?.damageId ?? null,
      },
    });
    if (piece._frostUses === max) {
      afterEffectFinished(piece, ctx, 'spell_scroll_frostbolt', { label: `Scroll: ${piece.name}` });
    } else {
      pushActivate(piece, ctx, 'spell_scroll_frostbolt', `Scroll: ${piece.name}`);
    }
    return true;
  },
};

/** owl_spirit — prepare buff amp; mana convert (fatigue uses fatiguemana). */
/** @type {ScriptHandler} */
export const owlSpiritPort = {
  handlerId: 'owl_spirit',
  family: 'pet_like',
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const amp = Number.isFinite(Number(piece.chance))
      ? Number(piece.chance)
      : Number(getPName(piece.params, 'chance', 0)) || 0;
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      other.buffAmpChance = (Number(other.buffAmpChance) || 0) + amp;
    }
    piece._owlFatigue = false;
    ctx.bus?.on?.('fatigue_start', () => {
      piece._owlFatigue = true;
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const need = Math.trunc(getPName(piece.params, 'manat', getP1(piece.params, 0)));
    if (getStackAmount(player, 'mana') >= need) {
      useMana(player, need, { originKey: piece.placementKey, originId: piece.itemId });
      const give = Math.trunc(
        piece._owlFatigue
          ? getPName(piece.params, 'fatiguemana', getPName(piece.params, 'mana', getP2(piece.params, 0)))
          : getPName(piece.params, 'mana', getP2(piece.params, 0)),
      );
      if (give > 0) {
        grantStacks(player, 'mana', give, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        events.push({
          t: t + 0.003,
          type: 'buff',
          target: 'player',
          amount: give,
          label: `${piece.name}: +${give} Mana`,
          meta: { category: 'buff', stack: 'mana', script: true, handler: 'owl_spirit' },
        });
      }
    }
    pushActivate(piece, ctx, 'owl_spirit', `Pet: ${piece.name}`);
    return true;
  },
};

/** hedgehog — pet strike + spikes scaling; low-HP once → spikes+block. */
/** @type {ScriptHandler} */
export const hedgehogPort = {
  handlerId: 'hedgehog',
  family: 'pet_like',
  // Hedgehog.gd connects during onPrepare.
  onPrepare(piece, ctx) {
    piece._hedgeTriggered = false;
    const th = getPName(piece.params, 'healtht', getP3(piece.params, 50)) / 100 - 0.0001;
    const spikes = Math.trunc(getPName(piece.params, 'spikes', getP4(piece.params, 3)));
    const block = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : Number(ctx.itemsById?.get(piece.itemId)?.block) || 0;
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      if (piece._hedgeTriggered || payload?.hit === false || payload?.hit?.hit === false) return;
      const player = ctx.player;
      const rel = player.maxHp > 0 ? player.hp / player.maxHp : 1;
      if (rel >= th) return;
      piece._hedgeTriggered = true;
      if (spikes) {
        grantStacks(player, 'spikes', spikes, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        ctx.events.push({
          t: payload?.t ?? ctx.t,
          type: 'buff',
          actor: eventSideForPiece(piece),
          target: eventSideForPiece(piece),
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          amount: spikes,
          label: `${piece.name}: +${spikes} Spikes`,
          meta: { category: 'buff', stack: 'spikes', script: true, handler: 'hedgehog' },
        });
      }
      if (block) {
        grantStacks(player, 'block', block, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        ctx.events.push({
          t: payload?.t ?? ctx.t,
          type: 'buff',
          actor: eventSideForPiece(piece),
          target: eventSideForPiece(piece),
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          amount: block,
          label: `${piece.name}: +${block} Block`,
          meta: { category: 'buff', stack: 'block', script: true, handler: 'hedgehog' },
        });
      }
      ctx.events.push({
        t: payload?.t ?? ctx.t,
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        type: 'info',
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'hedgehog', miniActivate: true },
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    const { player } = ctx;
    const perValue = getPName(piece.params, 'dam_spikes', getP2(piece.params, 0.5));
    const per = Number.isFinite(Number(perValue)) ? Number(perValue) : 0;
    const spikes = Number(player.stacks.spikes) || 0;
    const base = Number.isFinite(Number(piece.damageMin)) ? Number(piece.damageMin) : 0;
    const raw = Math.max(0, Math.round(base + spikes * per));
    dealEffectDamage(piece, ctx, raw);
    // Hedgehog.gd activates only after dealEffectDamage returns its result.
    pushActivate(piece, ctx, 'hedgehog', `Pet: ${piece.name}`);
    return true;
  },
};

/** bomb — spend all buffs; DR shred by dam×removed; fixed minDam hit. */
/** @type {ScriptHandler} */
export const bombPort = {
  handlerId: 'bomb',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events } = ctx;
    if (tryUseStamina(player, piece.staminaCost || 1) === 'starve') return false;
    pushActivate(piece, ctx, 'bomb', `Accessory: ${piece.name}`);
    let removed = 0;
    for (const k of BUFF_KEYS) {
      const n = getStackAmount(player, /** @type {any} */ (k));
      if (n > 0) {
        spendStacks(player, k, n, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        removed += n;
      }
    }
    const damFactor = getPName(piece.params, 'dam', 2) / 100;
    if (removed > 0 && damFactor) {
      dummy.damageResistancePct =
        (Number(dummy.damageResistancePct) || 0) - damFactor * removed * 100;
    }
    const raw = Math.max(1, Math.round(piece.damageMin || 5));
    dealEffectDamage(piece, ctx, raw);
    piece.alive = false;
    piece.charges = 0;
    events.push({
      t: t + 0.002,
      type: 'info',
      label: `${piece.name}: spent ${removed} buffs`,
      meta: { category: 'system', script: true, handler: 'bomb' },
    });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_B_PORTS = {
  magic_badge: magicBadgePort,
  scholar_bag: scholarBagPort,
  burning_spikes: burningSpikesPort,
  stone_helm: stoneHelmPort,
  fire_pit: firePitPort,
  hardwood: hardwoodPort,
  mage_hat: mageHatPort,
  time_melting: timeMeltingPort,
  cap_of_brilliance: capOfBrilliancePort,
  dragon_nest: dragonNestPort,
  amulet_of_steel: amuletOfSteelPort,
  wisdom_puppy: wisdomPuppyPort,
  armored_wisdom_puppy: armoredWisdomPuppyPort,
  spell_scroll_frostbolt: spellScrollFrostboltPort,
  owl_spirit: owlSpiritPort,
  hedgehog: hedgehogPort,
  bomb: bombPort,
};
