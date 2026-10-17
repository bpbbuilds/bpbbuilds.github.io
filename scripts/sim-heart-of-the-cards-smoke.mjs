import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/HeartoftheCards.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*for item in inventory\.getItems\(\):[\s\S]*item\.hasType\(Type\.Card\)[\s\S]*connectForCombat\(item, "activated", "onCardRevealed"\)/);
assert.match(source, /func onCardRevealed\(event\):[\s\S]*var card = event\.getOrigin\(\)[\s\S]*giveRegeneration\(regen, event\)[\s\S]*if card\.chainPosition \+ 1 >= chainPosition:[\s\S]*giveMana\(mana, event\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.heart_of_the_cards?.file, 'Exclusive/HeartoftheCards.gd');
assert.equal(getScriptHandler('heart_of_the_cards')?.handlerId, 'heart_of_the_cards');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: 'you',
    kind: id === 'heart_of_the_cards' ? 'skill' : 'card',
    alive: true,
    ...overrides,
  };
}

function context(player, pieces) {
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    events: [],
    t: 5,
    pieces,
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('heart_of_the_cards');
const player = createActor('player', { maxHp: 200 });
const heart = piece('heart_of_the_cards', 'you:heart-of-the-cards');
const card = piece('the_lovers', 'you:card', { _chainPos: 2 });
const ctx = context(player, [heart, card]);
handler.onPrepare(heart, ctx);

// The source listens to every inventory card, not only cards connected by a star.
ctx.bus.emit('piece_activated', { piece: card, t: 5 });
assert.equal(player.stacks.regeneration, 3, 'Heart of the Cards gives source Regeneration on any card activation');
assert.equal(player.stacks.mana, 6, 'Heart of the Cards gives source Mana when the card reaches its chain position');
assert.equal(ctx.events.at(-1)?.itemId, 'heart_of_the_cards', 'Heart of the Cards activates after card effects');

const shortPlayer = createActor('player', { maxHp: 200 });
const shortHeart = piece('heart_of_the_cards', 'you:heart-short');
const shortCard = piece('the_lovers', 'you:card-short', { _chainPos: 1 });
const shortCtx = context(shortPlayer, [shortHeart, shortCard]);
handler.onPrepare(shortHeart, shortCtx);
shortCtx.bus.emit('piece_activated', { piece: shortCard, t: 5 });
assert.equal(shortPlayer.stacks.regeneration, 3);
assert.equal(shortPlayer.stacks.mana, 0, 'Heart of the Cards withholds Mana before the source chain position');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroHeart = piece('heart_of_the_cards', 'you:heart-zero', {
  params: { regen: 0, p1: 0, mana: 0, p2: 0, pos: 0, p3: 0 },
});
const zeroCard = piece('the_lovers', 'you:card-zero', { _chainPos: 0 });
const zeroCtx = context(zeroPlayer, [zeroHeart, zeroCard]);
handler.onPrepare(zeroHeart, zeroCtx);
zeroCtx.bus.emit('piece_activated', { piece: zeroCard, t: 5 });
assert.equal(zeroPlayer.stacks.regeneration, 0, 'Heart of the Cards honors explicit zero Regeneration');
assert.equal(zeroPlayer.stacks.mana, 0, 'Heart of the Cards honors explicit zero Mana');
assert.equal(zeroCtx.events.at(-1)?.itemId, 'heart_of_the_cards', 'Heart of the Cards still activates with zero values');

const otherPlayer = createActor('player', { maxHp: 200 });
const otherHeart = piece('heart_of_the_cards', 'you:heart-other');
const otherCard = piece('the_lovers', 'them:card-other', { side: 'them', _chainPos: 2 });
const otherCtx = context(otherPlayer, [otherHeart, otherCard]);
handler.onPrepare(otherHeart, otherCtx);
otherCtx.bus.emit('piece_activated', { piece: otherCard, t: 5 });
assert.equal(otherPlayer.stacks.regeneration, 0, 'Heart of the Cards ignores the opponent inventory');

console.log('OK Heart of the Cards source-backed inventory-wide card listener, chain threshold, activation ordering, side isolation, and zero parameters');
