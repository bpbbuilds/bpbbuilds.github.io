import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Joker.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /onready var staminaReduction = getP\("stamina"\)/);
assert.match(source, /onready var revealsPerQuad: = int\(getP\("cards"\)\)/);
assert.match(source, /func countChain\(\):[\s\S]*counter\[cardType\] \/ 4[\s\S]*rest \/ 3[\s\S]*rest \/ 2/);
assert.match(source, /func doRevealEffect\(\):[\s\S]*giveRandomBuffs\(getP\("buffs"\)\)[\s\S]*gainCritResistStacks\(pairs\)[\s\S]*changeStaminaFactor\( - staminaReduction \* triplets\)[\s\S]*descriptor != descriptor[\s\S]*doRevealEffect\(\)/);
assert.equal(inventory.byId.joker?.file, 'Exclusive/Joker.gd');
assert.equal(getScriptHandler('joker')?.handlerId, 'joker');

function makeCard(itemId, placementKey, descriptor, side = 'you') {
  const item = byId.get(itemId) || { id: itemId, name: itemId };
  return {
    ...item,
    itemId,
    placementKey,
    descriptor,
    name: item.displayName || item.name || itemId,
    kind: 'card',
    params: { ...(item.params || {}) },
    side,
    alive: true,
    staminaCost: 10,
    baseStaminaCost: 10,
    staminaFactor: 1,
  };
}

function makeContext(joker, cards, opponent) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 200 });
  const deck = { itemId: 'deck_of_cards', placementKey: 'deck', _cards: cards };
  return {
    t: 2.5,
    player,
    dummy,
    events: [],
    rng: () => 0,
    pieces: [deck, ...cards, opponent],
    itemsById: byId,
  };
}

const prior = [
  makeCard('ace_of_spades', 'pair-a', 'pair'),
  makeCard('darkest_lotus', 'pair-b', 'pair'),
  makeCard('ace_of_spades', 'trip-a', 'triplet'),
  makeCard('reverse', 'trip-b', 'triplet'),
  makeCard('darkest_lotus', 'trip-c', 'triplet'),
  makeCard('ace_of_spades', 'quad-a', 'quad'),
  makeCard('reverse', 'quad-b', 'quad'),
  makeCard('darkest_lotus', 'quad-c', 'quad'),
  makeCard('white_eyes_blue_dragon', 'quad-d', 'quad'),
];
const joker = makeCard('joker', 'joker', 'joker', 'you');
joker._chainPos = prior.length;
joker._deckKey = 'deck';
joker.params = { buffs: 0, p1: 0, stamina: 25, p2: 25, cards: 2, p3: 2 };
const opponent = makeCard('ace_of_spades', 'opponent-card', 'opponent', 'them');
const chain = [...prior, joker];
const ctx = makeContext(joker, chain, opponent);
const handler = getScriptHandler('joker');
assert.equal(typeof handler?.onRevealEffect, 'function');
handler.onRevealEffect(joker, ctx);

assert.equal(ctx.player.stacks.lucky || 0, 0, 'Joker honors an explicit zero random-buff count');
assert.equal(ctx.player.critResistStacks, 1, 'Joker counts card descriptors for pairs');
for (const card of [...prior, joker]) {
  assert.equal(card.staminaFactor, 0.75, 'Joker applies triplet stamina reduction to player inventory');
}
assert.equal(opponent.staminaFactor, 1, 'Joker does not change the opponent inventory');
assert.equal(
  ctx.events.filter((event) => ['ace_of_spades', 'darkest_lotus'].includes(event.meta?.handler)).length,
  2,
  'Joker reveals the source cards × cards-per-quad parameter',
);
assert.equal(ctx.events.at(-1)?.meta?.handler, 'joker', 'Joker activates after all reveal effects');

const zeroJoker = makeCard('joker', 'zero-joker', 'zero-joker');
zeroJoker._chainPos = 0;
zeroJoker._deckKey = 'zero-deck';
zeroJoker.params = { buffs: 0, p1: 0, stamina: 0, p2: 0, cards: 0, p3: 0 };
const zeroCtx = makeContext(zeroJoker, [zeroJoker], makeCard('ace_of_spades', 'zero-opponent', 'zero-opponent', 'them'));
handler.onRevealEffect(zeroJoker, zeroCtx);
assert.equal(zeroCtx.player.critResistStacks || 0, 0, 'Joker honors explicit zero chain effects');
assert.equal(zeroCtx.events.at(-1)?.meta?.handler, 'joker', 'Joker still activates with zero parameters');

console.log('OK Joker source-backed descriptor chain counting, exact parameter fallbacks, player-only stamina reduction, reveal count, activation ordering, and zero parameters');
