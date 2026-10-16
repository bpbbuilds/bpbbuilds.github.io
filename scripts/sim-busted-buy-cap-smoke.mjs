import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { startBattleRage, tickBattleRage } from '../js/pages/sim/engine/battle-rage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const bustedSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BustedBlade.gd', 'utf8');
const holySource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BuytheHolyLight.gd', 'utf8');
const capSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/CapofBrilliance.gd', 'utf8');

assert.match(bustedSource, /extends .*Greatsword\.gd/);
assert.match(bustedSource, /func onPrepare\(\)/);
assert.match(bustedSource, /character_empower_changed/);
assert.match(bustedSource, /baseCooldownOverride = getP3\(\)/);
assert.match(holySource, /func onPrepare\(\)/);
assert.match(holySource, /item\.addSpeed\(holySpeed\)/);
assert.match(holySource, /isLamp\(item\)/);
assert.match(capSource, /extends .*LeatherHelm\.gd/);
assert.match(capSource, /\.onPrepare\(\)/);
assert.match(capSource, /giveMana\(mana\)/);
assert.match(capSource, /\.onCombatStart\(\)/);

function graphFor(sourceId, targetId, sourceKey = 'source', targetKey = 'target') {
  return {
    pieces: new Map([
      [sourceKey, { id: sourceId, cells: ['0,0'], affectCells: [] }],
      [targetKey, { id: targetId, cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', sourceKey],
      ['1,0', targetKey],
    ]),
  };
}

const busted = getScriptHandler('busted_blade');
assert.equal(busted?.handlerId, 'busted_blade');
assert.equal(typeof busted?.onPrepare, 'function');

const ragePlayer = createActor('player');
const rageDummy = createActor('dummy');
const rageBus = createCombatBus();
const bustedPiece = {
  itemId: 'busted_blade',
  name: 'Busted Blade',
  placementKey: 'busted',
  side: 'you',
  kind: 'weapon',
  params: { p1: 5, p2: 2.5, p3: 2.5 },
  baseCooldown: 5,
  cooldown: 5,
  baseStaminaCost: 5,
  staminaCost: 5,
  bonusDamage: 0,
  alive: true,
};
const rageCtx = {
  player: ragePlayer,
  dummy: rageDummy,
  bus: rageBus,
  events: [],
  t: 1,
  itemsById: new Map([['busted_blade', { id: 'busted_blade', chance: null }]]),
};

busted.onPrepare(bustedPiece, rageCtx);
grantStacks(ragePlayer, 'empower', 2, { originKey: 'empower', originId: 'empower' });
assert.equal(bustedPiece.bonusDamage, 10, 'Busted Blade scales varying damage from Empower deltas');
spendStacks(ragePlayer, 'empower', 1, { originKey: 'empower', originId: 'empower' });
assert.equal(bustedPiece.bonusDamage, 5, 'Busted Blade removes varying damage when Empower is spent');

startBattleRage(ragePlayer, 3, 1, { bus: rageBus });
assert.equal(bustedPiece.cooldown, 2.5, 'rage uses the source cooldown override');
assert.equal(bustedPiece.staminaCost, 2.5, 'rage uses the inherited Greatsword stamina override');
startBattleRage(rageDummy, 3, 1, { bus: rageBus });
assert.equal(bustedPiece.cooldown, 2.5, 'opponent rage does not alter the owner weapon');
tickBattleRage(ragePlayer, 4, { bus: rageBus });
assert.equal(bustedPiece.cooldown, 5, 'rage end restores the source cooldown');
assert.equal(bustedPiece.staminaCost, 5, 'rage end restores the inherited stamina cost');

const holy = getScriptHandler('buy_the_holy_light');
assert.equal(holy?.handlerId, 'buy_the_holy_light');
assert.equal(typeof holy?.onPrepare, 'function');
const holyPiece = { itemId: 'buy_the_holy_light', name: 'Buy the Holy Light', placementKey: 'holy', params: { speed: 40, p1: 40 } };
const lampPiece = { itemId: 'oil_lamp', name: 'Oil Lamp', placementKey: 'lamp', cooldown: 0, speedScale: 0 };
const holyCtx = {
  graph: graphFor('buy_the_holy_light', 'oil_lamp', 'holy', 'lamp'),
  itemsById: new Map([
    ['buy_the_holy_light', { id: 'buy_the_holy_light', params: { speed: 40, p1: 40 } }],
    ['oil_lamp', { id: 'oil_lamp', type: 'Accessory' }],
  ]),
  canAffect: null,
  pieces: [holyPiece, lampPiece],
};
holy.onPrepare(holyPiece, holyCtx);
assert.equal(lampPiece.speedScale, 0.4, 'Buy the Holy Light buffs an affected lamp without requiring a cooldown');

const cap = getScriptHandler('cap_of_brilliance');
assert.equal(cap?.handlerId, 'cap_of_brilliance');
assert.equal(typeof cap?.onPrepare, 'function');
const capPlayer = createActor('player');
const capDummy = createActor('dummy');
const capPiece = {
  itemId: 'cap_of_brilliance',
  name: 'Cap of Brilliance',
  placementKey: 'cap',
  side: 'you',
  kind: 'armor',
  chance: 20,
  params: { chance2: 15, mana: 2, p3: 2, p1: 25, p2: 4 },
  blockGrant: 0,
};
const manaPiece = { itemId: 'mana_orb', name: 'Mana Orb', placementKey: 'orb', cooldown: 2, buffAmpChance: 0 };
const capEvents = [];
const capCtx = {
  player: capPlayer,
  dummy: capDummy,
  graph: graphFor('cap_of_brilliance', 'mana_orb', 'cap', 'orb'),
  itemsById: new Map([
    ['cap_of_brilliance', { id: 'cap_of_brilliance', chance: 20, params: capPiece.params }],
    ['mana_orb', { id: 'mana_orb', type: 'Accessory', extraTypes: ['Magic'] }],
  ]),
  pieces: [capPiece, manaPiece],
  canAffect: null,
  events: capEvents,
  t: 1,
};
cap.onPrepare(capPiece, capCtx);
assert.equal(capPlayer.critResistance, 20, 'Cap inherits Leather Helm crit resistance');
assert.equal(capPlayer.stunResistance, 20, 'Cap inherits Leather Helm stun resistance');
assert.equal(manaPiece.buffAmpChance, 15, 'Cap amplifies linked Mana gains during preparation');
cap.onCombatStart(capPiece, capCtx);
assert.equal(capPlayer.stacks.mana, 2, 'Cap grants source Mana on combat start');
assert.equal(capPlayer.damageResistancePct, 25, 'Cap inherits Leather Helm timed damage resistance');
assert.ok(capEvents.some((event) => event.type === 'activate'), 'Cap retains inherited activation projection');

console.log('OK Busted Blade / Buy the Holy Light / Cap of Brilliance focused smoke');
