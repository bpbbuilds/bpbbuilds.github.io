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
import {
  BATTERY_DUR_PER_TILE,
  buildBatteryChargePath,
  chargeEnterSchedule,
} from '../charge-path.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { randInt } from '../rng.js';
import { gainStacks } from '../stacks.js';
import { dealHit } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { getScriptHandler } from './registry.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const manaCrystalPort = {
  handlerId: 'mana_crystal',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, itemsById } = ctx;
    pushActivate(piece, ctx, 'mana_crystal', `Accessory: ${piece.name}`);
    const item = itemsById.get(piece.itemId);
    const boardPiece = graph.pieces.get(piece.placementKey);
    if (!item || !boardPiece) return true;

    const mana1 = Math.max(1, Math.round(getPName(piece.params, 'mana1', getP1(piece.params, 1))));
    const mana2 = Math.max(1, Math.round(getPName(piece.params, 'mana2', getP2(piece.params, 2))));
    const durPerTile = getPName(piece.params, 'dur', BATTERY_DUR_PER_TILE) || BATTERY_DUR_PER_TILE;
    const pathId = `charge:${piece.placementKey}:${t}`;
    const path = buildBatteryChargePath({
      pathId,
      item,
      placement: {
        x: boardPiece.x,
        y: boardPiece.y,
        r: boardPiece.r,
        key: piece.placementKey,
      },
      startT: t,
      durPerTile,
    });
    if (!path) return true;

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
      meta: {
        category: 'charge',
        phase: 'start',
        pathId,
        chargePath: path,
        handler: 'mana_crystal',
      },
    });

    const schedule = chargeEnterSchedule(path.cells.length, durPerTile);
    /** @type {string | null} */
    let lastKey = null;
    for (const step of schedule) {
      const cell = path.cells[step.cellIndex];
      if (!cell) continue;
      const targetKey = cell.targetKey || null;
      const targetPiece = targetKey
        ? (ctx.pieces || []).find((p) => p.placementKey === targetKey)
        : null;
      const enterAbs = t + step.enterT;
      if (targetKey !== lastKey) {
        if (targetPiece) {
          if (!targetPiece.pendingCharges) targetPiece.pendingCharges = [];
          targetPiece.pendingCharges.push({
            at: enterAbs,
            meta: {
              pathId,
              cellIndex: step.cellIndex,
              emitterKey: piece.placementKey,
            },
          });
          const tgtItem = itemsById.get(targetPiece.itemId);
          const amt = itemHasType(tgtItem, 'magic') ? mana2 : mana1;
          grantStacks(ctx.player, 'mana', amt, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          events.push({
            t: enterAbs,
            type: 'buff',
            target: 'player',
            amount: amt,
            label: `${piece.name}: +${amt} Mana (${targetPiece.name})`,
            meta: {
              category: 'buff',
              stack: 'mana',
              script: true,
              handler: 'mana_crystal',
            },
          });
        }
        lastKey = targetKey;
      }
    }
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
    const need = Math.max(1, Math.round(getP2(piece.params, 1)));
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
  onCombatStart(piece, ctx) {
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
    pushActivate(piece, ctx, 'book_of_basics', `Book: ${piece.name}`);
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
          target: 'player',
          amount: hp,
          label: `${piece.name}: +${hp} max HP`,
          meta: { category: 'heal', script: true, handler: 'book_of_basics' },
        });
      }
    }
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
    let dark = 0;
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      if (itemHasType(item, 'vampir')) vamp += 1;
      if (itemHasType(item, 'magic')) mana += 1;
      if (itemHasType(item, 'dark')) dark += 1;
    }
    const vampPer = Math.max(0, Math.round(getPName(piece.params, 'vampirism', 1)));
    const manaPer = Math.max(0, Math.round(getPName(piece.params, 'mana', 1)));
    const debuffPer = Math.max(0, Math.round(getPName(piece.params, 'debuffs', 1)));
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
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Accessory: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'rainbow_orb' },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'rainbow_orb', `Accessory: ${piece.name}`);
    const n = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP1(piece.params, 1))));
    const picked = giveAllBuffs(player, n, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'rainbow_orb', picked);
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
    const block = Math.max(1, Math.round(piece.blockGrant || getP2(piece.params, 8)));
    gainStacks(player, 'block', block);
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'magitecc_armor' },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'magitecc_armor', `Armor: ${piece.name}`);
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 5))));
    if ((Number(player.stacks.mana) || 0) >= need) {
      if (useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent > 0) {
        const cleanse = Math.max(
          1,
          Math.round(getPName(piece.params, 'cleanse', getP2(piece.params, 1))),
        );
        cleanseRandomDebuffs(player, cleanse, ctx.rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        const block2 = Math.max(1, Math.round(getPName(piece.params, 'block', getP3(piece.params, 4))));
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
