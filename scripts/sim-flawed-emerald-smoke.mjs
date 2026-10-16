/**
 * Flawed Emerald fidelity — inherited Emerald inventory, weapon socket,
 * armor GemPower scaling, and source-owned raw stack amounts.
 *   node scripts/sim-flawed-emerald-smoke.mjs
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
const sourceGem = catalog.find((entry) => entry.id === 'flawed_emerald');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const emeraldSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Emerald.gd', 'utf8');
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const gemSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Gem.gd', 'utf8');
assert.match(emeraldSource, /func doCooldownEffect\(\):\s*\n\s*giveRegeneration\(getP3\(\)\)\s*\n\s*onAfterEffectFinished\(\)/);
assert.match(emeraldSource, /func prepareWeapon\(\):\s*\n\s*connectForCombat\(socket\.getItem\(\), "attacked", "onAttack"\)/);
assert.match(emeraldSource, /inflictPoison\(getP1\(\), damageRes\.event\)/);
assert.match(emeraldSource, /character\(\)\.changeResistChance\(Game\.EventType\.Poison, getGemPower\(\) \* getP2\(\)\)/);
assert.match(itemSource, /return target\.gainStacks\(type, round\(amount \* buffPowers\[type\]\)/);
assert.match(gemSource, /var gemPower = 1\.0/);

const gem = {
  ...sourceGem,
  shape: sourceGem.shape || [[1]],
  // Fractional values prove the source passes raw amounts to giveStacks;
  // GemPower proves armor uses the inherited multiplier.
  params: { p1: 0.4, p2: 15, p3: 0.4, poison: 0.4, regen: 0.4, chance: 100 },
  gemPower: 2,
};
const byId = new Map([
  ['flawed_emerald', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const handler = getScriptHandler('flawed_emerald');
assert.equal(handler?.handlerId, 'flawed_emerald');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const inventoryOwner = createActor('player');
const inventoryFoe = createActor('dummy');
const inventoryEvents = [];
handler.onCooldownEffect(
  { itemId: 'flawed_emerald', placementKey: 'inventory', name: 'Flawed Emerald', params: gem.params, alive: true },
  { player: inventoryOwner, dummy: inventoryFoe, events: inventoryEvents, t: 5, rng: () => 0 },
);
assert.equal(inventoryOwner.stacks.regeneration, 0, 'inventory uses raw source regeneration amount');
assert.equal(inventoryEvents.at(-1)?.type, 'activate', 'inventory Emerald activates after its effect');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['flawed_emerald'] }],
  byId,
);
const weaponOwner = createActor('player');
const weaponFoe = createActor('dummy');
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
assert.equal(weaponFoe.stacks.poison, 0, 'weapon hit passes raw fractional poison to source stack rounding');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['flawed_emerald'] }],
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
assert.equal(armorOwner.stackResist.poison, 30, 'armor Emerald applies source GemPower times poison resistance');

console.log('OK Flawed Emerald source, inventory, weapon, and armor regression');
