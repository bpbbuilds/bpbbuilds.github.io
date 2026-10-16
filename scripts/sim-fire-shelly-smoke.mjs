/**
 * Fire Shelly fidelity — inherited Shelly preparation, heat-first cooldown,
 * cleanse/heal ordering, and negative cleanse protection.
 *   node scripts/sim-fire-shelly-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const ids = ['fire_shelly', 'health_potion'];
const byId = new Map(ids.map((id) => [id, catalog.find((item) => item.id === id)])
  .filter(([, item]) => item));

const fireSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FireShelly.gd', 'utf8');
const shellySource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Shelly.gd', 'utf8');
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const buffSource = fs.readFileSync('tools/game-extract-full/Core/Buff.gd', 'utf8');
assert.match(fireSource, /onready var heat:\s*=\s*int\(getP\("heat"\)\)/);
assert.match(fireSource, /func doCooldownEffect\(\):\s*\n\s*giveHeat\(heat\)\s*\n\s*\.doCooldownEffect\(\)/);
assert.match(shellySource, /func canAffect\(item\):\s*\n\s*return item\.hasType\(Type\.Potion\)/);
assert.match(shellySource, /func doCooldownEffect\(\):\s*\n\s*cleanseRandomDebuffs\(cleanses\)\s*\n\s*heal\(\)\s*\n\s*activate\(\)/);
assert.match(shellySource, /func onPrepare\(\):\s*\n\s*character\(\)\.changeDebuffProtectionChance\( - getChance\(\)\)/);
assert.match(shellySource, /addSpeed\(potionSpeed \* getNumAffectedItems\(\)\)/);
assert.match(itemSource, /func heal\(amount: int = getP_m\("heal"\)/);
assert.match(buffSource, /cleanseProtectionChancePercent < 0/);

const handler = getScriptHandler('fire_shelly');
const baseHandler = getScriptHandler('shelly');
assert.equal(handler?.handlerId, 'fire_shelly');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');
assert.equal(typeof baseHandler?.onPrepare, 'function');
assert.equal(baseHandler?.onCombatStart, undefined, 'Shelly preparation must not be delayed to combat start');

const placements = [
  { id: 'fire_shelly', key: 'fire-shelly', x: 0, y: 0, r: 0 },
  { id: 'health_potion', key: 'potion', x: 0, y: 0, r: 0 },
];
const pieces = buildCombatPieces(placements, byId);
const graph = buildBoardGraph(placements, byId);
const fireShelly = pieces.find((piece) => piece.itemId === 'fire_shelly');
assert.ok(fireShelly);
fireShelly.params = {
  debuffs: 2,
  p1: 2,
  heal: 40,
  p2: 40,
  speed: 30,
  p3: 30,
  heat: 2,
  p4: 2,
};
const player = createActor('player', { maxHp: 100 });
player.hp = 50;
grantStacks(player, 'poison', 1);
grantStacks(player, 'blind', 1);
const events = [];
const ctx = {
  t: 4,
  player,
  dummy: createActor('dummy'),
  graph,
  pieces,
  itemsById: byId,
  events,
  rng: () => 0,
};

handler.onPrepare(fireShelly, ctx);
assert.equal(fireShelly.speedScale, 0.3, 'one linked Potion receives exact source speed');
assert.equal(player.debuffCleanseProtectChance, -25, 'source chance makes debuffs easier to cleanse');

handler.onCooldownEffect(fireShelly, ctx);
assert.equal(getStackAmount(player, 'heat'), 2, 'Fire Shelly grants Heat before inherited Shelly effect');
assert.equal(getStackAmount(player, 'poison'), 0);
assert.equal(getStackAmount(player, 'blind'), 0);
assert.equal(player.hp, 90, 'inherited heal uses Fire Shelly named heal parameter');
const activation = events.findIndex((event) => event.type === 'activate' && event.itemId === 'fire_shelly');
const heal = events.findIndex((event) => event.type === 'heal' && event.itemId === 'fire_shelly');
assert.ok(heal >= 0 && activation > heal, 'cleanse/heal precede inherited activation');

const integrated = simulateEngine({
  placements,
  itemsById: byId,
  durationSec: 13.5,
  dummyAttacks: false,
});
const integratedFire = integrated.pieceSnapshots
  .find((snapshot) => snapshot.t === 0)?.byKey['fire-shelly'];
assert.equal(integratedFire?.speedScale, 0.3, 'real engine applies inherited preparation speed');
const integratedHeat = integrated.events.find(
  (event) => event.itemId === 'fire_shelly' && event.meta?.stack === 'heat',
);
const integratedHeal = integrated.events.find(
  (event) => event.itemId === 'fire_shelly' && event.type === 'heal',
);
const integratedActivation = integrated.events.find(
  (event) => event.itemId === 'fire_shelly' && event.type === 'activate',
);
assert.ok(integratedHeat && integratedHeal && integratedActivation, 'real engine projects Fire Shelly effects');
assert.ok(
  integratedHeat.t < integratedHeal.t && integratedHeal.t < integratedActivation.t,
  'real engine preserves heat, heal, activation order',
);

console.log('OK Fire Shelly inherited source and cleanse/order regression');
