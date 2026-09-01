/**
 * Deck star-chain + Card.cardSecondaryEffectActive (Fool / Lovers / Ace / Reverse).
 */

import { affectedTargets } from '../board-graph.js';
import { itemHasType } from './ports-util.js';

/**
 * @typedef {import('../pieces.js').CombatPiece} CombatPiece
 */

/**
 * Game chainPosition is -1 when not in a deck (Card.notifyChainPosition).
 * @param {CombatPiece | null | undefined} piece
 */
export function chainPos(piece) {
  if (piece == null || piece._chainPos == null || piece._chainPos === '') return -1;
  const n = Number(piece._chainPos);
  return Number.isFinite(n) ? n : -1;
}

/** Star-cell cards only (Card.getNextCard / Deck.updateCards). */
export function starCardHits(ctx, sourceKey) {
  const links = affectedTargets(
    ctx.graph,
    sourceKey,
    ctx.itemsById,
    ctx.canAffect,
  );
  return links.filter(
    (l) =>
      l.via === 'rule' && itemHasType(ctx.itemsById.get(l.id), 'card'),
  );
}

function pieceByKey(ctx, key) {
  return (ctx.pieces || []).find((p) => p.placementKey === key) || null;
}

/**
 * Card.gd getNextCard + canAffect: next star card with higher chainPosition
 * (or still unassigned). Prefer the assigned deck chain when available.
 * @param {object} ctx
 * @param {CombatPiece} piece
 */
export function getNextCard(ctx, piece) {
  const pos = chainPos(piece);
  if (pos >= 0 && piece._deckKey) {
    const deck = (ctx.pieces || []).find((p) => p.placementKey === piece._deckKey);
    const cards = Array.isArray(deck?._cards) ? deck._cards : null;
    if (cards && pos + 1 < cards.length) return cards[pos + 1];
    if (cards) return null;
  }
  const hits = starCardHits(ctx, piece.placementKey);
  for (const hit of hits) {
    const next = pieceByKey(ctx, hit.key);
    if (!next) continue;
    const nPos = chainPos(next);
    // Card.canAffect when placed: chainPosition > self OR still -1 (building).
    if (nPos > pos || nPos < 0) return next;
  }
  return null;
}

/**
 * Util.countDuplicates: len - unique count of descriptors before this index.
 * @param {CombatPiece[]} cards
 * @param {number} untilIndex
 */
export function countDuplicatesBefore(cards, untilIndex) {
  const ids = [];
  const end = Math.max(0, untilIndex);
  for (let i = 0; i < end && i < cards.length; i++) {
    const id = cards[i]?.itemId;
    if (id) ids.push(id);
  }
  return ids.length - new Set(ids).size;
}

/**
 * @param {CombatPiece} piece
 * @param {CombatPiece[]} [chain]
 */
export function cardSecondaryEffectActive(piece, chain) {
  const pos = chainPos(piece);
  if (pos < 0 || !piece._deckKey) return false;
  const id = String(piece.itemId || '');
  if (id === 'the_fool') return pos === 0;
  if (id === 'the_lovers') return pos % 2 === 0;
  if (id === 'ace_of_spades') return pos % 2 === 1;
  if (id === 'reverse') return countDuplicatesBefore(chain || [], pos) === 0;
  return false;
}

/**
 * @param {object} ctx
 * @param {CombatPiece} deckPiece
 */
export function assignChain(ctx, deckPiece) {
  const firstHits = starCardHits(ctx, deckPiece.placementKey);
  /** @type {CombatPiece[]} */
  const cards = [];
  if (!firstHits.length) {
    deckPiece._cards = cards;
    return cards;
  }
  /** @type {Set<string>} */
  const seen = new Set();
  let cur = pieceByKey(ctx, firstHits[0].key);
  while (cur && !seen.has(cur.placementKey)) {
    seen.add(cur.placementKey);
    cards.push(cur);
    cur = getNextCard(ctx, cur);
  }
  cards.forEach((c, i) => {
    c._chainPos = i;
    c._deckKey = deckPiece.placementKey;
    c._secondaryActive = cardSecondaryEffectActive(c, cards);
  });
  deckPiece._cards = cards;
  return cards;
}

/**
 * Inventory-time Deck.updateCards — before combat start so t=0 snapshots have art flags.
 * @param {{ pieces?: CombatPiece[], graph: object, itemsById: Map<string, object>, canAffect?: object | null }} ctx
 */
export function assignAllDeckChains(ctx) {
  for (const piece of ctx.pieces || []) {
    if (piece.itemId === 'deck_of_cards') assignChain(ctx, piece);
  }
}
