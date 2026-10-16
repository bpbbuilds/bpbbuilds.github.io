import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PowerPuppy.gd', 'utf8');

assert.equal(inventory.byId.power_puppy?.file, 'Exclusive/PowerPuppy.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Pet\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* getP4\(\) \/ 100\.0\)[\s\S]*options = \[0, 1, 2\]/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*Util\.pickRandomElement\(options\)[\s\S]*giveLucky\(getP1\(\)\)[\s\S]*giveRegeneration\(getP2\(\)\)[\s\S]*giveEmpower\(getP3\(\)\)[\s\S]*activate\(\)/);

const powerItem = byId.get('power_puppy');
const power = {
  ...powerItem,
  itemId: 'power_puppy',
  placementKey: 'power',
  name: 'Power Puppy',
  params: powerItem.params,
  kind: 'pet',
  side: 'you',
  alive: true,
};
const courage = {
  ...byId.get('courage_puppy'),
  itemId: 'courage_puppy',
  placementKey: 'courage',
  name: 'Courage Puppy',
  kind: 'pet',
  side: 'you',
};
const wisdom = {
  ...byId.get('wisdom_puppy'),
  itemId: 'wisdom_puppy',
  placementKey: 'wisdom',
  name: 'Wisdom Puppy',
  kind: 'pet',
  side: 'you',
};
const sword = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'sword',
  name: 'Wooden Sword',
  kind: 'weapon',
  side: 'you',
};
const graph = {
  pieces: new Map([
    ['power', { key: 'power', id: 'power_puppy', cells: [], affectCells: [
      { cell: 'courage-link', color: 'primary' },
      { cell: 'wisdom-link', color: 'primary' },
      { cell: 'sword-link', color: 'primary' },
    ] }],
    ['courage', { key: 'courage', id: 'courage_puppy', cells: [], affectCells: [] }],
    ['wisdom', { key: 'wisdom', id: 'wisdom_puppy', cells: [], affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['courage-link', 'courage'],
    ['wisdom-link', 'wisdom'],
    ['sword-link', 'sword'],
  ]),
};
const player = createActor('player');
const events = [];
let roll = 0;
const ctx = {
  player,
  dummy: createActor('dummy'),
  pieces: [power, courage, wisdom, sword],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 3,
  rng: () => roll,
};
const handler = getScriptHandler('power_puppy');

assert.equal(handler?.handlerId, 'power_puppy');
assert.equal(typeof handler.onPrepare, 'function');
assert.equal(handler.onCombatStart, undefined, 'Power Puppy source setup belongs to prepare');
handler.onPrepare(power, ctx);
assert.ok(Math.abs(power.speedScale - 0.2) < 1e-12, 'only linked Pet items add the source speed bonus');

bindBuffCombatLog({ events, getT: () => ctx.t, dummy: ctx.dummy });
handler.onCooldownEffect(power, ctx);
assert.equal(player.stacks.lucky, 1);
assert.equal(events.at(-1)?.type, 'activate', 'activation follows the source Lucky grant');
handler.onCooldownEffect(power, ctx);
assert.equal(player.stacks.regeneration, 1, 'second cycle uses the remaining Regen option');
roll = 0.999;
handler.onCooldownEffect(power, ctx);
assert.equal(player.stacks.empower, 1, 'third cycle uses the remaining Empower option');

const grants = events.filter((event) => event.type === 'buff' && event.itemId === 'power_puppy');
assert.deepEqual(grants.map((event) => event.meta?.stack), ['lucky', 'regeneration', 'empower']);
assert.ok(grants.every((event) => event.amount === 1));
unbindBuffCombatLog();

console.log('OK Power Puppy source and handler regression');
