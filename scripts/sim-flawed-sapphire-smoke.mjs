/**
 * Flawed Sapphire fidelity — inherited Sapphire inventory cold, spectral
 * weapon Mana/Cold, and armor Mana-to-Block conversion.
 *   node scripts/sim-flawed-sapphire-smoke.mjs
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
const sourceGem = catalog.find((entry) => entry.id === 'flawed_sapphire');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const sapphireSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Sapphire.gd', 'utf8');
assert.match(sapphireSource, /onready var manaNeeded = int\(getP2\(\)/);
assert.match(sapphireSource, /func doCooldownEffect\(\):\s*\n\s*inflictCold\(getP5\(\)\)\s*\n\s*onAfterEffectFinished\(\)/);
assert.match(sapphireSource, /connectForCombat\(socket\.getItem\(\), "pre_deal_damage_late", "preAttack"\)/);
assert.match(sapphireSource, /giveMana\(getP1\(\), damageRes\.event\)\s*\n\s*inflictCold\(getP4\(\), damageRes\.event\)/);
assert.match(sapphireSource, /var block = relMana \* getP3\(\)/);
assert.match(sapphireSource, /giveBlock\(getGemPower\(\) \* block, event\)/);

const gem = {
  ...sourceGem,
  shape: sourceGem.shape || [[1]],
  params: { p1: 0.4, p2: 1.9, p3: 0.4, p4: 0.4, p5: 0.4 },
  chance: 100,
  gemPower: 2,
};
const byId = new Map([
  ['flawed_sapphire', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const handler = getScriptHandler('flawed_sapphire');
assert.equal(handler?.handlerId, 'flawed_sapphire');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const inventoryOwner = createActor('player');
const inventoryFoe = createActor('dummy');
const inventoryEvents = [];
handler.onCooldownEffect(
  { itemId: 'flawed_sapphire', placementKey: 'inventory', name: 'Flawed Sapphire', params: gem.params, alive: true },
  { player: inventoryOwner, dummy: inventoryFoe, events: inventoryEvents, t: 5, rng: () => 0 },
);
assert.equal(inventoryFoe.stacks.cold, 0, 'inventory Sapphire keeps raw fractional Cold amount');
assert.equal(inventoryEvents.at(-1)?.type, 'activate', 'inventory Sapphire activates after Cold');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['flawed_sapphire'] }],
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
assert.equal(damageResult.damageSource.spectral, true, 'weapon pre-attack makes the strike spectral');
weaponBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 4 }, t: 1 });
assert.equal(weaponOwner.stacks.mana, 0, 'spectral weapon hit keeps raw fractional Mana amount');
assert.equal(weaponFoe.stacks.cold, 0, 'spectral weapon hit keeps raw fractional Cold amount');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['flawed_sapphire'] }],
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
// Source int(1.9) gives a one-Mana threshold; 1 Mana × p3 .4 × GemPower 2
// reaches one Block only after the source multiplication-before-rounding path.
grantStacks(armorOwner, 'mana', 1);
assert.equal(armorOwner.block, 1, 'armor Sapphire converts Mana using int threshold and GemPower');

console.log('OK Flawed Sapphire source, inventory, weapon, and armor regression');
