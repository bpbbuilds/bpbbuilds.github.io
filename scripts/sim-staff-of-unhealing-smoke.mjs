import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'staff_of_unhealing');
const source = fs.readFileSync('tools/game-extract-full/Items/StaffofUnhealing.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-heal.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const staffOfUnhealingPort'),
  handlerSource.indexOf('/** SunArmor.gd', handlerSource.indexOf('export const staffOfUnhealingPort') + 1),
);

assert.equal(inventory.byId.staff_of_unhealing?.file, 'StaffofUnhealing.gd');
assert.deepEqual(
  inventory.byId.staff_of_unhealing?.overrides,
  ['doCooldownEffect', 'onPrepare'],
);
assert.match(source, /^extends Item/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useStamina\(\)[\s\S]*getP_m\(\"heal\"\)[\s\S]*getMana\(\) >= manaCost[\s\S]*giveUnhealing\(1\.0\)[\s\S]*useMana\(manaCost\)[\s\S]*heal\(healAmount, event\)[\s\S]*heal\(healAmount\)[\s\S]*activate\(\)/);
assert.match(source, /func buffEnded\(\):[\s\S]*reduceUnhealing\(1\.0\)[\s\S]*setState\(false\)/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /applyUnhealing/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /requestedHealAmount/);
assert.match(portBlock, /pushActivate/);

const staff = {
  ...item,
  itemId: 'staff_of_unhealing',
  placementKey: 'staff',
  name: 'Staff of Unhealing',
  params: {
    heal: 8.4,
    p1: 8.4,
    manat: 2,
    p2: 2,
    dur_unhealing: 2,
    p4: 2,
  },
  paramMult: { heal: 2, dur_unhealing: 2 },
  staminaCost: 1.3,
  kind: 'weapon',
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
const handler = getScriptHandler('staff_of_unhealing');

assert.equal(handler?.handlerId, 'staff_of_unhealing');
handler.onPrepare(staff, ctx);
assert.equal(staff._unhealBuff, false, 'prepare clears the temporary state');
assert.equal(staff._unhealUntil, null, 'prepare clears the timer');

player.hp = 50;
player.stamina = 3;
player.stacks.mana = 3;
handler.onCooldownEffect(staff, ctx);
assert.equal(player.stacks.mana, 1, 'the Mana path spends the exact source cost');
assert.ok(Math.abs(player.stamina - 1.7) < 1e-9, 'the source stamina cost is preserved');
assert.equal(staff._unhealUntil, 6, 'the modified Unhealing duration starts at the cooldown time');
assert.equal(player.hp, 67, 'the modified heal is rounded by the actor heal path');
assert.equal(events.at(-1)?.type, 'activate', 'activation follows state, Mana, and healing effects');

player.hp = 40;
player.stamina = 2;
const manaBeforeNoManaPath = player.stacks.mana;
handler.onCooldownEffect(staff, { ...ctx, t: 3 });
assert.equal(player.stacks.mana, manaBeforeNoManaPath, 'insufficient Mana leaves Mana unchanged');
assert.equal(player.unhealing, 1, 'the active temporary state remains until its timer ends');
assert.equal(player.hp, 57, 'the no-Mana branch still heals');
assert.equal(events.at(-1)?.type, 'activate', 'the no-Mana branch still activates after healing');

handler.onTick(staff, { ...ctx, t: 6 });
assert.equal(player.unhealing, 0, 'timer expiry removes the temporary Unhealing state');
assert.equal(staff._unhealBuff, false, 'timer expiry clears the active flag');

player.hp = 30;
player.stamina = 0;
player.stacks.mana = 2;
const eventCountBeforeStarve = events.length;
handler.onCooldownEffect(staff, { ...ctx, t: 8 });
assert.equal(player.stacks.mana, 2, 'starved cooldown does not spend Mana');
assert.equal(player.hp, 30, 'starved cooldown does not heal');
assert.equal(events.length, eventCountBeforeStarve, 'starved cooldown has no item effects');

console.log('OK Staff of Unhealing source, prepare reset, stamina gate, Mana/unhealing branch, modified heal, timer expiry, activation ordering, and starve regression');
