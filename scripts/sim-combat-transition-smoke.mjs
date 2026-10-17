import assert from 'node:assert/strict';
import fs from 'node:fs';

import { COMBAT_DELAY, simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = fs.readFileSync('tools/game-extract-full/Core/Game.gd', 'utf8');
const catalogRaw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(catalogRaw) ? catalogRaw : catalogRaw.items || [];
const byId = new Map(catalog.map((item) => [item.id, item]));

function at(text, value) {
  const index = text.indexOf(value);
  assert.notEqual(index, -1, `Game.gd contains ${value}`);
  return index;
}

assert.ok(at(source, 'PLAYER.prepare()') < at(source, 'for item in items:\n\t\titem.prepare()'));
assert.ok(at(source, 'OPPONENT.prepare()') < at(source, 'for item in items:\n\t\titem.prepare()'));
assert.ok(at(source, 'emit_signal("combat_start")') < at(source, 'combatTimer.start()'));
assert.ok(at(source, 'combatTimer.start()') < at(source, 'PLAYER.combatStart()'));
assert.ok(at(source, 'OPPONENT.combatStart()') < at(source, 'for item in items:\n\t\titem.preCombatStart()'));
assert.ok(at(source, 'for item in items:\n\t\titem.preCombatStart()') < at(source, 'for item in items:\n\t\titem.combatStart()'));
assert.ok(at(source, 'for item in items:\n\t\titem.combatStart()') < at(source, 'for item in items:\n\t\titem.postCombatStart()'));

const placements = [
  { id: 'wooden_sword', key: 'you:sword', x: 0, y: 0, r: 0 },
  { id: 'healing_herbs', key: 'you:herbs', x: 1, y: 0, r: 0 },
];
const run = simulateEngine({
  placements,
  itemsById: byId,
  durationSec: COMBAT_DELAY + 1,
  dummyAttacks: false,
  captureLifecycle: true,
});

assert.deepEqual(
  run.transition,
  [
    { phase: 'character_prepare', side: 'player', t: 0 },
    { phase: 'character_prepare', side: 'dummy', t: 0 },
    { phase: 'character_combat_start', side: 'player', t: COMBAT_DELAY },
    { phase: 'character_combat_start', side: 'dummy', t: COMBAT_DELAY },
  ],
  'characters cross the transition boundary before item pre-combat work',
);

const fightStart = run.events.find((event) => event.type === 'fight_start');
const live = run.events.find((event) => event.label?.startsWith('Items live'));
assert.equal(fightStart?.t, 0, 'fight begins at simulation time zero');
assert.equal(live?.t, COMBAT_DELAY, 'items become live after the source combat delay');
assert.ok(
  run.events
    .filter((event) => event.type === 'activate' && event.placementKey)
    .every((event) => event.t + 1e-9 >= COMBAT_DELAY),
  'item activations do not leak into the transition delay',
);

console.log('OK Game combat transition source order, character boundary, and delay timing');
