/**
 * Band AO — leftover cards + deck_of_cards chain (Card.gd reveal).
 */

import {
  applyEffectDmgFactor,
  applyHealEfficiency,
  changeCritResistStacks,
  changeCritStacks,
  changeReflectStacks,
} from '../actor-stats.js';
import { giveRandomBuffs, grantStacks, stealRandomBuff } from '../buff-economy.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { dealEffectDamage, stealLife } from './handlers.js';
import {
  cardSecondaryEffectActive,
  chainPos,
  prepareCard,
  startCardActivation,
  triggerCard,
} from './card-chain.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { removeRandomBuffs as stripBuffs } from './ports-wave-c-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 * @typedef {import('../pieces.js').CombatPiece} CombatPiece
 */

function chainCards(ctx, piece) {
  const key = piece._deckKey;
  if (!key) return [];
  const deck = (ctx.pieces || []).find((p) => p.placementKey === key);
  return Array.isArray(deck?._cards) ? deck._cards : [];
}

function secondaryOn(piece, ctx) {
  return cardSecondaryEffectActive(piece, chainCards(ctx, piece));
}

function cardDescriptor(card) {
  const descriptor = card?.descriptor;
  if (descriptor && typeof descriptor === 'object') {
    return String(descriptor.id ?? descriptor.internalName ?? descriptor.name ?? card?.itemId ?? '');
  }
  return String(descriptor ?? card?.itemId ?? card?.id ?? '');
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

const cardBasePort = {
  handlerId: 'card',
  family: 'unique',
  onPrepare: prepareCard,
  onPreCombatStart() {},
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx);
  },
};

