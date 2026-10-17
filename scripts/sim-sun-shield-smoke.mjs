import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SunShield.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-shields.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('const sunShieldPort'),
  handlerSource.indexOf('/** @type', handlerSource.indexOf('const sunShieldPort') + 1),
);

assert.equal(inventory.byId.sun_shield?.file, 'Exclusive/SunShield.gd');
assert.deepEqual(inventory.byId.sun_shield?.overrides, ['onPrepare', 'afterBlock']);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canBlock\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(item, "gave_block", "onItemGaveBlock"\)/);
assert.match(source, /func onItemGaveBlock\(amount, event\):[\s\S]*blockAcc \+= amount[\s\S]*var ticks = blockAcc \/ blockPerTick[\s\S]*blockAcc %= blockPerTick/);
assert.match(source, /dealEffectDamage\(dam, event\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\), blockedDamageRes\.event\)[\s\S]*activate\(\)/);
assert.match(source, /func addBonusDamageOnTick\(dam\):[\s\S]*bonusDamagePerTick \+= dam/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /onBuffChanged\(ctx\.player/);
assert.match(port, /dealEffectDamage\(/);
assert.match(port, /miniActivate: true/);
assert.doesNotMatch(port, /bus\?\.on\?\.\('afterBlock'/);

const sunShield = {
  ...byId.get('sun_shield'),
  itemId: 'sun_shield',
  placementKey: 'sun-shield',
  name: 'Sun Shield',
  params: { damblock: 20, p1: 20, stamina: 0.7, p2: 0.7, blockt: 12, p3: 12, dam: 4, p4: 4 },
  chance: 30,
  kind: 'shield',
  alive: true,
};
const linkedShield = {
  ...byId.get('holy_armor'),
  itemId: 'holy_armor',
  placementKey: 'linked-shield',
  name: 'Linked Holy Armor',
  side: 'you',
};
const unrelatedShield = {
  ...byId.get('holy_armor'),
  itemId: 'holy_armor',
  placementKey: 'unrelated-shield',
  name: 'Unrelated Holy Armor',
  side: 'you',
};
const graph = {
  pieces: new Map([
    ['sun-shield', {
      key: 'sun-shield',
      id: 'sun_shield',
      cells: [],
      affectCells: [{ cell: 'linked-cell', color: 'primary' }],
    }],
    ['linked-shield', { key: 'linked-shield', id: 'holy_armor', cells: [], affectCells: [] }],
    ['unrelated-shield', { key: 'unrelated-shield', id: 'holy_armor', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['linked-cell', 'linked-shield']]),
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
  pieces: [sunShield, linkedShield, unrelatedShield],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
  rng: () => 0,
};
const runtime = getScriptHandler('sun_shield');
assert.equal(runtime?.handlerId, 'sun_shield');
runtime.onPrepare(sunShield, ctx);
runtime.onCombatStart(sunShield, ctx);
assert.equal(player._shields.length, 1, 'Sun Shield registers its source block shield');
assert.equal(player._shields[0].chance, 30, 'Sun Shield preserves catalog block chance');
assert.equal(player._shields[0].damblock, 20, 'Sun Shield preserves p1 flat block reduction');

const hpBefore = dummy.hp;
grantStacks(player, 'block', 11, { originKey: linkedShield.placementKey, originId: linkedShield.itemId });
assert.equal(sunShield._blk, 11, 'linked blocker progress is retained below the threshold');
assert.equal(dummy.hp, hpBefore - 4, 'Sun Shield rounds fractional damage after any positive linked Block amount');

grantStacks(player, 'block', 100, { originKey: unrelatedShield.placementKey, originId: unrelatedShield.itemId });
assert.equal(sunShield._blk, 11, 'unlinked block grants are ignored');
assert.equal(dummy.hp, hpBefore - 4, 'unlinked block grants do not deal additional Sun Shield damage');

grantStacks(player, 'block', 12, { originKey: linkedShield.placementKey, originId: linkedShield.itemId });
assert.equal(sunShield._blk, 11, 'Sun Shield retains the fractional threshold remainder');
assert.equal(dummy.hp, hpBefore - 12, 'Sun Shield converts the full accumulated fractional tick ratio');
assert.equal(events.at(-1)?.meta?.miniActivate, true, 'Sun Shield records miniActivate without a normal activation');
assert.equal(events.filter((event) => event.type === 'activate').length, 0, 'block accumulation does not inflate activations');

runtime.addBonusDamageOnTick(sunShield, ctx, 3);
grantStacks(player, 'block', 1, { originKey: linkedShield.placementKey, originId: linkedShield.itemId });
assert.equal(sunShield._blk, 0, 'Sun Shield clears its threshold remainder');
assert.equal(dummy.hp, hpBefore - 19, 'Sun Shield applies bonus damage after the retained remainder reaches one full tick');

player.stamina = 2;
player._shields[0].afterBlock({});
assert.equal(player.stamina, 1.3, 'Sun Shield afterBlock drains its source stamina amount');
assert.equal(events.at(-1)?.type, 'activate', 'Sun Shield afterBlock activates after the stamina drain');

console.log('OK Sun Shield source, linked block threshold, damage, bonus tick damage, mini activation, and afterBlock regression');
