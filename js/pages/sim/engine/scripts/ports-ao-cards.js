/**
 * Band AO — leftover cards + deck_of_cards chain (Card.gd reveal).
 */

import { applyEffectDmgFactor, applyHealEfficiency } from '../actor-stats.js';
import { giveRandomBuffs, grantStacks, stealRandomBuff } from '../buff-economy.js';
import { getP1, getP2, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { dealEffectDamage, stealLife } from './handlers.js';
import {
  assignChain,
  cardSecondaryEffectActive,
  chainPos,
  getNextCard,
} from './card-chain.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { removeRandomBuffs as stripBuffs } from './ports-wave-c-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 * @typedef {import('../pieces.js').CombatPiece} CombatPiece
 */

function cardRevealCd(piece) {
  const base = Number(piece.baseCooldown);
  if (Number.isFinite(base) && base > 0 && base < 500) return Math.max(0.35, base);
  const cd = Number(piece.cooldown);
  if (Number.isFinite(cd) && cd > 0 && cd < 500) return Math.max(0.35, cd);
  return 1.5;
}

function startCardReveal(card) {
  if (!card || card._revealing || card._revealed) return;
  card._revealing = true;
  const cd = cardRevealCd(card);
  card.baseCooldown = cd;
  card.cooldown = cd;
  card.triggerTime = cd;
}

function pauseCard(piece) {
  piece._revealing = false;
  piece._revealed = true;
  piece.cooldown = 999;
  piece.triggerTime = 999;
}

function chainCards(ctx, piece) {
  const key = piece._deckKey;
  if (!key) return [];
  const deck = (ctx.pieces || []).find((p) => p.placementKey === key);
  return Array.isArray(deck?._cards) ? deck._cards : [];
}

function secondaryOn(piece, ctx) {
  return cardSecondaryEffectActive(piece, chainCards(ctx, piece));
}

/** Game chainPosition is 0-based; -1 means not in a deck. Do not floor to 1. */
function chainIndex(piece) {
  const pos = chainPos(piece);
  return pos < 0 ? 0 : pos;
}

function logStackGrants(piece, ctx, handler, picked) {
  const filtered = {};
  for (const [stack, amount] of Object.entries(picked || {})) {
    const n = Math.round(Number(amount) || 0);
    if (n > 0) filtered[stack] = n;
  }
  if (!Object.keys(filtered).length) return;
  pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, handler, filtered);
}

function revealCard(piece, ctx, fn) {
  if (piece._revealed) return true;
  pushActivate(piece, ctx, piece.itemId, `Card: ${piece.name}`);
  fn();
  const next = getNextCard(ctx, piece);
  pauseCard(piece);
  startCardReveal(next);
  return true;
}

const deckOfCardsPort = {
  handlerId: 'deck_of_cards',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const cards = assignChain(ctx, piece);
    const luck = Math.max(1, Math.round(getP1(piece.params, 1)));
    grantStacks(ctx.player, 'lucky', luck, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (cards[0]) startCardReveal(cards[0]);
    pushActivate(piece, ctx, 'deck_of_cards', `Deck: ${piece.name}`);
  },
};

const aceOfSpadesPort = {
  handlerId: 'ace_of_spades',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    return revealCard(piece, ctx, () => {
      for (const o of ctx.pieces || []) {
        if (o.kind === 'weapon' || (Number(o.damageMax) || 0) > 0) {
          o.critChance = (Number(o.critChance) || 0) + 1;
        }
      }
      if (secondaryOn(piece, ctx)) {
        const luck = Math.max(0, Math.round(getPName(piece.params, 'luck', 1)));
        const spikes = Math.max(0, Math.round(getPName(piece.params, 'spikes', 1)));
        if (luck) grantStacks(ctx.player, 'lucky', luck, { originKey: piece.placementKey, originId: piece.itemId });
        if (spikes) grantStacks(ctx.player, 'spikes', spikes, { originKey: piece.placementKey, originId: piece.itemId });
        logStackGrants(piece, ctx, 'ace_of_spades', { lucky: luck, spikes });
      }
    });
  },
};

