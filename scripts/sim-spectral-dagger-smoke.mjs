import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const source = fs.readFileSync('tools/game-extract-full/Items/SpectralDagger.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-mana.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const spectralDaggerPort'),
  handlerSource.indexOf('/** SpikedStaff.gd'),
);
const sourceItem = catalog.find((item) => item.id === 'spectral_dagger');

assert.ok(sourceItem, 'Spectral Dagger: extracted catalog row');
assert.equal(inventory.byId.spectral_dagger?.file, 'SpectralDagger.gd');
assert.deepEqual(inventory.byId.spectral_dagger?.overrides, ['onPreDealDamage_early']);
assert.equal(sourceItem.cost, 4, 'Spectral Dagger: catalog cost');
assert.equal(sourceItem.staminaCost, 0, 'Spectral Dagger: catalog stamina');
assert.equal(sourceItem.damageMin, 2, 'Spectral Dagger: catalog min damage');
assert.equal(sourceItem.damageMax, 3, 'Spectral Dagger: catalog max damage');
assert.equal(sourceItem.cooldown, 2.5, 'Spectral Dagger: catalog cooldown');
assert.equal(sourceItem.accuracy, 95, 'Spectral Dagger: catalog accuracy');
assert.deepEqual(sourceItem.params, { p1: 1, dam: 6, p2: 6 });
assert.match(source, /extends Dagger/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)/);
assert.match(source, /tryUseMana\(getP1\(\)\)[\s\S]*damageRes\.damage \+= getP2\(\)[\s\S]*damageRes\.damageSource\.makeSpectral\(\)/);
assert.match(portBlock, /onPreDealDamageEarly/);
assert.doesNotMatch(portBlock, /onDealtDamage/);
assert.match(portBlock, /makeDamageSpectral/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(getP[12]\(/);

function makeContext({ params = sourceItem.params, mana = 1, block = 4, rng = () => 0 } = {}) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 120 });
  player.stacks.mana = mana;
  dummy.block = block;
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  const piece = {
    ...sourceItem,
    itemId: 'spectral_dagger',
    placementKey: 'spectral',
    name: 'Spectral Dagger',
    params: { ...params },
    kind: 'weapon',
    side: 'you',
    alive: true,
    baseCooldown: sourceItem.cooldown,
    chance: sourceItem.chance,
    chanceTag: sourceItem.chanceTag,
  };
  return {
    t: 2,
    player,
    dummy,
    events,
    rng,
    pieces: [piece],
    itemsById: new Map([['spectral_dagger', sourceItem]]),
    graph: null,
    piece,
  };
}

const handler = getScriptHandler('spectral_dagger');
assert.equal(handler?.handlerId, 'spectral_dagger');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const spectral = makeContext();
handler.onCooldownEffect(spectral.piece, spectral);
assert.equal(spectral.player.stacks.mana, 0, 'Spectral Dagger: one Mana is spent on the hit');
assert.equal(spectral.dummy.hp, 112, 'Spectral Dagger: base roll plus bonus lands as one hit');
assert.equal(spectral.dummy.block, 4, 'Spectral Dagger: spectral source bypasses Block');
assert.equal(spectral.events.filter((event) => event.type === 'damage').length, 1,
  'Spectral Dagger: bonus is not a second damage event');
const damageIndex = spectral.events.findIndex((event) => event.type === 'damage');
const activateIndex = spectral.events.findIndex((event) => event.type === 'activate');
assert.ok(damageIndex >= 0 && activateIndex > damageIndex,
  'Spectral Dagger: the weapon activates after its mutated hit resolves');

const noMana = makeContext({ mana: 0, block: 4 });
handler.onCooldownEffect(noMana.piece, noMana);
assert.equal(noMana.dummy.hp, 120, 'Spectral Dagger: without Mana only the base hit resolves through Block');
assert.equal(noMana.dummy.block, 2, 'Spectral Dagger: without Mana the base hit uses normal Block');

const zero = makeContext({ params: { p1: 0, dam: 0, p2: 0 }, mana: 0, block: 4 });
handler.onCooldownEffect(zero.piece, zero);
assert.equal(zero.dummy.hp, 120, 'Spectral Dagger: explicit zero Mana cost does not become one');
assert.equal(zero.dummy.block, 2, 'Spectral Dagger: explicit zero bonus does not become one');

const miss = makeContext({ mana: 1, block: 4, rng: () => 0.99 });
miss.piece.accuracy = 0;
handler.onCooldownEffect(miss.piece, miss);
assert.equal(miss.dummy.hp, 120, 'Spectral Dagger: a miss does not spend Mana or add spectral damage');
assert.equal(miss.player.stacks.mana, 1, 'Spectral Dagger: a miss preserves Mana');
assert.equal(miss.dummy.block, 4, 'Spectral Dagger: a miss preserves Block');

console.log('Spectral Dagger source/parity smoke passed.');
