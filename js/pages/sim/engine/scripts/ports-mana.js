/**
 * Band Y Phase 136 — mana engines.
 */

import { tryUseStamina } from '../actor.js';
import {
  cleanseRandomDebuffs,
  giveAllBuffs,
  grantStacks,
  inflictRandomDebuffs,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { applyHealEfficiency } from '../actor-stats.js';
import { eventSideForPiece } from '../vs-board.js';
import { emitPathCharge } from '../charge-delivery.js';
import { getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { randInt } from '../rng.js';
import { gainStacks } from '../stacks.js';
import { dealHit } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { getScriptHandler } from './registry.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function emitManaCrystalCharge(piece, ctx, speedFactor = 1) {
  const mana1 = Math.max(1, Math.round(getPName(piece.params, 'mana1', getP1(piece.params, 1))));
  const mana2 = Math.max(1, Math.round(getPName(piece.params, 'mana2', getP2(piece.params, 2))));
  const durPerTile = getPName(piece.params, 'dur', 2) || 2;
  let lastKey = null;
  emitPathCharge(piece, ctx, {
    speedFactor,
    durPerTile,
    label: `${piece.name}: charge`,
    onCellEnter(target, step) {
      const targetKey = target?.placementKey || null;
      if (targetKey === lastKey) return;
      lastKey = targetKey;
      if (!target) return;
      const targetItem = ctx.itemsById.get(target.itemId);
      const amount = itemHasType(targetItem, 'magic') ? mana2 : mana1;
      grantStacks(ctx.player, 'mana', amount, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      ctx.events.push({
        t: ctx.t + (step.enterT || 0),
        type: 'buff',
        target: 'player',
        amount,
        label: `${piece.name}: +${amount} Mana (${target.name})`,
        meta: {
          category: 'buff',
          stack: 'mana',
          script: true,
          handler: 'mana_crystal',
        },
      });
    },
  });
}

/** @type {ScriptHandler} */
export const manaCrystalPort = {
  handlerId: 'mana_crystal',
  family: 'unique',
  emitCharge(piece, ctx, speedFactor = 1) {
    pushActivate(piece, ctx, 'mana_crystal', `Accessory: ${piece.name}`);
    emitManaCrystalCharge(piece, ctx, speedFactor);
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'mana_crystal', `Accessory: ${piece.name}`);
    emitManaCrystalCharge(piece, ctx);
    ctx.bus?.emit?.('charge_emitted', { piece, t: ctx.t });
    return true;
  },
};

/** @type {ScriptHandler} */
export const eggscaliburPort = {
  handlerId: 'eggscalibur',
  family: 'custom_cd',
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
    pushActivate(piece, ctx, 'eggscalibur', `Weapon: ${piece.name}`);
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    dealHit(piece, ctx, raw);
    return true;
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const { player, rng, graph, itemsById, canAffect, pieces } = ctx;
    const need = Math.round(getP2(piece.params, 1));
    if (
      useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return;
    }
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const foods = (pieces || []).filter((p) => {
      if (!links.some((l) => l.key === p.placementKey)) return false;
      return itemHasType(itemsById.get(p.itemId), 'food');
    });
    for (let i = foods.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = foods[i];
      foods[i] = foods[j];
      foods[j] = tmp;
    }
    for (const food of foods) {
      const h = getScriptHandler(food.itemId);
      if (h?.onCooldownEffect) h.onCooldownEffect(food, ctx);
    }
  },
};

