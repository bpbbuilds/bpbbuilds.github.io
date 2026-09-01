/**
 * Band Y Phase 134 — buff converter ports (most / least / random).
 */

import {
  giveLeastBuffs,
  giveMostBuffs,
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  removeMostBuffs,
  useLucky,
  BUFF_KEYS,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { PLAYER_STAMINA_REGEN } from '../actor.js';
import { applyStaminaRegeneration } from '../actor-stats.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { afterEffectFinished } from './ports-util.js';
import { recordPieceMod, withStatSource } from '../stat-mods.js';

/**
 * @param {import('../sim-events.js').SimEvent[] | object[]} events
 * @param {object} piece
 * @param {import('../actor.js').SimActor} player
 * @param {number} t
 * @param {string} handler
 * @param {Record<string, number>} picked
 * @param {number} [baseOff]
 */
function pushBuffGrants(events, piece, player, t, handler, picked, baseOff = 0.002) {
  let off = baseOff;
  for (const [stack, amount] of Object.entries(picked || {})) {
    events.push({
      t: t + off,
      type: 'buff',
      target: 'player',
      amount,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${amount} ${stack}`,
      meta: {
        category: 'buff',
        stack,
        script: true,
        handler,
        [stack]: player.stacks[/** @type {any} */ (stack)],
      },
    });
    off += 0.002;
  }
}

/** @type {ScriptHandler} */
export const amuletOfFortunePort = {
  handlerId: 'amulet_of_fortune',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const chance = Math.max(
      0,
      Number(getPName(piece.params, 'chance', getP1(piece.params, 15))) || 0,
    );
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    withStatSource(piece, () => {
      for (const other of pieces || []) {
        if (other.placementKey === piece.placementKey) continue;
        if (!links.some((l) => l.key === other.placementKey)) continue;
        const item = itemsById.get(other.itemId);
        const baseChance = Number(item?.chance) || 0;
        if (!(baseChance > 0)) continue;
        other.bonusChanceMult = (Number(other.bonusChanceMult) || 0) + chance;
        // addBonusChance(+15) → ×1.15; tip “Changed by” as +15% factor
        recordPieceMod(other, { stat: 'chance', amount: chance / 100, unit: 'factor' });
        events.push({
          t: t + 0.01,
          type: 'info',
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${chance}% chance → ${other.name}`,
          meta: {
            category: 'adjacency',
            script: true,
            handler: 'amulet_of_fortune',
            targetKey: other.placementKey,
          },
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    // AmuletofFortune.gd: giveMostBuffs then onAfterEffectFinished() →
    // deactivateCooldown + consume() → one Activations tick, no further CDs.
    const num = Math.max(
      1,
      Math.round(getPName(piece.params, 'buffs', getP2(piece.params, 2))),
    );
    const picked = giveMostBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'amulet_of_fortune', picked);
    afterEffectFinished(piece, ctx, 'amulet_of_fortune', {
      label: `Accessory: ${piece.name}`,
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const wolpertingerPort = {
  handlerId: 'wolpertinger',
  family: 'pet_like',
  onPreCombatStart(piece, ctx) {
    const { player } = ctx;
    const perBuff = (getP1(piece.params, 0.7) / 100) * PLAYER_STAMINA_REGEN;
    if (!(perBuff > 0)) return;
    const origin = {
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      name: piece.name,
    };
    onBuffChanged(player, (ch) => {
      // Game: no amount>0 guard — spends also reduce stamina regen.
      if (!ch.amount || !BUFF_KEYS.includes(String(ch.stack))) return;
      applyStaminaRegeneration(player, ch.amount * perBuff, ctx, origin);
    });
  },
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const petKeys = links.filter((l) => {
      const other = (pieces || []).find((p) => p.placementKey === l.key);
      return other && (other.kind === 'pet' || String(itemsById.get(other.itemId)?.type || '')
        .toLowerCase()
        .includes('pet'));
    });
    const speedPct = getP3(piece.params, 15) / 100;
    if (petKeys.length && speedPct) {
      addSpeed(piece, petKeys.length * speedPct);
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${Math.round(petKeys.length * speedPct * 100)}% speed (${petKeys.length} pets)`,
        meta: { category: 'adjacency', script: true, handler: 'wolpertinger' },
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const num = Math.max(1, Math.round(getP2(piece.params, 3)));
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Pet: ${piece.name}`,
      meta: { category: 'pet', script: true, handler: 'wolpertinger' },
    });
    const picked = giveLeastBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'wolpertinger', picked);
    return true;
  },
};

const WAND_BUFFS = ['mana', 'lucky', 'regeneration'];

/** @type {ScriptHandler} */
export const wandPort = {
  handlerId: 'wand',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Accessory: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'wand' },
    });
    const granted = giveLeastBuffs(player, 1, rng, {
      availableBuffs: WAND_BUFFS,
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'wand', granted);

    const manaNeed = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 10))));
    const luckNeed = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP2(piece.params, 10))));
    const regenNeed = Math.max(
      1,
      Math.round(getPName(piece.params, 'regent', getP3(piece.params, 10))),
    );
    const mana = Number(player.stacks.mana) || 0;
    const luck = Number(player.stacks.lucky) || 0;
    const regen = Number(player.stacks.regeneration) || 0;
    if (mana >= manaNeed || luck >= luckNeed || regen >= regenNeed) {
      const useN = Math.max(1, Math.round(getPName(piece.params, 'use', 1)));
      const removed = removeMostBuffs(player, useN, rng, {
        availableBuffs: WAND_BUFFS,
        use: true,
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (removed) {
        events.push({
          t: t + 0.01,
          type: 'buff',
          target: 'player',
          amount: -removed.spent,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: −${removed.spent} ${removed.stack}`,
          meta: {
            category: 'buff',
            stack: removed.stack,
            script: true,
            handler: 'wand',
          },
        });
        const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', 1)));
        grantStacks(player, 'empower', emp, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        events.push({
          t: t + 0.012,
          type: 'buff',
          target: 'player',
          amount: emp,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${emp} Empower`,
          meta: {
            category: 'buff',
            stack: 'empower',
            script: true,
            handler: 'wand',
            empower: player.stacks.empower,
          },
        });
      }
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const littleMimicPort = {
  handlerId: 'little_mimic',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let gold = 0;
    for (const link of links) {
      const other = (pieces || []).find((p) => p.placementKey === link.key);
      if (!other) continue;
      const item = itemsById.get(other.itemId);
      gold += Math.max(0, Number(item?.cost) || 0);
    }
    const speedPer = getPName(piece.params, 'speed', getP2(piece.params, 1)) / 100;
    const bonus = gold * speedPer;
    if (bonus > 0) {
      addSpeed(piece, bonus);
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${Math.round(bonus * 100)}% speed (${gold}g)`,
        meta: { category: 'adjacency', script: true, handler: 'little_mimic', gold },
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const num = Math.max(
      1,
      Math.round(getPName(piece.params, 'buffs', getP1(piece.params, 3))),
    );
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Pet: ${piece.name}`,
      meta: { category: 'pet', script: true, handler: 'little_mimic' },
    });
    const picked = giveMostBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'little_mimic', picked);
    return true;
  },
};

