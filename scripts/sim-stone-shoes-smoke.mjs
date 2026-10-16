import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StoneShoes.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-armor.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const bindStoneShoes'),
  handlerSource.indexOf('/** WingedBoots.gd', handlerSource.indexOf('const bindStoneShoes')),
);

assert.equal(inventory.byId.stone_shoes?.file, 'Exclusive/StoneShoes.gd');
assert.equal(inventory.byId.stone_shoes?.extends, 'Item');
assert.deepEqual(
  inventory.byId.stone_shoes?.overrides,
  ['onPrepare'],
);
assert.match(source, /^extends Item/);
assert.match(source, /onready var healthThreshold: = getP1\(\) \/ 100\.0 - 0\.0001/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*connectForCombat\(character\(\), "character_damaged"/);
assert.match(source, /func onDamaged\(_damage, event\):[\s\S]*relHealth < healthThreshold[\s\S]*giveLucky\(getP2\(\)[\s\S]*giveEmpower\(getP3\(\)[\s\S]*giveBlock\(getBlock\(\)/);
assert.match(source, /buffTimer\.start\(getP_m\("dur"\)\)/);
assert.match(source, /opponent\(\)\.changeTypedDamageFactor\(DamageSource\.Type\.Ranged, - damReduction\)/);
assert.match(source, /opponent\(\)\.changeEffectDamageFactor\( - damReduction\)/);
assert.match(source, /func onBuffTimeout\(\):[\s\S]*changeTypedDamageFactor\(DamageSource\.Type\.Ranged, damReduction\)/);
assert.match(portBlock, /getP1\(piece\.params, 40\) \/ 100 - 0\.0001/);
assert.match(portBlock, /modifiedParamValue\(/);
assert.match(portBlock, /getP5\(piece\.params, 7\)/);
assert.match(portBlock, /onPrepare: bindStoneShoes/);
assert.match(portBlock, /onCombatStart: bindStoneShoes/);
assert.match(portBlock, /onTick\(piece, ctx\)/);

const shoes = {
  ...byId.get('stone_shoes'),
  itemId: 'stone_shoes',
  placementKey: 'shoes',
  name: 'Stone Shoes',
  kind: 'armor',
  params: { healtht: 70, p1: 70, luck: 1, p2: 1, empower: 1, p3: 1, damreduction: 35, p4: 35, dur: 7, p5: 7 },
  paramMult: { dur: 2 },
  blockGrant: 45,
  alive: true,
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [shoes],
  itemsById: byId,
  events,
  bus,
  t: 2,
};
const handler = getScriptHandler('stone_shoes');
assert.equal(handler?.handlerId, 'stone_shoes');
handler.onPrepare(shoes, ctx);

player.hp = 140;
bus.emit('character_damaged', { actor: player, hit: true, t: 3 });
assert.equal(player.stacks.lucky, 0, 'exactly 70% HP stays above the source strict threshold');
player.hp = 139;
bus.emit('character_damaged', { actor: player, hit: true, t: 3.1 });
assert.equal(player.stacks.lucky, 1);
assert.equal(player.stacks.empower, 1);
assert.equal(player.block, 45, 'activation grants the catalog Block amount');
assert.equal(dummy.rangedDmgFactor, -0.35);
assert.equal(dummy.effectDmgFactor, -0.35);
assert.equal(shoes._stoneUntil, 16, 'duration uses the placement-modified getP_m value');
assert.equal(shoes.alive, false, 'source consumes Stone Shoes after activation');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'stone_shoes'));

handler.onTick(shoes, { ...ctx, t: 15.99 });
assert.equal(dummy.rangedDmgFactor, -0.35);
handler.onTick(shoes, { ...ctx, t: 16 });
assert.equal(dummy.rangedDmgFactor, 0);
assert.equal(dummy.effectDmgFactor, 0);
handler.onTick(shoes, { ...ctx, t: 17 });
assert.equal(dummy.rangedDmgFactor, 0, 'timeout restoration runs only once');

console.log('OK Stone Shoes source, strict health threshold, Lucky/Empower/Block activation, modified duration, typed/effect reduction, consume, and timeout restoration regression');
