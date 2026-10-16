import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(
  catalog
    .map((item) => [item.id, { ...item, shape: item.shape || [[1]] }])
    .filter(([id]) => id),
);

const expectedSources = {
  book_of_basics: 'Exclusive/BookofBasics.gd',
  book_of_darkness: 'Exclusive/BookofDarkness.gd',
  book_of_ice: 'Exclusive/BookofIce.gd',
  book_of_ice_new: 'Exclusive/BookofIce.gd',
  book_of_light: 'Exclusive/BookofLight.gd',
  book_of_nature: 'Exclusive/BookofNature.gd',
};
for (const [id, file] of Object.entries(expectedSources)) {
  assert.equal(inventory.byId[id].file, file);
  assert.ok(inventory.byId[id].overrides.includes('onPrepare'));
  assert.ok(inventory.byId[id].overrides.includes('doCooldownEffect'));
}

function item(id, key, side = 'you', extra = {}) {
  const source = byId.get(id);
  return {
    itemId: id,
    placementKey: key,
    name: source?.name || id,
    params: source?.params || {},
    side,
    alive: true,
    speedScale: 0,
    kind: 'gadget',
    ...extra,
  };
}

function graphFor(bookId, spellIds) {
  const pieces = new Map([
    ['book', { key: 'book', id: bookId, cells: ['0,0'], affectCells: [] }],
  ]);
  const filled = new Map([['0,0', 'book']]);
  for (const [index, id] of spellIds.entries()) {
    const key = `spell${index}`;
    pieces.set(key, { key, id, cells: [`${index + 1},0`], affectCells: [] });
    filled.set(`${index + 1},0`, key);
  }
  return { pieces, filled };
}

function context(player, dummy, events, graph, pieces) {
  return {
    player,
    dummy,
    events,
    graph,
    pieces,
    itemsById: byId,
    canAffect: null,
    rng: () => 0,
    t: 5,
  };
}

for (const id of Object.keys(expectedSources)) {
  const handler = getScriptHandler(id);
  assert.equal(handler?.handlerId, id);
  assert.equal(typeof handler?.onPrepare, 'function');
  assert.equal(typeof handler?.onCooldownEffect, 'function');
}

// Every Book source uses onPrepare for linked spell speed. Book of Basics also
// caches its crafted/non-crafted spell health factor at that lifecycle point.
const basics = getScriptHandler('book_of_basics');
const craftedSpell = { ...byId.get('spell_scroll_ice'), crafted: true };
const bookBasicsItems = new Map(byId);
bookBasicsItems.set('spell_scroll_ice', craftedSpell);
const basicsPiece = item('book_of_basics', 'book');
const basicsSpell = item('spell_scroll_ice', 'spell0');
const basicsGraph = graphFor('book_of_basics', ['spell_scroll_ice']);
basics.onPrepare(basicsPiece, {
  graph: basicsGraph,
  itemsById: bookBasicsItems,
  pieces: [basicsPiece, basicsSpell],
  canAffect: null,
});
assert.equal(basicsPiece._bookSpellFactor, 2);
const basicsPlayer = createActor('player');
basicsPlayer.stacks.mana = 1;
const basicsEvents = [];
basics.onCooldownEffect(
  basicsPiece,
  context(basicsPlayer, createActor('dummy'), basicsEvents, basicsGraph, [basicsPiece, basicsSpell]),
);
assert.equal(basicsPlayer.stacks.mana, 0);
assert.equal(basicsPlayer.maxHp, 214);
assert.ok(basicsEvents.some((event) => event.type === 'activate' && event.itemId === 'book_of_basics'));
assert.equal(basicsEvents.find((event) => event.type === 'heal')?.target, 'player');
assert.ok(
  basicsEvents.findIndex((event) => event.type === 'activate') >
    basicsEvents.findIndex((event) => event.type === 'heal'),
);

