import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(
  catalog
    .map((item) => [item.id, { ...item, shape: item.shape || [[1]] }])
    .filter(([id]) => id),
);

const bookSource = inventory.byId.book_of_ice_new;
assert.equal(bookSource.file, 'Exclusive/BookofIce.gd');
assert.equal(bookSource.sceneFile, 'Exclusive/BookofIceNew.tscn');
assert.equal(bookSource.extends, 'Item');
assert.ok(bookSource.overrides.includes('onPrepare'));
assert.ok(bookSource.overrides.includes('doCooldownEffect'));
assert.ok(bookSource.sourceMethods.includes('canAffect'));

const amethystSource = inventory.byId.chipped_amethyst;
assert.equal(amethystSource.file, 'Gems/Amethyst.gd');
assert.equal(amethystSource.sceneFile, 'Gems/ChippedAmethyst.tscn');
assert.equal(amethystSource.extends, 'Gem');
assert.deepEqual(amethystSource.overrides, ['doCooldownEffect']);
assert.deepEqual(amethystSource.sourceMethods, ['prepareWeapon', 'prepareArmor']);

const book = getScriptHandler('book_of_ice_new');
const chipped = getScriptHandler('chipped_amethyst');
assert.equal(book?.handlerId, 'book_of_ice_new');
assert.equal(typeof book?.onPrepare, 'function');
assert.equal(typeof book?.onCooldownEffect, 'function');
assert.equal(chipped?.handlerId, 'chipped_amethyst');
assert.equal(typeof chipped?.onCooldownEffect, 'function');

function piece(id, key, side = 'you') {
  const item = byId.get(id);
  return {
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    kind: id === 'book_of_ice_new' ? 'gadget' : 'gem',
    side,
    alive: true,
    speedScale: 0,
    blockGrant: 0,
  };
}

function withCombatLog(events, dummy, fn) {
  bindBuffCombatLog({ events, getT: () => 5, dummy });
  try {
    return fn();
  } finally {
    unbindBuffCombatLog();
  }
}

// Book of Ice New reuses BookofIce.gd, including its linked-spell speed rule.
const bookPiece = piece('book_of_ice_new', 'book');
const spellPiece = piece('spell_scroll_ice', 'spell');
const graph = {
  pieces: new Map([
    ['book', { key: 'book', id: 'book_of_ice_new', cells: ['0,0'], affectCells: [] }],
    ['spell', { key: 'spell', id: 'spell_scroll_ice', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'book'],
    ['1,0', 'spell'],
  ]),
};
book.onPrepare(bookPiece, {
  graph,
  itemsById: byId,
  pieces: [bookPiece, spellPiece],
  canAffect: null,
});
assert.equal(bookPiece.speedScale, 0.2, 'Book of Ice doubles speed for linked Ice spells');

// The source activates after the mana gate: with mana it spends and chills;
// without mana it still activates but does not spend or inflict Cold.
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const bookCtx = { player, dummy, events, rng: () => 0, t: 5 };
book.onCooldownEffect(bookPiece, bookCtx);
assert.equal(player.stacks.mana, 0);
assert.equal(dummy.stacks.cold, 0);
assert.equal(events.at(-1)?.type, 'activate');
assert.equal(events.at(-1)?.itemId, 'book_of_ice_new');

player.stacks.mana = 1;
events.length = 0;
withCombatLog(events, dummy, () => book.onCooldownEffect(bookPiece, bookCtx));
assert.equal(player.stacks.mana, 0);
assert.equal(dummy.stacks.cold, 2);
const bookSpend = events.findIndex((event) => event.type === 'buff' && event.amount < 0);
const bookCold = events.findIndex((event) => event.type === 'debuff' && event.amount > 0);
const bookActivate = events.findIndex(
  (event) => event.type === 'activate' && event.itemId === 'book_of_ice_new',
);
assert.ok(bookSpend >= 0 && bookCold >= 0 && bookActivate > bookCold);

// The same Book of Ice source path must work for the opponent actor.
const opponentBook = piece('book_of_ice_new', 'opp:book', 'them');
const opponent = createActor('dummy');
const yourActor = createActor('player');
opponent.stacks.mana = 1;
const opponentEvents = [];
withCombatLog(opponentEvents, yourActor, () =>
  book.onCooldownEffect(opponentBook, {
    player: opponent,
    dummy: yourActor,
    events: opponentEvents,
    rng: () => 0,
    t: 5,
  }),
);
assert.equal(opponent.stacks.mana, 0);
assert.equal(yourActor.stacks.cold, 2);
assert.equal(opponentEvents.at(-1)?.actor, 'dummy');

// Chipped Amethyst's inherited Amethyst.gd inventory hook cleanses before
// activating and repeats rather than consuming itself.
const amethystPiece = piece('chipped_amethyst', 'amethyst');
const amethystPlayer = createActor('player');
const amethystDummy = createActor('dummy');
amethystPlayer.stacks.cold = 1;
const amethystEvents = [];
withCombatLog(amethystEvents, amethystDummy, () =>
  chipped.onCooldownEffect(amethystPiece, {
    player: amethystPlayer,
    dummy: amethystDummy,
    events: amethystEvents,
    rng: () => 0,
    t: 5,
  }),
);
assert.equal(amethystPlayer.stacks.cold, 0);
const cleanse = amethystEvents.findIndex((event) => event.type === 'debuff' && event.amount < 0);
const amethystActivate = amethystEvents.findIndex(
  (event) => event.type === 'activate' && event.itemId === 'chipped_amethyst',
);
assert.ok(cleanse >= 0 && amethystActivate > cleanse);
assert.equal(amethystPiece.alive, true);

// Socketed Chipped Amethyst keeps the inherited weapon/armor mode hooks and
// resolves them for both board sides.
const [sword] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'sword', x: 0, y: 0, r: 0, gems: ['chipped_amethyst'] }],
  byId,
);
const socketPlayer = createActor('player');
const socketDummy = createActor('dummy');
socketDummy.stacks.lucky = 1;
const socketBus = createCombatBus();
prepareGemSockets(sword, {
  player: socketPlayer,
  dummy: socketDummy,
  bus: socketBus,
  t: 0,
  itemsById: byId,
  rng: () => 0,
});
socketBus.emit('piece_dealt_damage', { piece: sword, hit: { hit: true, damage: 4 } });
assert.equal(socketDummy.stacks.lucky, 0, 'Chipped Amethyst removes one buff on a hit');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['chipped_amethyst'] }],
  byId,
);
const armorPlayer = createActor('player');
const armorDummy = createActor('dummy');
prepareGemSockets(armor, {
  player: armorPlayer,
  dummy: armorDummy,
  bus: createCombatBus(),
  t: 0,
  itemsById: byId,
});
assert.equal(armorDummy._healAmp, -0.12);

console.log('OK Book of Ice New / Chipped Amethyst focused smoke');
