/**
 * Band AO — leftover spells + books (incl. leftover auto-pattern books).
 */

import { giveStamina, healActor } from '../actor.js';
import { loseHealth } from './handlers.js';
import {
  grantStacks,
  spendStacks,
  useMana,
  useRegeneration,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { afterEffectFinished, itemHasType, pushActivate } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';
import { rollPercent } from '../rng.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function spellSpeed(ctx, piece, bonusType) {
  const per = getPName(piece.params, 'speed', 8) / 100;
  let spd = 0;
  for (const o of linked(ctx, piece)) {
    if (!itemHasType(ctx.itemsById.get(o.itemId), 'spell')) continue;
    spd += itemHasType(ctx.itemsById.get(o.itemId), bonusType) ? per * 2 : per;
  }
  if (spd) addSpeed(piece, spd);
}

const spellScrollIcePort = {
  handlerId: 'spell_scroll_ice',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._iceUsed = false;
    piece._iceColdInflicted = 0;
    const links = linked(ctx, piece);
    piece._iceAffectedKeys = new Set(links.map((target) => target.placementKey));
    piece._iceMaxCold = Math.trunc(getPName(piece.params, 'max', getP2(piece.params, 4)));
    piece._iceCold = Math.trunc(getPName(piece.params, 'cold', getP1(piece.params, 1)));
    ctx.bus?.on?.('pre_take_damage_late', (payload) => {
      if (piece._iceUsed || piece.alive === false || payload?.defender !== ctx.player) return;
      const incoming = Math.max(0, Number(payload?.damage?.damage ?? payload?.damage?.healthDamage) || 0);
      const blockable = payload?.source?.ignoreBlock === true
        ? 0
        : Math.min(incoming, Math.max(0, Number(ctx.player.block) || 0));
      if (!(ctx.player.hp - Math.max(0, incoming - blockable) <= 0)) return;
      const have = getStackAmount(ctx.dummy, 'cold');
      if (!(have > 0)) return;
      piece._iceUsed = true;
      spendStacks(ctx.dummy, 'cold', have, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const block = Number(piece.blockGrant ?? ctx.itemsById.get(piece.itemId)?.block ?? 0);
      gainStacks(ctx.player, 'block', Math.round(block * have), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      afterEffectFinished(piece, ctx, 'spell_scroll_ice', { label: `Spell: ${piece.name}` });
    });
  },
  onPeerActivated(listener, activated, ctx) {
    if (!listener._iceAffectedKeys?.has(activated?.placementKey)) return;
    const maxC = Number(listener._iceMaxCold) || 0;
    const cold = Number(listener._iceCold) || 0;
    if (!(listener._iceColdInflicted < maxC)) return;
    const catalog = ctx.itemsById.get(listener.itemId);
    const rawChance = listener.chance != null ? listener.chance : catalog?.chance;
    const chance = Number.isFinite(Number(rawChance)) ? Number(rawChance) : 20;
    if (!rollPercent(chance, ctx.rng)) return;
    listener._iceColdInflicted = Math.min(cold, maxC - listener._iceColdInflicted);
    grantStacks(ctx.dummy, 'cold', cold, {
      rng: ctx.rng,
      opponent: ctx.player,
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
      meta: { category: 'system', script: true, handler: 'spell_scroll_ice', miniActivate: true },
    });
  },
};

const spellScrollNaturePort = {
  handlerId: 'spell_scroll_nature',
  family: 'unique',
  onPrepare(piece, ctx) {
    const links = linked(ctx, piece);
    piece._natureAffectedKeys = new Set(links.map((target) => target.placementKey));
    piece._natureStaminaAcc = 0;
    piece._natureNeed = getPName(piece.params, 'staminat', getP1(piece.params, 0));
    piece._natureGive = getPName(piece.params, 'stamina', getP3(piece.params, 0));
    piece._natureManaNeed = getPName(piece.params, 'mana', getP2(piece.params, 0));
    ctx.bus?.on?.('stamina_used', (payload) => {
      if (payload?.actor !== ctx.player) return;
      if (!piece._natureAffectedKeys?.has(payload?.piece?.placementKey)) return;
      const need = Number(piece._natureNeed) || 0;
      if (!(need > 0)) return;
      piece._natureStaminaAcc += Number(payload.amount) || 0;
      while (piece._natureStaminaAcc >= need - 0.0001) {
        const manaNeed = Number(piece._natureManaNeed) || 0;
        if (getStackAmount(ctx.player, 'mana') >= manaNeed) {
          useMana(ctx.player, manaNeed, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          giveStamina(ctx.player, piece._natureGive);
          pushActivate(piece, ctx, 'spell_scroll_nature', `Spell: ${piece.name}`);
        }
        piece._natureStaminaAcc -= need;
      }
    });
  },
};

function bookPort(id, bonusType, onCd) {
  return {
    handlerId: id,
    family: 'unique',
    // BookofIce.gd uses onPrepare, before the first cooldown is armed.
    onPrepare(piece, ctx) {
      spellSpeed(ctx, piece, bonusType);
    },
    onCooldownEffect: onCd,
  };
}

const bookOfIcePort = bookPort('book_of_ice', 'ice', (piece, ctx) => {
  const need = Math.max(1, Math.round(getPName(piece.params, 'mana', 3)));
  // BookofIce.gd calls activate() after the mana gate. The activation still
  // happens when mana is insufficient, but its source/handler is the concrete
  // catalog row (important for the scene alias Book of Ice New).
  if (getStackAmount(ctx.player, 'mana') >= need) {
    useMana(ctx.player, need, { originKey: piece.placementKey, originId: piece.itemId });
    grantStacks(
      ctx.dummy,
      'cold',
      Math.max(1, Math.round(getPName(piece.params, 'cold', 2))),
      { originKey: piece.placementKey, originId: piece.itemId },
    );
  }
  pushActivate(piece, ctx, piece.itemId, `Book: ${piece.name}`);
  return true;
});

const bookOfIceNewPort = { ...bookOfIcePort, handlerId: 'book_of_ice_new' };

const bookOfDarknessPort = bookPort('book_of_darkness', 'dark', (piece, ctx) => {
  const need = Math.max(1, Math.round(getPName(piece.params, 'health', 8)));
  if (ctx.player.hp > need) {
    const cost = loseHealth(piece, ctx, need);
    if (cost) {
      grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getPName(piece.params, 'mana', 2))), {});
      grantStacks(ctx.dummy, 'blind', Math.max(1, Math.round(getPName(piece.params, 'blind', 1))), {});
    }
  }
  pushActivate(piece, ctx, 'book_of_darkness', `Book: ${piece.name}`);
  return true;
});

