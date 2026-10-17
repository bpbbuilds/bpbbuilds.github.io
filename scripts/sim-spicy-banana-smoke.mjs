import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { affectedTargets } from '../js/pages/sim/engine/board-graph.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpicyBanana.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-skills.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const spicyBananaPort'),
  handlerSource.indexOf('const bindStoned'),
);
const sourceItem = byId.get('spicy_banana');

assert.ok(sourceItem, 'Spicy Banana: extracted catalog row');
assert.equal(inventory.byId.spicy_banana?.file, 'Exclusive/SpicyBanana.gd');
assert.deepEqual(inventory.byId.spicy_banana?.overrides, ['onPrepare']);
assert.equal(sourceItem.cost, 5, 'Spicy Banana: catalog cost');
assert.equal(sourceItem.chance, 75, 'Spicy Banana: catalog chance');
assert.deepEqual(sourceItem.params, {
  heat: 2,
  p1: 2,
  stamina: 1,
  p2: 1,
  heal: 3,
  p3: 3,
});
assert.match(source, /func canAffect\(item\):[\s\S]*item\.isA\(bananaDescriptor\)[\s\S]*item\.isA\(manananaDescriptor\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(banana, "activated", "onBananaActivated"\)[\s\S]*staminaUsed = 0[\s\S]*character_used_stamina/);
assert.match(source, /func onBananaActivated\(event\):[\s\S]*rollChance\(\)[\s\S]*giveHeat\(heatPerActivation, event\)[\s\S]*activate\(\)/);
assert.match(source, /func onStaminaUsed\(amount\):[\s\S]*staminaUsed \+= amount[\s\S]*floor\(staminaUsed \/ staminaForHeal\)[\s\S]*heal\(healTicks \* getP_m\("heal"\)\)/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /stamina_used/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, '(?:heat|stamina|heal)'/);

const graph = {
  pieces: new Map([
    ['spicy', { key: 'spicy', id: 'spicy_banana', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
    ] }],
    ['banana', { key: 'banana', id: 'banana', cells: ['1,0'], affectCells: [] }],
    ['mananana', { key: 'mananana', id: 'mananana', cells: ['2,0'], affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: ['3,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'spicy'],
    ['1,0', 'banana'],
    ['2,0', 'mananana'],
    ['3,0', 'sword'],
  ]),
};
const canAffect = { rulesById: canAffectRules.byId };
const linked = affectedTargets(graph, 'spicy', byId, canAffect).map((link) => link.key);
assert.deepEqual(linked, ['banana', 'mananana'], 'Spicy Banana: source rule links only Banana and Mananana');

function makeContext({ params = sourceItem.params, heatChance = 75 } = {}) {
  const player = createActor('player', { maxHp: 200 });
  player.hp = 180;
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const events = [];
  player._eventLog = events;
  const spicy = {
    ...sourceItem,
    itemId: 'spicy_banana',
    placementKey: 'spicy',
    name: 'Spicy Banana',
    params: { ...params },
    kind: 'passive',
    side: 'you',
    alive: true,
    chance: heatChance,
  };
  const banana = {
    ...byId.get('banana'),
    itemId: 'banana',
    placementKey: 'banana',
    name: 'Banana',
    kind: 'consumable',
    side: 'you',
    alive: true,
  };
  return {
    t: 2,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [spicy, banana],
    graph,
    itemsById: byId,
    canAffect,
    spicy,
    banana,
  };
}

const handler = getScriptHandler('spicy_banana');
assert.equal(handler?.handlerId, 'spicy_banana');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPeerActivated, 'function');

const combat = makeContext();
handler.onPrepare(combat.spicy, combat);
assert.equal(combat.spicy._stamAcc, 0, 'Spicy Banana: prepare resets stamina accumulator');
combat.bus.emit('stamina_used', { actor: combat.player, piece: combat.banana, amount: 0.4, t: 2 });
assert.equal(combat.player.hp, 180, 'Spicy Banana: fractional stamina below threshold does not heal');
combat.bus.emit('stamina_used', { actor: combat.player, piece: combat.banana, amount: 0.6, t: 2 });
assert.equal(combat.player.hp, 183, 'Spicy Banana: one full stamina threshold heals the source amount');
assert.equal(combat.spicy._stamAcc, 0, 'Spicy Banana: consumed stamina threshold is removed');
assert.equal(combat.events.filter((event) => event.type === 'heal').length, 1,
  'Spicy Banana: one threshold produces one heal event');

handler.onPeerActivated(combat.spicy, combat.banana, combat);
assert.equal(combat.player.stacks.heat, 2, 'Spicy Banana: linked Banana activation grants catalog Heat');
assert.equal(combat.events.filter((event) => event.type === 'activate').length, 1,
  'Spicy Banana: successful linked activation activates once');

const fractional = makeContext({ params: { heat: 1.9, p1: 1.9, stamina: 0.4, p2: 0.4, heal: 2.5, p3: 2.5 } });
handler.onPrepare(fractional.spicy, fractional);
fractional.bus.emit('stamina_used', { actor: fractional.player, piece: fractional.banana, amount: 0.9, t: 2 });
assert.equal(fractional.player.hp, 185, 'Spicy Banana: floor threshold uses raw stamina and raw heal parameter');
assert.ok(Math.abs(fractional.spicy._stamAcc - 0.1) < 1e-9,
  'Spicy Banana: fractional remainder is retained');
handler.onPeerActivated(fractional.spicy, fractional.banana, fractional);
assert.equal(fractional.player.stacks.heat, 1, 'Spicy Banana: source int(heat) truncates fractional Heat');

const zero = makeContext({ params: { heat: 0, p1: 0, stamina: 1, p2: 1, heal: 0, p3: 0 } });
handler.onPrepare(zero.spicy, zero);
handler.onPeerActivated(zero.spicy, zero.banana, zero);
assert.equal(zero.player.stacks.heat, 0, 'Spicy Banana: explicit zero Heat is preserved');
assert.equal(zero.events.filter((event) => event.type === 'buff').length, 0,
  'Spicy Banana: zero Heat does not create a fake buff event');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 1,
  'Spicy Banana: zero Heat still follows the successful source activation path');

const wrongTarget = makeContext();
handler.onPrepare(wrongTarget.spicy, wrongTarget);
handler.onPeerActivated(wrongTarget.spicy, { itemId: 'wooden_sword', placementKey: 'sword' }, wrongTarget);
assert.equal(wrongTarget.player.stacks.heat, 0, 'Spicy Banana: non-Banana peer is ignored');

console.log('Spicy Banana source/parity smoke passed.');
