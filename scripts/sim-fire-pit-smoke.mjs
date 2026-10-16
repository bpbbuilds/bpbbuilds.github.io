/**
 * Fire Pit fidelity — pre-combat max health, Fire multiplicity, and source-only shop hook.
 *   node scripts/sim-fire-pit-smoke.mjs
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
const ids = ['fire_pit', 'flame', 'molten_greatsword'];
const byId = new Map(ids.map((id) => [id, catalog.find((item) => item.id === id)])
  .filter(([, item]) => item));

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FirePit.gd', 'utf8');
const bagSource = fs.readFileSync('tools/game-extract-full/Items/Bag.gd', 'utf8');
const characterSource = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
assert.match(source, /func canApplyEffect\(toItem\):\s*\n\s*return toItem\.hasType\(Type\.Fire\)/);
assert.match(source, /func onPreCombatStart\(\):/);
assert.match(source, /giveMaxHealth\(getP_m\("maxhealth"\) \* getNumAffectedInside_type\(Type\.Fire\)\)/);
assert.match(source, /func onShopEntered\(\):/);
assert.match(source, /placeGeneratedItem\(flame, occupiedCells\)/);
assert.match(source, /Game\.spendGold\(1\)/);
assert.match(source, /func getBagMultiplicity\(forItem\) -> int:/);
assert.match(source, /return forItem\.getTypeMultiplicity\(Type\.Fire\)/);
assert.match(bagSource, /func getNumAffectedInside_type\(type: int\) -> int:/);
assert.match(bagSource, /num \+= item\.getTypeMultiplicity\(type\)/);
assert.match(characterSource, /func giveMaxHealth\(amount\):\s*\n\s*maxHealth \+= amount\s*\n\s*curHealth \+= amount/);

const handler = getScriptHandler('fire_pit');
assert.equal(handler?.handlerId, 'fire_pit');
assert.equal(typeof handler?.onPreCombatStart, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Fire Pit must not be delayed to combat start');
assert.equal(inventory.byId.fire_pit.file, 'Exclusive/FirePit.gd');
assert.deepEqual(inventory.byId.fire_pit.overrides, ['onPreCombatStart']);

const placements = [
  { id: 'fire_pit', key: 'fire-pit', x: 0, y: 0, r: 0 },
  { id: 'flame', key: 'flame', x: 0, y: 0, r: 0 },
  { id: 'molten_greatsword', key: 'molten', x: 0, y: 0, r: 0 },
];
const pieces = buildCombatPieces(placements, byId);
const graph = buildBoardGraph(placements, byId);
const firePit = pieces.find((piece) => piece.itemId === 'fire_pit');
assert.ok(firePit);
firePit.params = { maxhealth: 5, p1: 5 };
firePit.paramAdd = { maxhealth: 1 };

const player = { id: 'player', hp: 60, maxHp: 100 };
const events = [];
handler.onPreCombatStart(firePit, {
  t: 2.5,
  player,
  graph,
  pieces,
  itemsById: byId,
  events,
});
// Flame contributes one Fire and Molten Greatsword contributes its source-defined
// Fire multiplicity (10), with the modified maxhealth parameter applied to all 11.
assert.equal(player.maxHp, 166, 'modified maxhealth × Fire multiplicity updates max HP');
assert.equal(player.hp, 126, 'giveMaxHealth adds to current HP without clamping');
assert.equal(events.at(-1)?.amount, 66);

const run = simulateEngine({
  placements: [
    { id: 'fire_pit', key: 'fire-pit', x: 0, y: 0, r: 0 },
    { id: 'flame', key: 'flame', x: 0, y: 0, r: 0 },
    { id: 'molten_greatsword', key: 'molten', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
const before = run.snapshots.find((snapshot) => snapshot.t === 0);
const after = run.snapshots.find((snapshot) => snapshot.t === 2.5);
assert.ok(before && after);
assert.equal(after.player.maxHp - before.player.maxHp, 55, 'pre-combat effect is visible after the zero-time snapshot');
assert.equal(after.player.hp - before.player.hp, 55, 'engine mirrors giveMaxHealth current-HP gain');

console.log('OK Fire Pit source and pre-combat/multiplicity regression');
