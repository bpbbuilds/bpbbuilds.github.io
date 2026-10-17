import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpikedCollar.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const spikedCollarPort'),
  handlerSource.indexOf('const vampiricCollarPort'),
);
const sourceItem = catalog.find((item) => item.id === 'spiked_collar');

assert.ok(sourceItem, 'Spiked Collar: extracted catalog row');
assert.equal(inventory.byId.spiked_collar?.file, 'Exclusive/SpikedCollar.gd');
assert.deepEqual(inventory.byId.spiked_collar?.overrides, ['onPrepare']);
assert.equal(sourceItem.cost, 6, 'Spiked Collar: catalog cost');
assert.deepEqual(sourceItem.params, { dur_rage: 2, p1: 2, spikes: 1, p2: 1 });
assert.match(source, /onready var spikes: = int\(getP\("spikes"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "battle_rage_started", "onBattleRageStarted"\)[\s\S]*addBattleRageDuration\(getP_m\("dur_rage"\)\)/);
assert.match(source, /func onBattleRageStarted\(event\):[\s\S]*giveSpikes\(spikes, event\)[\s\S]*activate\(\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(handlerSource, /modifiedParamValue/);
assert.match(portBlock, /battle_rage_started/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'spikes'/);

function makeContext({ params = sourceItem.params, eventActor = null } = {}) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const events = [];
  player._eventLog = events;
  const piece = {
    ...sourceItem,
    itemId: 'spiked_collar',
    placementKey: 'collar',
    name: 'Spiked Collar',
    params: { ...params },
    kind: 'accessory',
    side: 'you',
    alive: true,
  };
  return {
    t: 2,
    player,
    dummy,
    bus,
    events,
    pieces: [piece],
    itemsById: new Map([['spiked_collar', sourceItem]]),
    piece,
    eventActor,
  };
}

const handler = getScriptHandler('spiked_collar');
assert.equal(handler?.handlerId, 'spiked_collar');
assert.equal(typeof handler?.onPrepare, 'function');

const combat = makeContext();
combat.piece.paramAdd = { dur_rage: 1 };
combat.piece.paramMult = { dur_rage: 1.5 };
handler.onPrepare(combat.piece, combat);
assert.equal(combat.player.battleRageBonusDur, 4.5,
  'Spiked Collar: prepare adds modified Battle Rage duration');
combat.bus.emit('battle_rage_started', { actor: combat.player, t: 7 });
assert.equal(combat.player.stacks.spikes, 1,
  'Spiked Collar: player Battle Rage grants source integer Spikes');
const activation = combat.events.find((event) => event.type === 'activate');
assert.equal(activation?.t, 7,
  'Spiked Collar: activation uses the Battle Rage event timestamp');

combat.bus.emit('battle_rage_started', { actor: combat.dummy, t: 8 });
assert.equal(combat.player.stacks.spikes, 1,
  'Spiked Collar: opponent Battle Rage does not grant player Spikes');
assert.equal(combat.events.filter((event) => event.type === 'activate').length, 1,
  'Spiked Collar: opponent Battle Rage does not activate the collar');

const zero = makeContext({ params: { dur_rage: 0.5, p1: 0.5, spikes: 0, p2: 0 } });
handler.onPrepare(zero.piece, zero);
assert.equal(zero.player.battleRageBonusDur, 0.5,
  'Spiked Collar: fractional duration is not rounded');
zero.bus.emit('battle_rage_started', { actor: zero.player, t: 3 });
assert.equal(zero.player.stacks.spikes, 0,
  'Spiked Collar: explicit zero Spikes is preserved');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 1,
  'Spiked Collar: zero Spikes still follows the source activation path');

console.log('Spiked Collar source/parity smoke passed.');
