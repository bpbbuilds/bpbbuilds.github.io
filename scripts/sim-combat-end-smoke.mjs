/**
 * Shared source/runtime regression for Game.combatEndDeferred cleanup order.
 *
 *   node scripts/sim-combat-end-smoke.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const gameSource = fs.readFileSync('tools/game-extract-full/Core/Game.gd', 'utf8');
const characterSource = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
const buffSource = fs.readFileSync('tools/game-extract-full/Core/Buff.gd', 'utf8');
const timerSource = fs.readFileSync(
  'tools/game-extract-full/Interface/CombatTimer/CombatTimer.gd',
  'utf8',
);
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const cardSource = fs.readFileSync('tools/game-extract-full/Items/Card.gd', 'utf8');
const catalogRaw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(catalogRaw) ? catalogRaw : catalogRaw.items || [];
const catalogById = new Map(catalog.map((item) => [item.id, item]));

assert.match(gameSource, /emit_signal\("combat_end"[\s\S]*EventBus\.disconnectAll\(\)[\s\S]*PLAYER\.combatEnd\(\)[\s\S]*OPPONENT\.combatEnd\(\)[\s\S]*combatTimer\.combatEnd\(\)/);
assert.match(gameSource, /combatTimer\.combatEnd\(\)[\s\S]*for item in PLAYER\.INVENTORY\.getItems\(\) \+ OPPONENT\.INVENTORY\.getItems\(\):[\s\S]*item\.combatEnd\(\)/);
assert.match(characterSource, /func combatEnd\(\):[\s\S]*for buff in buffs:[\s\S]*buffs\[buff\]\.combatEnd\(\)/);
assert.match(buffSource, /func combatEnd\(\):[\s\S]*timer\.stop\(\)[\s\S]*temporaryStacks\.clear\(\)/);
assert.match(timerSource, /func combatEnd\(\):[\s\S]*fatigueCounter = 0[\s\S]*fatigueStartTimer\.stop\(\)[\s\S]*fatigueTickTimer\.stop\(\)/);
assert.match(itemSource, /func combatEnd\(\):[\s\S]*disconnectCombat\(\)[\s\S]*for gem in getGemsNoNull\(\):[\s\S]*gem\.combatEnd\(\)[\s\S]*onCombatEnd\(\)/);
assert.match(cardSource, /func combatEnd\(\):[\s\S]*\.combatEnd\(\)[\s\S]*activating = false/);

const placements = [
  { id: 'strong_vampiric_potion', key: 'you:vamp', x: 0, y: 0, r: 0 },
  { id: 'engineer_box', key: 'you:engineer', x: 1, y: 0, r: 0 },
  { id: 'ace_of_spades', key: 'you:ace', x: 2, y: 0, r: 0 },
];
const itemsById = new Map(placements.map(({ id }) => [id, catalogById.get(id)]));
for (const placement of placements) {
  assert.ok(itemsById.get(placement.id), `catalog contains ${placement.id}`);
}

const run = simulateEngine({
  placements,
  itemsById,
  durationSec: 2.6,
  dummyAttacks: false,
  captureLifecycle: true,
});
const transition = run.transition || [];
const endAt = 2.6;
assert.deepEqual(
  transition
    .filter((entry) => Math.abs(entry.t - endAt) < 1e-9)
    .map(({ phase, side }) => ({ phase, side })),
  [
    { phase: 'combat_end_signal', side: 'both' },
    { phase: 'bus_disconnect', side: 'system' },
    { phase: 'character_combat_end', side: 'player' },
    { phase: 'character_combat_end', side: 'dummy' },
    { phase: 'combat_timer_end', side: 'system' },
  ],
  'engine keeps the Game combat-end boundary order',
);

const endLifecycle = (run.lifecycle || []).filter((entry) => entry.phase === 'combat_end');
assert.equal(endLifecycle.length, placements.length, 'each source inventory item receives combatEnd');
for (const placement of placements) {
  assert.ok(
    endLifecycle.some((entry) => entry.placementKey === placement.key),
    `${placement.id} receives item combat-end cleanup`,
  );
}

console.log('OK Game combat-end source order and simulator cleanup boundary');
