import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, collapseDuplicateBuffLogs, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { COMBAT_START_PRIORITY, PRIORITY } from '../js/pages/sim/engine/combat-start-priority.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/TimeMelting.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.time_melting?.file, 'Exclusive/TimeMelting.gd');
assert.deepEqual(inventory.byId.time_melting?.overrides, ['onCombatStart', 'onPrepare']);
assert.match(source, /onready var heat: = int\(getP\("heat"\)\)/);
assert.match(source, /onready var bonusdur: = getP\("bonusdur"\) \/ 100\.0/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasInventoryDuration\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItems\(\)[\s\S]*modifyParam\("dur", bonusdur\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveHeat\(heat\)[\s\S]*activate\(\)/);
assert.match(source, /Priority\.High \+ 100/);
assert.match(portSource, /handlerId: 'time_melting'/);
assert.match(portSource, /addEffectDurationFactor\(other, bonusDur\)/);
assert.match(portSource, /pushActivate\(piece, ctx, 'time_melting'/);

assert.equal(COMBAT_START_PRIORITY.time_melting, PRIORITY.High + 100);
const handler = getScriptHandler('time_melting');
assert.equal(handler?.handlerId, 'time_melting');

const time = {
  ...byId.get('time_melting'),
  itemId: 'time_melting',
  placementKey: 'time',
  name: 'Time Melting',
  kind: 'skill',
  params: { p1: 5, p2: 50 },
};
const hammer = {
  ...byId.get('hammer'),
  itemId: 'hammer',
  placementKey: 'hammer',
  name: 'Hammer',
  kind: 'weapon',
  params: { dur_stun: 0.5 },
};
const unrelated = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'unrelated',
  name: 'Unrelated Sword',
  kind: 'weapon',
  params: {},
};
const itemsById = new Map([
  ['time_melting', time],
  ['hammer', hammer],
  ['wooden_sword', unrelated],
]);
const graph = {
  pieces: new Map([
    ['time', { id: 'time_melting', affectCells: [{ cell: 'hammer-cell', color: 'primary' }] }],
    ['hammer', { id: 'hammer', affectCells: [] }],
    ['unrelated', { id: 'wooden_sword', affectCells: [] }],
  ]),
  filled: new Map([['hammer-cell', 'hammer']]),
};
const prepareCtx = {
  graph,
  itemsById,
  canAffect: { rulesById: rules.byId },
  pieces: [time, hammer, unrelated],
};
handler.onPrepare(time, prepareCtx);
assert.equal(hammer.effectDurationFactor, 1.5, 'Time Melting uses the source p2 duration bonus on linked duration items');
assert.equal(unrelated.effectDurationFactor, undefined, 'Time Melting excludes linked items without inventory durations');

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const startCtx = { t: 2.5, player, dummy, events };
bindBuffCombatLog({ events, getT: () => startCtx.t, dummy });
handler.onCombatStart(time, startCtx);
unbindBuffCombatLog();
collapseDuplicateBuffLogs(events);
assert.equal(player.stacks.heat, 5, 'Time Melting grants the source Heat amount');
assert.equal(events.filter((event) => event.type === 'buff' && event.meta?.stack === 'heat').length, 1, 'Heat produces one combat-log grant');
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'time_melting').length, 1, 'Time Melting activates after granting Heat');

const zero = { ...time, params: { p1: 0, p2: 0 }, placementKey: 'zero-time' };
const zeroPlayer = createActor('player');
const zeroEvents = [];
handler.onCombatStart(zero, { t: 3, player: zeroPlayer, dummy: createActor('dummy'), events: zeroEvents });
assert.equal(zeroPlayer.stacks.heat, 0, 'zero Heat remains zero-safe');
assert.equal(zeroEvents.filter((event) => event.type === 'activate').length, 1, 'zero Heat still follows the source activation lifecycle');

console.log('OK Time Melting source, duration-target filter, p2 fallback, prepared duration multiplier, priority, Heat grant, activation, deduplicated log, and zero-safe regression');
