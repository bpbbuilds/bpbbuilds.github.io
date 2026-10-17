import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, grantTemporaryStacks, tickTemporaryStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantTimedResistancePct, tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';

const characterSource = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
const buffSource = fs.readFileSync('tools/game-extract-full/Core/Buff.gd', 'utf8');
const poisonIvySource = fs.readFileSync('tools/game-extract-full/Items/PoisonIvy.gd', 'utf8');

assert.match(
  characterSource,
  /func changeDamageResistance\(amount: float[\s\S]*?damageResistance \+= amount/,
  'Character damage resistance remains additive without an expiry clamp',
);
assert.match(
  poisonIvySource,
  /opponent\(\)\.changeDamageResistance\( - getP2\(\)\)/,
  'the game has a real negative-resistance source that can overlap a timed bonus',
);
assert.match(
  buffSource,
  /if duration < 0:[\s\S]*?permanentStacks \+= amount[\s\S]*?else:[\s\S]*?temporaryStacks\.push_back/,
  'the game keeps permanent and temporary stack ownership separate',
);
assert.match(
  buffSource,
  /func onTimeout\(\):[\s\S]*?changeCurrentLogShowLabel\(true, timedOutStacks\.amount/,
  'temporary stacks expire through the normal stack-change path',
);

const actor = createActor('player');
actor.damageResistancePct = -25;
grantTimedResistancePct(actor, 15, 2, 'overlap');
assert.equal(actor.damageResistancePct, -10, 'temporary resistance is additive at grant');
tickTimedResistances([actor], 1.999);
assert.equal(actor.damageResistancePct, -10, 'temporary resistance remains active before expiry');
tickTimedResistances([actor], 2);
assert.equal(
  actor.damageResistancePct,
  -25,
  'expiry restores the underlying negative resistance instead of clamping it to zero',
);

const bus = createCombatBus();
const stackActor = createActor('player');
stackActor._combatBus = bus;
const changes = [];
bus.on('character_blind_changed', (payload) => changes.push(payload));
grantStacks(stackActor, 'blind', 2, { originId: 'permanent' });
grantTemporaryStacks(stackActor, 'blind', 3, 2, 0, { originId: 'temporary' });
assert.equal(stackActor.stacks.blind, 5, 'permanent and temporary stacks share the visible current count');
assert.equal(tickTemporaryStacks(stackActor, 1.999), 0, 'temporary stacks do not expire early');
assert.equal(stackActor.stacks.blind, 5);
assert.equal(tickTemporaryStacks(stackActor, 2), 1, 'the due temporary entry expires once');
assert.equal(stackActor.stacks.blind, 2, 'expiry removes only the temporary amount');
assert.equal(changes.at(-1)?.amount, -3, 'expiry emits the normal negative stack-change signal');

console.log('OK timed resistance overlap and temporary stack expiry parity');
