/**
 * Perfect Topaz fidelity — explicit Godly Topaz.gd tier alias with actual
 * inventory, weapon, and GemPower-scaled armor values.
 *   node scripts/sim-perfect-topaz-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceGem = catalog.find((entry) => entry.id === 'perfect_topaz');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const row = inventory.byId.perfect_topaz;
assert.equal(row?.sceneFile, 'Gems/PerfectTopaz.tscn');
assert.equal(row?.file, 'Gems/Topaz.gd');
assert.equal(row?.extends, 'Gem');

const topazSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Topaz.gd', 'utf8');
assert.match(topazSource, /giveStaminaRegeneration\(getP2\(\) \/ 100\.0\)/);
assert.match(topazSource, /socket\.getItem\(\)\.addSpeed\(getP1\(\) \/ 100\)/);
assert.match(topazSource, /changeStunResistance\(getGemPower\(\) \* getChance\(\)/);
assert.match(topazSource, /changeCritResistance\(getGemPower\(\) \* getChance2\(\)/);

const gem = { ...sourceGem, shape: sourceGem.shape || [[1]], gemPower: 2 };
const byId = new Map([
  ['perfect_topaz', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const handler = getScriptHandler('perfect_topaz');
assert.equal(handler?.handlerId, 'perfect_topaz');
const inventoryOwner = createActor('player');
handler.onPrepare(
  { itemId: 'perfect_topaz', placementKey: 'inventory', name: 'Perfect Topaz', params: gem.params },
  { player: inventoryOwner, dummy: createActor('dummy'), events: [], t: 0 },
);
assert.equal(inventoryOwner.staminaRegen, 1.5, 'Perfect Topaz inventory adds source p2 stamina regen');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['perfect_topaz'] }],
  byId,
);
prepareGemSockets(weapon, {
  player: createActor('player'),
  dummy: createActor('dummy'),
  bus: createCombatBus(),
  itemsById: byId,
  rng: () => 0,
  t: 0,
});
assert.equal(weapon.speedScale, 0.4, 'Perfect Topaz weapon applies source p1 attack speed');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['perfect_topaz'] }],
  byId,
);
const armorOwner = createActor('player');
prepareGemSockets(armor, {
  player: armorOwner,
  dummy: createActor('dummy'),
  bus: createCombatBus(),
  itemsById: byId,
  rng: () => 0,
  t: 0,
});
assert.equal(armorOwner.stunResistance, 100, 'Perfect Topaz armor applies GemPower-scaled stun resistance');
assert.equal(armorOwner.critResistance, 60, 'Perfect Topaz armor applies GemPower-scaled crit resistance');

console.log('OK Perfect Topaz source alias and socket regression');
