import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { createFatigueState } from '../js/pages/sim/engine/fatigue.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/PoweroftheMoon.gd',
  'utf8',
);

assert.equal(inventory.byId.power_of_the_moon?.file, 'Exclusive/PoweroftheMoon.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*moonArmorDescriptor[\s\S]*moonShieldDescriptor/);
assert.match(source, /func onPostCombatStart\(\):[\s\S]*advanceTime\(timeAdvance\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*fatigue_start[\s\S]*onMoonArmorActivated/);
assert.match(source, /func onFatigueStarted\(\):[\s\S]*giveMaxHealth\(bonusHealth\)[\s\S]*activate\(\)/);
assert.match(source, /func onMoonArmorActivated\(event\):[\s\S]*inflictBlind\(blind,\s*event\)/);
assert.match(source, /func onMoonShiedActivated\(event\):[\s\S]*giveReflectStacks\(1\)/);
assert.match(source, /func onBought\(\):[\s\S]*boosted = 1/);
assert.match(source, /func onItemRoll\(descr\):[\s\S]*multiplyWeight\(1\.5\)/);
assert.match(source, /func onItemRolled\(descr\):[\s\S]*boosted -= 1/);

const powerItem = byId.get('power_of_the_moon');
const power = {
  ...powerItem,
  itemId: 'power_of_the_moon',
  placementKey: 'power',
  name: 'Power of the Moon',
  params: powerItem.params,
  kind: 'gadget',
  alive: true,
};
const armor = {
  ...byId.get('moon_armor'),
  itemId: 'moon_armor',
  placementKey: 'armor',
  name: 'Moon Armor',
  kind: 'armor',
};
const shield = {
  ...byId.get('moon_shield'),
  itemId: 'moon_shield',
  placementKey: 'shield',
  name: 'Moon Shield',
  kind: 'armor',
};
const outsider = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'outsider',
  name: 'Wooden Sword',
  kind: 'weapon',
};

const player = createActor('player', { maxHp: 100 });
player.hp = 40;
const dummy = createActor('dummy');
const events = [];
const bus = createCombatBus();
const fatigue = createFatigueState();
const graph = {
  pieces: new Map([
    [
      'power',
      {
        key: 'power',
        id: 'power_of_the_moon',
        cells: [],
        affectCells: [
          { cell: 'armor-link', color: 'primary' },
          { cell: 'shield-link', color: 'primary' },
        ],
      },
    ],
    ['armor', { key: 'armor', id: 'moon_armor', cells: [], affectCells: [] }],
    ['shield', { key: 'shield', id: 'moon_shield', cells: [], affectCells: [] }],
    ['outsider', { key: 'outsider', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['armor-link', 'armor'],
    ['shield-link', 'shield'],
  ]),
};
const ctx = {
  player,
  dummy,
  pieces: [power, armor, shield, outsider],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  fatigue,
  t: 17,
  rng: () => 0,
};
const handler = getScriptHandler('power_of_the_moon');

assert.equal(handler?.handlerId, 'power_of_the_moon');
handler.onPrepare(power, ctx);
assert.deepEqual([...power._moonLinkedKeys].sort(), ['armor', 'shield']);
assert.equal(handler.onCombatStart, undefined, 'fatigue listener belongs to prepare');

handler.onPostCombatStart(power, ctx);
assert.equal(fatigue.startAt, 11, 'Power of the Moon advances fatigue by six seconds');

handler.onPeerActivated(power, armor, ctx);
assert.equal(dummy.stacks.blind, 2, 'Moon Armor activation inflicts source blind amount');
handler.onPeerActivated(power, shield, ctx);
assert.equal(player.debuffReflectStacks, 1, 'Moon Shield activation grants one reflect stack');
const beforeOutsider = events.length;
handler.onPeerActivated(power, outsider, ctx);
assert.equal(events.length, beforeOutsider, 'unlinked activations are ignored');

bus.emit('fatigue_start', { t: 17 });
assert.equal(player.maxHp, 170, 'fatigue grants 70% of current max health');
assert.equal(player.hp, 110, 'temporary max-health grant also fills the same amount');
assert.equal(events.at(-1)?.type, 'activate', 'fatigue grant is followed by source activation');
assert.equal(events.at(-1)?.itemId, 'power_of_the_moon');
assert.equal(events.at(-1)?.t, 17);

console.log('OK Power of the Moon source and handler regression');
