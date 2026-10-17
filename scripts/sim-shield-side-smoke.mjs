import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const shieldSource = fs.readFileSync('tools/game-extract-full/Items/Shield.gd', 'utf8');
const moonShieldSource = fs.readFileSync('tools/game-extract-full/Items/MoonShield.gd', 'utf8');
const pineProtectorSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PineProtector.gd', 'utf8');
assert.ok(shieldSource.includes('func afterBlock():'), 'Shield source exposes afterBlock lifecycle');
assert.ok(
  moonShieldSource.includes('func afterBlock():') &&
    moonShieldSource.includes('drainStamina(getP2(), blockedDamageRes.event)'),
  'Moon Shield source drains stamina during afterBlock',
);
assert.ok(
  pineProtectorSource.includes('connectForCombat(item, "activated", "onItemActivated")') &&
    pineProtectorSource.includes('heal()'),
  'Pine Protector source heals its owner when linked food activates',
);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const itemsById = new Map(
  (raw.items || raw).map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]),
);
for (const id of ['moon_shield', 'wooden_sword']) {
  itemsById.get(id).chance = 100;
}

const run = simulateEngine({
  placements: [{ id: 'wooden_sword', key: 'you:sword', x: 0, y: 0, r: 0 }],
  opponentPlacements: [{ id: 'moon_shield', key: 'them:shield', x: 0, y: 0, r: 0 }],
  itemsById,
  durationSec: 5,
  seed: 77,
  dummyAttacks: false,
});

const drain = run.events.find(
  (event) => event.type === 'stamina' && event.itemId === 'moon_shield',
);
assert.ok(drain, 'opponent Moon Shield produces its afterBlock stamina drain');
assert.equal(drain.actor, 'dummy', 'opponent shield drain is attributed to the opponent side');
assert.equal(drain.amount, 0.7, 'opponent shield drain keeps the source P2 amount');
assert.ok(
  run.events.some(
    (event) => event.type === 'activate' && event.itemId === 'moon_shield' && event.actor === 'dummy',
  ),
  'opponent shield activation remains attributed to the opponent side',
);

const pineOwner = createActor('dummy', { maxHp: 100 });
pineOwner.hp = 50;
const pineEvents = [];
getScriptHandler('pine_protector').onPeerActivated(
  {
    itemId: 'pine_protector',
    placementKey: 'them:pine',
    side: 'them',
    name: 'Pine Protector',
    _maxblock: 10,
    _damblock2: 1,
    _healOnFood: 8,
  },
  { itemId: 'banana' },
  {
    t: 2,
    player: pineOwner,
    dummy: createActor('player', { maxHp: 100 }),
    events: pineEvents,
    itemsById: new Map([['banana', { id: 'banana', type: 'Food' }]]),
  },
);
assert.equal(pineEvents.find((event) => event.type === 'heal')?.actor, 'dummy', 'opponent Pine Protector heal is attributed to the opponent side');
assert.equal(pineEvents.find((event) => event.type === 'heal')?.target, 'dummy', 'opponent Pine Protector heal targets the opponent side');

console.log('OK opponent-owned shield afterBlock side attribution and source P2 drain');
