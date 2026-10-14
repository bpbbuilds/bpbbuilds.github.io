import assert from 'node:assert/strict';
import fs from 'node:fs';

import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items || [];
const itemsById = new Map(catalog.map((item) => [item.id, item]));

const placements = [
  { id: 'dark_lantern', x: 0, y: 0, r: 0, key: 'you:dark_lantern:0,0' },
  // Use a 60% threshold instance so the lantern's exact 50% opening HP loss
  // exercises the source '< threshold' branch without changing game defaults.
  {
    id: 'health_potion',
    x: 1,
    y: 0,
    r: 0,
    key: 'you:health_potion:1,0',
    instance: { params: { p1: 60 } },
  },
];

const run = simulateEngine({
  placements,
  itemsById,
  durationSec: 2.51,
  playerMaxHp: 100,
  dummyAttacks: false,
  seed: 20261012,
});

const potionDrink = run.events.find(
  (event) => event.itemId === 'health_potion' && event.meta?.handler === 'health_potion',
);
assert.ok(potionDrink, 'Health Potion responds to Dark Lantern combat-start self-damage');
assert.equal(potionDrink.t, 2.5, 'Health Potion drinks at the combat-start timestamp');

const start = run.snapshots.find((snapshot) => Math.abs(snapshot.t - 2.5) < 1e-9);
assert.equal(start?.player.hp, 62, 'Health Potion heals after Dark Lantern drops HP below 50%');

// The extracted HealthPotion.gd uses a strict `<` comparison. A Lantern loss
// from 100 → 50 is exactly the default 50% threshold and must not drink a
// default Health Potion merely because it received the damage signal.
const exactThresholdRun = simulateEngine({
  placements: [
    { id: 'dark_lantern', x: 0, y: 0, r: 0, key: 'you:dark_lantern:0,0' },
    { id: 'health_potion', x: 1, y: 0, r: 0, key: 'you:health_potion:1,0' },
  ],
  itemsById,
  durationSec: 2.51,
  playerMaxHp: 100,
  dummyAttacks: false,
  seed: 20261012,
});
assert.equal(
  exactThresholdRun.events.some(
    (event) => event.itemId === 'health_potion' && event.meta?.handler === 'health_potion',
  ),
  false,
  'exact 50% Lantern damage does not satisfy a strict below-50% threshold',
);

console.log('OK Dark Lantern combat-start self-damage triggers health-threshold items');
