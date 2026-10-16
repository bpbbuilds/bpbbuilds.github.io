import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/Reverse.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ao-cards.js',
  'utf8',
);
const reversePort = port.slice(
  port.indexOf('const reversePort'),
  port.indexOf('const holoFireLizardPort', port.indexOf('const reversePort')),
);

assert.match(source, /extends Card/);
assert.match(source, /func cardSecondaryEffectActive\(\):[\s\S]*deck\.countDuplicates\(chainPosition\) == 0/);
assert.match(
  source,
  /func doRevealEffect\(\):[\s\S]*giveReflectStacks\(getP\("reflect"\)\)[\s\S]*stealRandomBuff\(getP\("steal"\)\)[\s\S]*activate\(\)/,
);
assert.match(reversePort, /getPName\(piece\.params, 'reflect', getP1\(piece\.params, 0\)\)/);
assert.match(reversePort, /getPName\(piece\.params, 'steal', getP2\(piece\.params, 0\)\)/);
assert.match(reversePort, /secondaryOn\(piece, ctx\)/);

function item(id, overrides = {}) {
  const base = byId.get(id);
  assert.ok(base, `catalog item ${id} exists`);
  return {
    ...base,
    ...overrides,
    itemId: id,
    placementKey: overrides.placementKey || id,
    alive: true,
  };
}

function context(piece, cards, params = piece.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  grantStacks(dummy, 'lucky', 3);
  const events = [];
  const deck = { itemId: 'deck_of_cards', placementKey: 'deck', _cards: cards };
  piece.params = params;
  piece._deckKey = 'deck';
  const ctx = {
    player,
    dummy,
    pieces: [deck, ...cards],
    itemsById: byId,
    events,
    t: 5,
    rng: () => 0,
  };
  return { ctx, player, dummy, events };
}

const handler = getScriptHandler('reverse');
assert.equal(handler?.handlerId, 'reverse');

const primary = item('reverse', {
  placementKey: 'reverse-primary',
  params: { reflect: 3, p1: 3, steal: 2, p2: 2 },
  _chainPos: 0,
});
const primaryRun = context(primary, [primary]);
handler.onRevealEffect(primary, primaryRun.ctx);
assert.equal(primaryRun.player.debuffReflectStacks, 3, 'primary Reverse gives the named reflect amount');
assert.equal(primaryRun.player.stacks.lucky, 2, 'primary Reverse steals the named number of buffs');
assert.equal(primaryRun.dummy.stacks.lucky, 1);
assert.equal(primaryRun.events.at(-1)?.type, 'activate', 'Reverse activates after reveal effects');

const duplicate = item('reverse', {
  placementKey: 'reverse-duplicate',
  params: { reflect: 3, p1: 3, steal: 2, p2: 2 },
  _chainPos: 2,
});
const first = item('reverse', { placementKey: 'reverse-first', _chainPos: 0 });
const second = item('reverse', { placementKey: 'reverse-second', _chainPos: 1 });
const duplicateRun = context(duplicate, [first, second, duplicate]);
handler.onRevealEffect(duplicate, duplicateRun.ctx);
assert.equal(duplicateRun.player.debuffReflectStacks, 3, 'duplicate Reverse still gives reflect');
assert.equal(duplicateRun.player.stacks.lucky, 0, 'duplicate Reverse skips the secondary steal');
assert.equal(duplicateRun.dummy.stacks.lucky, 3);

const sparse = item('reverse', {
  placementKey: 'reverse-sparse',
  params: {},
  _chainPos: 0,
});
const sparseRun = context(sparse, [sparse]);
handler.onRevealEffect(sparse, sparseRun.ctx);
assert.equal(sparseRun.player.debuffReflectStacks, 0, 'missing reflect does not fabricate stacks');
assert.equal(sparseRun.player.stacks.lucky, 0, 'missing steal does not fabricate a steal');
assert.equal(sparseRun.dummy.stacks.lucky, 3);

console.log('OK Reverse source and handler regression');
