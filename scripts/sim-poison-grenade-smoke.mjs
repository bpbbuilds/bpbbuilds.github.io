import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const grenadeItem = catalog.find((item) => item.id === 'poison_grenade');
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PoisonGrenade.gd', 'utf8');

assert.equal(inventory.byId.poison_grenade?.file, 'Exclusive/PoisonGrenade.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_lucky_changed", "onLuckChanged"\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictPoison\(poison\)[\s\S]*selfInflictPoison\(selfPoison\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(source, /func onChargeReceived\(_charge\):[\s\S]*advanceCooldownSeconds\(cdAdvance\)/);
assert.match(source, /func onLuckChanged\(amount, event\):[\s\S]*character\(\)\.getLucky\(\) >= luckNeeded[\s\S]*changePoisonCritChancePercent\( - getChance\(\)\)/);
assert.equal(grenadeItem.params.p1, 20);
assert.equal(grenadeItem.params.p2, 12);
assert.equal(grenadeItem.params.p3, 1.5);
assert.equal(grenadeItem.params.p4, 5);

const piece = {
  ...grenadeItem,
  itemId: 'poison_grenade',
  placementKey: 'grenade',
  name: 'Poison Grenade',
  params: grenadeItem.params,
  kind: 'gadget',
  alive: true,
  charges: 1,
  cooldown: 10,
  triggerTime: 10,
  baseCooldown: 10,
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const events = [];
const itemsById = new Map([['poison_grenade', grenadeItem]]);
const ctx = {
  player,
  dummy,
  events,
  t: 4,
  itemsById,
  rng: () => 0,
  activatePiece: () => true,
};
const handler = getScriptHandler('poison_grenade');

assert.equal(handler?.handlerId, 'poison_grenade');
handler.onPrepare(piece, ctx);
grantStacks(player, 'lucky', 5, { originKey: piece.placementKey, originId: piece.itemId });
assert.equal(dummy.poisonCritChance, 30, 'lucky threshold enables Poison Crit chance');
spendStacks(player, 'lucky', 1, { originKey: piece.placementKey, originId: piece.itemId });
assert.equal(dummy.poisonCritChance, 0, 'dropping below lucky threshold removes Poison Crit chance');

piece.triggerTime = 10;
handler.onChargeReceived(piece, ctx);
assert.equal(piece.triggerTime, 8.5, 'charge advances cooldown by source cdAdvance seconds');

handler.onCooldownEffect(piece, ctx);
assert.equal(dummy.stacks.poison, 20, 'source poison amount targets the opponent');
assert.equal(player.stacks.poison, 12, 'source selfPoison amount targets the owner');
assert.equal(piece.alive, false, 'onAfterEffectFinished consumes the grenade');
assert.equal(piece.charges, 0);
assert.equal(events.at(-1)?.type, 'activate', 'activation is logged after both Poison effects');
assert.equal(events.at(-1)?.meta.consume, true);

console.log('OK Poison Grenade source and lifecycle regression');
