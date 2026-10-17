import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpikedStaff.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-mana.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const spikedStaffPort'),
  handlerSource.indexOf('/** StaffofFire.gd'),
);
const sourceItem = catalog.find((item) => item.id === 'spiked_staff');

assert.ok(sourceItem, 'Spiked Staff: extracted catalog row');
assert.equal(inventory.byId.spiked_staff?.file, 'Exclusive/SpikedStaff.gd');
assert.deepEqual(inventory.byId.spiked_staff?.overrides, ['onPreDealDamage_early']);
assert.equal(sourceItem.cost, 16, 'Spiked Staff: catalog cost');
assert.equal(sourceItem.staminaCost, 1, 'Spiked Staff: catalog stamina');
assert.equal(sourceItem.cooldown, 1.8, 'Spiked Staff: catalog cooldown');
assert.deepEqual(sourceItem.params, {
  mana: 3,
  p1: 3,
  empower: 2,
  p2: 2,
  spikes: 5,
  p3: 5,
});
assert.match(source, /onready var manaCost = getP\("mana"\)/);
assert.match(source, /onready var empower = getP\("empower"\)/);
assert.match(source, /onready var spikes = getP\("spikes"\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*tryUseMana\(manaCost\)[\s\S]*giveEmpower\(empower, event\)[\s\S]*isBattleRaging\(\)[\s\S]*giveSpikes\(spikes, event\)/);
assert.match(portBlock, /onPreDealDamageEarly/);
assert.doesNotMatch(portBlock, /onDealtDamage/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, '(?:mana|empower|spikes)'/);

function makeContext({ params = sourceItem.params, mana = 3, raging = false, accuracy = 100 } = {}) {
  const player = createActor('player');
  const dummy = createActor('dummy', { maxHp: 120 });
  player.stacks.mana = mana;
  player.battleRage = raging;
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  const piece = {
    ...sourceItem,
    itemId: 'spiked_staff',
    placementKey: 'staff',
    name: 'Spiked Staff',
    params: { ...params },
    kind: 'weapon',
    side: 'you',
    alive: true,
    baseCooldown: sourceItem.cooldown,
    chance: sourceItem.chance,
    accuracy,
  };
  return {
    t: 2,
    player,
    dummy,
    events,
    rng: () => accuracy < 100 ? 0.99 : 0,
    pieces: [piece],
    itemsById: new Map([['spiked_staff', sourceItem]]),
    graph: null,
    piece,
  };
}

const handler = getScriptHandler('spiked_staff');
assert.equal(handler?.handlerId, 'spiked_staff');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const combat = makeContext({ raging: true });
handler.onCooldownEffect(combat.piece, combat);
assert.equal(combat.player.stacks.mana, 0,
  'Spiked Staff: source early hook spends the Mana cost before the hit resolves');
assert.equal(combat.player.stacks.empower, 2,
  'Spiked Staff: successful Mana use grants source Empower');
assert.equal(combat.player.stacks.spikes, 5,
  'Spiked Staff: Battle Rage adds source Spikes in the same early hook');
assert.equal(combat.events.filter((event) => event.type === 'damage').length, 1,
  'Spiked Staff: the weapon still produces one normal hit');

const calm = makeContext({ raging: false });
handler.onCooldownEffect(calm.piece, calm);
assert.equal(calm.player.stacks.empower, 2,
  'Spiked Staff: Empower does not require Battle Rage');
assert.equal(calm.player.stacks.spikes, 0,
  'Spiked Staff: Spikes require Battle Rage');

const miss = makeContext({ raging: true, accuracy: 0 });
handler.onCooldownEffect(miss.piece, miss);
assert.equal(miss.player.stacks.mana, 0,
  'Spiked Staff: the source early hook runs before a miss is returned');
assert.equal(miss.player.stacks.empower, 2,
  'Spiked Staff: a miss still follows the source early-hook Mana event');
assert.equal(miss.player.stacks.spikes, 5,
  'Spiked Staff: a miss still follows the source Battle Rage branch');

const zero = makeContext({
  params: { mana: 0, p1: 0, empower: 0, p2: 0, spikes: 0, p3: 0 },
  mana: 0,
  raging: true,
});
handler.onCooldownEffect(zero.piece, zero);
assert.equal(zero.player.stacks.empower, 0,
  'Spiked Staff: explicit zero Empower is preserved');
assert.equal(zero.player.stacks.spikes, 0,
  'Spiked Staff: explicit zero Spikes is preserved');

console.log('Spiked Staff source/parity smoke passed.');
