import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/StoneSkinPotion.gd', 'utf8');
const strongSource = fs.readFileSync('tools/game-extract-full/Items/StrongStoneSkinPotion.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ak-potions.js', 'utf8');
const portStart = handlerSource.indexOf('function stoneSkinPort');
const portBlock = handlerSource.slice(
  portStart,
  handlerSource.indexOf('\n  };\n}', portStart) + '\n  };\n}'.length,
);

assert.equal(inventory.byId.stone_skin_potion?.file, 'StoneSkinPotion.gd');
assert.equal(inventory.byId.stone_skin_potion?.extends, 'Potion');
assert.deepEqual(inventory.byId.stone_skin_potion?.overrides, ['onTriggerPotion']);
assert.match(source, /^extends Potion/);
assert.match(source, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*healthToBlock\(getP2\(\), getBlock\(\), triggerEvent\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_block_changed"/);
assert.match(source, /func onBlockChanged\(_amount, event\):[\s\S]*isEmpty\(\)[\s\S]*character\(\)\.getBlock\(\) >= getP1\(\)[\s\S]*consumePotion\(\)/);
assert.match(strongSource, /extends "res:\/\/Items\/StoneSkinPotion\.gd"/);
assert.match(strongSource, /giveStacksTemporary\(character\(\), Game\.EventType\.Spikes,[\s\S]*getP_m\("dur"\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(portBlock, /character_block_changed/);
assert.match(portBlock, /triggerFirstAffectedPotion\(piece, ctx, t\)/);
assert.match(portBlock, /modifiedParamValue\(/);
assert.doesNotMatch(portBlock, /onBuffChanged\(ctx\.player/);

const makePotion = (id, placementKey, overrides = {}) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  kind: 'consumable',
  params: byId.get(id)?.params || {},
  blockGrant: Number(byId.get(id)?.block) || 0,
  alive: true,
  charges: null,
  ...overrides,
});

const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const target = makePotion('health_potion', 'target', { _potionTrigger: () => { target.triggered = (target.triggered || 0) + 1; } });
const normal = makePotion('stone_skin_potion', 'normal', {
  params: { p1: 45, p2: 15 },
  blockGrant: 30,
});
const events = [];
const graph = {
  pieces: new Map([
    ['normal', { key: 'normal', id: 'stone_skin_potion', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
    ['target', { key: 'target', id: 'health_potion', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([['1,0', 'target']]),
};
const ctx = {
  player,
  dummy,
  pieces: [normal, target],
  graph,
  itemsById: byId,
  canAffect: { rulesById: { ...canAffectRules.byId, stone_skin_potion: { primary: { op: 'hasType', type: 'Potion' } } } },
  events,
  bus,
  t: 5,
};
const handler = getScriptHandler('stone_skin_potion');
assert.equal(handler?.handlerId, 'stone_skin_potion');
handler.onPrepare(normal, ctx);
assert.equal(normal._cdLocked, true, 'Stone Skin Potion has no independent cooldown loop');
player.hp = 100;
player.block = 44;
grantStacks(player, 'block', 1, { originId: 'test', originKey: 'test' });
assert.equal(player.hp, 85, 'the source p2 health budget is converted to Block');
assert.equal(player.block, 75);
assert.equal(normal.alive, false, 'threshold Block consumes the potion');
assert.equal(target.triggered, 1, 'consumePotion triggers the first affected potion');
assert.ok(events.some((event) => event.meta?.miniActivate && event.itemId === 'health_potion'));
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'stone_skin_potion'));

const strong = makePotion('strong_stone_skin_potion', 'strong', {
  params: { p1: 45, p2: 15, p3: 2, p4: 4 },
  paramMult: { dur: 2 },
  blockGrant: 35,
});
const strongPlayer = createActor('player');
const strongBus = createCombatBus();
strongPlayer._combatBus = strongBus;
const strongCtx = {
  ...ctx,
  player: strongPlayer,
  pieces: [strong],
  graph: { pieces: new Map([['strong', { key: 'strong', id: 'strong_stone_skin_potion', cells: ['0,0'], affectCells: [] }]]), filled: new Map() },
  bus: strongBus,
  events: [],
  t: 2,
};
const strongHandler = getScriptHandler('strong_stone_skin_potion');
strongHandler.onPrepare(strong, strongCtx);
strongPlayer.hp = 100;
strongPlayer.block = 44;
grantStacks(strongPlayer, 'block', 1, { originId: 'test', originKey: 'test' });
assert.equal(strongPlayer.stacks.spikes, 2);
assert.equal(strongPlayer._tempStacks[0].expiresAt, 10, 'strong potion uses placement-modified p4 duration');

console.log('OK Stone Skin Potion source, Block-signal prepare lifecycle, threshold consumption, health-to-Block conversion, chained potion trigger, and strong temporary Spikes duration regression');
