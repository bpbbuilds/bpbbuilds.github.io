import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor, tryUseStamina } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/HeroicPotion.gd', 'utf8');
const strongScene = fs.readFileSync('tools/game-extract-full/Items/StrongHeroicPotion.tscn', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const itemsById = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /extends Potion/);
assert.match(source, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*giveStamina\(getP1\(\), triggerEvent\)[\s\S]*giveEmpower\(getP2\(\), triggerEvent\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_pre_use_stamina", "checkStamina"\)/);
assert.match(source, /func checkStamina\(amount\):[\s\S]*isEmpty\(\)[\s\S]*getCurrentStamina\(\) < amount[\s\S]*consumePotion\(\)/);
assert.match(strongScene, /ext_resource path="res:\/\/Items\/HeroicPotion\.gd" type="Script"/);

const handler = getScriptHandler('heroic_potion');
const strongHandler = getScriptHandler('strong_heroic_potion');
assert.equal(handler?.handlerId, 'heroic_potion');
assert.equal(strongHandler?.handlerId, 'strong_heroic_potion');
assert.equal(typeof handler?.onPrepare, 'function', 'Heroic Potion binds its source preparation hook');
assert.equal(typeof strongHandler?.onPrepare, 'function', 'Strong Heroic Potion inherits the source preparation hook');

function makePiece(itemId, params, key = itemId) {
  return {
    itemId,
    placementKey: key,
    name: itemsById.get(itemId)?.name || itemId,
    kind: 'consumable',
    side: 'you',
    params,
    alive: true,
    charges: 1,
    cooldown: 999,
    triggerTime: 999,
  };
}

function makeContext(piece, { stamina = 0, graph = null, pieces = [piece] } = {}) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  player.stamina = stamina;
  player._simT = 5;
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    t: 5,
    player,
    dummy,
    events: [],
    bus,
    graph: graph || { pieces: new Map(), filled: new Map() },
    pieces,
    itemsById,
    canAffect: () => true,
  };
}

const normal = makePiece('heroic_potion', { p1: 2, p2: 1, p3: 1 });
const normalCtx = makeContext(normal);
handler.onPrepare(normal, normalCtx);
assert.equal(tryUseStamina(normalCtx.player, 2), 'ok', 'Heroic Potion refills a starving stamina use');
assert.equal(normalCtx.player.stamina, 0, 'the original stamina use happens after the potion effect');
assert.equal(normalCtx.player.stacks.empower, 1, 'Heroic Potion grants p2 Empower');
assert.equal(normal.alive, false, 'Heroic Potion is consumed once it prevents starvation');
assert.ok(normalCtx.events.some((event) => event.type === 'activate' && event.itemId === 'heroic_potion'));

const exact = makePiece('heroic_potion', { p1: 2, p2: 1 }, 'exact');
const exactCtx = makeContext(exact, { stamina: 2 });
handler.onPrepare(exact, exactCtx);
assert.equal(tryUseStamina(exactCtx.player, 2), 'ok');
assert.equal(exact.alive, true, 'Heroic Potion keeps the source strict below-stamina comparison');
assert.equal(exactCtx.player.stamina, 0);

const linked = makePiece('heroic_potion', { p1: 2, p2: 1 }, 'linked_source');
const target = makePiece('heroic_potion', { p1: 2, p2: 1 }, 'linked_target');
target._potionTrigger = () => { target.triggered = (target.triggered || 0) + 1; };
const linkedGraph = {
  pieces: new Map([
    ['linked_source', { key: 'linked_source', id: 'heroic_potion', cells: ['0,0'], affectCells: [] }],
    ['linked_target', { key: 'linked_target', id: 'heroic_potion', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'linked_source'],
    ['1,0', 'linked_target'],
  ]),
};
const linkedCtx = makeContext(linked, { graph: linkedGraph, pieces: [linked, target] });
handler.onPrepare(linked, linkedCtx);
tryUseStamina(linkedCtx.player, 2);
assert.equal(linked.alive, false, 'Linked source Heroic Potion is consumed');
assert.equal(target.alive, true, 'Linked Potion is not consumed by the source Potion');
assert.equal(target.triggered, 1, 'Heroic Potion triggers the first linked Potion effect');
assert.ok(linkedCtx.events.some((event) => event.meta?.miniActivate && event.itemId === 'heroic_potion'));

const strong = makePiece('strong_heroic_potion', { p1: 4, p2: 1, p3: 1 }, 'strong');
const strongCtx = makeContext(strong);
strongHandler.onPrepare(strong, strongCtx);
assert.equal(tryUseStamina(strongCtx.player, 4), 'ok', 'Strong Heroic Potion refills its source p1 stamina use');
assert.equal(strongCtx.player.stamina, 0);
assert.equal(strongCtx.player.stacks.empower, 1);
assert.equal(strongCtx.player.stacks.lucky, 0, 'Strong Heroic Potion does not invent an unused p3 Lucky effect');
assert.equal(strong.alive, false);

const zero = makePiece('heroic_potion', { p1: 0, p2: 0 }, 'zero');
const zeroCtx = makeContext(zero);
zeroHandler();

function zeroHandler() {
  handler.onPrepare(zero, zeroCtx);
  zeroCtx.bus.emit('pre_use_stamina', { actor: zeroCtx.player, amount: 1, t: 5 });
}

assert.equal(zero.alive, false, 'Zero-effect Heroic Potion still consumes on starvation');
assert.equal(zeroCtx.player.stamina, 0);
assert.equal(zeroCtx.player.stacks.empower, 0);

console.log('OK Heroic Potion and Strong Heroic Potion source ports');