const darkestLotusPort = {
  handlerId: 'darkest_lotus',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const pos = chainIndex(piece);
    return revealCard(piece, ctx, () => {
      const mana = Math.round(getP1(piece.params, 1) * pos);
      const strip = Math.round(getP2(piece.params, 1) * pos);
      if (mana > 0) {
        grantStacks(ctx.player, 'mana', mana, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        logStackGrants(piece, ctx, 'darkest_lotus', { mana });
      }
      // Item.removeRandomBuffs → opponent(), not the wearer.
      if (strip > 0) {
        stripBuffs(ctx.dummy, strip, ctx.rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
  },
};

const reversePort = {
  handlerId: 'reverse',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    return revealCard(piece, ctx, () => {
      ctx.player.debuffReflectChance =
        (Number(ctx.player.debuffReflectChance) || 0) + getPName(piece.params, 'reflect', 20);
      if (secondaryOn(piece, ctx)) {
        stealRandomBuff(ctx.dummy, ctx.player, Math.max(1, Math.round(getPName(piece.params, 'steal', 1))), ctx.rng, {});
      }
    });
  },
};

const holoFireLizardPort = {
  handlerId: 'holo_fire_lizard',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const pos = chainIndex(piece);
    return revealCard(piece, ctx, () => {
      // HoloFireLizard.gd: changeEffectDamageFactor → dealEffectDamage → giveHeat.
      // Effect flags: no vamp / no spikes (Item.dealEffectDamage → takeDamage only).
      applyEffectDmgFactor(
        ctx.player,
        getPName(piece.params, 'damfactor', 10) / 100,
        ctx,
        piece,
      );
      const perCard = getPName(piece.params, 'dampercard', getP1(piece.params, 2));
      const dam = Math.max(1, Math.round((Number(piece.damageMin) || 4) + perCard * pos));
      dealEffectDamage(piece, ctx, dam);
      // Named `heat` — not 2nd JS key (that is damfactor).
      const heat = Math.max(0, Math.round(getPName(piece.params, 'heat', getP2(piece.params, 0))));
      if (heat > 0) {
        grantStacks(ctx.player, 'heat', heat, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        logStackGrants(piece, ctx, 'holo_fire_lizard', { heat });
      }
    });
  },
};

const jokerPort = {
  handlerId: 'joker',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    return revealCard(piece, ctx, () => {
      giveRandomBuffs(ctx.player, Math.max(1, Math.round(getPName(piece.params, 'buffs', 2))), ctx.rng, {});
    });
  },
};

const theFoolPort = {
  handlerId: 'the_fool',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    return revealCard(piece, ctx, () => {
      const spd = getPName(piece.params, 'revealspeed', 8) / 100;
      for (const o of ctx.pieces || []) {
        if (itemHasType(ctx.itemsById.get(o.itemId), 'card')) addSpeed(o, spd);
      }
      if (secondaryOn(piece, ctx)) {
        grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getPName(piece.params, 'empower', 1))), {});
      }
    });
  },
};

const theLoversPort = {
  handlerId: 'the_lovers',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    return revealCard(piece, ctx, () => {
      // TheLovers.gd: heal amp → stealLife → regen (secondary only on even chain).
      if (secondaryOn(piece, ctx)) {
        applyHealEfficiency(
          ctx.player,
          getPName(piece.params, 'healamp', 6) / 100,
          ctx,
          piece,
        );
      }
      const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', 7)));
      const ls = getPName(piece.params, 'lifesteal', 100) / 100;
      stealLife(piece, ctx, dam, ls);
      if (secondaryOn(piece, ctx)) {
        const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', 2)));
        // grantStacks already combat-logs; pass fireT so it matches activatePiece stamp
        // (getT() is step-end and was duplicating at +~0.03s → two "Gained 2 regen" lines).
        grantStacks(ctx.player, 'regeneration', regen, {
          originKey: piece.placementKey,
          originId: piece.itemId,
          t: ctx.t,
        });
      }
    });
  },
};

const whiteEyesPort = {
  handlerId: 'white_eyes_blue_dragon',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const pos = chainPos(piece);
    return revealCard(piece, ctx, () => {
      gainStacks(
        ctx.player,
        'block',
        Math.max(1, Math.round((Number(piece.blockGrant) || 2) + getP1(piece.params, 1) * pos)),
      );
      grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getP2(piece.params, 1))), {});
      applyEffectDmgFactor(
        ctx.dummy,
        -getPName(piece.params, 'damfactor', 10) / 100,
        ctx,
        piece,
      );
    });
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AO_CARD_PORTS = {
  deck_of_cards: deckOfCardsPort,
  ace_of_spades: aceOfSpadesPort,
  darkest_lotus: darkestLotusPort,
  reverse: reversePort,
  holo_fire_lizard: holoFireLizardPort,
  joker: jokerPort,
  the_fool: theFoolPort,
  the_lovers: theLoversPort,
  white_eyes_blue_dragon: whiteEyesPort,
};
