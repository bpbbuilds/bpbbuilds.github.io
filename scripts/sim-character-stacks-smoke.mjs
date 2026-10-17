/**
 * Source-backed Character.gd / Buff.gd stack-contract smoke.
 *   node scripts/sim-character-stacks-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { gainStacks } from '../js/pages/sim/engine/stacks.js';
import {
  cleanseRandomDebuffs,
  grantTemporaryStacks,
  spendStacks,
  stealStack,
  tickTemporaryStacks,
} from '../js/pages/sim/engine/buff-economy.js';

const characterSource = fs.readFileSync(
  'tools/game-extract-full/Core/Character.gd',
  'utf8',
);
const buffSource = fs.readFileSync('tools/game-extract-full/Core/Buff.gd', 'utf8');

assert.match(
  characterSource,
  /func gainStacks\(buffType, amount: int,[\s\S]*?return buffs\[buffType\]\.gainStacks\(amount, item, triggerEvent\)/,
  'Character.gd gainStacks delegates to Buff.gd gainStacks',
);
assert.match(
  characterSource,
  /func gainStacksTemporary\(buffType, amount: int, duration,[\s\S]*?return buffs\[buffType\]\.gainTemporary\(amount, duration, item, triggerEvent, reflect\)/,
  'Character.gd gainStacksTemporary delegates with duration and reflect',
);
assert.match(
  characterSource,
  /func loseStacks\(buffType, amount: int,[\s\S]*?return buffs\[buffType\]\.loseStacks\(amount, item, triggerEvent\)/,
  'Character.gd loseStacks delegates as an unprotected loss',
);
assert.match(
  characterSource,
  /func useStacks\(buffType, amount: int,[\s\S]*?return buffs\[buffType\]\.loseStacks\(amount, item, triggerEvent, true\)/,
  'Character.gd useStacks delegates as a used loss',
);
assert.match(buffSource, /amount = min\(current, amount\)/, 'Buff.gd clamps losses to current stacks');
assert.match(
  buffSource,
  /if not used:[\s\S]*?resistStacks > 0:[\s\S]*?character\.buffProtectStacks > 0\):/,
  'Buff.gd applies non-used protection pools',
);
assert.match(
  buffSource,
  /if permanentStacks >= amount:[\s\S]*?farthestTimeout[\s\S]*?temporaryStacks\.remove\(farthestIndex\)/,
  'Buff.gd removes permanent stacks before farthest-expiry temporary stacks',
);
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
assert.match(
  itemSource,
  /func cleanseRandomDebuffs\([\s\S]*?character\(\)\.loseStacks\(debuff, cleansedDebuffs\[debuff\], self, triggerEvent\)/,
  'Item.gd cleanseRandomDebuffs uses normal protected loss semantics',
);

// Permanent and timed stacks keep independent accounting, including partial
// removal and the source farthest-expiry cleanup order.
{
  const actor = createActor('player');
  gainStacks(actor, 'empower', 1);
  grantTemporaryStacks(actor, 'empower', 2, 2, 0);
  grantTemporaryStacks(actor, 'empower', 4, 1, 0);
  assert.equal(actor.stacks.empower, 7, 'permanent and temporary grants are additive');

  assert.deepEqual(spendStacks(actor, 'empower', 2), { spent: 2 }, 'used loss spends available stacks');
  assert.equal(actor.stacks.empower, 5, 'used loss removes permanent then temporary stacks');

  const events = [];
  tickTemporaryStacks(actor, 1, events);
  assert.equal(actor.stacks.empower, 1, 'earliest temporary entry expires at its source timeout');
  assert.equal(actor._tempStacks?.[0]?.amount, 1, 'partial farthest-expiry removal preserves its timer remainder');
  tickTemporaryStacks(actor, 2, events);
  assert.equal(actor.stacks.empower, 0, 'remaining temporary entry expires at its own timeout');
  assert.equal(events.filter((event) => event.meta?.expired).length, 2, 'each temporary timeout is projected once');
}

// useStacks is a clamped loss: asking for more than current removes all that
// exists instead of failing the operation.
{
  const actor = createActor('player');
  gainStacks(actor, 'mana', 2);
  assert.deepEqual(spendStacks(actor, 'mana', 5), { spent: 2 }, 'used loss clamps to current stacks');
  assert.equal(actor.stacks.mana, 0, 'clamped used loss empties the stack');
}

// Buff.gd reflects before consuming Character.debuffResistStacks.
{
  const target = createActor('dummy');
  const opponent = createActor('player');
  target.debuffReflectStacks = 1;
  target.debuffResistStacks = 1;
  const result = gainStacks(target, 'poison', 1, { rng: () => 0, opponent });
  assert.equal(result.reflected, 1, 'one incoming debuff is reflected before resist stacks');
  assert.equal(target.stacks.poison, 0, 'reflected debuff does not remain on target');
  assert.equal(opponent.stacks.poison, 1, 'reflected debuff lands on the opponent');
  assert.equal(target.debuffReflectStacks, 0, 'reflect stack is consumed');
  assert.equal(target.debuffResistStacks, 1, 'debuff resist stack remains after the reflection');
}

// Temporary reflections retain the source duration and can still be resisted
// by the receiving Buff object after the reflection hop.
{
  const target = createActor('dummy');
  const opponent = createActor('player');
  target.debuffReflectChance = 100;
  grantTemporaryStacks(target, 'blind', 1, 2, 0, { rng: () => 0, opponent });
  assert.equal(target.stacks.blind, 0, 'temporary reflected debuff leaves the source target');
  assert.equal(opponent.stacks.blind, 1, 'temporary reflected debuff reaches the opponent');
  assert.equal(opponent._tempStacks?.[0]?.expiresAt, 2, 'temporary reflection keeps the source duration');
  tickTemporaryStacks(opponent, 2, []);
  assert.equal(opponent.stacks.blind, 0, 'temporary reflected debuff expires on the source timeout');
}

// Buff.resistStacks is a per-debuff one-use pool, separate from percentage
// resistance and the Character-wide debuff-resist pool.
{
  const actor = createActor('dummy');
  actor.stackResistStacks.poison = 1;
  const result = gainStacks(actor, 'poison', 2, { rng: () => 0 });
  assert.equal(result.resisted, 1, 'per-debuff resist stack absorbs one debuff stack');
  assert.equal(result.gained, 1, 'remaining debuff stack is applied');
  assert.equal(actor.stackResistStacks.poison, 0, 'per-debuff resist stack is consumed');
}

// Item.cleanseRandomDebuffs uses loseStacks (not useStacks), so cleanse
// protection must block the removal and preserve the debuff.
{
  const actor = createActor('player');
  gainStacks(actor, 'poison', 1);
  actor.debuffCleanseProtectChance = 100;
  const cleansed = cleanseRandomDebuffs(actor, 1, () => 0);
  assert.deepEqual(cleansed, {}, 'cleanse protection blocks a random debuff cleanse');
  assert.equal(actor.stacks.poison, 1, 'protected debuff remains intact');

  const unprotected = createActor('player');
  gainStacks(unprotected, 'poison', 1);
  assert.deepEqual(
    cleanseRandomDebuffs(unprotected, 1, () => 0),
    { poison: 1 },
    'an unprotected random debuff cleanse still removes one stack',
  );
  assert.equal(unprotected.stacks.poison, 0, 'unprotected debuff is removed');
}

// Character.buffProtectStacks protects non-used buff removals, including
// hostile strips, and is distinct from the legacy simulator alias.
{
  const actor = createActor('player');
  gainStacks(actor, 'lucky', 3);
  actor.buffProtectStacks = 2;
  actor.buffProtect = 2;
  const result = spendStacks(actor, 'lucky', 2, { hostileStrip: true, rng: () => 0 });
  assert.equal(result.spent, 0, 'buff protection blocks a hostile strip');
  assert.equal(actor.stacks.lucky, 3, 'protected buff remains intact');
  assert.equal(actor.buffProtectStacks, 0, 'buff protection stacks are consumed');
  assert.equal(actor.buffProtect, 0, 'legacy protection alias stays synchronized');
}

{
  const from = createActor('player');
  const to = createActor('dummy');
  gainStacks(from, 'lucky', 3);
  from.buffProtectStacks = 1;
  from.buffProtect = 1;
  const result = stealStack(from, to, 'lucky', 2, {});
  assert.equal(result.stolen, 1, 'partial buff protection preserves the unprotected steal remainder');
  assert.equal(from.stacks.lucky, 2, 'partial protected steal removes only the unprotected amount');
}

// Source gainTemporary accepts a zero-duration temporary entry; it is visible
// until the timer tick at that same simulation time.
{
  const actor = createActor('player');
  grantTemporaryStacks(actor, 'heat', 1, 0, 0);
  assert.equal(actor.stacks.heat, 1, 'zero-duration temporary gain is still applied');
  tickTemporaryStacks(actor, 0, []);
  assert.equal(actor.stacks.heat, 0, 'zero-duration temporary gain expires at its timeout');
}

console.log('OK sim-character-stacks-smoke');
