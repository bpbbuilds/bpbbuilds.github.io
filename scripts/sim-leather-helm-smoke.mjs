import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/LeatherHelm.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('leather_helm');

assert.equal(inventory.byId.leather_helm?.file, 'LeatherHelm.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*changeCritResistance\(getChance\(\)\)[\s\S]*changeStunResistance\(getStunProtectChance\(\)/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*changeDamageResistance\(damReduction\)[\s\S]*buffsActive \+= 1[\s\S]*buffTimer\.start\(getBuffDur\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*activate\(\)/);
assert.equal(getScriptHandler('leather_helm')?.handlerId, 'leather_helm');

function makeContext(params = data.params, itemsById = byId) {
  const piece = {
    ...data,
    itemId: 'leather_helm',
    placementKey: 'leather-helm',
    name: 'Leather Helm',
    kind: 'helmet',
    side: 'you',
    alive: true,
    params: { ...params },
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  return {
    piece,
    player,
    dummy,
    bus,
    events,
    t: 2,
    pieces: [piece],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById,
  };
}

const ctx = makeContext();
const handler = getScriptHandler('leather_helm');
handler.onPrepare(ctx.piece, ctx);
assert.equal(ctx.player.critResistance, 15, 'Leather Helm adds source chance to Crit Resistance during prepare');
assert.equal(ctx.player.stunResistance, 15, 'Leather Helm adds source chance to Stun Resistance during prepare');
assert.equal(ctx.player.damageResistancePct, 0, 'Leather Helm does not start timed damage resistance during prepare');

handler.onPreCombatStart(ctx.piece, ctx);
assert.equal(ctx.player.damageResistancePct, 25, 'Leather Helm applies exact p1 damage resistance pre-combat');
assert.equal(ctx.piece.state, 1, 'Leather Helm enters its active source state');
assert.equal(ctx.player._timedResists?.[0]?.untilT, 5);
handler.onCombatStart(ctx.piece, ctx);
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'leather_helm'));

tickTimedResistances([ctx.player], 5);
assert.equal(ctx.player.damageResistancePct, 0, 'Leather Helm removes timed resistance at the source duration');
assert.equal(ctx.piece.state, 0, 'Leather Helm leaves its active state when the buff timer ends');

const zeroItems = new Map(byId);
zeroItems.set('leather_helm', { ...data, chance: 0 });
const zero = makeContext({ p1: 0, p2: 0, dur: 0 }, zeroItems);
handler.onPrepare(zero.piece, zero);
handler.onPreCombatStart(zero.piece, zero);
assert.equal(zero.player.critResistance, 0, 'Leather Helm honors explicit zero Crit Resistance chance');
assert.equal(zero.player.stunResistance, 0, 'Leather Helm honors explicit zero Stun Resistance chance');
assert.equal(zero.player.damageResistancePct, 0, 'Leather Helm honors explicit zero damage resistance');
assert.equal(zero.piece.state, 1, 'Leather Helm still records the source pre-combat state transition');

console.log('OK Leather Helm source-backed prepare resistances, pre-combat timed damage resistance, combat-start activation, timer cleanup/state, and zero parameters');
