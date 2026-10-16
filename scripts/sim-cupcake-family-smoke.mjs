import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const sources = {
  cupcake: fs.readFileSync('tools/game-extract-full/Items/Exclusive/Cupcake.gd', 'utf8'),
  cupcakeDragon: fs.readFileSync('tools/game-extract-full/Items/Exclusive/CupcakeDragon.gd', 'utf8'),
  cupcakeGoobert: fs.readFileSync('tools/game-extract-full/Items/Exclusive/CupcakeGoobert.gd', 'utf8'),
  cupcakeStaff: fs.readFileSync('tools/game-extract-full/Items/Exclusive/CupcakeStaff.gd', 'utf8'),
};

for (const [id, file, extendsName, overrides] of [
  ['cupcake', 'Exclusive/Cupcake.gd', 'Food', ['doCooldownEffect']],
  ['cupcake_dragon', 'Exclusive/CupcakeDragon.gd', 'Weapon', ['onPreDealDamage_early', 'onPrepare']],
  ['cupcake_goobert', 'Exclusive/CupcakeGoobert.gd', 'Goobert', ['doCooldownEffect']],
  ['cupcake_staff', 'Exclusive/CupcakeStaff.gd', 'Weapon', ['onPreDealDamage_early', 'onPrepare']],
]) {
  const row = inventory.byId[id];
  assert.ok(row, `${id} has a source inventory row`);
  assert.equal(row.file, file);
  assert.equal(row.extends, extendsName);
  assert.deepEqual(row.overrides, overrides);
}
assert.match(sources.cupcake, /extends Food[\s\S]*func doCooldownEffect\(\):[\s\S]*heal\(\)[\s\S]*giveMostBuffs\(numBuffs\)[\s\S]*activate\(\)/);
assert.match(sources.cupcakeDragon, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*getMostStacks\(character\(\), Game\.getBuffs\(\)/);
assert.match(sources.cupcakeDragon, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Food\)/);
assert.match(sources.cupcakeDragon, /func onPrepare\(\):[\s\S]*addSpeed\(speedPerFood \* getNumAffectedItems\(\)\)/);
assert.match(sources.cupcakeGoobert, /extends Goobert[\s\S]*func doCooldownEffect\(\):[\s\S]*heal\(\)[\s\S]*giveMostBuffs\(numBuffs\)/);
assert.match(sources.cupcakeStaff, /func onPrepare\(\):[\s\S]*connectToCharacterBuffs\("onBuffsChanged"\)/);
assert.match(sources.cupcakeStaff, /func onPreDealDamage_early\(damageRes: DamageResult\):/);
assert.match(sources.cupcakeStaff, /character\(\)\.getMana\(\) >= manaNeeded/);
assert.match(sources.cupcakeStaff, /useMana\(manaNeeded\)[\s\S]*giveMostBuffs\(numBuffs,/);
assert.match(sources.cupcakeStaff, /func onBuffsChanged\(amount, event\):[\s\S]*changeVaryingDamage\(amount \* damPerBuff\)/);

const cupcakeHandler = getScriptHandler('cupcake');
const dragonHandler = getScriptHandler('cupcake_dragon');
const goobertHandler = getScriptHandler('cupcake_goobert');
const staffHandler = getScriptHandler('cupcake_staff');
assert.equal(typeof cupcakeHandler?.onPrepare, 'function');
assert.equal(typeof dragonHandler?.onPrepare, 'function');
assert.equal(typeof goobertHandler?.onPrepare, 'function');
assert.equal(typeof staffHandler?.onPreDealDamageEarly, 'function');

function graphFor(pieceId, links, sourceId = pieceId) {
  const filled = new Map();
  const pieces = new Map([
    [pieceId, { key: pieceId, id: sourceId, affectCells: links.map((link) => ({ cell: link.cell, color: 'primary' })) }],
  ]);
  for (const link of links) {
    filled.set(link.cell, link.key);
    pieces.set(link.key, { key: link.key, id: link.id, affectCells: [] });
  }
  return { pieces, filled };
}

// Cupcake inherits Food.prepare(): linked Food increases speed before combat.
{
  const piece = {
    itemId: 'cupcake', placementKey: 'cupcake', name: 'Cupcake', kind: 'consumable', side: 'you',
    alive: true, params: byId.get('cupcake').params, speedScale: 0, cooldown: 6, baseCooldown: 6,
  };
  const food = { itemId: 'banana', placementKey: 'food', name: 'Banana', kind: 'consumable', side: 'you', alive: true };
  const player = createActor('player');
  player.hp = 100;
  const events = [];
  const ctx = {
    player, dummy: createActor('dummy'), events, t: 4, rng: () => 0,
    graph: graphFor('cupcake', [{ cell: '1,0', key: 'food', id: 'banana' }]),
    pieces: [piece, food], itemsById: byId, canAffect: null,
  };
  cupcakeHandler.onPrepare(piece, ctx);
  assert.equal(piece.speedScale, 0.1);
  bindBuffCombatLog({ events, getT: () => ctx.t, dummy: ctx.dummy });
  cupcakeHandler.onCooldownEffect(piece, ctx);
  unbindBuffCombatLog();
  assert.equal(player.hp, 110);
  const buffIndex = events.findIndex((event) => event.type === 'buff' && event.meta?.stack);
  const activateIndex = events.findIndex((event) => event.type === 'activate' && event.itemId === 'cupcake');
  assert.ok(buffIndex >= 0 && activateIndex > buffIndex, 'Cupcake activates after heal and most-buff grants');
}

// Cupcake Goobert inherits Goobert.prepare() and activates after six peer
// activations, then heals and gives most buffs in source order.
{
  const listener = {
    itemId: 'cupcake_goobert', placementKey: 'goobert', name: 'Cupcake Goobert', kind: 'pet', side: 'you',
    alive: true, params: byId.get('cupcake_goobert').params,
  };
  const player = createActor('player');
  player.hp = 100;
  const events = [];
  const ctx = { player, dummy: createActor('dummy'), events, t: 5, rng: () => 0 };
  goobertHandler.onPrepare(listener, ctx);
  for (let i = 0; i < 5; i += 1) goobertHandler.onPeerActivated(listener, { itemId: 'banana' }, ctx);
  assert.equal(player.hp, 100);
  goobertHandler.onPeerActivated(listener, { itemId: 'banana' }, ctx);
  assert.equal(player.hp, 135);
  const healIndex = events.findIndex((event) => event.type === 'heal' && event.itemId === 'cupcake_goobert');
  const buffIndex = events.findIndex((event) => event.type === 'buff' && event.meta?.handler === 'cupcake_goobert');
  const activateIndex = events.findIndex((event) => event.type === 'activate' && event.itemId === 'cupcake_goobert');
  assert.ok(activateIndex > healIndex && activateIndex > buffIndex, 'Cupcake Goobert activates after its inherited cooldown effect');
}

// Cupcake Dragon prepares from Food links and applies its buff removal/gain
// before the weapon damage lands.
{
  const piece = {
    itemId: 'cupcake_dragon', placementKey: 'dragon', name: 'Cupcake Dragon', kind: 'weapon', side: 'you',
    alive: true, params: byId.get('cupcake_dragon').params, speedScale: 0,
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const food = { itemId: 'banana', placementKey: 'food', name: 'Banana', kind: 'consumable', side: 'you', alive: true };
  player.stacks.lucky = 3;
  dummy.stacks.lucky = 2;
  dummy.stacks.regeneration = 1;
  const ctx = {
    player, dummy, events: [], t: 3, rng: () => 0,
    graph: graphFor('dragon', [{ cell: '1,0', key: 'food', id: 'banana' }], 'cupcake_dragon'),
    pieces: [piece, food], itemsById: byId, canAffect: null,
  };
  dragonHandler.onPrepare(piece, ctx);
  assert.equal(piece.speedScale, 0.2);
  const damageRes = { hit: true, damage: 7 };
  dragonHandler.onPreDealDamageEarly(piece, ctx, damageRes);
  assert.equal(dummy.stacks.lucky, 0);
  assert.equal(player.stacks.lucky, 3);
  assert.equal(player.stacks.regeneration, byId.get('cupcake_dragon').params.gain);
  assert.equal(damageRes.damage, 7, 'Dragon status effect does not mutate weapon damage');
}

// Cupcake Staff spends Mana before damage, gives most buffs, and receives
// later buff deltas through the source preparation listener.
{
  const piece = {
    itemId: 'cupcake_staff', placementKey: 'staff', name: 'Cupcake Staff', kind: 'weapon', side: 'you',
    alive: true, params: byId.get('cupcake_staff').params, bonusDamage: 0,
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  player.stacks.mana = 3;
  const events = [];
  const bus = createCombatBus();
  player._combatBus = bus;
  const ctx = { player, dummy, bus, events, t: 3, rng: () => 0 };
  staffHandler.onPrepare(piece, ctx);
  staffHandler.onPreDealDamageEarly(piece, ctx, { hit: true, damage: 7 });
  assert.equal(player.stacks.mana, 0);
  assert.equal(player.stacks.lucky, byId.get('cupcake_staff').params.buffs);
  grantStacks(player, 'regeneration', 1, { rng: () => 0 });
  assert.ok(Math.abs(piece.bonusDamage - byId.get('cupcake_staff').params.dam * 2) < 1e-9);
}

console.log('OK Cupcake family source ports');
