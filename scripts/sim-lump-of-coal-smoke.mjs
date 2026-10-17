import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { combatStartGemSockets, prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Gems/LumpofCoal.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-heat.js', 'utf8');
const lumpPort = portFile.slice(
  portFile.indexOf('export const lumpOfCoalPort'),
  portFile.indexOf('/** @type {Record<string, ScriptHandler>}', portFile.indexOf('export const lumpOfCoalPort')),
);
const socketFile = fs.readFileSync('js/pages/sim/engine/gem-sockets.js', 'utf8');

assert.equal(inventory.byId.lump_of_coal?.file, 'Gems/LumpofCoal.gd');
assert.match(source, /func canBlock\(\):[\s\S]*return false/);
assert.match(source, /func prepareWeapon\(\):[\s\S]*connectForCombat\(socket\.getItem\(\), "pre_deal_damage_early", "preAttack"\)/);
assert.match(source, /func preAttack\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollChance\(\)[\s\S]*damageRes\.damage \+= getP1\(\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func prepareArmor\(\):[\s\S]*changeDebuffResistStacks\(round\(getGemPower\(\)\)\)/);
assert.match(source, /func combatStartArmor\(\):[\s\S]*giveBlock\(round\(getGemPower\(\) \* getBlock\(\)\)\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveRandomBuffs\(1\)[\s\S]*inflictRandomDebuffs\(1\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(lumpPort, /giveRandomBuffs\(player, 1/);
assert.match(lumpPort, /inflictRandomDebuffs\(dummy, 1/);
assert.match(lumpPort, /afterEffectFinished\(piece, ctx, 'lump_of_coal', \{ label: `Gem:/);
assert.doesNotMatch(lumpPort, /pushActivate\(piece/);
assert.match(socketFile, /fam === 'coal'[\s\S]*getP1\(params, 0\)/);
assert.match(socketFile, /fam === 'coal'[\s\S]*debuffResistStacks/);
assert.match(socketFile, /gemPowerForHost\(gem, piece\) \*[\s\S]*Number\(gem\.block\)/);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

const handler = getScriptHandler('lump_of_coal');
assert.equal(handler?.handlerId, 'lump_of_coal');

const piece = {
  placementKey: 'coal',
  itemId: 'lump_of_coal',
  name: 'Lump of Coal',
  kind: 'gadget',
  side: 'you',
  alive: true,
  charges: 1,
  cooldown: 3,
  triggerTime: 3,
};
const ctx = {
  t: 3,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
};
handler.onCooldownEffect(piece, ctx);
assert.equal(ctx.player.stacks.lucky, 1, 'inventory Coal grants one random buff');
assert.equal(ctx.dummy.stacks.poison, 1, 'inventory Coal inflicts one random debuff');
assert.equal(piece.alive, false, 'onAfterEffectFinished consumes inventory Coal');
assert.equal(piece.charges, 0, 'consumption clears charges');
const activationIndex = ctx.events.findIndex((event) => event.type === 'activate');
const infoIndex = ctx.events.findIndex((event) => event.type === 'info');
assert.ok(activationIndex > infoIndex, 'activation follows both random effects and the source completion callback');

const gem = {
  id: 'lump_of_coal',
  name: 'Lump of Coal',
  type: 'Gem',
  chance: 100,
  block: 8,
  gemPower: 2,
  params: { p1: 4 },
};
byId.set('lump_of_coal', gem);
byId.set('test_weapon', { id: 'test_weapon', name: 'Test Weapon', type: 'Weapon' });
byId.set('test_armor', { id: 'test_armor', name: 'Test Armor', type: 'Armor' });

const socketPlayer = createActor('player');
const socketCtx = {
  t: 0,
  player: socketPlayer,
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  itemsById: byId,
};
const weapon = {
  placementKey: 'weapon',
  itemId: 'test_weapon',
  kind: 'weapon',
  side: 'you',
  damageMin: 10,
  damageMax: 10,
  gemIds: ['lump_of_coal'],
};
prepareGemSockets(weapon, socketCtx);
const extraDamage = weapon._preDeal[0]();
assert.equal(extraDamage, 4, 'socketed weapon uses the direct source p1 damage value');
assert.equal(socketCtx.events.filter((event) => event.meta?.miniActivate).length, 1, 'weapon socket records mini activation');

const armor = {
  placementKey: 'armor',
  itemId: 'test_armor',
  kind: 'armor',
  side: 'you',
  gemIds: ['lump_of_coal'],
};
prepareGemSockets(armor, socketCtx);
assert.equal(socketPlayer.debuffResistStacks, 2, 'armor socket applies rounded Gem Power debuff resistance');
combatStartGemSockets(armor, socketCtx);
assert.equal(socketPlayer.block, 16, 'armor socket multiplies block by Gem Power');

console.log('OK Lump of Coal source-backed inventory order/consumption, weapon p1+mini activation, armor debuff resistance, and Gem Power block regression');
