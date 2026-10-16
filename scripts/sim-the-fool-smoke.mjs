import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/TheFool.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-cards.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('const theFoolPort'),
  handlerSource.indexOf('const theLoversPort'),
);

assert.equal(inventory.byId.the_fool?.file, 'TheFool.gd');
assert.deepEqual(inventory.byId.the_fool?.overrides, ['doRevealEffect']);
assert.match(source, /func cardSecondaryEffectActive\(\):[\s\S]*return chainPosition == 0/);
assert.match(source, /func doRevealEffect\(\):[\s\S]*card\.addSpeed\(bonusSpeed\)[\s\S]*cardSecondaryEffectActive\(\)[\s\S]*giveEmpower\(getP\("empower"\)\)[\s\S]*activate\(\)/);
assert.match(port, /chainCards\(ctx, piece\)/);
assert.match(port, /addSpeed\(o, spd\)/);
assert.match(port, /Math\.max\(0, Math\.round\(getPName\(piece\.params, 'empower'/);
assert.match(port, /pushActivate\(piece, ctx, 'the_fool'/);

const fool = {
  itemId: 'the_fool',
  placementKey: 'fool',
  name: 'The Fool',
  params: { revealspeed: 50, p1: 50, empower: 1, p2: 1 },
  speedScale: 0,
  _deckKey: 'deck',
  _chainPos: 0,
};
const linkedCard = {
  itemId: 'the_lovers',
  placementKey: 'linked-card',
  name: 'The Lovers',
  speedScale: 0,
  _deckKey: 'deck',
  _chainPos: 1,
};
const unrelatedCard = {
  itemId: 'the_lovers',
  placementKey: 'unrelated-card',
  name: 'Unrelated Card',
  speedScale: 0,
  _deckKey: 'other-deck',
  _chainPos: 0,
};
const deck = { itemId: 'deck_of_cards', placementKey: 'deck', _cards: [fool, linkedCard] };
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [deck, fool, linkedCard, unrelatedCard],
  events,
  t: 2,
  rng: () => 0,
};
const runtime = getScriptHandler('the_fool');
assert.equal(runtime?.handlerId, 'the_fool');
runtime.onRevealEffect(fool, ctx);
assert.equal(fool.speedScale, 0.5, 'The Fool speeds itself as a card in its deck');
assert.equal(linkedCard.speedScale, 0.5, 'The Fool speeds every card in its deck');
assert.equal(unrelatedCard.speedScale, 0, 'The Fool does not speed cards in another deck');
assert.equal(player.stacks.empower, 1, 'The Fool grants Empower for chain position zero');
assert.equal(events.at(-1)?.type, 'activate', 'The Fool activates after its reveal effect');

const zeroFool = {
  ...fool,
  placementKey: 'zero-fool',
  params: { revealspeed: 50, p1: 50, empower: 0, p2: 0 },
  _deckKey: 'zero-deck',
  _chainPos: 0,
};
const zeroDeck = { itemId: 'deck_of_cards', placementKey: 'zero-deck', _cards: [zeroFool] };
const zeroPlayer = createActor('player');
const zeroCtx = { ...ctx, player: zeroPlayer, pieces: [zeroDeck, zeroFool], events: [] };
runtime.onRevealEffect(zeroFool, zeroCtx);
assert.equal(zeroPlayer.stacks.empower, 0, 'The Fool preserves a zero Empower parameter');

console.log('OK The Fool source, deck-scoped speed, chain-position Empower, zero-safe values, and reveal activation regression');
