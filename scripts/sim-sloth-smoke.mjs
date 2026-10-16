import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Sloth.gd', 'utf8');
const handler = fs.readFileSync('js/pages/sim/engine/scripts/ports-threshold.js', 'utf8');
const row = inventory.byId.sloth;
const portBlock = handler.slice(
  handler.indexOf('export const slothPort'),
  handler.indexOf('function bionicAccHealOrBlock', handler.indexOf('export const slothPort') + 1),
);

assert.equal(row?.file, 'Exclusive/Sloth.gd', 'Sloth extracted source path');
assert.deepEqual(row?.overrides, ['doCooldownEffect', 'onCombatStart', 'trigger', 'onPrepare'], 'Sloth inventory overrides');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*item\.reduceSpeed\(speed\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*getP_m\("maxhealth_base"\)[\s\S]*getNumAffectedItems\(\)[\s\S]*giveMaxHealth\(m\)[\s\S]*activate\(\)/);
assert.match(source, /func trigger\(\):[\s\S]*awakenNow = true[\s\S]*\.trigger\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*if awakenNow:[\s\S]*giveAllBuffs\(buffs\)[\s\S]*stun\(getP_m\("dur_stun"\)\)[\s\S]*onAfterEffectFinished\(\)[\s\S]*else:[\s\S]*giveAllBuffs\(buffsAmulet\)[\s\S]*stun\(getP_m\("dur_stun_amulet"\)\)[\s\S]*activate\(\)/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /giveTempMaxHp/);
assert.match(portBlock, /afterEffectFinished\(piece, ctx, 'sloth'/);
assert.match(portBlock, /giveAllBuffs\([\s\S]*grantStun\([\s\S]*afterEffectFinished/);
assert.match(portBlock, /giveAllBuffs\([\s\S]*grantStun\([\s\S]*pushActivate/);
const cooldownBlock = portBlock.slice(portBlock.indexOf('onCooldownEffect'));
assert.doesNotMatch(cooldownBlock, /pushActivate\(piece, ctx, 'sloth',[\s\S]*const awaken/);

const sloth = {
  itemId: 'sloth',
  placementKey: 'sloth',
  name: 'Sloth',
  side: 'you',
  params: {
    speed: 30,
    p1: 30,
    maxhealth_base: 10,
    p2: 10,
    maxhealth_item: 15,
    p3: 15,
    buffs: 2,
    p4: 2,
    buffs_amulet: 1,
    p5: 1,
    dur_stun: 1.5,
    p6: 1.5,
    dur_stun_amulet: 0.5,
    p7: 0.5,
  },
};
const target = {
  itemId: 'wooden_sword',
  placementKey: 'target',
  name: 'Wooden Sword',
  side: 'you',
  speedScale: 1,
};
const graph = {
  pieces: new Map([
    ['sloth', { key: 'sloth', id: 'sloth', cells: ['sloth-body'], affectCells: [{ cell: 'target-cell', color: 'primary' }] }],
    ['target', { key: 'target', id: 'wooden_sword', cells: ['target-cell'], affectCells: [] }],
  ]),
  filled: new Map([['target-cell', 'target']]),
};
const itemsById = new Map([
  ['sloth', { id: 'sloth', hasCooldown: true }],
  ['wooden_sword', { id: 'wooden_sword', hasCooldown: true }],
]);
const player = createActor('player');
const dummy = createActor('dummy');
player.hp = 100;
const events = [];
const runtime = getScriptHandler('sloth');
assert.equal(runtime?.handlerId, 'sloth', 'Sloth runtime handler');

runtime.onPreCombatStart(sloth, { graph, itemsById, pieces: [sloth, target] });
assert.equal(target.speedScale, 0.7, 'Sloth reduces linked cooldown speed by source percentage');

runtime.onCombatStart(sloth, {
  player,
  dummy,
  graph,
  itemsById,
  pieces: [sloth, target],
  events,
  t: 1,
});
assert.equal(player.maxHp, 250, 'Sloth adds source percentage max health');
assert.equal(player.hp, 150, 'Sloth fills the added max health');
assert.equal(events.at(-1)?.type, 'activate', 'Sloth combat-start activation');

const beforeAwakenActivations = events.filter((event) => event.type === 'activate').length;
runtime.onCooldownEffect(sloth, { player, dummy, events, t: 2 });
assert.equal(player.stacks.empower, 2, 'Sloth awaken grants source buff amount');
assert.equal(dummy.stunnedUntil, 3.5, 'Sloth awaken applies source stun duration');
assert.equal(sloth.alive, false, 'Sloth awaken consumes through onAfterEffectFinished');
assert.equal(events.filter((event) => event.type === 'activate').length, beforeAwakenActivations,
  'Sloth awaken does not emit a second activation before consuming');

const repeat = { ...sloth, alive: true, charges: 1, _slothAwaken: false };
const repeatEvents = [];
runtime.onCooldownEffect(repeat, { player, dummy, events: repeatEvents, t: 4 });
assert.equal(player.stacks.empower, 3, 'Sloth non-awaken grants amulet buff amount');
assert.equal(repeatEvents.at(-1)?.type, 'activate', 'Sloth non-awaken activation follows effects');

console.log('OK Sloth source, inventory, speed aura, max-health, awaken, amulet, stun, and consumption regression');