// Book of Ice and its New scene alias share BookofIce.gd: mana gates Cold,
// but activation itself is unconditional.
for (const id of ['book_of_ice', 'book_of_ice_new']) {
  const book = getScriptHandler(id);
  const piece = item(id, 'book');
  const spell = item('spell_scroll_ice', 'spell0');
  const graph = graphFor(id, ['spell_scroll_ice']);
  book.onPrepare(piece, { graph, itemsById: byId, pieces: [piece, spell], canAffect: null });
  assert.equal(piece.speedScale, 0.2);
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  book.onCooldownEffect(piece, context(player, dummy, events, graph, [piece, spell]));
  assert.equal(dummy.stacks.cold, 0);
  assert.equal(events.at(-1).type, 'activate');
  player.stacks.mana = 1;
  book.onCooldownEffect(piece, context(player, dummy, events, graph, [piece, spell]));
  assert.equal(player.stacks.mana, 0);
  assert.equal(dummy.stacks.cold, 2);
}

const darkness = getScriptHandler('book_of_darkness');
const darknessPiece = item('book_of_darkness', 'book');
const darknessSpell = item('spell_scroll_dark', 'spell0');
const darknessGraph = graphFor('book_of_darkness', ['spell_scroll_dark']);
darkness.onPrepare(darknessPiece, {
  graph: darknessGraph,
  itemsById: byId,
  pieces: [darknessPiece, darknessSpell],
  canAffect: null,
});
assert.equal(darknessPiece.speedScale, 0.2);
const darkPlayer = createActor('player');
const darkDummy = createActor('dummy');
const darkEvents = [];
darkness.onCooldownEffect(darknessPiece, context(darkPlayer, darkDummy, darkEvents, darknessGraph, []));
assert.equal(darkPlayer.hp, 192);
assert.equal(darkPlayer.stacks.mana, 3);
assert.equal(darkDummy.stacks.blind, 1);
assert.equal(darkEvents.find((event) => event.type === 'damage')?.amount, 8);
assert.ok(
  darkEvents.findIndex((event) => event.type === 'activate') >
    darkEvents.findIndex((event) => event.type === 'damage'),
);
darkPlayer.hp = 8;
darkness.onCooldownEffect(darknessPiece, context(darkPlayer, darkDummy, darkEvents, darknessGraph, []));
assert.equal(darkPlayer.hp, 8, 'Book of Darkness does not spend lethal health');

const light = getScriptHandler('book_of_light');
const lightPiece = item('book_of_light', 'book');
const lightSpell = item('spell_scroll_light', 'spell0');
const lightGraph = graphFor('book_of_light', ['spell_scroll_light']);
light.onPrepare(lightPiece, {
  graph: lightGraph,
  itemsById: byId,
  pieces: [lightPiece, lightSpell],
  canAffect: null,
});
assert.equal(lightPiece.speedScale, 0.2);
const lightPlayer = createActor('player');
lightPlayer.hp = 150;
lightPlayer.stacks.mana = 1;
const lightDummy = createActor('dummy');
const lightEvents = [];
light.onCooldownEffect(lightPiece, context(lightPlayer, lightDummy, lightEvents, lightGraph, []));
assert.equal(lightPlayer.stacks.mana, 0);
assert.equal(lightPlayer.stacks.regeneration, 1);
assert.equal(lightPlayer.hp, 162);
assert.equal(lightEvents.find((event) => event.type === 'heal')?.amount, 12);
assert.ok(
  lightEvents.findIndex((event) => event.type === 'activate') >
    lightEvents.findIndex((event) => event.type === 'heal'),
);

const nature = getScriptHandler('book_of_nature');
const naturePiece = item('book_of_nature', 'book');
const natureSpell = item('spell_scroll_nature', 'spell0');
const natureGraph = graphFor('book_of_nature', ['spell_scroll_nature']);
nature.onPrepare(naturePiece, {
  graph: natureGraph,
  itemsById: byId,
  pieces: [naturePiece, natureSpell],
  canAffect: null,
});
assert.equal(naturePiece.speedScale, 0.2);
const naturePlayer = createActor('player');
naturePlayer.stacks.regeneration = 1;
const natureDummy = createActor('dummy');
const natureEvents = [];
nature.onCooldownEffect(naturePiece, context(naturePlayer, natureDummy, natureEvents, natureGraph, []));
assert.equal(naturePlayer.stacks.regeneration, 0);
assert.equal(naturePlayer.stacks.lucky, 1);
assert.equal(naturePlayer.stacks.spikes, 2);

console.log('OK Book Basics / Darkness / Ice / Light / Nature focused smoke');
