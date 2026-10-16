/**
 * Flawed Amethyst fidelity — inherited Amethyst inventory, weapon socket,
 * armor healing reduction, and source int() buff-removal behavior.
 *   node scripts/sim-flawed-amethyst-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceGem = catalog.find((entry) => entry.id === 'flawed_amethyst');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const amethystSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Amethyst.gd', 'utf8');
const gemSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Gem.gd', 'utf8');
assert.match(amethystSource, /onready var healReduction: = getP1\(\) \/ 100\.0/);
assert.match(amethystSource, /onready var buffRemoval: = int\(getP2\(\)\)/);
assert.match(amethystSource, /func doCooldownEffect\(\):\s*\n\s*cleanseRandomDebuffs\(1\)\s*\n\s*activate\(\)/);
assert.match(amethystSource, /func prepareWeapon\(\):\s*\n\s*connectForCombat\(socket\.getItem\(\), "attacked", "onAttack"\)/);
assert.match(amethystSource, /func prepareArmor\(\):\s*\n\s*opponent\(\)\.reduceHealingEfficiency\(getGemPower\(\) \* healReduction\)/);
assert.match(gemSource, /var gemPower = 1\.0/);

const handler = getScriptHandler('flawed_amethyst');
assert.equal(handler?.handlerId, 'flawed_amethyst');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const gem = {
  ...sourceGem,
  shape: sourceGem.shape || [[1]],
  params: { p1: 18, p2: 1.9, buffs: 1.9 },
  gemPower: 2,
};
const byId = new Map([
  ['flawed_amethyst', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const inventoryOwner = createActor('player');
const inventoryFoe = createActor('dummy');
inventoryOwner.stacks.poison = 1;
const inventoryEvents = [];
handler.onCooldownEffect(
  { itemId: 'flawed_amethyst', placementKey: 'inventory', name: 'Flawed Amethyst', params: gem.params, alive: true },
  { player: inventoryOwner, dummy: inventoryFoe, events: inventoryEvents, t: 5, rng: () => 0 },
);
assert.equal(inventoryOwner.stacks.poison, 0, 'inventory Amethyst cleanses one debuff');
assert.equal(inventoryEvents.at(-1)?.type, 'activate', 'inventory Amethyst activates after cleansing');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['flawed_amethyst'] }],
  byId,
);
const weaponOwner = createActor('player');
const weaponFoe = createActor('dummy');
weaponFoe.stacks.lucky = 1;
weaponFoe.stacks.empower = 1;
const weaponBus = createCombatBus();
prepareGemSockets(weapon, {
  player: weaponOwner,
  dummy: weaponFoe,
  bus: weaponBus,
  itemsById: byId,
  rng: () => 0,
  t: 0,
});
weaponBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 4 }, t: 1 });
assert.equal(
  getStackAmount(weaponFoe, 'lucky') + getStackAmount(weaponFoe, 'empower'),
  1,
  'source int() removes one buff from the successful weapon hit',
);

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['flawed_amethyst'] }],
  byId,
);
const armorOwner = createActor('player');
const armorFoe = createActor('dummy');
prepareGemSockets(armor, {
  player: armorOwner,
  dummy: armorFoe,
  bus: createCombatBus(),
  itemsById: byId,
  rng: () => 0,
  t: 0,
});
assert.equal(armorFoe._healAmp, -0.36, 'armor Amethyst applies source GemPower times p1');

const integrated = simulateEngine({
  placements: [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['flawed_amethyst'] }],
  itemsById: new Map([
    ['flawed_amethyst', { ...sourceGem, shape: sourceGem.shape || [[1]] }],
    ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
  ]),
  durationSec: 3.5,
  dummyAttacks: false,
});
const combatStart = integrated.snapshots.find((snapshot) => snapshot.t === 2.5);
assert.equal(combatStart?.dummy.healAmp, -0.18, 'real engine projects socketed armor reduction');

console.log('OK Flawed Amethyst source and socket-mode regression');
