import assert from 'node:assert/strict';
import fs from 'node:fs';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import classMasks from '../assets/data/item-class-masks.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/EnergyConversion.gd', 'utf8');
assert.match(source, /extends Item/);
assert.match(source, /onready var heat: = int\(getP\("heat"\)\)/);
assert.match(source, /onready var heatThreshold: = int\(getP\("heatt"\)\)/);
assert.match(source, /onready var numBuffs: = int\(getP\("buffs"\)\)/);
assert.match(source, /onready var speedPerFood: = getP\("speed"\) \/ 100\.0/);
assert.match(source, /func canAffect\(item\):\s*return item\.hasType\(Type\.Food\)/);
assert.match(source, /func onPrepare\(\):\s*addSpeed\(getNumAffectedItems\(\) \* speedPerFood\)/);
assert.match(source, /if useStamina\(\) == Character\.StaminaResult\.Sufficient:/);
assert.match(source, /if character\(\)\.getHeat\(\) >= heatThreshold:/);
assert.match(source, /giveRandomBuffs\(numBuffs, null, stackTypes\)/);
assert.match(source, /giveHeat\(heat\)/);

const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-heat.js', 'utf8');
const energyBlock = handlerSource.match(/const energyConversionPort = \{[\s\S]*?\n\};/u)?.[0];
assert.ok(energyBlock, 'Energy Conversion handler block exists');
assert.match(energyBlock, /onPrepare\(piece, ctx\)/);
assert.match(energyBlock, /itemHasType\(ctx\.itemsById\.get\(o\.itemId\), 'food'\)/);
assert.match(energyBlock, /Math\.trunc\(getPName\(piece\.params, 'heatt'/);
assert.match(energyBlock, /Math\.trunc\(getPName\(piece\.params, 'buffs'/);
assert.match(energyBlock, /Math\.trunc\(getPName\(piece\.params, 'heat'/);
assert.doesNotMatch(energyBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, '(?:heat|heatt|buffs)'/);

const sourceItem = inventory.byId.energy_conversion;
assert.equal(sourceItem.file, 'Exclusive/EnergyConversion.gd');
assert.deepEqual(sourceItem.overrides.sort(), ['doCooldownEffect', 'onPrepare']);
const handler = getScriptHandler('energy_conversion');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const sourcePiece = {
  itemId: 'energy_conversion',
  placementKey: 'you:energy',
  name: 'Energy Conversion',
  params: { heat: 4, p1: 4, heatt: 20, p2: 20, buffs: 5, p3: 5, speed: 25, p4: 25 },
  staminaCost: 0.7,
  speedScale: 0,
};
const food = { itemId: 'banana', placementKey: 'you:food', name: 'Banana' };
const nonFood = { itemId: 'wooden_sword', placementKey: 'you:sword', name: 'Wooden Sword' };
const graph = {
  pieces: new Map([
    ['you:energy', { id: 'energy_conversion', affectCells: [
      { cell: 'food-cell', color: 'primary' },
      { cell: 'sword-cell', color: 'primary' },
    ] }],
    ['you:food', { id: 'banana', affectCells: [] }],
    ['you:sword', { id: 'wooden_sword', affectCells: [] }],
  ]),
  filled: new Map([
    ['food-cell', 'you:food'],
    ['sword-cell', 'you:sword'],
  ]),
};
const canAffect = {
  rulesById: canRules.byId,
  classMasks: classMasks.byId,
  classBits: classMasks.classBits,
};
handler.onPrepare(sourcePiece, {
  t: 0,
  events: [],
  graph,
  itemsById,
  canAffect,
  pieces: [sourcePiece, food, nonFood],
});
assert.equal(sourcePiece.speedScale, 0.25, 'one linked Food adds the source speed percentage');

const player = createActor('player');
const events = [];
const ctx = { player, dummy: createActor('dummy'), events, t: 5, rng: () => 0 };
handler.onCooldownEffect(sourcePiece, ctx);
assert.equal(player.stamina, 4.3, 'successful source stamina use consumes 0.7');
assert.equal(player.stacks.heat, 4, 'below threshold grants exact Heat');
assert.equal(events.at(-1)?.type, 'activate', 'activation follows Heat grant');

const thresholdPlayer = createActor('player');
thresholdPlayer.stacks.heat = 19;
const thresholdEvents = [];
handler.onCooldownEffect({ ...sourcePiece, params: { heat: 4.9, p1: 4.9, heatt: 19.9, p2: 19.9, buffs: 1.9, p3: 1.9, speed: 25, p4: 25 } }, {
  player: thresholdPlayer,
  dummy: createActor('dummy'),
  events: thresholdEvents,
  t: 5,
  rng: () => 0,
});
const nonHeatTotal = Object.entries(thresholdPlayer.stacks)
  .filter(([stack]) => stack !== 'heat')
  .reduce((sum, [, value]) => sum + value, 0);
assert.equal(nonHeatTotal, 1, 'int() truncates threshold/buff parameters and excludes Heat from random buffs');
assert.equal(thresholdPlayer.stacks.heat, 19, 'random-buff branch does not add Heat');

const zeroPlayer = createActor('player');
const zeroEvents = [];
handler.onCooldownEffect({ ...sourcePiece, params: { heat: 0, p1: 0, heatt: 0, p2: 0, buffs: 0, p3: 0, speed: 0, p4: 0 } }, {
  player: zeroPlayer,
  dummy: createActor('dummy'),
  events: zeroEvents,
  t: 5,
  rng: () => 0,
});
assert.equal(Object.values(zeroPlayer.stacks).reduce((sum, value) => sum + value, 0), 0, 'typed zero values stay zero');
assert.equal(zeroEvents.filter((event) => event.type === 'activate').length, 1, 'zero values still activate after sufficient stamina');

const starvedPlayer = createActor('player', { maxStamina: 0 });
const starvedEvents = [];
assert.equal(handler.onCooldownEffect(sourcePiece, {
  player: starvedPlayer,
  dummy: createActor('dummy'),
  events: starvedEvents,
  t: 5,
  rng: () => 0,
}), false, 'insufficient stamina does not activate');
assert.equal(starvedEvents.length, 0, 'source starvation emits no activation event');

console.log('OK Energy Conversion source/food/threshold smoke');