/** @type {ScriptHandler} */
export const badgerSpiritPort = {
  handlerId: 'badger_spirit',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    piece._badgerArmed = true;
    pushActivate(piece, ctx, 'badger_spirit', `Pet: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect } = ctx;
    pushActivate(piece, ctx, 'badger_spirit', `Pet: ${piece.name}`);
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 5))));
    if ((Number(player.stacks.mana) || 0) >= need) {
      if (useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent > 0) {
        const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
        const base = Math.max(1, Math.round(getPName(piece.params, 'maxhealth', getP2(piece.params, 5))));
        const bonus = Math.max(
          0,
          Math.round(getPName(piece.params, 'maxhealth_bonus', getP3(piece.params, 2))),
        );
        const hp = base + links.length * bonus;
        player.maxHp += hp;
        player.hp = Math.min(player.maxHp, player.hp + hp);
        events.push({
          t: t + 0.004,
          type: 'heal',
          target: 'player',
          amount: hp,
          label: `${piece.name}: +${hp} max HP`,
          meta: { category: 'heal', script: true, handler: 'badger_spirit' },
        });
      }
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const bookOfBasicsPort = {
  handlerId: 'book_of_basics',
  family: 'unique',
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let factor = 0;
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      if (!itemHasType(item, 'spell')) continue;
      factor += item?.crafted || item?.isCrafted ? 2 : 1;
    }
    piece._bookSpellFactor = factor;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 5))));
    if ((Number(player.stacks.mana) || 0) >= need) {
      if (useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent > 0) {
        const base = Math.max(1, Math.round(getPName(piece.params, 'maxhealth', getP2(piece.params, 5))));
        const per = Math.max(
          0,
          Math.round(getPName(piece.params, 'maxhealth_spell', getP3(piece.params, 2))),
        );
        const hp = base + per * (Number(piece._bookSpellFactor) || 0);
        player.maxHp += hp;
        player.hp = Math.min(player.maxHp, player.hp + hp);
        events.push({
          t: t + 0.004,
          type: 'heal',
          actor: eventSideForPiece(piece),
          target: eventSideForPiece(piece),
          amount: hp,
          label: `${piece.name}: +${hp} max HP`,
          meta: { category: 'heal', script: true, handler: 'book_of_basics' },
        });
      }
    }
    pushActivate(piece, ctx, 'book_of_basics', `Book: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const rainbowOrbPort = {
  handlerId: 'rainbow_orb',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, dummy, events, graph, itemsById, canAffect, pieces, rng } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let vamp = 0;
    let mana = 0;
    let holy = 0;
    let dark = 0;
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      if (itemHasType(item, 'vampir')) vamp += 1;
      if (itemHasType(item, 'magic')) mana += 1;
      if (itemHasType(item, 'holy')) holy += 1;
      if (itemHasType(item, 'dark')) dark += 1;
    }
    const vampPer = getPName(piece.params, 'vampirism', getP2(piece.params, 0));
    const manaPer = getPName(piece.params, 'mana', getP3(piece.params, 0));
    const healAmpPer = getPName(piece.params, 'healamp', getP4(piece.params, 0));
    const debuffPer = getPName(piece.params, 'debuffs', getP5(piece.params, 0));
    if (vamp > 0) {
      grantStacks(player, 'vampirism', vamp * vampPer, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (mana > 0) {
      grantStacks(player, 'mana', mana * manaPer, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (holy > 0 && healAmpPer) {
      applyHealEfficiency(player, (holy * healAmpPer) / 100, ctx, piece);
    }
    if (dark > 0 && debuffPer > 0) {
      inflictRandomDebuffs(dummy, dark * debuffPer, rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        opponent: player,
      });
    }
    events.push({
      t,
      type: 'activate',
      actor: eventSideForPiece(piece),
      target: eventSideForPiece(piece),
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Accessory: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'rainbow_orb' },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const picked = giveAllBuffs(player, 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'rainbow_orb', picked);
    pushActivate(piece, ctx, 'rainbow_orb', `Accessory: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const magiteccArmorPort = {
  handlerId: 'magitecc_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { player, events, t, graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speedPer = getPName(piece.params, 'speed', getP1(piece.params, 5)) / 100;
    if (links.length > 0 && speedPer) addSpeed(piece, links.length * speedPer);
    const catalogBlock = Number(itemsById?.get?.(piece.itemId)?.block);
    const block = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : (Number.isFinite(catalogBlock) ? catalogBlock : 0);
    if (block) {
      gainStacks(player, 'block', block);
      events.push({
        t,
        type: 'buff',
        target: 'player',
        amount: block,
        label: `${piece.name}: +${block} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'magitecc_armor' },
      });
    }
    pushActivate(piece, ctx, 'magitecc_armor', `Armor: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const need = Number(getPName(piece.params, 'manat', getP1(piece.params, 5)));
    if ((Number(player.stacks.mana) || 0) >= need) {
      useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const cleanse = Number(getPName(piece.params, 'cleanse', getP2(piece.params, 1)));
      cleanseRandomDebuffs(player, cleanse, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const block2 = Number(getPName(piece.params, 'block', getP3(piece.params, 4)));
      if (block2) {
        gainStacks(player, 'block', block2);
        events.push({
          t: t + 0.004,
          type: 'buff',
          target: 'player',
          amount: block2,
          label: `${piece.name}: +${block2} Block`,
          meta: { category: 'buff', stack: 'block', script: true, handler: 'magitecc_armor' },
        });
      }
    }
    pushActivate(piece, ctx, 'magitecc_armor', `Armor: ${piece.name}`);
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const MANA_PORTS = {
  mana_crystal: manaCrystalPort,
  eggscalibur: eggscaliburPort,
  badger_spirit: badgerSpiritPort,
  book_of_basics: bookOfBasicsPort,
  rainbow_orb: rainbowOrbPort,
  magitecc_armor: magiteccArmorPort,
};
