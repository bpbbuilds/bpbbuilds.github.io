import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Ukulele.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-cold.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));

assert.match(source, /onready var speedPerItem:[\s\S]*getP\("speed"\)[\s\S]*100\.0/);
assert.match(source, /onready var cdAdvance:[\s\S]*getP\("advance"\)/);
assert.match(source, /onready var healAmp:[\s\S]*getP\("healamp"\)[\s\S]*100\.0/);
assert.match(source, /onready var buffs:[\s\S]*int\(getP\("buffs"\)\)/);
assert.match(source, /onready var cold:[\s\S]*int\(getP\("cold"\)\)/);
assert.match(source, /canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Musical\)/);
assert.match(source, /getAffectedItems\(Affected\.Secondary\)[\s\S]*connectForCombat/);
assert.match(source, /addSpeed\(speedPerItem \* getNumAffectedItems\(\)/);
assert.match(source, /changeAmplificiationChancePercent_allBuffs\(getChance\(\)\)/);
assert.match(source, /advanceCooldownPercent\(cdAdvance\)/);
assert.match(source, /if rng == 0:[\s\S]*heal\(\)[\s\S]*elif rng == 1:[\s\S]*giveRandomBuffs\(buffs\)[\s\S]*else:[\s\S]*inflictCold\(cold\)[\s\S]*activate\(\)/);
assert.match(portSource, /ukulelePort[\s\S]*onPrepare\(piece, ctx\)/);
assert.match(portSource, /ukulelePort[\s\S]*advanceCooldownPercent/);

const badgeCatalog = {
  id: 'ukulele',
  name: 'Ukulele',
  chance: 15,
  params: {
    healamp: 99, p1: 20,
    heal: 99, p2: 30,
    buffs: 99, p3: 5,
    cold: 99, p4: 4,
    speed: 99, p5: 10,
    advance: 99, p6: 20,
  },
};
const primaryCatalog = {
  id: 'primary',
  name: 'Primary Cooldown',
  type: 'Melee Weapon',
  cooldown: 10,
  extraTypes: [],
};
const musicalCatalog = {
  id: 'musical',
  name: 'Musical Target',
  type: 'Accessory',
  cooldown: 8,
  extraTypes: ['Musical'],
};
const ukulele = {
  ...badgeCatalog,
  itemId: 'ukulele',
  placementKey: 'ukulele',
  alive: true,
  side: 'you',
  cooldown: 6,
  params: { ...badgeCatalog.params },
};
const primary = {
  ...primaryCatalog,
  itemId: 'primary',
  placementKey: 'primary',
  cooldown: 10,
  baseCooldown: 10,
  _iterationCd: 12,
  triggerTime: 12,
  speedScale: 0,
  buffAmpChance: 0,
  alive: true,
};
const musical = {
  ...musicalCatalog,
  itemId: 'musical',
  placementKey: 'musical',
  cooldown: 8,
  baseCooldown: 8,
  speedScale: 0,
  buffAmpChance: 0,
  alive: true,
};
const graph = {
  pieces: new Map([
    ['ukulele', { key: 'ukulele', id: 'ukulele', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'secondary' },
    ] }],
    ['primary', { key: 'primary', id: 'primary', cells: ['1,0'], affectCells: [] }],
    ['musical', { key: 'musical', id: 'musical', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'ukulele'],
    ['1,0', 'primary'],
    ['2,0', 'musical'],
  ]),
};
const player = createActor('player');
player.hp = 100;
const dummy = createActor('dummy');
const events = [];
const bus = createCombatBus();
const ctx = {
  t: 2,
  player,
  dummy,
  bus,
  events,
  graph,
  pieces: [ukulele, primary, musical],
  itemsById: new Map([
    ['ukulele', badgeCatalog],
    ['primary', primaryCatalog],
    ['musical', musicalCatalog],
  ]),
  canAffect: { rulesById: rules.byId },
  rng: () => 0,
};

const handler = getScriptHandler('ukulele');
assert.equal(handler?.handlerId, 'ukulele');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

handler.onPrepare(ukulele, ctx);
assert.equal(ukulele.speedScale, 0.1, 'Ukulele uses the primary affected-item count and source p5 speed');
assert.equal(player._healAmp, 0.2, 'Ukulele uses source p1 healing efficiency');
assert.equal(ukulele.buffAmpChance, 15, 'Ukulele amplifies the owner inventory with base chance');
assert.equal(primary.buffAmpChance, 15);
assert.equal(musical.buffAmpChance, 15);
assert.deepEqual(ukulele._ukePool, [primary], 'Ukulele queues only non-musical cooldown items');

bus.emit('piece_activated', { piece: musical, t: 2 });
assert.equal(primary.triggerTime, 9.6, 'Ukulele advances the target by source p6 percent of its iteration cooldown');

ukulele._ukeOpts = [0];
handler.onCooldownEffect(ukulele, ctx);
assert.equal(player.hp, 136, 'Ukulele uses source p2 heal with preparation healing efficiency');
assert.equal(events.at(-1)?.type, 'activate', 'Ukulele effects resolve before activation');
assert.equal(events.at(-1)?.meta?.handler, 'ukulele');

ukulele._ukeOpts = [2];
handler.onCooldownEffect(ukulele, ctx);
assert.equal(dummy.stacks.cold, 4, 'Ukulele uses source p4 Cold amount');
assert.equal(events.at(-1)?.type, 'activate');

console.log('OK Ukulele source positional parameters, primary/secondary targeting, prep stats, cooldown advance, effect ordering, and Cold regression');
