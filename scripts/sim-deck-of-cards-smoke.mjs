import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { assignChain } from '../js/pages/sim/engine/scripts/card-chain.js';

const source = fs.readFileSync('tools/game-extract-full/Items/DeckofCards.gd', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};

const row = inventory.byId.deck_of_cards;
assert.ok(row, 'Deck of Cards has a source inventory row');
assert.equal(row.file, 'DeckofCards.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['onCombatStart', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Card\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*chainStarted = false/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveLucky\(getP1\(\)\)[\s\S]*if not chainStarted[\s\S]*cardActivations = 0[\s\S]*cards\[0\]\.call_deferred\("startActivation"\)[\s\S]*activate\(\)/);

const handler = getScriptHandler('deck_of_cards');
assert.equal(handler?.handlerId, 'deck_of_cards');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');

const data = byId.get('deck_of_cards');
const aceData = byId.get('ace_of_spades');
const lotusData = byId.get('darkest_lotus');
assert.ok(data && aceData && lotusData);
const deck = {
  itemId: 'deck_of_cards',
  placementKey: 'deck',
  name: 'Deck of Cards',
  kind: 'gadget',
  side: 'you',
  alive: true,
  params: data.params,
  _deckChainStarted: true,
  _deckCardActivations: 9,
};
const first = {
  itemId: 'ace_of_spades',
  placementKey: 'first-card',
  name: 'Ace of Spades',
  kind: 'card',
  side: 'you',
  alive: true,
  params: aceData.params,
  baseCooldown: aceData.cooldown,
  cooldown: 999,
  triggerTime: 999,
};
const second = {
  itemId: 'darkest_lotus',
  placementKey: 'second-card',
  name: 'Darkest Lotus',
  kind: 'card',
  side: 'you',
  alive: true,
  params: lotusData.params,
  baseCooldown: lotusData.cooldown,
  cooldown: 999,
  triggerTime: 999,
};
const graph = {
  pieces: new Map([
    ['deck', { key: 'deck', id: 'deck_of_cards', cells: [], affectCells: [{ cell: '1,0', color: 'primary' }] }],
    ['first-card', { key: 'first-card', id: 'ace_of_spades', cells: [], affectCells: [{ cell: '2,0', color: 'primary' }] }],
    ['second-card', { key: 'second-card', id: 'darkest_lotus', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'first-card'],
    ['2,0', 'second-card'],
  ]),
};
const itemsById = new Map([
  ['deck_of_cards', data],
  ['ace_of_spades', aceData],
  ['darkest_lotus', lotusData],
]);
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 1,
  rng: () => 0,
  graph,
  itemsById,
  pieces: [deck, first, second],
  canAffect,
};

assignChain(ctx, deck);
assert.deepEqual(deck._cards.map((card) => card.itemId), ['ace_of_spades', 'darkest_lotus']);
handler.onPrepare(deck, ctx);
assert.equal(deck._deckChainStarted, false, 'source preparation resets the chain gate');
assert.equal(deck._deckCardActivations, 0, 'source preparation resets card activation count');

handler.onCombatStart(deck, ctx);
assert.equal(player.stacks.lucky, data.params.p1, 'source combat start grants the catalog Lucky amount');
assert.equal(deck._deckChainStarted, true);
assert.equal(deck._deckCardActivations, 0);
assert.equal(first._revealing, true, 'the first linked card is armed once');
assert.equal(second._revealing, undefined);
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'deck_of_cards'));

const activationCount = events.filter((event) => event.type === 'activate' && event.itemId === 'deck_of_cards').length;
handler.onCombatStart(deck, { ...ctx, t: 2 });
assert.equal(player.stacks.lucky, data.params.p1 * 2, 'the Deck grants Lucky on each source combat-start call');
assert.equal(first._revealing, true, 'the already-started chain is not armed a second time');
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'deck_of_cards').length, activationCount + 1);

const zeroDeck = { ...deck, params: { p1: 0 }, _deckChainStarted: false, _deckCardActivations: 0 };
const luckyBeforeZero = player.stacks.lucky;
handler.onPrepare(zeroDeck, ctx);
handler.onCombatStart(zeroDeck, { ...ctx, t: 3 });
assert.equal(player.stacks.lucky, luckyBeforeZero, 'zero source Lucky does not invent a stack');

console.log('OK Deck of Cards source port');
