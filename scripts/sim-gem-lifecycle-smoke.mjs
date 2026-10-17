import assert from 'node:assert/strict';
import fs from 'node:fs';

import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const gemSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Gem.gd', 'utf8');
const catalogRaw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(catalogRaw) ? catalogRaw : catalogRaw.items || [];
const byId = new Map(catalog.map((item) => [item.id, item]));

function position(side, id, key, gems = []) {
  return { id, key: `${side}:${key}`, x: 0, y: 0, r: 0, gems };
}

function indexOf(text, pattern) {
  const at = text.indexOf(pattern);
  assert.notEqual(at, -1, `source contains ${pattern}`);
  return at;
}

// Item.gd owns the outer lifecycle: socketed Gem hooks run inside each host
// item phase, before the host hook for prepare/start/end.
assert.ok(indexOf(itemSource, 'for gem in getGemsNoNull():\n\t\tgem.prepare()') < indexOf(itemSource, '\tonPrepare()'));
assert.ok(indexOf(itemSource, 'for gem in getGemsNoNull():\n\t\tgem.preCombatStart()') < indexOf(itemSource, '\tif hasCooldown():'));
assert.ok(indexOf(itemSource, 'for gem in getGemsNoNull():\n\t\tgem.combatStart()') < indexOf(itemSource, '\tif hasStartofBattle():'));
assert.ok(indexOf(itemSource, 'for gem in getGemsNoNull():\n\t\tgem.combatEnd()') < indexOf(itemSource, '\tonCombatEnd()'));

// Gem.gd dispatches the three host modes through the overridable methods and
// only arms cooldowns for loose/inactive gems, matching socket ownership.
assert.ok(indexOf(gemSource, 'match getGemMode():\n\t\tGemMode.Inventory:\n\t\t\tprepareInventory()') > indexOf(gemSource, 'func onPrepare()'));
assert.ok(indexOf(gemSource, 'match getGemMode():\n\t\tGemMode.Inventory:\n\t\t\tcombatStartInventory()') > indexOf(gemSource, 'func combatStart():'));
assert.ok(indexOf(gemSource, 'match getGemMode():\n\t\tGemMode.Inventory:\n\t\t\tcombatEndInventory()') > indexOf(gemSource, 'func combatEnd():'));
assert.match(
  gemSource,
  /return \(\(gemMode == GemMode\.Inventory or\s+gemMode == GemMode\.Inactive\)\s+and\s+\.hasCooldown\(\)\)/,
);

for (const id of ['wooden_sword', 'leather_armor', 'chipped_topaz', 'elephant_rune']) {
  assert.ok(byId.get(id), `catalog contains ${id}`);
}

const placements = [
  position('you', 'wooden_sword', 'sword', ['chipped_topaz']),
  position('you', 'leather_armor', 'armor', ['elephant_rune']),
];
const run = simulateEngine({
  placements,
  itemsById: byId,
  durationSec: 4,
  dummyAttacks: false,
  captureLifecycle: true,
});
const phases = ['prepare', 'socket_prepare', 'cooldown_arm', 'pre_combat_start', 'socket_combat_start', 'combat_start', 'post_combat_start'];
for (const placement of placements) {
  const key = placement.key;
  const actual = run.lifecycle.filter((entry) => entry.placementKey === key).map((entry) => entry.phase);
  assert.deepEqual(actual, phases, `${key} follows Gem/Item lifecycle`);
  const socket = run.lifecycle.findIndex((entry) => entry.placementKey === key && entry.phase === 'socket_prepare');
  const nextPrepare = run.lifecycle.findIndex((entry, index) => index > socket && entry.phase === 'prepare');
  assert.equal(nextPrepare === -1 || socket < nextPrepare, true, `${key} socket prepare stays inside host prepare pass`);
}

const swordKey = 'you:sword';
const snap = run.pieceSnapshots.find((entry) => Math.abs(entry.t - 2.5) < 1e-9);
assert.ok(Number(snap?.byKey?.[swordKey]?.cooldown) > 0, 'socketed host is armed after Gem.prepare');

console.log('OK Gem source dispatch, host-owned prepare ordering, mode coverage, and socket lifecycle');
