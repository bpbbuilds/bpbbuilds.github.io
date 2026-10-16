import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { dealDamage } from '../js/pages/sim/engine/damage.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Turtle.gd', 'utf8');
const parent = fs.readFileSync('tools/game-extract-full/Items/LeatherHelm.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-c2.js', 'utf8');
const shieldSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-shields.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.turtle?.file, 'Exclusive/Turtle.gd');
assert.equal(inventory.byId.turtle?.extends, 'LeatherHelm');
assert.deepEqual(inventory.byId.turtle?.overrides, ['doCooldownEffect', 'onPreCombatStart', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Shield\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItems\(\)[\s\S]*modifyParam\("damblock", extraDamBlock\)/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*\.onPreCombatStart\(\)[\s\S]*opponent\(\)\.changeDamageResistance\(damReduction\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getBlock\(\)[\s\S]*getMaxHealth\(\)[\s\S]*maxHealthBlock[\s\S]*activate\(\)/);
assert.match(parent, /func onPreCombatStart\(\):[\s\S]*changeDamageResistance\(damReduction\)[\s\S]*buffTimer\.start\(getBuffDur\(\)/);
assert.match(parent, /func getBuffDur\(\)[^\n]*:[\s\S]*getP_m\("dur"\)/);
assert.match(portSource, /handlerId: 'turtle'/);
assert.match(portSource, /onPrepare\(piece, ctx\)/);
assert.match(portSource, /onPreCombatStart\(piece, ctx\)/);
assert.match(portSource, /grantTimedResistancePct\(/);
assert.match(shieldSource, /paramMult\?\.damblock/);

const turtleCatalog = byId.get('turtle');
const shieldCatalog = byId.get('shield_of_valor');
assert.ok(turtleCatalog && shieldCatalog);
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
const turtle = {
  ...turtleCatalog,
  itemId: 'turtle',
  placementKey: 'turtle',
  name: 'Turtle',
  kind: 'pet',
  side: 'you',
  alive: true,
  blockGrant: turtleCatalog.block,
  params: { ...turtleCatalog.params },
  paramAdd: { dur: 1 },
};
const shield = {
  ...shieldCatalog,
  itemId: 'shield_of_valor',
  placementKey: 'shield',
  name: 'Shield of Valor',
  kind: 'armor',
  side: 'you',
  alive: true,
  params: { ...shieldCatalog.params },
  blockGrant: 0,
};
const graph = {
  pieces: new Map([
    ['turtle', { key: 'turtle', id: 'turtle', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
    ['shield', { key: 'shield', id: 'shield_of_valor', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([['0,0', 'turtle'], ['1,0', 'shield']]),
};
const ctx = {
  t: 0,
  player,
  dummy,
  bus,
  events,
  graph,
  pieces: [turtle, shield],
  itemsById: new Map([
    ['turtle', turtleCatalog],
    ['shield_of_valor', shieldCatalog],
  ]),
  canAffect: { rulesById: rules.byId },
};

const turtleHandler = getScriptHandler('turtle');
assert.equal(turtleHandler?.handlerId, 'turtle');
assert.equal(typeof turtleHandler?.onPrepare, 'function', 'Turtle must resolve to its source lifecycle handler');
assert.equal(typeof turtleHandler?.onPreCombatStart, 'function');
assert.equal(typeof turtleHandler?.onCombatStart, 'function');
assert.equal(typeof turtleHandler?.onCooldownEffect, 'function');

turtleHandler.onPrepare(turtle, ctx);
assert.equal(shield.paramMult?.damblock, 2, 'Turtle applies source p2 damblock multiplier to affected Shields');
assert.equal(player.damageResistancePct, 0, 'Turtle does not start inherited DR during preparation');
assert.equal(dummy.damageResistancePct, 0, 'Turtle does not affect the opponent before pre-combat');

const shieldHandler = getScriptHandler('shield_of_valor');
shieldHandler.onPrepare?.(shield, ctx);
shieldHandler.onCombatStart(shield, ctx);
turtleHandler.onPreCombatStart(turtle, ctx);
assert.equal(player.damageResistancePct, 35, 'Turtle applies inherited Leather Helm DR to its owner before combat');
assert.equal(dummy.damageResistancePct, 35, 'Turtle applies source opponent DR before combat');
assert.equal(player._timedResists?.[0]?.untilT, 8, 'Turtle uses modified source p3 duration');

const beforeStartEvents = events.length;
turtleHandler.onCombatStart(turtle, ctx);
assert.equal(events.length, beforeStartEvents + 1, 'Turtle inherited combat-start hook only activates once');
assert.equal(events.at(-1)?.type, 'activate');
assert.equal(events.at(-1)?.meta?.handler, 'turtle');

const beforeHp = player.hp;
const damage = dealDamage(dummy, player, {
  amount: 20,
  canMiss: false,
  canCrit: false,
  isAttack: true,
  isMelee: true,
  nowT: 1,
  bus,
  events,
  rng: () => 0,
});
assert.equal(damage.healthDamage, 0, 'Turtle-modified Shield of Valor blocks the full 20 damage');
assert.equal(damage.reduced, 20, 'Turtle damblock modifies the real shield damage reduction path');
assert.equal(player.hp, beforeHp, 'Turtle shield reduction preserves owner HP');

const beforeBlock = player.block;
assert.equal(turtleHandler.onCooldownEffect(turtle, ctx), true);
assert.equal(player.block - beforeBlock, 100, 'Turtle grants getBlock plus max-health percentage Block');
assert.equal(events.at(-1)?.type, 'activate', 'Turtle cooldown effect activates after Block');
assert.equal(turtle.alive, true, 'Turtle source activate path does not consume the pet');

tickTimedResistances([player, dummy], 8);
assert.equal(player.damageResistancePct, 0, 'Turtle owner DR ends at the source duration');
assert.equal(dummy.damageResistancePct, 0, 'Turtle opponent DR ends at the source duration');

const zero = {
  ...turtle,
  placementKey: 'zero-turtle',
  params: { p1: 0, p2: 0, p3: 0, p4: 0 },
  paramAdd: {},
};
const zeroCtx = { ...ctx, t: 0, events: [], player: createActor('player'), dummy: createActor('dummy') };
turtleHandler.onPreCombatStart(zero, zeroCtx);
assert.equal(zeroCtx.player.damageResistancePct, 0, 'zero Turtle DR remains inert');
assert.doesNotThrow(() => turtleHandler.onCooldownEffect(zero, zeroCtx), 'zero Turtle cooldown remains safe');

console.log('OK Turtle source inheritance, shield can-affect/param modification, dual-side pre-combat DR, modified duration, real shield reduction, Block grant, activation order, and zero-safe regression');
