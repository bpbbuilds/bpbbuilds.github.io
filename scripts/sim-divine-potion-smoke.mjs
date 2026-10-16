import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { BUFF_KEYS, grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DivinePotion.gd', 'utf8');
const strongSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StrongDivinePotion.gd', 'utf8');
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

const row = inventory.byId.divine_potion;
assert.ok(row, 'Divine Potion has a source inventory row');
assert.equal(row.file, 'Exclusive/DivinePotion.gd');
assert.equal(row.extends, 'Potion');
assert.deepEqual(row.overrides, ['onTriggerPotion']);
assert.match(source, /func onPrepare\(\):[\s\S]*connectToCharacterDebuffs\("debuffsChanged"\)/);
assert.match(source, /func debuffsChanged\(_amount, event\):[\s\S]*isEmpty\(\)[\s\S]*getDebuffStacks\(\) >= debuffsNeeded[\s\S]*consumePotion\(\)/);
assert.match(source, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*cleanseRandomDebuffs\(getP2\(\)\)/);
assert.match(strongSource, /\.onTriggerPotion\(triggerEvent\)[\s\S]*giveRandomBuffs\(getP3\(\)\)/);

const handler = getScriptHandler('divine_potion');
const strongHandler = getScriptHandler('strong_divine_potion');
assert.equal(handler?.handlerId, 'divine_potion');
assert.equal(strongHandler?.handlerId, 'strong_divine_potion');

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

function makeContext(piece, { playerHp = 200, graph = null, pieces = [piece] } = {}) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 1200 });
  player.hp = playerHp;
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    t: 1,
    player,
    dummy,
    events: [],
    rng: () => 0,
    bus,
    graph: graph || { pieces: new Map(), filled: new Map() },
    pieces,
    itemsById,
    canAffect,
  };
}

const params = { debufft: 2, p1: 2, cleanses: 2, p2: 2 };
const normal = makePiece('divine_potion', params);
const normalCtx = makeContext(normal);
normalCtx.player.stacks.poison = 2;
handler.onPrepare(normal, normalCtx);
grantStacks(normalCtx.player, 'blind', 2, { opponent: normalCtx.dummy, originId: normal.itemId });
assert.equal(normal.alive, false);
assert.equal(normalCtx.player.stacks.poison + normalCtx.player.stacks.blind, 2);

const strong = makePiece('strong_divine_potion', { debufft: 2, p1: 2, cleanses: 2, p2: 2, buffs: 3, p3: 3 });
const strongCtx = makeContext(strong);
strongCtx.player.stacks.poison = 2;
strongHandler.onPrepare(strong, strongCtx);
grantStacks(strongCtx.player, 'blind', 2, { opponent: strongCtx.dummy, originId: strong.itemId });
assert.equal(strong.alive, false);
assert.equal(strongCtx.player.stacks.poison + strongCtx.player.stacks.blind, 2);
assert.equal(BUFF_KEYS.reduce((total, key) => total + (strongCtx.player.stacks[key] || 0), 0), 3);

const zero = makePiece('divine_potion', { debufft: 0, p1: 0, cleanses: 0, p2: 0 });
const zeroCtx = makeContext(zero);
zeroCtx.player.stacks.poison = 2;
handler.onPrepare(zero, zeroCtx);
grantStacks(zeroCtx.player, 'blind', 1, { opponent: zeroCtx.dummy, originId: zero.itemId });
assert.equal(zero.alive, false, 'zero threshold still consumes on the first debuff change');
assert.equal(zeroCtx.player.stacks.poison + zeroCtx.player.stacks.blind, 3);

const linked = makePiece('divine_potion', params, 'linked_divine');
const health = makePiece('health_potion', itemsById.get('health_potion').params, 'linked_health');
const linkedGraph = {
  pieces: new Map([
    ['linked_divine', { id: 'divine_potion', affectCells: [], cells: ['0,0'] }],
    ['linked_health', { id: 'health_potion', affectCells: [], cells: ['1,0'] }],
  ]),
  filled: new Map([
    ['0,0', 'linked_divine'],
    ['1,0', 'linked_health'],
  ]),
};
const linkedCtx = makeContext(linked, { playerHp: 150, graph: linkedGraph, pieces: [linked, health] });
const healthHandler = getScriptHandler('health_potion');
healthHandler.onPrepare(health, linkedCtx);
linkedCtx.player.stacks.poison = 2;
handler.onPrepare(linked, linkedCtx);
grantStacks(linkedCtx.player, 'blind', 2, { opponent: linkedCtx.dummy, originId: linked.itemId });
assert.equal(linked.alive, false);
assert.equal(health.alive, true, 'linked Potion trigger does not consume the target');
assert.equal(linkedCtx.player.hp, 162);

console.log('OK Divine Potion source port');