const bookOfLightPort = bookPort('book_of_light', 'holy', (piece, ctx) => {
  const need = Math.max(1, Math.round(getPName(piece.params, 'mana', 3)));
  if (getStackAmount(ctx.player, 'mana') >= need) {
    useMana(ctx.player, need, { originKey: piece.placementKey, originId: piece.itemId });
    grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getPName(piece.params, 'regen', 1))), {});
    const healAmount = Math.max(1, Math.round(getPName(piece.params, 'heal', 6)));
    const healed = healActor(ctx.player, healAmount);
    if (healed > 0 || (ctx.player._lastHeal && !ctx.player._lastHeal.meterAttached)) {
      const actor = eventSideForPiece(piece);
      const logged = Number(ctx.player._lastHeal?.loggedAmount) || healed;
      if (ctx.player._lastHeal) ctx.player._lastHeal.meterAttached = true;
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'heal',
        actor,
        target: actor,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: logged,
        label: `${piece.name}: heal +${logged}`,
        meta: { category: 'heal', script: true, handler: 'book_of_light', playerHp: ctx.player.hp },
      });
    }
  }
  pushActivate(piece, ctx, 'book_of_light', `Book: ${piece.name}`);
  return true;
});

const bookOfNaturePort = bookPort('book_of_nature', 'nature', (piece, ctx) => {
  const need = Math.max(1, Math.round(getPName(piece.params, 'regen', 2)));
  if (getStackAmount(ctx.player, 'regeneration') >= need) {
    useRegeneration(ctx.player, need, { originKey: piece.placementKey, originId: piece.itemId });
    grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getPName(piece.params, 'luck', 1))), {});
    grantStacks(ctx.player, 'spikes', Math.max(1, Math.round(getPName(piece.params, 'spikes', 1))), {});
  }
  pushActivate(piece, ctx, 'book_of_nature', `Book: ${piece.name}`);
  return true;
});

const manaMasteryPort = {
  handlerId: 'mana_mastery',
  family: 'unique',
  onCombatStart(piece, ctx) {
    // ManaMastery.onPreCombatStart — after ManaOrb.onPrepare reset (sim onPreCombatStart).
    const bonus = Math.max(0, Math.round(getPName(piece.params, 'buffs', 20)));
    if (bonus > 0) {
      for (const o of ctx.pieces || []) {
        if (o.itemId !== 'mana_orb' || !o.alive) continue;
        if (o.side !== piece.side) continue;
        o._bonusBuffs = (Number(o._bonusBuffs) || 0) + bonus;
      }
    }
    const n = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'magic'),
    ).length;
    if (n) addSpeed(piece, (getPName(piece.params, 'speed', 8) / 100) * n);
  },
  onCooldownEffect(piece, ctx) {
    grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getPName(piece.params, 'mana', 2))), {});
    pushActivate(piece, ctx, 'mana_mastery', `Skill: ${piece.name}`);
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AO_SPELL_PORTS = {
  spell_scroll_ice: spellScrollIcePort,
  spell_scroll_nature: spellScrollNaturePort,
  book_of_ice: bookOfIcePort,
  book_of_ice_new: bookOfIceNewPort,
  book_of_darkness: bookOfDarknessPort,
  book_of_light: bookOfLightPort,
  book_of_nature: bookOfNaturePort,
  mana_mastery: manaMasteryPort,
};
