/**
 * Flame Whip fidelity — hit-only Spikes spend, integer source parameters,
 * exact damage bonus, Heat grant, and zero-threshold behavior.
 *   node scripts/sim-flame-whip-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'flame_whip');
const walrus = catalog.find((entry) => entry.id === 'walrus_tusk');
assert.ok(item, 'Flame Whip catalog row exists');
assert.ok(walrus, 'Walrus Tusk catalog row exists');

const whipSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FlameWhip.gd', 'utf8');
const weaponSource = fs.readFileSync('tools/game-extract-full/Items/Weapon.gd', 'utf8');
assert.match(whipSource, /onready var spikesNeeded: int = getP\("spikes"\)/);
assert.match(whipSource, /onready var heatGain: int = getP\("heat"\)/);
assert.match(whipSource, /onready var bonusDamage: float = getP\("bonusdam"\)/);
assert.match(whipSource, /if damageRes\.hasHit\(\):\s*\n\s*if character\(\)\.getSpikes\(\) >= spikesNeeded:/);
assert.match(whipSource, /useSpikes\(spikesNeeded\)\s*\n\s*damageRes\.damage \+= bonusDamage\s*\n\s*giveHeat\(heatGain\)/);
assert.match(weaponSource, /func doCooldownEffect\(\):\s*\n\s*if useStamina\(\) == Character\.StaminaResult\.Sufficient:/);

const handler = getScriptHandler('flame_whip');
assert.equal(handler?.handlerId, 'flame_whip');
assert.equal(typeof handler?.onCooldownEffect, 'function');

function runDirect(params, spikes = 1, accuracy = 100) {
  const piece = buildCombatPieces(
    [{ id: 'flame_whip', key: 'whip', x: 0, y: 0, r: 0 }],
    new Map([['flame_whip', item]]),
  )[0];
  piece.params = params;
  piece.damageMin = 5;
  piece.damageMax = 5;
  piece.accuracy = accuracy;
  piece.staminaCost = 0;
  const player = createActor('player');
  const dummy = createActor('dummy');
  if (spikes) grantStacks(player, 'spikes', spikes);
  const events = [];
  handler.onCooldownEffect(piece, { t: 0, player, dummy, events, rng: () => 0 });
  return { piece, player, dummy, events };
}

const fractional = runDirect({
  spikes: 1.9,
  p1: 1.9,
  heat: 2.9,
  p2: 2.9,
  bonusdam: 8,
  p3: 8,
});
assert.equal(getStackAmount(fractional.player, 'spikes'), 0, 'source int() truncates the Spikes threshold');
assert.equal(getStackAmount(fractional.player, 'heat'), 2, 'source int() truncates Heat gain');
assert.equal(fractional.dummy.hp, 1187, 'source bonus damage is applied to the hit');

const miss = runDirect({ spikes: 1, p1: 1, heat: 4, p2: 4, bonusdam: 8, p3: 8 }, 1, 0);
assert.equal(getStackAmount(miss.player, 'spikes'), 1, 'a miss does not spend Spikes');
assert.equal(getStackAmount(miss.player, 'heat'), 0, 'a miss does not grant Heat');

const zero = runDirect({ spikes: 0, p1: 0, heat: 0, p2: 0, bonusdam: 8, p3: 8 }, 0);
assert.equal(getStackAmount(zero.player, 'heat'), 0, 'zero Heat remains a valid typed source value');
assert.equal(zero.dummy.hp, 1187, 'zero Spikes threshold still permits the source hit');

const itemsById = new Map([
  ['flame_whip', item],
  ['walrus_tusk', walrus],
]);
const run = simulateEngine({
  placements: [
    { id: 'flame_whip', key: 'whip', x: 0, y: 0, r: 0 },
    { id: 'walrus_tusk', key: 'tusk', x: 2, y: 0, r: 0 },
  ],
  itemsById,
  durationSec: 5,
  dummyAttacks: false,
});
const integratedDamage = run.events.find(
  (event) => event.itemId === 'flame_whip' && event.type === 'damage',
);
const integratedHeat = run.events.find(
  (event) => event.itemId === 'flame_whip' && event.meta?.stack === 'heat',
);
const integratedSpend = run.events.find(
  (event) => event.itemId === 'flame_whip' && event.meta?.stack === 'spikes',
);
assert.ok(integratedDamage && integratedHeat && integratedSpend, 'real engine runs the Flame Whip hit hook');
assert.equal(integratedHeat.amount, 4);
assert.equal(integratedSpend.amount, -1);

console.log('OK Flame Whip source and hit-hook regression');
