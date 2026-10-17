import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Snowball.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-heat.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'snowball');
const snowballPort = port.slice(port.indexOf("handlerId: 'snowball'"));
const snowballBody = snowballPort.slice(0, snowballPort.indexOf('/** BurningBlade.gd'));

assert.ok(sourceItem, 'Snowball: extracted catalog row');
assert.equal(inventory.byId.snowball?.file, 'Exclusive/Snowball.gd');
assert.deepEqual(inventory.byId.snowball?.overrides, ['onCombatStart', 'onPrepare']);
assert.equal(sourceItem.cost, 4, 'Snowball: catalog cost');
assert.equal(sourceItem.cooldown, null, 'Snowball: no cooldown');
assert.deepEqual(sourceItem.params, { cold: 2, p1: 2, healthreduction: 15, p2: 15 });
assert.match(source, /onready var cold: = int\(getP\("cold"\)\)/);
assert.match(source, /onready var maxHealthReduction: = - getP\("healthreduction"\) \/ 100\.0/);
assert.match(source, /func onPrepare\(\):[\s\S]*opponent\(\)\.changeMaxHealthGain\(maxHealthReduction\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*inflictCold\(cold\)[\s\S]*consume\(\)/);
assert.match(snowballBody, /onPrepare\(piece, ctx\)/);
assert.match(snowballBody, /Math\.trunc/);
assert.match(snowballBody, /pushActivate/);
assert.doesNotMatch(snowballBody, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'cold'/);

function makeContext(params = sourceItem.params) {
  return {
    t: 2,
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    rng: () => 0,
  };
}

const handler = getScriptHandler('snowball');
assert.equal(handler?.handlerId, 'snowball');

const piece = {
  itemId: 'snowball',
  placementKey: 'snowball',
  name: 'Snowball',
  params: { cold: 1.9, p1: 1.9, healthreduction: 15, p2: 15 },
  side: 'you',
  kind: 'accessory',
  alive: true,
  charges: 1,
};
const prepared = makeContext();
handler.onPrepare(piece, prepared);
assert.equal(prepared.dummy._maxHealthGain, -0.15,
  'Snowball: preparation applies the source foe max-health-gain reduction');
assert.equal(prepared.player._maxHealthGain || 0, 0,
  'Snowball: preparation changes the opponent, not the owner');
handler.onCombatStart(piece, prepared);
assert.equal(prepared.dummy.stacks.cold, 1,
  'Snowball: source int(cold) truncates before applying Cold');
assert.equal(piece.alive, false, 'Snowball: consume removes the item');
assert.equal(piece.charges, 0, 'Snowball: consume clears charges');
const coldEvent = prepared.events.findIndex((event) => event.type === 'debuff');
const activation = prepared.events.findIndex((event) => event.type === 'activate');
assert.ok(coldEvent >= 0 && activation > coldEvent,
  'Snowball: consume activation follows Cold');

const notPrepared = {
  itemId: 'snowball',
  placementKey: 'snowball-unprepared',
  name: 'Snowball',
  params: { cold: 2, p1: 2, healthreduction: 15, p2: 15 },
  side: 'you',
  kind: 'accessory',
  alive: true,
  charges: 1,
};
const combatOnly = makeContext();
handler.onCombatStart(notPrepared, combatOnly);
assert.equal(combatOnly.dummy._maxHealthGain || 0, 0,
  'Snowball: max-health reduction is not deferred to combat start');

const signed = makeContext();
const signedPiece = {
  ...notPrepared,
  placementKey: 'snowball-signed',
  params: { cold: 0, p1: 0, healthreduction: -20, p2: -20 },
  alive: true,
  charges: 1,
};
handler.onPrepare(signedPiece, signed);
assert.equal(signed.dummy._maxHealthGain, 0.2,
  'Snowball: source sign is preserved for explicit negative reduction values');
handler.onCombatStart(signedPiece, signed);
assert.equal(signed.dummy.stacks.cold, 0, 'Snowball: explicit zero Cold is preserved');
assert.equal(signed.events.filter((event) => event.type === 'activate').length, 1,
  'Snowball: zero Cold still consumes and activates');

console.log('Snowball source/parity smoke passed.');
