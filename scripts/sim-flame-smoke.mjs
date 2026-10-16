/**
 * Flame fidelity — combat-start Heat grant, Item.consume activation, and
 * one-shot consumption.
 *   node scripts/sim-flame-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'flame');
assert.ok(item, 'Flame catalog row exists');
const byId = new Map([['flame', item]]);

const flameSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Flame.gd', 'utf8');
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
assert.match(flameSource, /func onCombatStart\(\):\s*\n\s*giveHeat\(1\)\s*\n\s*consume\(\)/);
assert.match(itemSource, /func consume\(damageRes = null, playCombatAni = true\):\s*\n\s*activate\(damageRes, playCombatAni, true\)\s*\n\s*consumed = true/);

const handler = getScriptHandler('flame');
assert.equal(handler?.handlerId, 'flame');
assert.equal(typeof handler?.onCombatStart, 'function');

const placement = { id: 'flame', key: 'flame', x: 0, y: 0, r: 0 };
const piece = buildCombatPieces([placement], byId)[0];
const player = createActor('player');
const events = [];
handler.onCombatStart(piece, { t: 2.5, player, events });
assert.equal(getStackAmount(player, 'heat'), 1, 'Flame gives exactly one Heat');
assert.equal(piece.alive, false, 'consume removes Flame from the active inventory');
assert.equal(piece.charges, 0, 'consume exhausts Flame');
assert.equal(events.filter((event) => event.type === 'activate').length, 1, 'consume projects activation');

const run = simulateEngine({
  placements: [placement],
  itemsById: byId,
  durationSec: 3.5,
  dummyAttacks: false,
});
const heatEvents = run.events.filter(
  (event) => event.itemId === 'flame' && event.meta?.stack === 'heat',
);
const activationEvents = run.events.filter(
  (event) => event.itemId === 'flame' && event.type === 'activate',
);
assert.equal(heatEvents.length, 1, 'real engine emits one Heat grant');
assert.equal(heatEvents[0].amount, 1);
assert.equal(activationEvents.length, 1, 'real engine emits one consume activation');
assert.equal(activationEvents[0].meta?.handler, 'flame');
assert.equal(activationEvents[0].meta?.combatStart, true);
assert.equal(run.events.filter((event) => event.itemId === 'flame' && event.type === 'cooldown').length, 0);

console.log('OK Flame source and one-shot Heat/consume regression');