/**
 * @param {object} piece
 * @param {import('../actor.js').SimActor} player
 * @param {object[]} events
 * @param {number} t
 * @param {string} handler
 */
function grantMaxHealth(piece, player, events, t, handler) {
  const gain = Math.max(
    1,
    Math.round(getPName(piece.params, 'maxhealth', getP1(piece.params, 10))),
  );
  player.maxHp += gain;
  player.hp = Math.min(player.maxHp, player.hp + gain);
  events.push({
    t: t + 0.001,
    type: 'heal',
    target: 'player',
    amount: gain,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name}: +${gain} max HP`,
    meta: {
      category: 'heal',
      script: true,
      handler,
      playerHp: player.hp,
      maxHp: player.maxHp,
    },
  });
}

/** @type {ScriptHandler} */
export const cheesePort = {
  handlerId: 'cheese',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Food: ${piece.name}`,
      meta: { category: 'consumable', script: true, handler: 'cheese' },
    });
    grantMaxHealth(piece, player, events, t, 'cheese');
    const num = Math.max(1, Math.round(getP2(piece.params, 1)));
    const picked = giveRandomBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'cheese', picked, 0.004);
    return true;
  },
};

/** @type {ScriptHandler} */
export const cheeseGoobertPort = {
  handlerId: 'cheese_goobert',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Pet: ${piece.name}`,
      meta: { category: 'pet', script: true, handler: 'cheese_goobert' },
    });
    grantMaxHealth(piece, player, events, t, 'cheese_goobert');
    const num = Math.max(1, Math.round(getP3(piece.params, 2)));
    const picked = giveRandomBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'cheese_goobert', picked, 0.004);
    return true;
  },
};

/** @type {ScriptHandler} */
export const presentPort = {
  handlerId: 'present',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const num = Math.max(1, Math.round(getP1(piece.params, 5)));
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Accessory: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'present' },
    });
    const picked = giveRandomBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'present', picked);
  },
};

/** @type {ScriptHandler} */
export const doubleRainbowPort = {
  handlerId: 'double_rainbow',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const speedPer = getPName(piece.params, 'speed', getP1(piece.params, 35)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let holy = 0;
    for (const link of links) {
      const other = (pieces || []).find((p) => p.placementKey === link.key);
      if (!other) continue;
      const item = itemsById.get(other.itemId);
      const tags = `${item?.type || ''} ${item?.extraTypes || ''} ${item?.tags || ''}`.toLowerCase();
      if (tags.includes('holy')) holy += 1;
    }
    if (holy > 0 && speedPer > 0) {
      addSpeed(piece, holy * speedPer);
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${Math.round(holy * speedPer * 100)}% speed (${holy} holy)`,
        meta: { category: 'adjacency', script: true, handler: 'double_rainbow' },
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Skill: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'double_rainbow' },
    });
    const picked = giveRandomBuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'double_rainbow', picked);
    return true;
  },
};

