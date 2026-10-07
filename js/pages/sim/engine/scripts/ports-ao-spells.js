/**
 * Band AO — leftover spells + books (incl. leftover auto-pattern books).
 */

import { healActor } from '../actor.js';
import {
  grantStacks,
  spendStacks,
  useMana,
  useRegeneration,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { itemHasType, pushActivate } from './ports-util.js';
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
  onCombatStart(piece, ctx) {
    piece._iceUsed = false;
    piece._coldN = 0;
    const maxC = Math.max(1, Math.round(getPName(piece.params, 'max', 4)));
    const cold = Math.max(1, Math.round(getPName(piece.params, 'cold', 1)));
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (piece._iceUsed || piece.alive === false) return;
      if (ctx.player.hp > 0 || Number(payload?.healthDamage) <= 0) return;
      const have = getStackAmount(ctx.dummy, 'cold');
      if (!(have > 0)) return;
      piece._iceUsed = true;
      spendStacks(ctx.dummy, 'cold', have, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      gainStacks(ctx.player, 'block', Math.max(1, Math.round((Number(piece.blockGrant) || 2) * have)));
      piece.alive = false;
    });
  },
  onPeerActivated(listener, activated, ctx) {
    const item = ctx.itemsById.get(activated.itemId);
    if (!itemHasType(item, 'shield') && !itemHasType(item, 'armor')) return;
    const maxC = Math.max(1, Math.round(getPName(listener.params, 'max', 4)));
    const cold = Math.max(1, Math.round(getPName(listener.params, 'cold', 1)));
    listener._coldN = listener._coldN || 0;
    if (listener._coldN >= maxC) return;
    if (!rollPercent(Number(listener.chance) || 20, ctx.rng)) return;
    listener._coldN += 1;
    grantStacks(ctx.dummy, 'cold', cold, {});
  },
};

const spellScrollNaturePort = {
  handlerId: 'spell_scroll_nature',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._stam = 0;
    const need = Math.max(1, getPName(piece.params, 'staminat', 8));
    const give = Math.max(1, getPName(piece.params, 'stamina', 4));
    const manaNeed = Math.max(1, Math.round(getPName(piece.params, 'mana', 2)));
    ctx.bus?.on?.('piece_dealt_damage', () => {});
    piece._nat = { need, give, manaNeed };
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
  pushActivate(piece, ctx, 'book_of_darkness', `Book: ${piece.name}`);
  if (ctx.player.hp <= need) return true;
  ctx.player.hp -= need;
  grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getPName(piece.params, 'mana', 2))), {});
  grantStacks(ctx.dummy, 'blind', Math.max(1, Math.round(getPName(piece.params, 'blind', 1))), {});
  return true;
});

const bookOfLightPort = bookPort('book_of_light', 'holy', (piece, ctx) => {
  const need = Math.max(1, Math.round(getPName(piece.params, 'mana', 3)));
  pushActivate(piece, ctx, 'book_of_light', `Book: ${piece.name}`);
  if (getStackAmount(ctx.player, 'mana') < need) return true;
  useMana(ctx.player, need, { originKey: piece.placementKey, originId: piece.itemId });
  grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getPName(piece.params, 'regen', 1))), {});
  healActor(ctx.player, Math.max(1, Math.round(getPName(piece.params, 'heal', 6))));
  return true;
});

const bookOfNaturePort = bookPort('book_of_nature', 'nature', (piece, ctx) => {
  const need = Math.max(1, Math.round(getPName(piece.params, 'regen', 2)));
  pushActivate(piece, ctx, 'book_of_nature', `Book: ${piece.name}`);
  if (getStackAmount(ctx.player, 'regeneration') < need) return true;
  useRegeneration(ctx.player, need, { originKey: piece.placementKey, originId: piece.itemId });
  grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getPName(piece.params, 'luck', 1))), {});
  grantStacks(ctx.player, 'spikes', Math.max(1, Math.round(getPName(piece.params, 'spikes', 1))), {});
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
