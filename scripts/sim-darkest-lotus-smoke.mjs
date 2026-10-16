import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { gainStacks } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/DarkestLotus.gd', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const row = inventory.byId.darkest_lotus;
assert.ok(row, 'Darkest Lotus has a source inventory row');
assert.equal(row.file, 'DarkestLotus.gd');
assert.equal(row.extends, 'Card');
assert.deepEqual(row.overrides, ['doRevealEffect']);
assert.match(source, /func doRevealEffect\(\):[\s\S]*var mana = getP1\(\) \* chainPosition/);
assert.match(source, /giveMana\(mana\)[\s\S]*removeRandomBuffs\(getP2\(\) \* chainPosition\)[\s\S]*activate\(\)/);

const handler = getScriptHandler('darkest_lotus');
assert.equal(handler?.handlerId, 'darkest_lotus');
assert.equal(typeof handler?.onRevealEffect, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const data = byId.get('darkest_lotus');
assert.ok(data);
const piece = {
  itemId: 'darkest_lotus',
  placementKey: 'lotus',
  name: 'Darkest Lotus',
  kind: 'card',
  side: 'you',
  alive: true,
  params: data.params,
  cooldown: data.cooldown,
  baseCooldown: data.cooldown,
  triggerTime: data.cooldown,
  _chainPos: 2,
  _deckKey: 'deck',
};
const next = {
  itemId: 'banana',
  placementKey: 'next',
  name: 'Banana',
  kind: 'card',
  side: 'you',
  alive: true,
  baseCooldown: 2,
  cooldown: 999,
  triggerTime: 999,
};
const previous = { itemId: 'ace_of_spades', placementKey: 'previous', _chainPos: 0 };
const previousTwo = { itemId: 'reverse', placementKey: 'previous-two', _chainPos: 1 };
const deck = {
  itemId: 'deck_of_cards',
  placementKey: 'deck',
  name: 'Deck of Cards',
  kind: 'gadget',
  side: 'you',
  alive: true,
  _cards: [previous, previousTwo, piece, next],
};
const player = createActor('player');
const dummy = createActor('dummy');
gainStacks(player, 'lucky', 1);
gainStacks(dummy, 'lucky', 4);
gainStacks(dummy, 'heat', 4);
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 7,
  rng: () => 0,
  pieces: [deck, previous, previousTwo, piece, next],
  graph: { pieces: new Map(), filled: new Map() },
};

const handled = handler.onCooldownEffect(piece, ctx);
assert.equal(handled, true);
assert.equal(player.stacks.mana, data.params.mana * piece._chainPos, 'Mana scales by the source zero-based chain position');
assert.equal(player.stacks.lucky, 1, 'the wearer keeps its own buffs');
assert.equal(dummy.stacks.lucky + dummy.stacks.heat, 2, 'the source removes six opponent buff stacks');
assert.equal(piece._revealed, true);
assert.equal(piece.cooldown, 999, 'the revealed card is deactivated');
assert.equal(next._revealing, true, 'the next chain card is armed');
const manaEvent = events.find((event) => event.type === 'buff' && event.meta?.stack === 'mana');
const activateEvent = events.find((event) => event.type === 'activate' && event.itemId === 'darkest_lotus');
assert.ok(manaEvent && activateEvent);
assert.ok(events.indexOf(activateEvent) > events.indexOf(manaEvent), 'activation follows the source mana/strip effects');

console.log('OK Darkest Lotus source port');
