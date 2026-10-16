import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'staff_of_fire');
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StaffofFire.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-mana.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const staffOfFirePort'),
  handlerSource.indexOf('/** CritwoodStaff.gd', handlerSource.indexOf('export const staffOfFirePort') + 1),
);

assert.equal(inventory.byId.staff_of_fire?.file, 'Exclusive/StaffofFire.gd');
assert.deepEqual(
  inventory.byId.staff_of_fire?.overrides,
  ['onPreDealDamage_early', 'onPrepare'],
);
assert.match(source, /^extends Weapon/);
assert.match(source, /func onPrepare\(\):[\s\S]*numActivations = 0/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*getHeat\(\) >= heatCost[\s\S]*tryUseMana\(manaCost\)[\s\S]*useHeat\(heatCost, event\)[\s\S]*addBonusDamage\(damBonus\)[\s\S]*numActivations \+= 1/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /onPreDealDamageEarly/);
assert.match(portBlock, /Math\.trunc/);
assert.match(portBlock, /useMana/);
assert.match(portBlock, /spendStacks/);
assert.match(portBlock, /addBonusDamage/);

const staff = {
  ...item,
  itemId: 'staff_of_fire',
  placementKey: 'staff',
  name: 'Staff of Fire',
  params: { p1: 1.9, p2: 1.9, p3: 6.8 },
  kind: 'weapon',
  staminaCost: 1,
  damageMin: 12,
  damageMax: 12,
  accuracy: 100,
  alive: true,
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('staff_of_fire');

assert.equal(handler?.handlerId, 'staff_of_fire');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(staff, ctx);
assert.equal(staff._fireActs, 0, 'prepare resets the activation counter');

player.stacks.mana = 2;
player.stacks.heat = 2;
handler.onPreDealDamageEarly(staff, ctx, { hit: true, damage: 12 });
assert.equal(player.stacks.mana, 1, 'one Mana is spent before the hit resolves');
assert.equal(player.stacks.heat, 1, 'one Heat is spent before the hit resolves');
assert.equal(staff.bonusDamage, 6, 'integer-truncated permanent bonus damage is added');
assert.equal(staff._fireActs, 1, 'successful proc increments the activation counter');

handler.onPreDealDamageEarly(staff, ctx, { hit: true, damage: 12 });
assert.equal(player.stacks.mana, 0, 'the second proc spends the remaining Mana');
assert.equal(player.stacks.heat, 0, 'the second proc spends the remaining Heat');
assert.equal(staff.bonusDamage, 12, 'each successful proc adds the source bonus');
assert.equal(staff._fireActs, 2, 'each successful proc increments once');

handler.onPreDealDamageEarly(staff, ctx, { hit: true, damage: 12 });
assert.equal(staff.bonusDamage, 12, 'insufficient Mana prevents a third proc');
assert.equal(staff._fireActs, 2, 'insufficient resources do not increment the counter');
assert.equal(events.filter((event) => event.type === 'buff').length, 2, 'only successful procs emit the buff projection');

handler.onPrepare(staff, ctx);
player.stacks.mana = 1;
player.stacks.heat = 1;
player.stamina = 10;
const integratedCtx = {
  ...ctx,
  notifyPreDealDamageEarly: (piece, hitCtx) => handler.onPreDealDamageEarly(piece, hitCtx),
};
assert.equal(handler.onCooldownEffect(staff, integratedCtx), true, 'the inherited Weapon path still activates');
const lastBuff = events.map((event) => event.type).lastIndexOf('buff');
const lastActivation = events.map((event) => event.type).lastIndexOf('activate');
assert.ok(lastBuff >= 0 && lastBuff < lastActivation, 'early resource proc precedes Weapon activation');
assert.equal(player.stacks.mana, 0, 'integrated early hook spends Mana before activation');
assert.equal(player.stacks.heat, 0, 'integrated early hook spends Heat before activation');

console.log('OK Staff of Fire source, prepare reset, early resource gate, integer parameters, permanent damage growth, and failed-proc regression');
