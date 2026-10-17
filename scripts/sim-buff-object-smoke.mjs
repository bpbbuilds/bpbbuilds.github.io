/**
 * Source-backed Buff.gd timeout/reset contract smoke.
 *   node scripts/sim-buff-object-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { gainStacks } from '../js/pages/sim/engine/stacks.js';
import * as tempStacks from '../js/pages/sim/engine/temp-stacks.js';

const {
  clearTemporaryStacks,
  grantTemporary,
  expireTemporaryStacks,
  summarizeTemporaryStacks,
} = tempStacks;
assert.equal(typeof clearTemporaryStacks, 'function', 'sim exposes Buff.gd combatEnd cleanup');

const source = fs.readFileSync('tools/game-extract-full/Core/Buff.gd', 'utf8');
assert.match(
  source,
  /func onTimeout\(\):[\s\S]*?changeCurrentLogShowLabel\(true, timedOutStacks\.amount,[\s\S]*?temporaryStacks\.remove\(nextTemporaryTimeout\)/,
  'Buff.gd timeout removes the selected timer entry after the timeout projection',
);
assert.match(
  source,
  /func onTimeout\(\):[\s\S]*?earliestTimeout = INF[\s\S]*?if delay <= 0\.01:[\s\S]*?onTimeout\(\)/,
  'Buff.gd recursively drains all due timers in earliest-time order',
);
assert.match(
  source,
  /func combatEnd\(\):[\s\S]*?timer\.stop\(\)[\s\S]*?temporaryStacks\.clear\(\)/,
  'Buff.gd combatEnd stops timeout work and clears temporary entries',
);

// Entries can be inserted in a different order than their timeout. Source
// Timer/onTimeout always projects the earliest timeout first.
{
  const actor = createActor('player');
  gainStacks(actor, 'empower', 3);
  grantTemporary(actor, 'empower', 1, 2, 0);
  grantTemporary(actor, 'empower', 2, 1, 0);
  const expired = expireTemporaryStacks(actor, 2);
  assert.deepEqual(
    expired.map((entry) => entry.amount),
    [2, 1],
    'due temporary entries expire in source timeout order',
  );
  assert.equal(actor.stacks.empower, 3, 'all due temporary stacks are removed exactly once');
}

// combatEnd clears timer metadata without inventing a second stack loss; the
// source Buff object leaves current to the character lifecycle reset.
{
  const actor = createActor('player');
  grantTemporary(actor, 'heat', 2, 5, 0);
  assert.deepEqual(Object.keys(summarizeTemporaryStacks(actor)), ['heat']);
  clearTemporaryStacks(actor);
  assert.equal(actor.stacks.heat, 2, 'combatEnd cleanup does not fabricate a stack delta');
  assert.deepEqual(summarizeTemporaryStacks(actor), {}, 'combatEnd cleanup clears temporary metadata');
  assert.deepEqual(actor._tempStacks, [], 'combatEnd cleanup leaves an empty timer collection');
}

// A direct timeout at its exact boundary is due, matching the one-shot Timer.
{
  const actor = createActor('player');
  grantTemporary(actor, 'mana', 1, 0.5, 2);
  assert.equal(expireTemporaryStacks(actor, 2.499999).length, 0, 'entry remains before its timeout');
  assert.equal(expireTemporaryStacks(actor, 2.5).length, 1, 'entry expires at its exact timeout');
}

// Buff.gd stores reflectChancePercent per Buff, so a Poison-only reflection
// must not reflect Blind when the actor-wide legacy fallback is zero.
{
  const target = createActor('dummy');
  const opponent = createActor('player');
  target.stackReflectChance = { poison: 100 };
  const poison = gainStacks(target, 'poison', 1, { rng: () => 0, opponent });
  const blind = gainStacks(target, 'blind', 1, { rng: () => 0, opponent });
  assert.equal(poison.reflected, 1, 'per-stack reflect chance reflects Poison');
  assert.equal(blind.reflected, 0, 'per-stack reflect chance does not leak to Blind');
  assert.equal(target.stacks.blind, 1, 'Blind remains on target without its own reflect chance');
}

console.log('OK sim-buff-object-smoke');
