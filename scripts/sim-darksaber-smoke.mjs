import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Darksaber.gd', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const row = inventory.byId.darksaber;
assert.ok(row, 'Darksaber has a source inventory row');
assert.equal(row.file, 'Darksaber.gd');
assert.equal(row.extends, 'Weapon');
assert.deepEqual(row.overrides, ['onPreDealDamage_early', 'onPrepare']);
assert.match(source, /func onPrepare\(\):[\s\S]*connectToOpponentDebuffs\("onDebuffsChanged"\)/);
assert.match(source, /func onDebuffsChanged\(amount, _event\):[\s\S]*changeVaryingDamage\(amount \* damPerDebuff\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*tryUseMana\(getP2\(\)\)[\s\S]*inflictBlind\(getP3\(\), event\)/);

const handler = getScriptHandler('darksaber');
assert.equal(handler?.handlerId, 'darksaber');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');

const data = byId.get('darksaber');
assert.ok(data);
const piece = {
  itemId: 'darksaber',
  placementKey: 'saber',
  name: 'Darksaber',
  kind: 'weapon',
  side: 'you',
  alive: true,
  params: data.params,
  damageMin: data.damageMin,
  damageMax: data.damageMax,
  staminaCost: data.staminaCost,
  accuracy: data.accuracy,
  damageKind: 'melee',
  cooldown: data.cooldown,
  baseCooldown: data.cooldown,
  bonusDamage: 0,
  removableBonusDamage: 0,
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 3,
  rng: () => 0,
  graph: { pieces: new Map(), filled: new Map() },
  itemsById: new Map([['darksaber', data]]),
  notifyPreDealDamageEarly: (sourcePiece, sourceCtx, res) => handler.onPreDealDamageEarly(sourcePiece, sourceCtx, res),
};

handler.onPrepare(piece, ctx);
grantStacks(dummy, 'poison', 2);
assert.equal(piece.bonusDamage, data.params.damperdebuff * 2, 'each opponent debuff stack changes varying damage');
spendStacks(dummy, 'poison', 1);
assert.equal(piece.bonusDamage, data.params.damperdebuff, 'debuff removal reverses the varying damage');

grantStacks(player, 'mana', 2);
const firstHandled = handler.onCooldownEffect(piece, ctx);
assert.equal(firstHandled, true);
assert.equal(player.stacks.mana, 1, 'a successful pre-damage hook spends one Mana');
assert.equal(dummy.stacks.blind, data.params.blind, 'the Mana spend inflicts the source Blind amount');
assert.ok(events.some((event) => event.type === 'damage' && event.itemId === 'darksaber'));

piece.accuracy = 0;
grantStacks(player, 'mana', 1);
const beforeMiss = events.length;
handler.onCooldownEffect(piece, { ...ctx, t: 4 });
assert.equal(player.stacks.mana, 1, 'the miss still spends Mana before the hit result is finalized');
assert.equal(dummy.stacks.blind, data.params.blind * 2, 'the miss still applies the source Blind effect');
assert.ok(events.slice(beforeMiss).some((event) => event.type === 'miss'));

const zeroPiece = { ...piece, params: { ...data.params, mana: 0, p2: 0, blind: 0, p3: 0 } };
const manaBeforeZero = player.stacks.mana;
const blindBeforeZero = dummy.stacks.blind;
handler.onPreDealDamageEarly(zeroPiece, ctx, { hit: true });
assert.equal(player.stacks.mana, manaBeforeZero, 'zero source Mana cost does not spend a stack');
assert.equal(dummy.stacks.blind, blindBeforeZero, 'zero source Blind amount does not invent a debuff');

console.log('OK Darksaber source port');
