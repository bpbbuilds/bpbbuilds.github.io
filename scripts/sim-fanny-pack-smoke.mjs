/**
 * Fanny Pack fidelity — source predicates, side-local Bagtacular, and exact speed.
 *   node scripts/sim-fanny-pack-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(
  ['bagtacular', 'fanny_pack', 'wooden_sword', 'coins', 'health_potion']
    .map((id) => [id, catalog.find((item) => item.id === id)])
    .filter(([, item]) => item),
);

const source = fs.readFileSync('tools/game-extract-full/Items/FannyPack.gd', 'utf8');
const bagSource = fs.readFileSync('tools/game-extract-full/Items/Bag.gd', 'utf8');
assert.match(source, /speedBonus\s*:\s*=\s*getP1\(\)\s*\/\s*100/);
assert.match(source, /isTypeInInventory\(ItemBook\.bagtacularDescriptor\)/);
assert.match(source, /for item in getItemsInside\(\):/);
assert.match(source, /if canApplyEffect\(item\):/);
assert.match(source, /item\.addSpeed\(totalSpeed\)/);
assert.match(source, /if active:\s*\n\s*activate\(\)/);
assert.match(source, /return toItem\.hasCooldown\(\) and not toItem\.isBag\(\)/);
assert.match(bagSource, /func isBag\(\)/, 'Bag base class owns the bag exclusion');

const handler = getScriptHandler('fanny_pack');
assert.equal(handler?.handlerId, 'fanny_pack');
assert.equal(typeof handler?.onCombatStart, 'function');

const fannySource = inventory.byId.fanny_pack;
assert.equal(fannySource.file, 'FannyPack.gd');
assert.equal(fannySource.extends, 'Bag');
assert.deepEqual(fannySource.overrides, ['onCombatStart']);

const fannyPlacement = { id: 'fanny_pack', key: 'fanny', x: 0, y: 0, r: 0 };
const swordPlacement = { id: 'wooden_sword', key: 'sword', x: 0, y: 0, r: 0 };
const coinPlacement = { id: 'coins', key: 'coins', x: 0, y: 0, r: 0 };

// Source hasCooldown is descriptor cooldown, not a synthetic sim loop cooldown.
const pieces = buildCombatPieces([fannyPlacement, swordPlacement, coinPlacement], byId);
const graph = buildBoardGraph([fannyPlacement, swordPlacement, coinPlacement], byId);
const fanny = pieces.find((piece) => piece.itemId === 'fanny_pack');
assert.ok(fanny);
handler.onCombatStart(fanny, {
  t: 0,
  events: [],
  graph,
  pieces,
  itemsById: byId,
});
const sword = pieces.find((piece) => piece.itemId === 'wooden_sword');
const coins = pieces.find((piece) => piece.itemId === 'coins');
assert.equal(sword?.speedScale, 0.1, 'cooldown item receives Fanny Pack speed');
assert.equal(coins?.speedScale, 0, 'cooldownless item is excluded by source hasCooldown');

// Bagtacular is an inventory-local global effect, never an opponent-side leak.
const sideRun = simulateEngine({
  placements: [
    { id: 'fanny_pack', key: 'fanny', x: 0, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'sword', x: 0, y: 0, r: 0 },
    { id: 'bagtacular', key: 'opp:bagtacular', x: 4, y: 4, r: 0, side: 'them' },
  ],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
assert.equal(
  sideRun.pieceSnapshots.find((snapshot) => snapshot.t === 2.5).byKey.sword.speedScale,
  0.1,
  'opponent Bagtacular does not buff the player Fanny Pack',
);

const withLocalBagtacular = simulateEngine({
  placements: [
    { id: 'bagtacular', key: 'bagtacular', x: 4, y: 4, r: 0 },
    { id: 'fanny_pack', key: 'fanny', x: 0, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'sword', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
assert.equal(
  withLocalBagtacular.pieceSnapshots.find((snapshot) => snapshot.t === 2.5).byKey.sword.speedScale,
  0.17,
  'local Bagtacular adds its named speed parameter',
);

// Item.activate() on a bag is animation-only in source; it is not a combat log metric.
assert.equal(
  withLocalBagtacular.events.some((event) => event.itemId === 'fanny_pack' && event.type === 'activate'),
  false,
  'Fanny Pack bag activation is not fabricated as a combat-log event',
);

console.log('OK Fanny Pack source and side/cooldown regression');
