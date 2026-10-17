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
const sourceGem = catalog.find((entry) => entry.id === 'regular_sapphire');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem, 'Regular Sapphire catalog fixtures');

const sapphireSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Sapphire.gd', 'utf8');
const gemSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Gem.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/gem-sockets.js', 'utf8');

assert.match(sapphireSource, /func doCooldownEffect\(\):\s*\n\s*inflictCold\(getP5\(\)\)\s*\n\s*onAfterEffectFinished\(\)/);
assert.match(sapphireSource, /connectForCombat\(socket\.getItem\(\), "pre_deal_damage_late", "preAttack"\)/);
assert.match(sapphireSource, /connectForCombat\(socket\.getItem\(\), "attacked", "onAttack"\)/);
assert.match(sapphireSource, /if spectral and damageRes\.hasHit\(\):[\s\S]*?giveMana\(getP1\(\), damageRes\.event\)[\s\S]*?inflictCold\(getP4\(\), damageRes\.event\)[\s\S]*?miniActivate\(\)/);
assert.match(sapphireSource, /var manaNeeded = int\(getP2\(\)/);
assert.match(sapphireSource, /giveBlock\(getGemPower\(\) \* block, event\)[\s\S]*?miniActivate\(\)/);
assert.match(gemSource, /func miniActivate\(\):[\s\S]*?\.miniActivate\(\)/);
assert.match(port, /fam === 'sapphire'/);

assert.equal(sourceGem.cooldown, 4);
assert.equal(sourceGem.chance, 40);
assert.deepEqual(sourceGem.params, { p1: 1, p2: 5, p3: 4, p4: 1, p5: 4 });

const handler = getScriptHandler('regular_sapphire');
assert.equal(handler?.handlerId, 'regular_sapphire');

{
  const owner = createActor('player');
  const foe = createActor('dummy');
  const events = [];
  handler.onCooldownEffect(
    { itemId: 'regular_sapphire', placementKey: 'inventory', name: 'Regular Sapphire', params: sourceGem.params },
    { player: owner, dummy: foe, events, rng: () => 0, t: 5 },
  );
  assert.equal(foe.stacks.cold, 4, 'inventory inflicts source P5 Cold');
  assert.equal(events.at(-1)?.type, 'activate', 'inventory effect finishes with activation');
}

const byId = new Map([
  ['regular_sapphire', { ...sourceGem, shape: sourceGem.shape || [[1]] }],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

{
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: 'sapphire-weapon', x: 0, y: 0, r: 0, gems: ['regular_sapphire'] }],
    byId,
  );
  const owner = createActor('player');
  const foe = createActor('dummy', { block: 999 });
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
  const damageResult = { damageSource: {} };
  for (const fn of weapon._preDealLate || []) fn(damageResult);
  assert.equal(damageResult.damageSource.spectral, true, 'weapon pre-hit marks the source spectral');
  bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 30 }, t: 2 });
  assert.equal(owner.stacks.mana, 1, 'spectral weapon hit grants source P1 Mana');
  assert.equal(foe.stacks.cold, 1, 'spectral weapon hit inflicts source P4 Cold');
  assert.ok(
    events.some((event) => event.itemId === 'regular_sapphire' && event.meta?.miniActivate),
    'spectral weapon hit emits source miniActivate projection',
  );
}

{
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'sapphire-armor', x: 0, y: 0, r: 0, gems: ['regular_sapphire'] }],
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
  grantStacks(owner, 'mana', 5, { originKey: 'mana', originId: 'mana' });
  assert.equal(owner.block, 4, 'armor converts one source Mana threshold to GemPower-scaled Block');
  assert.ok(
    events.some((event) => event.itemId === 'regular_sapphire' && event.meta?.miniActivate),
    'armor block conversion emits source miniActivate projection',
  );
}

{
  const zero = {
    ...sourceGem,
    params: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 },
    shape: [[1]],
  };
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'sapphire-zero', x: 0, y: 0, r: 0, gems: ['regular_sapphire'] }],
    new Map([
      ['regular_sapphire', zero],
      ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
    ]),
  );
  const owner = createActor('player');
  prepareGemSockets(armor, {
    player: owner,
    dummy: createActor('dummy'),
    events: [],
    bus: createCombatBus(),
    itemsById: new Map([
      ['regular_sapphire', zero],
      ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
    ]),
    rng: () => 0,
    t: 0,
  });
  grantStacks(owner, 'mana', 1, { originKey: 'zero', originId: 'zero' });
  assert.equal(owner.block, 0, 'zero Mana threshold remains a safe no-op');
}

console.log('Regular Sapphire source/parity smoke passed.');
