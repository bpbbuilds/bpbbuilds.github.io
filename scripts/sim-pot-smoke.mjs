import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Pot.gd', 'utf8');

assert.equal(inventory.byId.pot?.file, 'Exclusive/Pot.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Potion\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Food\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getNumAffectedItems\(Affected\.Secondary\)[\s\S]*addSpeed\(foodPotionSpeed \* \(getNumAffectedItems\(\) \+ numFood\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveHeat\(heat\)[\s\S]*giveRegeneration\(regen\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(source, /func onPotionTriggered\(_potion\):[\s\S]*getP_m\("heal"\) \+ getP_m\("heal_food"\) \* numFood/);

const potItem = byId.get('pot');
const pot = {
  ...potItem,
  itemId: 'pot',
  placementKey: 'pot',
  name: 'Pot',
  params: potItem.params,
  kind: 'gadget',
  alive: true,
  charges: 1,
  cooldown: potItem.cooldown,
};
const potion = { ...byId.get('health_potion'), itemId: 'health_potion', placementKey: 'potion', name: 'Health Potion', kind: 'consumable', alive: true };
const food = { ...byId.get('banana'), itemId: 'banana', placementKey: 'food', name: 'Banana', kind: 'consumable', alive: true };
const player = createActor('player', { maxHp: 100 });
player.hp = 40;
const dummy = createActor('dummy');
const events = [];
const bus = createCombatBus();
const graph = {
  pieces: new Map([
    ['pot', { key: 'pot', id: 'pot', cells: [], affectCells: [
      { cell: 'potion-link', color: 'primary' },
      { cell: 'food-link', color: 'secondary' },
    ] }],
    ['potion', { key: 'potion', id: 'health_potion', cells: [], affectCells: [] }],
    ['food', { key: 'food', id: 'banana', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['potion-link', 'potion'], ['food-link', 'food']]),
};
const ctx = {
  player,
  dummy,
  pieces: [pot, potion, food],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 5,
  rng: () => 0,
};
const handler = getScriptHandler('pot');

assert.equal(handler?.handlerId, 'pot');
handler.onPrepare(pot, ctx);
assert.equal(pot._potFood, 1);
assert.ok(Math.abs(pot.speedScale - 1) < 1e-9, 'source speed applies once for Potion and once for Food');

bus.emit('potion_emptied', { piece: potion, t: 5 });
assert.equal(player.hp, 53, 'Potion trigger heals p1 plus p2 per linked Food');

handler.onCooldownEffect(pot, ctx);
assert.equal(player.stacks.heat, 8);
assert.equal(player.stacks.regeneration, 8);
assert.equal(pot.alive, false, 'Pot consumes after its cooldown effects');
assert.equal(pot.charges, 0);
assert.equal(events.at(-1)?.type, 'activate');
assert.equal(events.at(-1)?.meta.consume, true);

console.log('OK Pot source and Potion/Food link regression');
