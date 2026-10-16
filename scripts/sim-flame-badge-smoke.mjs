/**
 * Flame Badge fidelity — source Heat parameter/amplification ordering and
 * combat-start consumption.
 *   node scripts/sim-flame-badge-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { bindBuffPowerPieces, unbindBuffPowerPieces } from '../js/pages/sim/engine/buff-power.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'flame_badge');
assert.ok(item, 'Flame Badge catalog row exists');
const byId = new Map([['flame_badge', item]]);

const badgeSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FlameBadge.gd', 'utf8');
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
assert.match(badgeSource, /func onCombatStart\(\):\s*\n\s*giveHeat\(getP1\(\)\)\s*\n\s*consume\(\)/);
assert.match(badgeSource, /func onAddToInventory\(\):\s*\n\s*ItemBook\.updateClass\(self\)/);
assert.match(badgeSource, /func onShopEntered\(\):/);
assert.match(itemSource, /func giveStacks\(target, type: int, amount, triggerEvent = null\):\s*\n\s*if amount > 0:\s*\n\s*return target\.gainStacks\(type, round\(amount \* buffPowers\[type\]\)/);

const handler = getScriptHandler('flame_badge');
assert.equal(handler?.handlerId, 'flame_badge');
assert.equal(typeof handler?.onCombatStart, 'function');

const placement = { id: 'flame_badge', key: 'badge', x: 0, y: 0, r: 0 };
const piece = buildCombatPieces([placement], byId)[0];
piece.params = { heat: 2.6, p1: 2.6 };
piece.buffPowers = { heat: 1.5 };
const player = createActor('player');
const events = [];
bindBuffPowerPieces([piece]);
try {
  handler.onCombatStart(piece, { t: 2.5, player, events });
} finally {
  unbindBuffPowerPieces();
}
assert.equal(getStackAmount(player, 'heat'), 4, 'source rounds after Heat amplification');
assert.equal(piece.alive, false, 'consume removes Flame Badge from the active inventory');
assert.equal(piece.charges, 0, 'consume exhausts Flame Badge');
assert.equal(events.filter((event) => event.type === 'activate').length, 1);

const run = simulateEngine({
  placements: [placement],
  itemsById: byId,
  durationSec: 3.5,
  dummyAttacks: false,
});
const heat = run.events.find(
  (event) => event.itemId === 'flame_badge' && event.meta?.stack === 'heat',
);
const activation = run.events.find(
  (event) => event.itemId === 'flame_badge' && event.type === 'activate',
);
assert.equal(heat?.amount, 6, 'real engine gives catalog Heat amount');
assert.equal(activation?.meta?.handler, 'flame_badge');
assert.equal(activation?.meta?.combatStart, true);
assert.equal(run.events.filter((event) => event.itemId === 'flame_badge' && event.type === 'cooldown').length, 0);

console.log('OK Flame Badge source amplification and one-shot regression');
