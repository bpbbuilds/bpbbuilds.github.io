import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceGem = catalog.find((entry) => entry.id === 'regular_ruby');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem, 'Regular Ruby catalog fixtures');

const rubySource = fs.readFileSync('tools/game-extract-full/Items/Gems/Ruby.gd', 'utf8');
const gemSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Gem.gd', 'utf8');
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/gem-sockets.js', 'utf8');

assert.match(rubySource, /func doCooldownEffect\(\):\s*\n\s*stealLife\(getP3\(\), getP_m\("lifesteal_factor"\) \/ 100\.0\)\s*\n\s*onAfterEffectFinished\(\)/);
assert.match(rubySource, /func prepareWeapon\(\):\s*\n\s*connectForCombat\(socket\.getItem\(\), "attacked", "onAttack"\)/);
assert.match(rubySource, /heal\(ceil\(damageRes\.damage \* getP_m\("lifesteal_weapon"\) \/ 100\.0\), damageRes\.event\)/);
assert.match(rubySource, /if damageRes\.hasHit\(\):[\s\S]*?miniActivate\(\)/);
assert.match(rubySource, /character\(\)\.addHealingEfficiency\(getGemPower\(\) \* getP2\(\) \/ 100\.0\)/);
assert.match(gemSource, /func miniActivate\(\):[\s\S]*?\.miniActivate\(\)/);
assert.match(itemSource, /func stealLife\(damage, lifestealFactor: float = 1\.0, triggerEvent = null\):/);
assert.match(port, /fam === 'ruby'/);

assert.equal(sourceGem.cooldown, 5);
assert.equal(sourceGem.params.p1, 15);
assert.equal(sourceGem.params.p2, 20);
assert.equal(sourceGem.params.p3, 10);
assert.equal(sourceGem.params.p4, 150);

const handler = getScriptHandler('regular_ruby');
assert.equal(handler?.handlerId, 'regular_ruby');

{
  const owner = createActor('player');
  const foe = createActor('dummy');
  owner.hp = 50;
  const events = [];
  handler.onCooldownEffect(
    { itemId: 'regular_ruby', placementKey: 'inventory', name: 'Regular Ruby', params: sourceGem.params },
    { player: owner, dummy: foe, events, rng: () => 0, t: 5 },
  );
  assert.equal(foe.hp, foe.maxHp - 10, 'inventory deals source P3 effect damage');
  assert.equal(owner.hp, 65, 'inventory heals source damage x lifesteal_factor');
  assert.equal(events.at(-1)?.type, 'activate', 'inventory effect finishes with activation');
}

const byId = new Map([
  ['regular_ruby', { ...sourceGem, shape: sourceGem.shape || [[1]] }],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

{
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: 'ruby-weapon', x: 0, y: 0, r: 0, gems: ['regular_ruby'] }],
    byId,
  );
  const owner = createActor('player');
  const foe = createActor('dummy');
  owner.hp = owner.maxHp - 10;
  const events = [];
  const bus = createCombatBus();
  prepareGemSockets(weapon, {
    player: owner,
    dummy: foe,
    events,
    bus,
    itemsById: byId,
    rng: () => 0,
    t: 2,
  });
  bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 20 }, t: 2 });
  assert.equal(owner.hp, owner.maxHp - 7, 'weapon hit heals ceil(damage x lifesteal_weapon)');
  assert.ok(
    events.some((event) => event.itemId === 'regular_ruby' && event.meta?.miniActivate),
    'weapon hit emits source miniActivate projection',
  );
}

{
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'ruby-armor', x: 0, y: 0, r: 0, gems: ['regular_ruby'] }],
    byId,
  );
  const owner = createActor('player');
  const events = [];
  prepareGemSockets(armor, {
    player: owner,
    dummy: createActor('dummy'),
    events,
    bus: createCombatBus(),
    itemsById: byId,
    rng: () => 0,
    t: 0,
  });
  assert.equal(owner._healAmp, 0.2, 'armor applies GemPower x P2 healing efficiency');
}

{
  const zero = {
    ...sourceGem,
    params: { p1: 0, p2: 0, p3: 0, p4: 0, lifesteal_weapon: 0, lifesteal_factor: 0 },
    shape: [[1]],
  };
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: 'ruby-zero', x: 0, y: 0, r: 0, gems: ['regular_ruby'] }],
    new Map([
      ['regular_ruby', zero],
      ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
    ]),
  );
  const owner = createActor('player');
  const foe = createActor('dummy');
  owner.hp = owner.maxHp - 10;
  const events = [];
  const bus = createCombatBus();
  const itemsById = new Map([
    ['regular_ruby', zero],
    ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ]);
  prepareGemSockets(weapon, {
    player: owner,
    dummy: foe,
    events,
    bus,
    itemsById,
    rng: () => 0,
    t: 0,
  });
  bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 20 }, t: 0 });
  assert.equal(owner.hp, owner.maxHp - 10, 'zero lifesteal weapon value does not heal');
  assert.ok(events.some((event) => event.meta?.miniActivate), 'zero lifesteal still preserves miniActivate');
}

console.log('Regular Ruby source/parity smoke passed.');
