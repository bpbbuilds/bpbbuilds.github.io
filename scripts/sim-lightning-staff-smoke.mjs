import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/LightningStaff.gd',
  'utf8',
);
const portFile = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-wave-d-weapons.js',
  'utf8',
);
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.lightning_staff?.file, 'Exclusive/LightningStaff.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*attackCounter = 0/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*tryUseMana\(manaCost\)[\s\S]*attackCounter \+= 1/);
assert.match(source, /if attackCounter == numAttacks:[\s\S]*emitCharge\(\)[\s\S]*charge_emitted/);
assert.match(source, /func emitCharge\(speedFactor = 1\.0\):[\s\S]*sendCharge\(getP_m\("dur"\)/);
assert.match(source, /func canAffect_lightning\(item\):[\s\S]*canBeEmpowered\(\) or item\.reactsToCharges\(\)/);
assert.deepEqual(rules.byId.lightning_staff.lightning, {
  op: 'or',
  args: [{ op: 'canBeEmpowered' }, { op: 'reactsToCharges' }],
});

const lightningPort = portFile.slice(
  portFile.indexOf('export const lightningStaffPort'),
  portFile.indexOf('/** ThunderDrake.gd', portFile.indexOf('export const lightningStaffPort')),
);
assert.match(lightningPort, /onPrepare\(piece\)/);
assert.match(lightningPort, /onPreDealDamageEarly\(piece, ctx, res\)/);
assert.match(portFile, /modifiedParamValue\(/);
assert.match(portFile, /onPathEnd\(step\)/);
assert.match(portFile, /addBonusDamage\(chargedTarget, .*removable: false/);
assert.doesNotMatch(lightningPort, /onCombatStart\(piece\)/);

const placements = [{ id: 'lightning_staff', key: 'staff', x: 0, y: 0, r: 0 }];
const staff = buildCombatPieces(placements, byId)[0];
staff.side = 'you';
const graph = buildBoardGraph(placements, byId);
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
dummy._combatBus = bus;
const chargeSignals = [];
bus.on('charge_emitted', (payload) => chargeSignals.push(payload));
const ctx = {
  t: 2,
  player,
  dummy,
  bus,
  events,
  rng: () => 0,
  graph,
  itemsById: byId,
  pieces: [staff],
  canAffect: { rulesById: rules.byId },
  chargeJobs: [],
};
const handler = getScriptHandler('lightning_staff');

assert.equal(handler?.handlerId, 'lightning_staff');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');
assert.equal(handler?.onDealtDamage, undefined, 'Lightning Staff is an early damage hook in source');

staff.paramMult = { dur: 2 };
handler.onPrepare(staff, ctx);
assert.equal(staff._litHits, 0);

grantStacks(player, 'mana', 3, { originId: 'setup' });
handler.onPreDealDamageEarly(staff, ctx, { hit: false, damage: 0 });
assert.equal(player.stacks.mana, 0, 'the source spends its exact named Mana cost before hit resolution');
assert.equal(staff.bonusDamage, 2, 'the source adds its exact named permanent damage bonus');
assert.equal(staff._litHits, 1, 'a miss still advances the source attack counter');
assert.equal(chargeSignals.length, 0);

handler.onPreDealDamageEarly(staff, ctx, { hit: false, damage: 0 });
handler.onPreDealDamageEarly(staff, ctx, { hit: false, damage: 0 });
assert.equal(staff._litHits, 0, 'the source resets its counter at the exact named threshold');
assert.equal(chargeSignals.length, 1, 'the source emits charge_emitted at the threshold even on a miss');
const chargeStart = events.find(
  (event) => event.type === 'charge' && event.meta?.phase === 'start',
);
assert.ok(chargeStart, 'Lightning Staff creates a source-backed charge path');
assert.equal(chargeStart.meta.chargePath.durPerTile, 3, 'charge duration uses modified getP_m("dur")');

console.log('OK Lightning Staff source-backed early-hook, exact resource/bonus/counter, charge signal, path, and modified duration regression');
