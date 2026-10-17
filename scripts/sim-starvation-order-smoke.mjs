import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { activatePiece } from '../js/pages/sim/engine/combat-activate.js';

const weaponSource = fs.readFileSync('tools/game-extract-full/Items/Weapon.gd', 'utf8');
assert.match(
  weaponSource,
  /func doCooldownEffect\(\):[\s\S]*?if useStamina\(\) == Character\.StaminaResult\.Sufficient:[\s\S]*?attack\(\)/,
  'the game only attacks after the weapon stamina check succeeds',
);

const player = createActor('player');
const dummy = createActor('dummy');
player.stamina = 0;
const events = [];
let preUseCount = 0;
const bus = {
  emit(type) {
    if (type === 'pre_use_stamina') preUseCount += 1;
  },
};
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = events;
dummy._eventLog = events;

const piece = {
  itemId: 'wooden_sword',
  placementKey: 'player:sword',
  name: 'Wooden Sword',
  kind: 'weapon',
  side: 'you',
  alive: true,
  charges: null,
  staminaCost: 1,
  damageMin: 4,
  damageMax: 4,
  accuracy: 100,
  params: {},
  gemNames: [],
};

const activated = activatePiece(piece, {
  t: 4,
  player,
  dummy,
  rng: () => 0,
  events,
  graph: { pieces: new Map(), filled: new Map() },
  itemsById: new Map(),
  canAffect: null,
  notifyPeerActivations() {},
});

assert.equal(activated, false, 'a starved weapon does not activate');
assert.equal(preUseCount, 1, 'a starved scripted cooldown performs one source stamina check');
assert.equal(
  events.filter((event) => event.type === 'stamina' && event.meta?.starved).length,
  1,
  'a starved scripted cooldown emits one out-of-stamina result',
);

console.log('OK starvation stops after one source stamina check');