const deckOfCardsPort = {
  handlerId: 'deck_of_cards',
  family: 'unique',
  onPrepare(piece) {
    piece._deckChainStarted = false;
    piece._deckCardActivations = 0;
  },
  onCombatStart(piece, ctx) {
    const cards = Array.isArray(piece._cards) ? piece._cards : [];
    const luck = Math.trunc(getP1(piece.params, 1));
    grantStacks(ctx.player, 'lucky', luck, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (!piece._deckChainStarted) {
      piece._deckChainStarted = true;
      piece._deckCardActivations = 0;
      if (cards[0]) startCardActivation(cards[0]);
    }
    pushActivate(piece, ctx, 'deck_of_cards', `Deck: ${piece.name}`);
  },
};

const aceOfSpadesPort = {
  handlerId: 'ace_of_spades',
  family: 'unique',
  onPrepare: prepareCard,
  onRevealEffect(piece, ctx) {
      // AceofSpades.gd: giveCritTokens(1) delegates to character(), so this
      // is an actor token consumed by the next eligible attack—not +1% crit
      // chance on every weapon.
      changeCritStacks(ctx.player, 1, ctx, piece);
      if (secondaryOn(piece, ctx)) {
        const luck = Math.max(0, Math.round(getPName(piece.params, 'luck', 1)));
        const spikes = Math.max(0, Math.round(getPName(piece.params, 'spikes', 1)));
        if (luck) grantStacks(ctx.player, 'lucky', luck, { originKey: piece.placementKey, originId: piece.itemId });
        if (spikes) grantStacks(ctx.player, 'spikes', spikes, { originKey: piece.placementKey, originId: piece.itemId });
        logStackGrants(piece, ctx, 'ace_of_spades', { lucky: luck, spikes });
      }
    pushActivate(piece, ctx, 'ace_of_spades', `Card: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx, aceOfSpadesPort.onRevealEffect);
  },
};

const darkestLotusPort = {
  handlerId: 'darkest_lotus',
  family: 'unique',
  onRevealEffect(piece, ctx) {
    const pos = chainIndex(piece);
      const mana = Math.round(getP1(piece.params, 1) * pos);
      const strip = Math.round(getP2(piece.params, 1) * pos);
      if (mana > 0) {
        const gained = grantStacks(ctx.player, 'mana', mana, {
          originKey: piece.placementKey,
          originId: piece.itemId,
          rng: ctx.rng,
        });
        logStackGrants(piece, ctx, 'darkest_lotus', { mana: gained.gained });
      }
      // Item.removeRandomBuffs → opponent(), not the wearer.
      if (strip > 0) {
        stripBuffs(ctx.dummy, strip, ctx.rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    pushActivate(piece, ctx, 'darkest_lotus', `Card: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx, darkestLotusPort.onRevealEffect);
  },
};

const reversePort = {
  handlerId: 'reverse',
  family: 'unique',
  onRevealEffect(piece, ctx) {
      const reflect = Math.trunc(getPName(piece.params, 'reflect', getP1(piece.params, 0)));
      changeReflectStacks(ctx.player, reflect, ctx, piece);
      if (secondaryOn(piece, ctx)) {
        const steal = Math.trunc(getPName(piece.params, 'steal', getP2(piece.params, 0)));
        if (steal > 0) stealRandomBuff(ctx.dummy, ctx.player, steal, ctx.rng, {});
      }
    pushActivate(piece, ctx, 'reverse', `Card: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx, reversePort.onRevealEffect);
  },
};

const holoFireLizardPort = {
  handlerId: 'holo_fire_lizard',
  family: 'unique',
  onRevealEffect(piece, ctx) {
    const pos = chainIndex(piece);
      // HoloFireLizard.gd: changeEffectDamageFactor → dealEffectDamage → giveHeat.
      // Effect flags: no vamp / no spikes (Item.dealEffectDamage → takeDamage only).
      applyEffectDmgFactor(
        ctx.player,
        getPName(piece.params, 'damfactor', 0) / 100,
        ctx,
        piece,
      );
      const perCard = getPName(piece.params, 'dampercard', getP1(piece.params, 0));
      const baseDamage = Number(piece.damageMin);
      const dam = (Number.isFinite(baseDamage) ? baseDamage : 0) + perCard * pos;
      dealEffectDamage(piece, ctx, dam);
      // Named `heat` — not 2nd JS key (that is damfactor).
      const heat = Math.trunc(getPName(piece.params, 'heat', getP2(piece.params, 0)));
      if (heat) {
        grantStacks(ctx.player, 'heat', heat, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        logStackGrants(piece, ctx, 'holo_fire_lizard', { heat });
      }
    pushActivate(piece, ctx, 'holo_fire_lizard', `Card: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx, holoFireLizardPort.onRevealEffect);
  },
};

function jokerChainCounts(piece, ctx) {
  const before = chainCards(ctx, piece).slice(0, Math.max(0, chainIndex(piece)));
  const counts = new Map();
  for (const card of before) {
    const id = cardDescriptor(card);
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  let pairs = 0;
  let triplets = 0;
  let quads = 0;
  for (const count of counts.values()) {
    quads += Math.floor(count / 4);
    const rest = count % 4;
    triplets += Math.floor(rest / 3);
    pairs += Math.floor((rest % 3) / 2);
  }
  return { pairs, triplets, quads };
}

/**
 * Joker.gd calls `revealedCard.doRevealEffect()` directly. This intentionally
 * bypasses Card.trigger: the chosen card stays face-down and retains its
 * pending cooldown, while its own reveal effects and activation event still
 * occur. All source Card subclasses live in this module.
 */
function revealCardEffectOnly(card, ctx) {
  const handler = AO_CARD_PORTS[card?.itemId];
  if (typeof handler?.onRevealEffect !== 'function') return false;
  handler.onRevealEffect(card, ctx);
  return true;
}

function pickCard(cards, rng) {
  if (!cards.length) return null;
  const roll = Math.max(0, Math.min(0.999999999, Number(rng?.()) || 0));
  return cards[Math.floor(roll * cards.length)] || null;
}

const jokerPort = {
  handlerId: 'joker',
  family: 'unique',
  onRevealEffect(piece, ctx) {
    giveRandomBuffs(ctx.player, getPName(piece.params, 'buffs', getP1(piece.params, 2)), ctx.rng, {});
    const { pairs, triplets, quads } = jokerChainCounts(piece, ctx);
    if (pairs > 0) changeCritResistStacks(ctx.player, pairs, ctx, piece);
    if (triplets > 0) {
      const reduction = -getPName(piece.params, 'stamina', getP2(piece.params, 25)) * triplets / 100;
      for (const other of ctx.pieces || []) {
        if (piece.side != null && other.side !== piece.side) continue;
        multiplyStaminaCost(other, reduction);
      }
    }
    const jokerDescriptor = cardDescriptor(piece);
    const eligible = chainCards(ctx, piece)
      .slice(0, Math.max(0, chainIndex(piece)))
      .filter((card) => cardDescriptor(card) !== jokerDescriptor);
    const revealsPerQuad = Math.trunc(getPName(piece.params, 'cards', getP3(piece.params, 2)));
    const reveals = Math.max(0, quads * revealsPerQuad);
    for (let i = 0; i < reveals && eligible.length; i += 1) {
      const card = pickCard(eligible, ctx.rng);
      if (!card) break;
      revealCardEffectOnly(card, ctx);
      // Joker.gd only removes the pick while alternatives exist, allowing the
      // final remaining card to be selected again for later quad reveals.
      if (eligible.length > 1) eligible.splice(eligible.indexOf(card), 1);
    }
    pushActivate(piece, ctx, 'joker', `Card: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx, jokerPort.onRevealEffect);
  },
};

const theFoolPort = {
  handlerId: 'the_fool',
  family: 'unique',
  onRevealEffect(piece, ctx) {
    const spd = getPName(piece.params, 'revealspeed', 8) / 100;
    // TheFool.gd iterates `deck.cards`, not every card on the board. Keep
    // unrelated decks/cards untouched when multiple card groups are present.
    for (const o of chainCards(ctx, piece)) {
      addSpeed(o, spd);
    }
    if (secondaryOn(piece, ctx)) {
      const empower = Math.max(0, Math.round(getPName(piece.params, 'empower', 1)));
      if (empower) grantStacks(ctx.player, 'empower', empower, {});
    }
    pushActivate(piece, ctx, 'the_fool', `Card: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx, theFoolPort.onRevealEffect);
  },
};

const theLoversPort = {
  handlerId: 'the_lovers',
  family: 'unique',
  onRevealEffect(piece, ctx) {
      // TheLovers.gd: heal amp → stealLife → regen (secondary only on even chain).
      if (secondaryOn(piece, ctx)) {
        applyHealEfficiency(
          ctx.player,
          getPName(piece.params, 'healamp', 6) / 100,
          ctx,
          piece,
        );
      }
      const dam = Number(getPName(piece.params, 'dam', getP1(piece.params, 7))) || 0;
      const ls = modifiedParamValue(
        piece,
        getPName(piece.params, 'lifesteal', getP3(piece.params, 100)),
        'lifesteal',
      ) / 100;
      stealLife(piece, ctx, dam, ls);
      if (secondaryOn(piece, ctx)) {
        const regen = Math.trunc(getPName(piece.params, 'regen', getP2(piece.params, 2)));
        // grantStacks already combat-logs; pass fireT so it matches activatePiece stamp
        // (getT() is step-end and was duplicating at +~0.03s → two "Gained 2 regen" lines).
        if (regen > 0) {
          grantStacks(ctx.player, 'regeneration', regen, {
            originKey: piece.placementKey,
            originId: piece.itemId,
            t: ctx.t,
          });
        }
      }
    pushActivate(piece, ctx, 'the_lovers', `Card: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx, theLoversPort.onRevealEffect);
  },
};

const whiteEyesPort = {
  handlerId: 'white_eyes_blue_dragon',
  family: 'unique',
  onRevealEffect(piece, ctx) {
    const pos = chainPos(piece);
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
    pushActivate(piece, ctx, 'white_eyes_blue_dragon', `Card: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return triggerCard(piece, ctx, whiteEyesPort.onRevealEffect);
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AO_CARD_PORTS = {
  card: cardBasePort,
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
