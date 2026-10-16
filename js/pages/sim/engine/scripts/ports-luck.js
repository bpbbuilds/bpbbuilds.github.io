/**
 * Band Y Phase 135 — luck spenders / Lucky food.
 */

import {
  BUFF_KEYS,
  cleanseRandomDebuffs,
  giveAllBuffs,
  grantStacks,
  removeLucky,
  removeMostBuffs,
  stealRandomBuff,
  stealStack,
  useLucky,
  useMana,
  useRegeneration,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP, getP1, getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { rollPercent } from '../rng.js';
import { gainStacks, getStackAmount, loseStacks } from '../stacks.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { recordPieceMod, withStatSource } from '../stat-mods.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function stealFedoraBuffs(piece, ctx, num) {
  const stolen = stealRandomBuff(ctx.dummy, ctx.player, num, ctx.rng, {
    availableBuffs: BUFF_KEYS.filter((key) => key !== 'lucky'),
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'fedora', stolen, 0.004);
}

const WAND_BUFFS = ['mana', 'lucky', 'regeneration'];

/** @type {ScriptHandler} */
export const carrotPort = {
  handlerId: 'carrot',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    cleanseRandomDebuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const need = Math.max(1, Math.round(getP2(piece.params, 3)));
    const chance = Number(piece.chance) || 50;
    if ((Number(player.stacks.lucky) || 0) >= need && rollPercent(chance, rng)) {
      grantStacks(player, 'empower', 1, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: 1,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +1 Empower`,
        meta: { category: 'buff', stack: 'empower', script: true, handler: 'carrot' },
      });
    }
    // Carrot.gd activates after cleansing and the optional Empower grant.
    pushActivate(piece, ctx, 'carrot', `Food: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const crowPort = {
  handlerId: 'crow',
  family: 'unique',
  onCombatStart(piece) {
    piece._crowActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'crow', `Pet: ${piece.name}`);
    const maxActs = Math.max(1, Math.round(getPName(piece.params, 'max', getP2(piece.params, 5))));
    const speedBonus = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const acts = Number(piece._crowActs) || 0;
    if (acts < maxActs) {
      const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
      for (const other of pieces || []) {
        if (other.placementKey === piece.placementKey) continue;
        if (!links.some((l) => l.key === other.placementKey)) continue;
        if (!(other.cooldown > 0)) continue;
        addSpeed(other, speedBonus);
      }
      piece._crowActs = acts + 1;
    }
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP3(piece.params, 1))));
    const take = Math.min(luck, Number(dummy.stacks.lucky) || 0);
    if (take > 0) {
      stealStack(dummy, player, 'lucky', take, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: take,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: steal ${take} Lucky`,
        meta: { category: 'buff', stack: 'lucky', script: true, handler: 'crow' },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const fedoraPort = {
  handlerId: 'fedora',
  family: 'unique',
  onPrepare(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const bonusChance = getPName(piece.params, 'chance', getPName(piece.params, 'p7'));
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let chanceBuffed = 0;
    withStatSource(piece, () => {
      for (const other of pieces || []) {
        if (other.placementKey === piece.placementKey) continue;
        const link = links.find((l) => l.key === other.placementKey);
        if (!link || link.color !== 'secondary') continue;
        const item = itemsById.get(other.itemId);
        const baseChance = Number(item?.chance) || Number(other.chance) || 0;
        if (!(baseChance > 0)) continue;
        other.bonusChanceMult = (Number(other.bonusChanceMult) || 0) + bonusChance;
        recordPieceMod(other, { stat: 'chance', amount: bonusChance / 100, unit: 'factor' });
        chanceBuffed += 1;
      }
    });
    if (chanceBuffed > 0) {
      events.push({
        t: t + 0.01,
        type: 'info',
        label: `${piece.name}: +${bonusChance}% chance x${chanceBuffed}`,
        meta: { category: 'adjacency', script: true, handler: 'fedora' },
      });
    }
  },
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    // Fedora.gd onPrepare: secondary canModifyChance → addBonusChance
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const luckPerNature = Math.trunc(getPName(piece.params, 'luck', getP1(piece.params)));
    const luckPerTreasure = Math.trunc(getPName(piece.params, 'luck2', getP2(piece.params)));
    let nature = 0;
    let treasure = 0;
    for (const other of pieces || []) {
      const link = links.find((l) => l.key === other.placementKey);
      if (!link || link.color !== 'primary') continue;
      const item = itemsById.get(other.itemId);
      if (itemHasType(item, 'nature')) nature += 1;
      if (item?.isTreasure === true || String(item?.shop || '').toLowerCase() === 'unique') {
        treasure += 1;
      }
    }
    const total = nature * luckPerNature + treasure * luckPerTreasure;
    if (total > 0) {
      grantStacks(player, 'lucky', total, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t,
        type: 'buff',
        target: 'player',
        amount: total,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${total} Lucky`,
        meta: { category: 'buff', stack: 'lucky', script: true, handler: 'fedora' },
      });
    }
    pushActivate(piece, ctx, 'fedora', `Accessory: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const need = Math.trunc(getPName(piece.params, 'luckt', getP3(piece.params)));
    const num = Math.trunc(getPName(piece.params, 'buffs', getP6(piece.params)));
    if (getStackAmount(player, 'lucky') >= need) {
      const spent = useLucky(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (spent.spent > 0) {
        events.push({
          t: t + 0.002,
          type: 'buff',
          target: 'player',
          amount: -spent.spent,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: −${spent.spent} Lucky`,
          meta: { category: 'buff', stack: 'lucky', script: true, handler: 'fedora' },
        });
        stealFedoraBuffs(piece, { ...ctx, t }, num);
      }
      if (spent.spent <= 0) stealFedoraBuffs(piece, { ...ctx, t }, num);
    }
    // Fedora.gd steals first and activates last.
    pushActivate(piece, { ...ctx, t: t + 0.006 }, 'fedora', `Accessory: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const sealTheDealPort = {
  handlerId: 'seal_the_deal',
  family: 'unique',
  onCalcTradeChance(piece, ctx) {
    const catalog = ctx.itemsById?.get(piece.itemId);
    const sellBox = ctx.sellBox || ctx.sellbox || ctx.shop;
    if (!sellBox) return;
    const shopChance = Number(piece.shopChance ?? catalog?.shopChance) || 0;
    const tradeBonus = Math.trunc(getPName(piece.params, 'gold', getP(piece.params, 0, 0)));
    sellBox.tradeChance = (Number(sellBox.tradeChance) || 0) + shopChance / 100;
    sellBox.tradeBonusValue = (Number(sellBox.tradeBonusValue) || 0) + tradeBonus;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const regenNeed = Math.trunc(getPName(piece.params, 'regent', getP(piece.params, 1, 0)));
    const vamp = Math.trunc(getPName(piece.params, 'vamp', getP(piece.params, 2, 0)));
    const luckNeed = Math.trunc(getPName(piece.params, 'luckt', getP(piece.params, 3, 0)));
    const spikes = Math.trunc(getPName(piece.params, 'spikes', getP(piece.params, 4, 0)));
    const manaNeed = Math.trunc(getPName(piece.params, 'manat', getP(piece.params, 5, 0)));
    const emp = Math.trunc(getPName(piece.params, 'empower', getP(piece.params, 6, 0)));
    const opts = { originKey: piece.placementKey, originId: piece.itemId };
    let off = 0.002;
    if ((Number(player.stacks.regeneration) || 0) >= regenNeed) {
      if (useRegeneration(player, regenNeed, opts).spent > 0) {
        grantStacks(player, 'vampirism', vamp, opts);
        events.push({
          t: t + off,
          type: 'buff',
          target: 'player',
          amount: vamp,
          label: `${piece.name}: Regen→Vamp +${vamp}`,
          meta: { category: 'buff', stack: 'vampirism', script: true, handler: 'seal_the_deal' },
        });
        off += 0.002;
      }
    }
    if ((Number(player.stacks.lucky) || 0) >= luckNeed) {
      if (useLucky(player, luckNeed, opts).spent > 0) {
        grantStacks(player, 'spikes', spikes, opts);
        events.push({
          t: t + off,
          type: 'buff',
          target: 'player',
          amount: spikes,
          label: `${piece.name}: Lucky→Spikes +${spikes}`,
          meta: { category: 'buff', stack: 'spikes', script: true, handler: 'seal_the_deal' },
        });
        off += 0.002;
      }
    }
    if ((Number(player.stacks.mana) || 0) >= manaNeed) {
      if (useMana(player, manaNeed, opts).spent > 0) {
        grantStacks(player, 'empower', emp, opts);
        events.push({
          t: t + off,
          type: 'buff',
          target: 'player',
          amount: emp,
          label: `${piece.name}: Mana→Empower +${emp}`,
          meta: { category: 'buff', stack: 'empower', script: true, handler: 'seal_the_deal' },
        });
      }
    }
    pushActivate(piece, { ...ctx, t: t + off }, 'seal_the_deal', `Skill: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const jynxTorquillaPort = {
  handlerId: 'jynx_torquilla',
  family: 'unique',
  onCombatStart(piece) {
    piece._jynxActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    const { t, dummy, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'jynx_torquilla', `Pet: ${piece.name}`);
    const maxActs = Math.max(1, Math.round(getPName(piece.params, 'max', getP2(piece.params, 5))));
    const speedBonus = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const acts = Number(piece._jynxActs) || 0;
    if (acts < maxActs) {
      const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
      for (const other of pieces || []) {
        if (other.placementKey === piece.placementKey) continue;
        if (!links.some((l) => l.key === other.placementKey)) continue;
        if (!(other.cooldown > 0)) continue;
        addSpeed(other, speedBonus);
      }
      piece._jynxActs = acts + 1;
    }
    const rem = Math.max(1, Math.round(getP3(piece.params, 1)));
    if ((Number(dummy.stacks.lucky) || 0) > 0) {
      removeLucky(dummy, rem, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'dummy',
        amount: -rem,
        label: `${piece.name}: −${rem} Lucky (opponent)`,
        meta: { category: 'buff', stack: 'lucky', script: true, handler: 'jynx_torquilla' },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const prismaticWandPort = {
  handlerId: 'prismatic_wand',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const all = giveAllBuffs(player, 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'prismatic_wand', all);
    const manaNeed = Math.max(0, Math.trunc(getPName(piece.params, 'manat', getP1(piece.params, 10))));
    const luckNeed = Math.max(0, Math.trunc(getPName(piece.params, 'luckt', getP2(piece.params, 10))));
    const regenNeed = Math.max(0, Math.trunc(getPName(piece.params, 'regent', getP3(piece.params, 10))));
    const useN = Math.max(0, Math.trunc(getPName(piece.params, 'use', getP5(piece.params, 1))));
    const mana = Number(player.stacks.mana) || 0;
    const luck = Number(player.stacks.lucky) || 0;
    const regen = Number(player.stacks.regeneration) || 0;
    if (mana >= manaNeed || luck >= luckNeed || regen >= regenNeed) {
      const removed = removeMostBuffs(player, useN, rng, {
        availableBuffs: WAND_BUFFS,
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (removed) {
        const emp = Math.max(0, Math.trunc(getPName(piece.params, 'empower', getP4(piece.params, 1))));
        grantStacks(player, 'empower', emp, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        events.push({
          t: t + 0.02,
          type: 'buff',
          target: 'player',
          amount: emp,
          label: `${piece.name}: +${emp} Empower`,
          meta: { category: 'buff', stack: 'empower', script: true, handler: 'prismatic_wand' },
        });
      }
    }
    pushActivate(piece, ctx, 'prismatic_wand', `Accessory: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const garlicPort = {
  handlerId: 'garlic',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'garlic', `Food: ${piece.name}`);
    const block =
      Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 4))) +
      (Number(piece._extraBlock) || 0);
    gainStacks(player, 'block', block);
    events.push({
      t: t + 0.002,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'garlic' },
    });
    const chance = Number(piece.chance) || 50;
    if (rollPercent(chance, rng)) {
      const rem = Math.max(1, Math.round(getP1(piece.params, 1)));
      const spent = Math.min(rem, Number(player.stacks.vampirism) || 0);
      if (spent > 0) {
        loseStacks(player, 'vampirism', spent);
        events.push({
          t: t + 0.004,
          type: 'buff',
          target: 'player',
          amount: -spent,
          label: `${piece.name}: −${spent} Vampirism`,
          meta: { category: 'buff', stack: 'vampirism', script: true, handler: 'garlic' },
        });
      }
    }
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const LUCK_PORTS = {
  carrot: carrotPort,
  crow: crowPort,
  fedora: fedoraPort,
  seal_the_deal: sealTheDealPort,
  jynx_torquilla: jynxTorquillaPort,
  prismatic_wand: prismaticWandPort,
  garlic: garlicPort,
};