/** @type {ScriptHandler} */
export const shamanMaskPort = {
  handlerId: 'shaman_mask',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, pieces } = ctx;
    let gems = 0;
    for (const p of pieces || []) {
      gems += Array.isArray(p.gemNames) ? p.gemNames.length : 0;
    }
    if (gems > 0) {
      grantStacks(player, 'lucky', gems, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.002,
        type: 'buff',
        target: 'player',
        amount: gems,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${gems} Lucky (gems)`,
        meta: {
          category: 'buff',
          stack: 'lucky',
          script: true,
          handler: 'shaman_mask',
          lucky: player.stacks.lucky,
        },
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const need = Math.max(1, Math.round(getP2(piece.params, 2)));
    const num = Math.max(1, Math.round(getP3(piece.params, 5)));
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Accessory: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'shaman_mask' },
    });
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
          meta: { category: 'buff', stack: 'lucky', script: true, handler: 'shaman_mask' },
        });
        const picked = giveRandomBuffs(player, num, rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        pushBuffGrants(events, piece, player, t, 'shaman_mask', picked, 0.004);
      }
    }
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const BUFF_PORTS = {
  amulet_of_fortune: amuletOfFortunePort,
  wolpertinger: wolpertingerPort,
  wand: wandPort,
  little_mimic: littleMimicPort,
  cheese: cheesePort,
  cheese_goobert: cheeseGoobertPort,
  present: presentPort,
  double_rainbow: doubleRainbowPort,
  shaman_mask: shamanMaskPort,
};
