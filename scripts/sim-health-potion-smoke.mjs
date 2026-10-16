import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/HealthPotion.gd', 'utf8');
const strongSource = fs.readFileSync('tools/game-extract-full/Items/StrongHealthPotion.gd', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const itemsById = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*heal\(getP_m\("heal"\), triggerEvent\)[\s\S]*cleansePoison\(getP3\(\), triggerEvent\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_damaged", "onDamaged"\)/);
assert.match(source, /func onDamaged\(_healthChange, event\):[\s\S]*isEmpty\(\)[\s\S]*getRelativeHealth\(\)[\s\S]*relHealth < healthThreshold[\s\S]*consumePotion\(event\)/);
assert.match(strongSource, /extends "res:\/\/Items\/HealthPotion.gd"/);
assert.match(strongSource, /\.onTriggerPotion\(triggerEvent\)[\s\S]*giveRegeneration\(getP4\(\), triggerEvent\)/);

const handler = getScriptHandler('health_potion');
const strongHandler = getScriptHandler('strong_health_potion');
assert.equal(handler?.handlerId, 'health_potion');
assert.equal(strongHandler?.handlerId, 'strong_health_potion');

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

function makeContext(piece, { playerHp = 100, graph = null, pieces = [piece] } = {}) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 1200 });
  player.hp = playerHp;
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    t: 2,
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

function damageSignal(ctx, overrides = {}) {
  ctx.bus.emit('character_damaged', {
    actor: ctx.player,
    attacker: ctx.dummy,
    t: 2,
    hit: true,
    healthDamage: 0,
    blocked: 12,
    damage: { damage: 12, healthDamage: 0, raw: 12 },
    ...overrides,
  });
}

const normalParams = { p1: 50, heal: 12, p2: 12, p3: 4 };
const normal = makePiece('health_potion', normalParams);
const normalCtx = makeContext(normal, { playerHp: 49 });
normalCtx.player.stacks.poison = 3;
handler.onPrepare(normal, normalCtx);
damageSignal(normalCtx);
assert.equal(normal.alive, false, 'Health Potion empties on a below-threshold blocked hit');
assert.equal(normalCtx.player.hp, 61, 'Health Potion heals by its named heal parameter');
assert.equal(normalCtx.player.stacks.poison, 0, 'Health Potion cleanses its poison amount');
assert.ok(normalCtx.events.some((event) => event.meta?.handler === 'health_potion' && event.type === 'activate'));

const exact = makePiece('health_potion', normalParams, 'exact');
const exactCtx = makeContext(exact, { playerHp: 50 });
handler.onPrepare(exact, exactCtx);
damageSignal(exactCtx);
assert.equal(exact.alive, true, 'Health Potion keeps the source strict below-threshold comparison');

const unrelated = makePiece('health_potion', normalParams, 'unrelated');
const unrelatedCtx = makeContext(unrelated, { playerHp: 40 });
handler.onPrepare(unrelated, unrelatedCtx);
unrelatedCtx.bus.emit('character_damaged', {
  actor: unrelatedCtx.dummy,
  t: 2,
  hit: true,
  healthDamage: 100,
  damage: { damage: 100, healthDamage: 100, raw: 100 },
});
assert.equal(unrelated.alive, true, 'Health Potion ignores the opponent damage signal');

const linked = makePiece('health_potion', normalParams, 'linked_source');
const target = makePiece('health_potion', normalParams, 'linked_target');
target._potionTrigger = () => { target.triggered = (target.triggered || 0) + 1; };
const linkedGraph = {
  pieces: new Map([
    ['linked_source', { key: 'linked_source', id: 'health_potion', cells: ['0,0'], affectCells: [] }],
    ['linked_target', { key: 'linked_target', id: 'health_potion', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'linked_source'],
    ['1,0', 'linked_target'],
  ]),
};
const linkedCtx = makeContext(linked, { playerHp: 40, graph: linkedGraph, pieces: [linked, target] });
handler.onPrepare(linked, linkedCtx);
damageSignal(linkedCtx);
assert.equal(linked.alive, false, 'Consumed Health Potion is empty before its trigger chain');
assert.equal(target.alive, true, 'A linked Potion is not consumed by the source Potion');
assert.equal(target.triggered, 1, 'Health Potion triggers the first linked Potion effect');
assert.ok(linkedCtx.events.some((event) => event.meta?.miniActivate && event.itemId === 'health_potion'));

const strongParams = { p1: 50, heal: 24, cleanse: 4, p3: 4, regen: 3, p4: 3 };
const strong = makePiece('strong_health_potion', strongParams, 'strong');
const strongCtx = makeContext(strong, { playerHp: 40 });
strongCtx.player.stacks.poison = 4;
strong.paramMult = { heal: 2 };
strongHandler.onPrepare(strong, strongCtx);
damageSignal(strongCtx);
assert.equal(strong.alive, false, 'Strong Health Potion consumes at the same threshold');
assert.equal(strongCtx.player.hp, 88, 'Strong Health Potion applies placement-modified heal');
assert.equal(strongCtx.player.stacks.poison, 0, 'Strong Health Potion inherits poison cleansing');
assert.equal(strongCtx.player.stacks.regeneration, 3, 'Strong Health Potion adds Regeneration');

const zero = makePiece('strong_health_potion', { p1: 50, heal: 0, cleanse: 0, p3: 0, regen: 0, p4: 0 }, 'zero');
const zeroCtx = makeContext(zero, { playerHp: 40 });
strongHandler.onPrepare(zero, zeroCtx);
damageSignal(zeroCtx);
assert.equal(zero.alive, false, 'Zero-effect Strong Health Potion still consumes below threshold');
assert.equal(zeroCtx.player.hp, 40, 'Zero heal remains zero');
assert.equal(zeroCtx.player.stacks.regeneration, 0, 'Zero Regeneration remains zero');

console.log('OK Health Potion and Strong Health Potion source ports');
