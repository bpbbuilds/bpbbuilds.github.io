import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceGem = catalog.find((entry) => entry.id === 'regular_emerald');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem, 'Regular Emerald catalog fixtures');

const emeraldSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Emerald.gd', 'utf8');
const gemSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Gem.gd', 'utf8');
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/gem-sockets.js', 'utf8');

assert.match(emeraldSource, /func doCooldownEffect\(\):\s*\n\s*giveRegeneration\(getP3\(\)\)\s*\n\s*onAfterEffectFinished\(\)/);
assert.match(emeraldSource, /func prepareWeapon\(\):\s*\n\s*connectForCombat\(socket\.getItem\(\), "attacked", "onAttack"\)/);
assert.match(emeraldSource, /if damageRes\.hasHit\(\):[\s\S]*?inflictPoison\(getP1\(\), damageRes\.event\)[\s\S]*?miniActivate\(\)/);
assert.match(emeraldSource, /character\(\)\.changeResistChance\(Game\.EventType\.Poison, getGemPower\(\) \* getP2\(\)\)/);
assert.match(gemSource, /func miniActivate\(\):[\s\S]*?\.miniActivate\(\)/);
assert.match(itemSource, /func giveRegeneration\(amount, triggerEvent = null\):/);
assert.match(port, /fam === 'emerald'/);

assert.equal(sourceGem.cooldown, 4);
assert.equal(sourceGem.chance, 80);
assert.equal(sourceGem.params.p1, 1);
assert.equal(sourceGem.params.p2, 20);
assert.equal(sourceGem.params.p3, 3);

const handler = getScriptHandler('regular_emerald');
assert.equal(handler?.handlerId, 'regular_emerald');

const owner = createActor('player');
const foe = createActor('dummy');
owner.hp -= 20;
const inventoryEvents = [];
handler.onCooldownEffect(
  { itemId: 'regular_emerald', placementKey: 'inventory', name: 'Regular Emerald', params: sourceGem.params },
  { player: owner, dummy: foe, events: inventoryEvents, rng: () => 0, t: 5 },
);
assert.equal(owner.stacks.regeneration, 3, 'inventory grants source P3 regeneration');
assert.equal(inventoryEvents.at(-1)?.type, 'activate', 'inventory effect finishes with activation');

const byId = new Map([
  ['regular_emerald', { ...sourceGem, shape: sourceGem.shape || [[1]] }],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

{
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: 'emerald-weapon', x: 0, y: 0, r: 0, gems: ['regular_emerald'] }],
    byId,
  );
  const socketOwner = createActor('player');
  const socketFoe = createActor('dummy');
  const events = [];
  const bus = createCombatBus();
  prepareGemSockets(weapon, {
    player: socketOwner,
    dummy: socketFoe,
    events,
    bus,
    itemsById: byId,
    rng: () => 0,
    t: 2,
  });
  bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 10 }, t: 2 });
  assert.equal(socketFoe.stacks.poison, 1, 'weapon hit inflicts source P1 poison');
  assert.ok(
    events.some((event) => event.itemId === 'regular_emerald' && event.meta?.miniActivate),
    'weapon hit emits source miniActivate projection',
  );
}

{
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'emerald-armor', x: 0, y: 0, r: 0, gems: ['regular_emerald'] }],
    byId,
  );
  const armorOwner = createActor('player');
  prepareGemSockets(armor, {
    player: armorOwner,
    dummy: createActor('dummy'),
    events: [],
    bus: createCombatBus(),
    itemsById: byId,
    rng: () => 0,
    t: 0,
  });
  assert.equal(armorOwner.stackResist.poison, 20, 'armor applies GemPower x P2 poison resistance');
}

{
  const zero = { ...sourceGem, params: { p1: 0, p2: 0, p3: 0 }, shape: [[1]] };
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: 'emerald-zero', x: 0, y: 0, r: 0, gems: ['regular_emerald'] }],
    new Map([
      ['regular_emerald', zero],
      ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
    ]),
  );
  const zeroOwner = createActor('player');
  const zeroFoe = createActor('dummy');
  const events = [];
  const bus = createCombatBus();
  prepareGemSockets(weapon, {
    player: zeroOwner,
    dummy: zeroFoe,
    events,
    bus,
    itemsById: new Map([
      ['regular_emerald', zero],
      ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
    ]),
    rng: () => 0,
    t: 0,
  });
  bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 10 }, t: 0 });
  assert.equal(zeroFoe.stacks.poison || 0, 0, 'zero P1 does not grant poison');
  assert.ok(events.some((event) => event.meta?.miniActivate), 'zero P1 still preserves miniActivate');
}

console.log('Regular Emerald source/parity smoke passed.');
