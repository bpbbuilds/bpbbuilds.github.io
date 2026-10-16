import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Gems/Skull.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-gems.js', 'utf8');
const sockets = fs.readFileSync('js/pages/sim/engine/gem-sockets.js', 'utf8');
const skullPort = port.slice(
  port.indexOf('function skullInventory'),
  port.indexOf('/** BadgerRune.gd', port.indexOf('function skullInventory')),
);

assert.equal(inventory.byId.skull?.file, 'Gems/Skull.gd');
assert.match(source, /func prepareInventory\(\):[\s\S]*character_damaged[\s\S]*onOpponentDamaged/);
assert.match(
  source,
  /func onOpponentDamaged\(_healthChange, event\):[\s\S]*getRelativeHealth\(\) <= healthThreshold[\s\S]*heal\(getP_m\("heal"\), event\)[\s\S]*giveEmpower\(getP3\(\), event\)[\s\S]*activate\(\)/,
);
assert.match(source, /func prepareWeapon\(\):[\s\S]*attacked[\s\S]*onAttack/);
assert.match(source, /func onAttack\(damageRes[^)]*\):[\s\S]*rollChance2\(\)[\s\S]*stealRandomBuff\(1\)/);
assert.match(source, /func prepareArmor\(\):[\s\S]*getGemPower\(\) \* getChance\(\)/);
assert.match(source, /func hasCooldown\(\):[\s\S]*return false/);
assert.match(skullPort, /onCombatStart\(piece, ctx\)/);
assert.match(skullPort, /character_damaged/);
assert.match(skullPort, /modifiedParamValue/);
assert.doesNotMatch(skullPort, /payload\?\.hit\?\.hit/);
assert.match(sockets, /fam === 'skull'[\s\S]*gemPower[\s\S]*critResistance/);

const handler = getScriptHandler('skull');
const piece = {
  ...byId.get('skull'),
  itemId: 'skull',
  placementKey: 'skull',
  name: 'Skull',
  kind: 'gem',
  params: { p1: 30, p2: 9, heal: 50, p3: 0 },
  paramAdd: { heal: 2 },
};
const player = createActor('player');
const dummy = createActor('dummy');
player.hp = 100;
dummy.hp = 300;
const events = [];
const bus = createCombatBus();
const ctx = { player, dummy, events, bus, t: 5, rng: () => 0 };

assert.equal(handler?.handlerId, 'skull');
handler.onCombatStart(piece, ctx);
bus.emit('character_damaged', { actor: player, hit: true, t: 5 });
assert.equal(player.hp, 100, 'Skull ignores damage to its owner');
bus.emit('character_damaged', { actor: dummy, hit: false, t: 6 });
assert.equal(player.hp, 152, 'Skull heals from the modified named heal parameter');
assert.equal(player.stacks.empower, 0, 'explicit zero p3 does not fabricate Empower');
const healIndex = events.findIndex((event) => event.type === 'heal');
const activateIndex = events.findIndex((event) => event.type === 'activate');
assert.ok(healIndex >= 0 && healIndex < activateIndex, 'Skull heals before activation');
bus.emit('character_damaged', { actor: dummy, hit: true, t: 7 });
assert.equal(player.hp, 152, 'Skull triggers only once');

{
  const gem = { ...byId.get('skull'), gemPower: 2 };
  const socketPlayer = createActor('player');
  const socketDummy = createActor('dummy');
  const socketBus = createCombatBus();
  const weapon = {
    itemId: 'wooden_sword',
    placementKey: 'sword',
    name: 'Wooden Sword',
    kind: 'weapon',
    gemIds: ['skull'],
  };
  const itemsById = new Map([
    ['wooden_sword', { ...byId.get('wooden_sword'), id: 'wooden_sword' }],
    ['skull', gem],
  ]);
  socketDummy.stacks.empower = 1;
  prepareGemSockets(weapon, {
    player: socketPlayer,
    dummy: socketDummy,
    bus: socketBus,
    itemsById,
    pieces: [weapon],
    events: [],
    rng: () => 0,
    t: 5,
  });
  socketBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true }, t: 5 });
  assert.equal(socketDummy.stacks.empower, 0, 'socketed Skull steals one buff after a hit');
  assert.equal(socketPlayer.stacks.empower, 1);
}

{
  const gem = { ...byId.get('skull'), gemPower: 2 };
  const socketPlayer = createActor('player');
  const armor = {
    itemId: 'holy_armor',
    placementKey: 'armor',
    name: 'Holy Armor',
    kind: 'armor',
    gemIds: ['skull'],
  };
  const itemsById = new Map([
    ['holy_armor', { ...byId.get('holy_armor'), id: 'holy_armor' }],
    ['skull', gem],
  ]);
  prepareGemSockets(armor, {
    player: socketPlayer,
    dummy: createActor('dummy'),
    bus: createCombatBus(),
    itemsById,
    pieces: [armor],
    events: [],
    rng: () => 0,
    t: 5,
  });
  assert.equal(socketPlayer.stackResist.poison, 50, 'Skull GemPower scales Poison resistance');
  assert.equal(socketPlayer.stackResist.blind, 50);
  assert.equal(socketPlayer.stackResist.cold, 50);
  assert.equal(socketPlayer.critResistance, 50);
}

console.log('OK Skull source, inventory, weapon-socket, and armor-socket regression');
