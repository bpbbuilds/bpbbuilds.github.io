/**
 * Pestilence Flask fidelity — prepare-time heal listener, linked potion
 * trigger, source poison amounts, and Strong's delayed poison timer.
 *   node scripts/sim-pestilence-flask-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor, healActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const itemsById = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
assert.equal(inventory.byId.pestilence_flask?.file, 'PestilenceFlask.gd');
assert.equal(inventory.byId.pestilence_flask?.extends, 'Potion');
assert.equal(inventory.byId.strong_pestilence_flask?.file, 'StrongPestilenceFlask.gd');
assert.equal(inventory.byId.strong_pestilence_flask?.extends, 'PestilenceFlask');

const source = fs.readFileSync('tools/game-extract-full/Items/PestilenceFlask.gd', 'utf8');
const strongSource = fs.readFileSync('tools/game-extract-full/Items/StrongPestilenceFlask.gd', 'utf8');
const simulateSource = fs.readFileSync('js/pages/sim/engine/simulate.js', 'utf8');
assert.match(source, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*inflictPoison\(getP1\(\), triggerEvent\)[\s\S]*selfInflictPoison\(getP2\(\), triggerEvent\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(opponent\(\), "character_healed", "onOpponentHeal"\)/);
assert.match(source, /func onOpponentHeal\(_amount, event\):[\s\S]*drink\(\)[\s\S]*triggerPotion\(event\)[\s\S]*affected\[0\]\.triggerPotion\(event\)[\s\S]*affected\[0\]\.miniActivate\(\)[\s\S]*activate\(\)/);
assert.match(strongSource, /\.onTriggerPotion\(triggerEvent\)[\s\S]*poisonTimer\.start\(getP3\(\)\)/);
assert.match(strongSource, /func poisonTimerTimeout\(\):[\s\S]*inflictPoison\(getP4\(\)/);
assert.match(strongSource, /func onCombatEnd\(\):[\s\S]*poisonTimer\.stop\(\)/);
assert.match(simulateSource, /piece\._pestilencePoisonAt != null/);

function makePiece(id, params) {
  const item = itemsById.get(id);
  return {
    itemId: id,
    placementKey: id,
    name: item?.name || id,
    kind: 'consumable',
    side: 'you',
    params,
    alive: true,
    charges: 1,
    cooldown: 999,
    triggerTime: 999,
  };
}

function makeContext(piece, linked) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  dummy.hp = 80;
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const events = [];
  return {
    ctx: {
      t: 4,
      player,
      dummy,
      rng: () => 0,
      events,
      bus,
      pieces: [piece, linked],
      itemsById,
      graph: {
        pieces: new Map([
          [piece.placementKey, { key: piece.placementKey, id: piece.itemId, cells: ['0,0'], affectCells: [] }],
          [linked.placementKey, { key: linked.placementKey, id: linked.itemId, cells: ['1,0'], affectCells: [] }],
        ]),
        filled: new Map([
          ['0,0', piece.placementKey],
          ['1,0', linked.placementKey],
        ]),
      },
      canAffect: { rulesById: JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8')).byId },
    },
    player,
    dummy,
    bus,
    events,
  };
}

const linked = {
  itemId: 'health_potion',
  placementKey: 'health',
  name: 'Health Potion',
  alive: true,
  _potionTriggerCalls: 0,
  _potionTrigger() { this._potionTriggerCalls += 1; },
};
const normal = makePiece('pestilence_flask', { p1: 3, p2: 1 });
const normalData = makeContext(normal, linked);
const normalHandler = getScriptHandler('pestilence_flask');
assert.equal(typeof normalHandler?.onPrepare, 'function');
normalHandler.onPrepare(normal, normalData.ctx);
assert.equal(normal.alive, true, 'Pestilence Flask remains armed after preparation');
healActor(normalData.dummy, 5);
assert.equal(normal.alive, false, 'Pestilence Flask drinks when the opponent heals');
assert.equal(normal.charges, 0);
assert.equal(normalData.dummy.stacks.poison, 3, 'Pestilence Flask inflicts source p1 Poison');
assert.equal(normalData.player.stacks.poison, 1, 'Pestilence Flask self-inflicts source p2 Poison');
assert.equal(linked._potionTriggerCalls, 1, 'Pestilence Flask triggers the first linked Potion once');
assert.equal(normalData.events.at(-1)?.type, 'activate', 'Pestilence Flask activates after linked trigger');

const strong = makePiece('strong_pestilence_flask', { p1: 3, p2: 1, p3: 2, delay: 9, p4: 3 });
const strongLinked = { ...linked, placementKey: 'strong-health', _potionTriggerCalls: 0 };
const strongData = makeContext(strong, strongLinked);
const strongHandler = getScriptHandler('strong_pestilence_flask');
strongHandler.onPrepare(strong, strongData.ctx);
healActor(strongData.dummy, 5);
assert.equal(strongData.dummy.stacks.poison, 3, 'Strong Pestilence keeps parent immediate Poison');
assert.equal(strong._pestilencePoisonAt, 6, 'Strong Pestilence starts the source p3 delay timer');
strongHandler.onTick(strong, { ...strongData.ctx, t: 5.99 });
assert.equal(strongData.dummy.stacks.poison, 3, 'Strong Pestilence waits for timer expiry');
strongHandler.onTick(strong, { ...strongData.ctx, t: 6 });
assert.equal(strongData.dummy.stacks.poison, 6, 'Strong Pestilence applies delayed source p4 Poison');
assert.equal(strong._pestilencePoisonAt, null);

const ended = makePiece('strong_pestilence_flask', { p1: 3, p2: 1, p3: 4, p4: 3 });
const endedData = makeContext(ended, { ...strongLinked, placementKey: 'ended-health', _potionTriggerCalls: 0 });
strongHandler.onPrepare(ended, endedData.ctx);
healActor(endedData.dummy, 5);
assert.equal(ended._pestilencePoisonAt, 8, 'Strong Pestilence arms a second timer');
strongHandler.onCombatEnd(ended, endedData.ctx);
assert.equal(ended._pestilencePoisonAt, null, 'Strong Pestilence stops its timer at combat end');
strongHandler.onTick(ended, { ...endedData.ctx, t: 8 });
assert.equal(endedData.dummy.stacks.poison, 3, 'Stopped Strong Pestilence timer does not poison after combat end');

console.log('OK Pestilence Flask source and lifecycle regression');
