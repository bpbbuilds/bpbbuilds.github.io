import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  assignChain,
  deactivateCard,
  prepareCard,
  startCardActivation,
  triggerCard,
} from '../js/pages/sim/engine/scripts/card-chain.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Card.gd', 'utf8');
assert.match(source, /func preCombatStart\(\):[\s\S]*deactivateCooldown\(\)/);
assert.match(source, /nextCard\.startActivation\(\)[\s\S]*setState\(true, true\)[\s\S]*deactivateCooldown\(\)[\s\S]*doRevealEffect\(\)/);
assert.equal(typeof getScriptHandler('card')?.onCooldownEffect, 'function', 'Card has an explicit base handler');

function card(id, key) {
  return { itemId: id, placementKey: key, kind: 'card', baseCooldown: 1.5, cooldown: 1.5, triggerTime: 0 };
}

const deck = { itemId: 'deck_of_cards', placementKey: 'deck', kind: 'unique' };
const first = card('ace_of_spades', 'first');
const second = card('the_lovers', 'second');
const third = card('reverse', 'third');
const pieces = [deck, third, second, first];
const itemsById = new Map([
  ['deck_of_cards', { id: 'deck_of_cards', type: 'Accessory' }],
  ['ace_of_spades', { id: 'ace_of_spades', type: 'Card' }],
  ['the_lovers', { id: 'the_lovers', type: 'Card' }],
  ['reverse', { id: 'reverse', type: 'Card' }],
]);
const graph = {
  pieces: new Map([
    ['deck', { id: 'deck_of_cards', cells: ['0,0'], affectCells: [{ cell: '1,0' }] }],
    ['first', { id: 'ace_of_spades', cells: ['1,0'], affectCells: [{ cell: '2,0' }] }],
    ['second', { id: 'the_lovers', cells: ['2,0'], affectCells: [{ cell: '3,0' }] }],
    ['third', { id: 'reverse', cells: ['3,0'], affectCells: [] }],
  ]),
  filled: new Map([['0,0', 'deck'], ['1,0', 'first'], ['2,0', 'second'], ['3,0', 'third']]),
};
const ctx = { pieces, graph, itemsById };

const chain = assignChain(ctx, deck);
assert.deepEqual(chain.map((piece) => piece.placementKey), ['first', 'second', 'third'], 'chain follows star order, not piece order');
for (const piece of chain) {
  prepareCard(piece, ctx);
  deactivateCard(piece);
  assert.equal(piece._cdLocked, true, 'cards are inactive before Deck starts the chain');
}

startCardActivation(first);
assert.equal(first._revealing, true);
assert.equal(first._cdLocked, false);
const revealStates = [];
triggerCard(first, ctx, () => revealStates.push([first._revealed, second._revealing]));
assert.deepEqual(revealStates, [[true, true]], 'next card starts before the current reveal effect');
assert.equal(first._cdLocked, true, 'revealed card deactivates');
triggerCard(second, ctx, () => {});
assert.equal(third._revealing, true, 'each trigger advances one card');

console.log('OK shared Card prepare, trigger/deactivation, and chain ordering');
