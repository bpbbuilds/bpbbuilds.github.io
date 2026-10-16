import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Snowcake.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-cold.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const snowcakePort'),
  handlerSource.indexOf('/** Ukulele.gd', handlerSource.indexOf('const snowcakePort') + 1),
);

assert.equal(inventory.byId.snowcake?.file, 'Exclusive/Snowcake.gd');
assert.deepEqual(inventory.byId.snowcake?.overrides, ['doCooldownEffect']);
assert.match(source, /^extends Food/);
assert.match(source, /onready var cold: = int\(getP\("cold"\)\)/);
assert.match(source, /onready var coldNeeded: = int\(getP\("coldt"\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictCold\(cold\)[\s\S]*getCold\(\) >= coldNeeded[\s\S]*changeEffectDamageFactor\(effectDam\)[\s\S]*dealEffectDamage\(dam\)[\s\S]*activate\(\)/);
assert.match(portBlock, /applyEffectDmgFactor/);
assert.match(portBlock, /dealEffectDamage/);
assert.match(portBlock, /Math\.trunc/);
assert.match(portBlock, /pushActivate/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'cold'/);

const snowcakeItem = byId.get('snowcake');
const snowcake = {
  ...snowcakeItem,
  itemId: 'snowcake',
  placementKey: 'snowcake',
  name: 'Snowcake',
  params: { cold: 1.9, p1: 1.9, coldt: 2.9, p2: 2.9, damfactor: 10, p3: 10 },
  kind: 'food',
  baseCooldown: snowcakeItem.cooldown,
  cooldown: snowcakeItem.cooldown,
};
const player = createActor('player');
const dummy = createActor('dummy', { maxHp: 100 });
dummy.hp = 100;
dummy.stacks.cold = 1;
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [snowcake],
  itemsById: byId,
  events,
  bus,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('snowcake');

assert.equal(handler?.handlerId, 'snowcake');
handler.onCooldownEffect(snowcake, ctx);
assert.equal(dummy.stacks.cold, 2, 'source int(cold) truncates the applied Cold amount');
assert.equal(player.effectDmgFactor, 0.1, 'effect damage factor applies only after the Cold threshold');
assert.equal(dummy.hp, 89, 'threshold branch deals min weapon effect damage through the factor');
assert.equal(events.at(-1)?.type, 'activate', 'activation follows Cold, factor, and effect damage');

const below = {
  ...snowcake,
  placementKey: 'snowcake-below',
};
const belowPlayer = createActor('player');
const belowDummy = createActor('dummy', { maxHp: 100 });
belowDummy.hp = 100;
const belowEvents = [];
handler.onCooldownEffect(below, {
  ...ctx,
  player: belowPlayer,
  dummy: belowDummy,
  events: belowEvents,
});
assert.equal(belowPlayer.effectDmgFactor, 0, 'below threshold does not grant effect damage factor');
assert.equal(belowDummy.hp, 100, 'below threshold does not deal effect damage');

console.log('OK Snowcake source, Food cooldown branch, Cold threshold, integer parameters, effect damage factor, min damage, and activation ordering regression');
