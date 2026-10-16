import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { dealDamage } from '../js/pages/sim/engine/damage.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { emitBuffChanged } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

function source(id, file, extendsName, overrides) {
  const row = inventory.byId[id];
  assert.ok(row, `${id} has a source inventory row`);
  assert.equal(row.file, file);
  assert.equal(row.extends, extendsName);
  assert.deepEqual(row.overrides, overrides);
  return row;
}

const amethyst = source('chipped_amethyst', 'Gems/Amethyst.gd', 'Gem', ['doCooldownEffect']);
const chrome = source('chrome_cube', 'Exclusive/ChromeCube.gd', 'Cube', ['onPrepare']);
const claws = source('claws_of_attack', 'ClawsofAttack.gd', 'Weapon', [
  'onPreDealDamage_early',
  'onPrepare',
]);

assert.ok(amethyst.sourceMethods.includes('prepareWeapon'));
assert.ok(amethyst.sourceMethods.includes('prepareArmor'));
assert.deepEqual(chrome.sourceMethods || [], []);
const clawsSourceText = fs.readFileSync('tools/game-extract-full/Items/ClawsofAttack.gd', 'utf8');
assert.match(clawsSourceText, /func onShopEntered\(\)/);
assert.equal(getScriptHandler('chipped_amethyst')?.handlerId, 'chipped_amethyst');
assert.equal(getScriptHandler('chrome_cube')?.handlerId, 'chrome_cube');
assert.equal(getScriptHandler('claws_of_attack')?.handlerId, 'claws_of_attack');

// ChromeCube.gd resolves its first linked cooldown item during onPrepare and
// reacts to the actual character_damaged signal once the foe is below 50%.
{
  const testWeapon = {
    id: 'chrome_test_weapon',
    name: 'Chrome Test Weapon',
    displayName: 'Chrome Test Weapon',
    type: 'Melee Weapon',
    cooldown: 1,
    staminaCost: 0,
    damageMin: 1,
    damageMax: 1,
    accuracy: 100,
    params: {},
    shape: [[1]],
    rarity: 'Common',
  };
  const items = new Map([
    [byId.get('chrome_cube').id, byId.get('chrome_cube')],
    [testWeapon.id, testWeapon],
  ]);
  const placements = [
    { id: 'chrome_cube', key: 'cube', x: 0, y: 1, r: 0 },
    { id: testWeapon.id, key: 'weapon', x: 0, y: 0, r: 0 },
  ];
  const pieces = buildCombatPieces(placements, items);
  const cube = pieces.find((piece) => piece.itemId === 'chrome_cube');
  const weapon = pieces.find((piece) => piece.itemId === testWeapon.id);
  assert.ok(cube && weapon);
  weapon.triggerTime = 3;
  const player = createActor('player');
  const dummy = createActor('dummy', { maxHp: 10 });
  dummy.hp = 4;
  const events = [];
  const bus = createCombatBus();
  cube._eventLog = events;
  weapon._eventLog = events;
  const ctx = {
    player,
    dummy,
    events,
    bus,
    t: 3,
    graph: buildBoardGraph(placements, items),
    itemsById: items,
    canAffect: null,
    pieces,
    rng: () => 0,
  };
  getScriptHandler('chrome_cube').onPrepare(cube, ctx);
  dealDamage(player, dummy, {
    amount: 1,
    originPiece: weapon,
    accuracy: 100,
    canMiss: false,
    canCrit: false,
    isAttack: true,
    isMelee: true,
    nowT: 3,
    events,
    bus,
    rng: () => 0,
  });
  assert.equal(cube.alive, false);
  assert.equal(cube._cube, true);
  assert.equal(weapon.triggerTime, 1.5);
  assert.equal(dummy._healAmp, -0.35);
  assert.ok(events.some((event) => event.itemId === 'chrome_cube' && event.type === 'stat'));
}

// ClawsofAttack.gd connects during onPrepare, updates speed from Spikes, and
// counts only successful early damage results before granting Empower.
{
  const items = new Map([[byId.get('claws_of_attack').id, byId.get('claws_of_attack')]]);
  const [clawsPiece] = buildCombatPieces(
    [{ id: 'claws_of_attack', key: 'claws', x: 0, y: 0, r: 0 }],
    items,
  );
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const ctx = {
    player,
    dummy,
    events,
    bus: createCombatBus(),
    t: 4,
    graph: buildBoardGraph([{ id: 'claws_of_attack', key: 'claws', x: 0, y: 0, r: 0 }], items),
    itemsById: items,
    canAffect: null,
    pieces: [clawsPiece],
    rng: () => 0,
  };
  const handler = getScriptHandler('claws_of_attack');
  handler.onPrepare(clawsPiece, ctx);
  player.stacks.spikes = 3;
  emitBuffChanged(player, { stack: 'spikes', amount: 3, originKey: 'spikes', originId: 'test' });
  assert.equal(clawsPiece.speedScale, 0.15);
  for (let i = 0; i < 3; i += 1) handler.onPreDealDamageEarly(clawsPiece, ctx, { hit: true });
  assert.equal(player.stacks.empower, 0);
  handler.onPreDealDamageEarly(clawsPiece, ctx, { hit: true });
  assert.equal(player.stacks.empower, 1);
  assert.ok(events.some((event) => event.meta?.handler === 'claws_of_attack'));
}

console.log('OK Chipped Amethyst, Chrome Cube, and Claws of Attack source ports');
