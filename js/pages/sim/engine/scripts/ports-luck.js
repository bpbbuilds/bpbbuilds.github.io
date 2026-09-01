/**
 * Band Y Phase 135 — luck spenders / Lucky food.
 */

import {
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
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { rollPercent } from '../rng.js';
import { gainStacks, loseStacks } from '../stacks.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { recordPieceMod, withStatSource } from '../stat-mods.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

const WAND_BUFFS = ['mana', 'lucky', 'regeneration'];

/** @type {ScriptHandler} */
export const carrotPort = {
  handlerId: 'carrot',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'carrot', `Food: ${piece.name}`);
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
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    // Fedora.gd onPrepare: secondary canModifyChance → addBonusChance
    const bonusChance = Math.max(
      0,
      Number(getPName(piece.params, 'chance', getPName(piece.params, 'p5', 10))) || 0,
    );
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let chanceBuffed = 0;
    if (bonusChance > 0) {
      withStatSource(piece, () => {
        for (const other of pieces || []) {
          if (other.placementKey === piece.placementKey) continue;
          const link = links.find((l) => l.key === other.placementKey);
          if (!link) continue;
          if (link.color !== 'secondary' && link.color !== 'adjacent') continue;
          const item = itemsById.get(other.itemId);
          const baseChance = Number(item?.chance) || Number(other.chance) || 0;
          if (!(baseChance > 0)) continue;
          other.bonusChanceMult = (Number(other.bonusChanceMult) || 0) + bonusChance;
          recordPieceMod(other, {
            stat: 'chance',
            amount: bonusChance / 100,
            unit: 'factor',
          });
          chanceBuffed += 1;
        }
      });
    }
    const luckPerNature = Math.max(
      0,
      Math.round(getPName(piece.params, 'luck', getP1(piece.params, 1))),
    );
    const luckPerTreasure = Math.max(
      0,
      Math.round(getPName(piece.params, 'luck2', getP2(piece.params, 1))),
    );
    let nature = 0;
    let treasure = 0;
    for (const other of pieces || []) {
      const link = links.find((l) => l.key === other.placementKey);
      if (!link || link.color === 'secondary') continue;
      const item = itemsById.get(other.itemId);
      if (itemHasType(item, 'nature')) nature += 1;
      if (itemHasType(item, 'treasure') || item?.isTreasure === true) treasure += 1;
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
    if (chanceBuffed > 0) {
      events.push({
        t: t + 0.01,
        type: 'info',
        label: `${piece.name}: +${bonusChance}% chance ×${chanceBuffed}`,
        meta: { category: 'adjacency', script: true, handler: 'fedora' },
      });
    }
    pushActivate(piece, ctx, 'fedora', `Accessory: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    pushActivate(piece, ctx, 'fedora', `Accessory: ${piece.name}`);
    const need = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP3(piece.params, 3))));
    const num = Math.max(1, Math.round(getPName(piece.params, 'buffs', 1)));
    if ((Number(player.stacks.lucky) || 0) >= need) {
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
        const stolen = stealRandomBuff(dummy, player, num, rng, {
          availableBuffs: [
            'regeneration',
            'vampirism',
            'spikes',
            'mana',
            'empower',
            'heat',
          ],
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        pushBuffGrants(events, piece, player, t, 'fedora', stolen, 0.004);
      }
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const sealTheDealPort = {
  handlerId: 'seal_the_deal',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'seal_the_deal', `Accessory: ${piece.name}`);
    const regenNeed = Math.max(
      1,
      Math.round(getPName(piece.params, 'regent', getP1(piece.params, 3))),
    );
    const vamp = Math.max(1, Math.round(getPName(piece.params, 'vamp', 1)));
    const luckNeed = Math.max(
      1,
      Math.round(getPName(piece.params, 'luckt', getP2(piece.params, 3))),
    );
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', 1)));
    const manaNeed = Math.max(
      1,
      Math.round(getPName(piece.params, 'manat', getP3(piece.params, 3))),
    );
    const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', 1)));
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
    pushActivate(piece, ctx, 'prismatic_wand', `Accessory: ${piece.name}`);
    const all = giveAllBuffs(player, 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'prismatic_wand', all);
    const manaNeed = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 10))));
    const luckNeed = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP2(piece.params, 10))));
    const regenNeed = Math.max(
      1,
      Math.round(getPName(piece.params, 'regent', getP3(piece.params, 10))),
    );
    const useN = Math.max(1, Math.round(getPName(piece.params, 'use', 1)));
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
        const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', 1)));
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
