import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StoneArmor.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-threshold.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const stoneArmorPort'),
  handlerSource.indexOf('/**\n * Item.healthToBlock', handlerSource.indexOf('export const stoneArmorPort')),
);
const cooldownBlock = portBlock.slice(portBlock.indexOf('onCooldownEffect(piece, ctx)'));

assert.equal(inventory.byId.stone_armor?.file, 'Exclusive/StoneArmor.gd');
assert.equal(inventory.byId.stone_armor?.extends, 'Item');
assert.deepEqual(
  inventory.byId.stone_armor?.overrides,
  ['doCooldownEffect', 'onCombatStart', 'onPrepare'],
);
assert.match(source, /^extends Item/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_damaged"/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveBlock\(\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*loseSpikes\(spikeRemoval, self\)[\s\S]*loseEmpower\(empowerRemoval, self\)[\s\S]*activate\(\)/);
assert.match(source, /func onDamaged\(_healthChange, event\):[\s\S]*relHealth < healthThreshold[\s\S]*giveBlock\(bl, true, event\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(portBlock, /getPName\(piece\.params, 'staminacost', getP4\(/);
assert.match(portBlock, /getPName\(piece\.params, 'healtht', getP3\(/);
assert.match(portBlock, /onCombatStart\(piece, ctx\)/);
assert.match(portBlock, /pushActivate\(piece, ctx, 'stone_armor'/);
assert.match(portBlock, /onCooldownEffect\(piece, ctx\)/);
assert.ok(
  cooldownBlock.indexOf("loseStacks(dummy, 'spikes'") < cooldownBlock.indexOf("pushActivate(piece, ctx, 'stone_armor'"),
  'Stone Armor removes debuffs before activating',
);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(missing/);

const stone = {
  ...byId.get('stone_armor'),
  itemId: 'stone_armor',
  placementKey: 'stone',
  name: 'Stone Armor',
  kind: 'armor',
  params: { p1: 1, p2: 2, p3: 50, p4: 20, p5: 40 },
  blockGrant: 120,
  staminaCost: 0,
};
const weapon = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  name: 'Wooden Sword',
  kind: 'weapon',
  staminaCost: 2,
  baseStaminaCost: 2,
  staminaFactor: 1,
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
  pieces: [stone, weapon],
  itemsById: byId,
  events,
  bus,
  t: 3,
};
const handler = getScriptHandler('stone_armor');
assert.equal(handler?.handlerId, 'stone_armor');

handler.onPrepare(stone, ctx);
assert.equal(weapon.staminaFactor, 1.2, 'p4 fallback applies source +20% stamina factor');
assert.equal(weapon.staminaCost, 2.4);

handler.onCombatStart(stone, ctx);
assert.equal(player.block, 120, 'onCombatStart grants the catalog Block amount');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'stone_armor'));

player.block = 0;
player.hp = 100;
bus.emit('character_damaged', { actor: player, hit: false, t: 4 });
assert.equal(player.block, 0, 'missed damage does not trigger the low-health listener');
bus.emit('character_damaged', { actor: dummy, hit: true, t: 4.1 });
assert.equal(player.block, 0, 'the opponent damage signal does not trigger the player listener');
bus.emit('character_damaged', { actor: player, hit: true, t: 4.15 });
assert.equal(player.block, 0, 'the exact threshold does not trigger the low-health listener');
player.hp = 90;
bus.emit('character_damaged', { actor: player, hit: true, t: 4.2 });
assert.equal(player.block, 44, 'missing health is converted using blockperhealth below the threshold');
bus.emit('character_damaged', { actor: player, hit: true, t: 4.3 });
assert.equal(player.block, 44, 'the low-health trigger activates only once');

dummy.stacks.spikes = 3;
dummy.stacks.empower = 4;
const cooldownBefore = events.length;
handler.onCooldownEffect(stone, ctx);
assert.equal(dummy.stacks.spikes, 2, 'p1 removes one Spike stack');
assert.equal(dummy.stacks.empower, 2, 'p2 removes two Empower stacks');
assert.ok(events.slice(cooldownBefore).some((event) => event.type === 'activate'));

console.log('OK Stone Armor source, indexed parameters, prepare stamina factor, start Block activation, low-health trigger, cooldown stripping, and effect ordering regression');
