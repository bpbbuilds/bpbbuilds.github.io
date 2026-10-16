import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/DemonicFlask.gd', 'utf8');
const strongSource = fs.readFileSync('tools/game-extract-full/Items/StrongDemonicFlask.gd', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const itemsById = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};

assert.match(source, /extends Potion/);
assert.match(source, /func canDamage\(\) -> bool:[\s\S]*return true/);
assert.match(source, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*getDebuffStacks\(\)[\s\S]*getP2\(\)[\s\S]*ceil\(dam\)[\s\S]*dealEffectDamage\(dam, triggerEvent\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(opponent\(\), "character_damaged", "onDamaged"\)/);
assert.match(source, /func onDamaged\(healthChange, event\):[\s\S]*isEmpty\(\)[\s\S]*getRelativeHealth\(\) < healthThreshold[\s\S]*drink\(\)[\s\S]*triggerPotion\(event\)[\s\S]*affected\[0\]\.triggerPotion\(event\)[\s\S]*affected\[0\]\.miniActivate\(\)[\s\S]*activate\(\)/);
assert.match(strongSource, /healingReductionTimer\.start\(getP_m\("dur"\)\)/);
assert.match(strongSource, /func onPrepare\(\):[\s\S]*character\(\), "character_damaged", "onPlayerDamaged"[\s\S]*opponent\(\), "character_damaged", "onOpponentDamaged"/);

const normalHandler = getScriptHandler('demonic_flask');
const strongHandler = getScriptHandler('strong_demonic_flask');
assert.equal(normalHandler?.handlerId, 'demonic_flask');
assert.equal(strongHandler?.handlerId, 'strong_demonic_flask');
assert.equal(typeof normalHandler?.onPrepare, 'function');
assert.equal(typeof strongHandler?.onTick, 'function');

function makePiece(itemId, params) {
  return {
    itemId,
    placementKey: itemId,
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

function makeCtx({ piece, playerHp = 200, dummyHp = 1200, graph = null, pieces = [piece] } = {}) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 1200 });
  player.hp = playerHp;
  dummy.hp = dummyHp;
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const events = [];
  const ctx = {
    t: 1,
    player,
    dummy,
    rng: () => 0,
    events,
    graph: graph || { pieces: new Map(), filled: new Map() },
    pieces,
    itemsById,
    canAffect,
    bus,
  };
  return { ctx, player, dummy, bus, events };
}

const normal = makePiece('demonic_flask', { p1: 50, dam: 0.3, p2: 0.3 });
{
  const { ctx, dummy, bus, events } = makeCtx({ piece: normal, dummyHp: 500 });
  dummy.stacks.poison = 4;
  normalHandler.onPrepare(normal, ctx);
  bus.emit('piece_dealt_damage', { actor: dummy, t: 1 });
  assert.equal(normal.alive, true, 'non-canonical piece damage must not trigger the flask');
  bus.emit('character_damaged', { actor: dummy, healthDamage: 1, t: 1 });
  assert.equal(normal.alive, false);
  assert.equal(normal.charges, 0);
  assert.equal(events.find((event) => event.type === 'damage' && event.itemId === 'demonic_flask')?.amount, 2);
}

const zeroDebuffs = makePiece('demonic_flask', { p1: 50, dam: 0.3, p2: 0.3 });
{
  const { ctx, dummy, bus, events } = makeCtx({ piece: zeroDebuffs, dummyHp: 400 });
  normalHandler.onPrepare(zeroDebuffs, ctx);
  bus.emit('character_damaged', { actor: dummy, healthDamage: 1, t: 1 });
  assert.equal(zeroDebuffs.alive, false);
  assert.equal(events.some((event) => event.type === 'damage' && event.itemId === 'demonic_flask' && event.amount > 0), false);
}

const strong = makePiece('strong_demonic_flask', {
  opphpt: 50,
  dam: 0.6,
  p2: 0.6,
  healreduction: 30,
  p3: 30,
  dur: 3,
  p4: 3,
  ownhpt: 25,
  lifesteal: 100,
  p6: 100,
});
{
  const { ctx, player, dummy, bus, events } = makeCtx({ piece: strong, playerHp: 40, dummyHp: 500 });
  strong.paramMult = { dur: 2 };
  dummy.stacks.poison = 4;
  strongHandler.onPrepare(strong, ctx);
  bus.emit('character_damaged', { actor: player, healthDamage: 1, t: 1 });
  assert.equal(strong.alive, false);
  assert.equal(dummy.hp, 497);
  assert.equal(player.hp, 43);
  assert.equal(dummy._healAmp, -0.3);
  strongHandler.onTick(strong, { ...ctx, t: 6.9 });
  assert.equal(dummy._healAmp, -0.3);
  strongHandler.onTick(strong, { ...ctx, t: 7.01 });
  assert.equal(dummy._healAmp, 0);
  assert.ok(events.some((event) => event.type === 'stat' && event.meta?.stat === 'heal_efficiency' && event.amount === -30));
  assert.ok(events.some((event) => event.type === 'stat' && event.meta?.stat === 'heal_efficiency' && event.amount === 30));
}

const linkedFlask = makePiece('demonic_flask', { p1: 50, dam: 0.3, p2: 0.3 });
const linkedHealth = {
  itemId: 'health_potion',
  placementKey: 'health',
  name: 'Health Potion',
  kind: 'consumable',
  side: 'you',
  params: itemsById.get('health_potion').params,
  alive: true,
  charges: 1,
};
const graph = {
  pieces: new Map([
    ['demonic_flask', { id: 'demonic_flask', affectCells: [], cells: ['0,0'] }],
    ['health', { id: 'health_potion', affectCells: [], cells: ['1,0'] }],
  ]),
  filled: new Map([
    ['0,0', 'demonic_flask'],
    ['1,0', 'health'],
  ]),
};
{
  const { ctx, player, dummy, bus } = makeCtx({
    piece: linkedFlask,
    playerHp: 150,
    dummyHp: 500,
    graph,
    pieces: [linkedFlask, linkedHealth],
  });
  dummy.stacks.poison = 4;
  const healthHandler = getScriptHandler('health_potion');
  healthHandler.onPrepare(linkedHealth, ctx);
  normalHandler.onPrepare(linkedFlask, ctx);
  bus.emit('character_damaged', { actor: dummy, healthDamage: 1, t: 1 });
  assert.equal(linkedFlask.alive, false);
  assert.equal(linkedHealth.alive, true, 'triggerPotion must not consume the linked Potion');
  assert.equal(player.hp, 162);
}

console.log('OK Demonic Flask source port');
