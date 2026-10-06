/**
 * Band Y Phase 144 — simple outlier ports (buffs / block / debuffs / gems).
 */

import {
  BUFF_KEYS,
  cleanseRandomDebuffs,
  giveAllBuffs,
  giveRandomBuffs,
  grantStacks,
  inflictRandomDebuffs,
  spendStacks,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { itemHasType, afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const amethystEggPort = {
  handlerId: 'amethyst_egg',
  family: 'unique',
  onCombatStart(piece, ctx) {
    amethystEggPort.onCooldownEffect?.(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'amethyst_egg', `Pet: ${piece.name}`);
    const n = Math.max(1, Math.round(getP1(piece.params, 1)));
    inflictRandomDebuffs(dummy, n, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      opponent: player,
    });
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: ${n} random debuff(s)`,
      meta: { category: 'system', script: true, handler: 'amethyst_egg' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const amuletOfAlchemyPort = {
  handlerId: 'amulet_of_alchemy',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const num = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP1(piece.params, 2))));
    const picked = giveRandomBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'amulet_of_alchemy', picked);
    pushActivate(piece, ctx, 'amulet_of_alchemy', `Accessory: ${piece.name}`);
  },
};

/** @type {ScriptHandler} */
export const portableAltarPort = {
  handlerId: 'portable_altar',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', getP1(piece.params, 1))));
    grantStacks(player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: emp,
      label: `${piece.name}: +${emp} Empower`,
      meta: { category: 'buff', stack: 'empower', script: true, handler: 'portable_altar' },
    });
  },
};

/** @type {ScriptHandler} */
export const hawkRunePort = {
  handlerId: 'hawk_rune',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'hawk_rune', `Rune: ${piece.name}`);
    gainStacks(dummy, 'blind', 1, { rng, opponent: player });
    events.push({
      t: t + 0.004,
      type: 'debuff',
      target: 'dummy',
      amount: 1,
      label: `${piece.name}: +1 Blind`,
      meta: { category: 'debuff', stack: 'blind', script: true, handler: 'hawk_rune' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const skullBadgePort = {
  handlerId: 'skull_badge',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { dummy, player, rng } = ctx;
    pushActivate(piece, ctx, 'skull_badge', `Badge: ${piece.name}`);
    inflictRandomDebuffs(dummy, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      opponent: player,
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const stoneBadgePort = {
  handlerId: 'stone_badge',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'stone_badge', `Badge: ${piece.name}`);
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 6)));
    gainStacks(player, 'block', block);
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'stone_badge' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const rainbowBadgePort = {
  handlerId: 'rainbow_badge',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'rainbow_badge', `Badge: ${piece.name}`);
    const picked = giveAllBuffs(player, 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'rainbow_badge', picked);
    afterEffectFinished(piece, ctx, 'rainbow_badge', { activate: false });
    return true;
  },
};

/** @type {ScriptHandler} */
export const recombobulatorPort = {
  handlerId: 'recombobulator',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'recombobulator', `Accessory: ${piece.name}`);
    const picked = giveRandomBuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'recombobulator', picked);
    cleanseRandomDebuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const goldArmorPort = {
  handlerId: 'gold_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    // GoldArmor.gd onPrepare: reduceSpeed(speed/100) on all weapons (shop gold omitted)
    const speedMalus = Math.abs(getPName(piece.params, 'speed', 10)) / 100;
    if (speedMalus) {
      for (const other of pieces || []) {
        if (other.placementKey === piece.placementKey) continue;
        const item = itemsById.get(other.itemId);
        const isWeapon =
          other.kind === 'weapon' ||
          itemHasType(item, 'weapon') ||
          other.damageMax > 0 ||
          other.damageMin > 0;
        if (!isWeapon) continue;
        addSpeed(other, -speedMalus);
      }
    }
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const regenPer = Math.max(1, Math.round(getPName(piece.params, 'regen', getP1(piece.params, 1))));
    const regen = links.length * regenPer;
    if (regen > 0) {
      grantStacks(player, 'regeneration', regen, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    const block = Math.max(1, Math.round(piece.blockGrant || getP2(piece.params, 10)));
    gainStacks(player, 'block', block);
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${regen} Regen +${block} Block`,
      meta: { category: 'buff', script: true, handler: 'gold_armor' },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'gold_armor', `Armor: ${piece.name}`);
    const cleanse = Math.max(1, Math.round(getPName(piece.params, 'cleanse', getP3(piece.params, 1))));
    cleanseRandomDebuffs(player, cleanse, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const debuffs =
      (Number(player.stacks.poison) || 0) +
      (Number(player.stacks.blind) || 0) +
      (Number(player.stacks.cold) || 0);
    if (debuffs <= 0) {
      const block = Math.max(1, Math.round(getPName(piece.params, 'block', 4)));
      gainStacks(player, 'block', block);
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: block,
        label: `${piece.name}: +${block} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'gold_armor' },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const fullBodyProtectionPort = {
  handlerId: 'full_body_protection',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'full_body_protection', `Armor: ${piece.name}`);
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 8)));
    gainStacks(player, 'block', block);
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'full_body_protection' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const mrsStrugglesPort = {
  handlerId: 'mrs_struggles',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speed = getP1(piece.params, 5) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, dummy, events } = ctx;
    pushActivate(piece, ctx, 'mrs_struggles', `Pet: ${piece.name}`);
    for (const k of BUFF_KEYS) {
      if (getStackAmount(dummy, /** @type {any} */ (k)) > 0) {
        spendStacks(dummy, k, 1, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: strip opponent buffs`,
      meta: { category: 'system', script: true, handler: 'mrs_struggles' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const mercuryElementalPort = {
  handlerId: 'mercury_elemental',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    piece._mercStam =
      Math.max(1, Math.round(getPName(piece.params, 'stamina', getP1(piece.params, 1)))) *
      Math.max(1, links.length);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'mercury_elemental', `Pet: ${piece.name}`);
    const stam = Number(piece._mercStam) || Math.max(1, Math.round(getP1(piece.params, 2)));
    player.stamina = Math.min(player.maxStamina || 20, (player.stamina || 0) + stam);
    events.push({
      t: t + 0.004,
      type: 'stamina',
      amount: stam,
      label: `${piece.name}: +${stam} stamina`,
      meta: { category: 'stamina', script: true, handler: 'mercury_elemental' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const vampiricGlovesPort = {
  handlerId: 'vampiric_gloves',
  family: 'unique',
  onPrepare(piece) {
    piece._vampiricGlovesActive = false;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'vampiric_gloves', `Accessory: ${piece.name}`);
    piece._vampiricGlovesActive = true;
    const vamp = Math.max(1, Math.round(getP1(piece.params, 1)));
    grantStacks(player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const speed = getP2(piece.params, 10) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (speed) addSpeed(other, speed);
    }
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: vamp,
      label: `${piece.name}: +${vamp} Vampirism`,
      meta: { category: 'buff', stack: 'vampirism', script: true, handler: 'vampiric_gloves' },
    });
    afterEffectFinished(piece, ctx, 'vampiric_gloves', { activate: false });
    return true;
  },
};

/** @type {ScriptHandler} */
export const thornElementalPort = {
  handlerId: 'thorn_elemental',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'thorn_elemental', `Pet: ${piece.name}`);
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 2))));
    grantStacks(player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: spikes,
      label: `${piece.name}: +${spikes} Spikes`,
      meta: { category: 'buff', stack: 'spikes', script: true, handler: 'thorn_elemental' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const thornburstPort = {
  handlerId: 'thornburst',
  family: 'unique',
  onCombatStart(piece) {
    piece._thornUses = Math.max(1, Math.round(getPName(piece.params, 'uses', getP2(piece.params, 3))));
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'thornburst', `Skill: ${piece.name}`);
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 2))));
    grantStacks(player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: spikes,
      label: `${piece.name}: +${spikes} Spikes`,
      meta: { category: 'buff', stack: 'spikes', script: true, handler: 'thornburst' },
    });
    piece._thornUses = (Number(piece._thornUses) || 1) - 1;
    if (piece._thornUses <= 0) {
      piece.alive = false;
      piece.charges = 0;
    }
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const OUTLIER_PORTS = {
  amethyst_egg: amethystEggPort,
  amulet_of_alchemy: amuletOfAlchemyPort,
  portable_altar: portableAltarPort,
  hawk_rune: hawkRunePort,
  skull_badge: skullBadgePort,
  stone_badge: stoneBadgePort,
  rainbow_badge: rainbowBadgePort,
  recombobulator: recombobulatorPort,
  gold_armor: goldArmorPort,
  full_body_protection: fullBodyProtectionPort,
  mrs_struggles: mrsStrugglesPort,
  mercury_elemental: mercuryElementalPort,
  vampiric_gloves: vampiricGlovesPort,
  thorn_elemental: thornElementalPort,
  thornburst: thornburstPort,
};
