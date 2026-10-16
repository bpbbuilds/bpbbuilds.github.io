/**
 * Flawless Sapphire fidelity — explicit Sapphire.gd tier alias with actual
 * inventory, spectral weapon, and armor values.
 *   node scripts/sim-flawless-sapphire-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceGem = catalog.find((entry) => entry.id === 'flawless_sapphire');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const row = inventory.byId.flawless_sapphire;
assert.equal(row?.sceneFile, 'Gems/FlawlessSapphire.tscn');
assert.equal(row?.file, 'Gems/Sapphire.gd');
assert.equal(row?.extends, 'Gem');

const sapphireSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Sapphire.gd', 'utf8');
assert.match(sapphireSource, /onready var manaNeeded = int\(getP2\(\)/);
assert.match(sapphireSource, /inflictCold\(getP5\(\)\)/);
assert.match(sapphireSource, /giveMana\(getP1\(\), damageRes\.event\)\s*\n\s*inflictCold\(getP4\(\), damageRes\.event\)/);
assert.match(sapphireSource, /giveBlock\(getGemPower\(\) \* block, event\)/);

const gem = { ...sourceGem, shape: sourceGem.shape || [[1]], chance: 100, gemPower: 2 };
const byId = new Map([
  ['flawless_sapphire', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const handler = getScriptHandler('flawless_sapphire');
assert.equal(handler?.handlerId, 'flawless_sapphire');
const inventoryOwner = createActor('player');
const inventoryFoe = createActor('dummy');
const inventoryEvents = [];
handler.onCooldownEffect(
  { itemId: 'flawless_sapphire', placementKey: 'inventory', name: 'Flawless Sapphire', params: gem.params, alive: true },
  { player: inventoryOwner, dummy: inventoryFoe, events: inventoryEvents, t: 5, rng: () => 0 },
);
assert.equal(inventoryFoe.stacks.cold, 5, 'Flawless Sapphire inventory gives source p5 Cold');
assert.equal(inventoryEvents.at(-1)?.type, 'activate', 'Flawless Sapphire inventory activates after Cold');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['flawless_sapphire'] }],
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
const damageResult = { damageSource: {} };
weapon._preDealLate[0](damageResult);
assert.equal(damageResult.damageSource.spectral, true, 'Flawless Sapphire weapon hit is spectral');
weaponBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 4 }, t: 1 });
assert.equal(weaponOwner.stacks.mana, 1, 'Flawless Sapphire weapon gives source p1 Mana');
assert.equal(weaponFoe.stacks.cold, 1, 'Flawless Sapphire weapon gives source p4 Cold');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['flawless_sapphire'] }],
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
grantStacks(armorOwner, 'mana', 5);
assert.equal(armorOwner.block, 10, 'Flawless Sapphire armor applies source threshold, p3, and GemPower');

console.log('OK Flawless Sapphire source alias and socket regression');
