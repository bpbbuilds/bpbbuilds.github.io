import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { useMana } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/ManaPotion.gd', 'utf8');
const strongScene = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StrongManaPotion.tscn', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const itemsById = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /onready var healthThreshold: = getP1\(\) \/ 100\.0 - 0\.0001/);
assert.match(source, /func onTriggerPotion\(event = null\):[\s\S]*giveMana\(getP2\(\), event\)[\s\S]*giveMaxHealth\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_mana_changed", "onManaChanged"\)[\s\S]*connectForCombat\(character\(\), "character_damaged", "onDamaged"\)/);
assert.match(source, /func onDamaged\(_healthChange, event\):[\s\S]*relHealth < healthThreshold[\s\S]*consumePotion\(event\)/);
assert.match(source, /func onManaChanged\(amount, event\):[\s\S]*amount < 0[\s\S]*event\.getOrigin\(\) is Item[\s\S]*event\.getOrigin\(\)\.character\(\) == character\(\)[\s\S]*consumePotion\(event\)/);
assert.match(strongScene, /ext_resource path="res:\/\/Items\/ManaPotion\.gd" type="Script"/);

const handler = getScriptHandler('mana_potion');
const strongHandler = getScriptHandler('strong_mana_potion');
assert.equal(handler?.handlerId, 'mana_potion');
assert.equal(strongHandler?.handlerId, 'strong_mana_potion');

function makePiece(itemId, params, key = itemId, side = 'you') {
  return {
    itemId,
    placementKey: key,
    name: itemsById.get(itemId)?.name || itemId,
    kind: 'consumable',
    side,
    params,
    alive: true,
    charges: 1,
    cooldown: 999,
    triggerTime: 999,
  };
}

function makeContext(piece, { playerHp = 100, mana = 0, graph = null, pieces = [piece] } = {}) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy');
  player.hp = playerHp;
  player.stacks.mana = mana;
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    t: 3,
    player,
    dummy,
    events: [],
    bus,
    graph: graph || { pieces: new Map(), filled: new Map() },
    pieces,
    itemsById,
    rng: () => 0,
  };
}

const normalParams = { p1: 50, mana: 4, p2: 4, maxhealth: 18, p3: 18 };
const normal = makePiece('mana_potion', normalParams);
const normalCtx = makeContext(normal, { playerHp: 49, mana: 2 });
handler.onPrepare(normal, normalCtx);
normalCtx.bus.emit('character_damaged', {
  actor: normalCtx.player,
  hit: true,
  healthDamage: 0,
  t: 3,
});
assert.equal(normal.alive, false, 'Mana Potion consumes on a below-threshold blocked hit');
assert.equal(normalCtx.player.stacks.mana, 6, 'Mana Potion grants source p2 Mana');
assert.equal(normalCtx.player.maxHp, 118, 'Mana Potion grants source p3 max health');
assert.equal(normalCtx.player.hp, 67, 'Mana Potion also increases current HP with max health');

const exact = makePiece('mana_potion', normalParams, 'exact');
const exactCtx = makeContext(exact, { playerHp: 50 });
handler.onPrepare(exact, exactCtx);
exactCtx.bus.emit('character_damaged', { actor: exactCtx.player, hit: true, healthDamage: 1, t: 3 });
assert.equal(exact.alive, true, 'Mana Potion preserves the source threshold minus 0.0001');

const spend = makePiece('mana_potion', normalParams, 'spend');
const spell = makePiece('book_of_ice', itemsById.get('book_of_ice')?.params || {}, 'spell');
const spendCtx = makeContext(spend, { mana: 5, pieces: [spend, spell] });
handler.onPrepare(spend, spendCtx);
assert.equal(useMana(spendCtx.player, 1, { originKey: spell.placementKey, originId: spell.itemId }).spent, 1);
assert.equal(spend.alive, false, 'Mana Potion consumes on an own item-originated mana spend');
assert.equal(spendCtx.player.stacks.mana, 8, 'Mana Potion replenishes after the triggering spend');

const noOrigin = makePiece('mana_potion', normalParams, 'no-origin');
const noOriginCtx = makeContext(noOrigin, { mana: 5 });
handler.onPrepare(noOrigin, noOriginCtx);
useMana(noOriginCtx.player, 1);
assert.equal(noOrigin.alive, true, 'Mana Potion ignores mana changes without an Item origin');

const linked = makePiece('mana_potion', normalParams, 'linked_source');
const target = makePiece('mana_potion', normalParams, 'linked_target');
target._potionTrigger = () => { target.triggered = (target.triggered || 0) + 1; };
const linkedGraph = {
  pieces: new Map([
    ['linked_source', { key: 'linked_source', id: 'mana_potion', cells: ['0,0'], affectCells: [] }],
    ['linked_target', { key: 'linked_target', id: 'mana_potion', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'linked_source'],
    ['1,0', 'linked_target'],
  ]),
};
const linkedCtx = makeContext(linked, { playerHp: 40, graph: linkedGraph, pieces: [linked, target] });
handler.onPrepare(linked, linkedCtx);
linkedCtx.bus.emit('character_damaged', { actor: linkedCtx.player, hit: true, healthDamage: 1, t: 3 });
assert.equal(target.alive, true, 'Linked Mana Potion is not consumed by the source Potion');
assert.equal(target.triggered, 1, 'Mana Potion triggers the first linked Potion effect');
assert.ok(linkedCtx.events.some((event) => event.meta?.miniActivate && event.itemId === 'mana_potion'));

const strong = makePiece('strong_mana_potion', { p1: 50, mana: 9, p2: 9, maxhealth: 25, p3: 25 }, 'strong');
strong.paramMult = { maxhealth: 2 };
const strongCtx = makeContext(strong, { playerHp: 40 });
strongHandler.onPrepare(strong, strongCtx);
strongCtx.bus.emit('character_damaged', { actor: strongCtx.player, hit: true, healthDamage: 1, t: 3 });
assert.equal(strong.alive, false, 'Strong Mana Potion consumes at the source threshold');
assert.equal(strongCtx.player.stacks.mana, 9, 'Strong Mana Potion grants source p2 Mana');
assert.equal(strongCtx.player.maxHp, 150, 'Strong Mana Potion applies placement-modified max health');
assert.equal(strongCtx.player.hp, 90, 'Strong Mana Potion applies current health with max-health gain');

const zero = makePiece('mana_potion', { p1: 50, mana: 0, p2: 0, maxhealth: 0, p3: 0 }, 'zero');
const zeroCtx = makeContext(zero, { playerHp: 40 });
handler.onPrepare(zero, zeroCtx);
zeroCtx.bus.emit('character_damaged', { actor: zeroCtx.player, hit: true, healthDamage: 0, t: 3 });
assert.equal(zero.alive, false, 'Zero-effect Mana Potion still consumes below threshold');
assert.equal(zeroCtx.player.maxHp, 100);

console.log('OK Mana Potion and Strong Mana Potion source ports');
