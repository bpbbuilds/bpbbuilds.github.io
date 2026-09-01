/**
 * Band Y Phase 134 — buff converter ports smoke.
 *   node scripts/sim-buff-smoke.mjs
 */
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const IDS = [
  'amulet_of_fortune',
  'wolpertinger',
  'wand',
  'little_mimic',
  'bowl_of_treats',
  'cheese',
  'cheese_goobert',
  'present',
  'double_rainbow',
  'shaman_mask',
];

for (const id of IDS) {
  const h = getScriptHandler(id);
  ok(h?.handlerId === id, `handler ${id}`);
}

const sword = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  type: 'Melee Weapon',
  cooldown: 2,
  damageMin: 5,
  damageMax: 10,
  accuracy: 90,
  staminaCost: 1,
  chance: 25,
  cost: 4,
  shape: [[1], [1]],
};
const fortune = {
  id: 'amulet_of_fortune',
  name: 'Amulet of Fortune',
  type: 'Accessory',
  cooldown: 5,
  params: { chance: 15, p1: 15, buffs: 2, p2: 2 },
  cost: 6,
  shape: [[1]],
};
const cheese = {
  id: 'cheese',
  name: 'Cheese',
  type: 'Food',
  cooldown: 3.8,
  params: { maxhealth: 10, p1: 10, p2: 1 },
  cost: 8,
  shape: [[1]],
};
const present = {
  id: 'present',
  name: 'Present',
  type: 'Accessory',
  params: { p1: 5 },
  cost: 10,
  shape: [[1]],
};
const wolp = {
  id: 'wolpertinger',
  name: 'Wolpertinger',
  type: 'Pet',
  cooldown: 5,
  params: { p1: 70, p2: 3, p3: 15 },
  cost: 12,
  shape: [[1]],
};
const shaman = {
  id: 'shaman_mask',
  name: 'Shaman Mask',
  type: 'Accessory',
  cooldown: 3.8,
  params: { p1: 1, p2: 2, p3: 5 },
  cost: 10,
  shape: [[1]],
};
const wand = {
  id: 'wand',
  name: 'Wand',
  type: 'Accessory',
  cooldown: 3.3,
  params: {
    manat: 10,
    p1: 10,
    luckt: 10,
    p2: 10,
    regent: 10,
    p3: 10,
    empower: 1,
    p4: 1,
    use: 1,
    p5: 1,
  },
  cost: 4,
  shape: [[1]],
};
const ruby = { id: 'ruby', name: 'Ruby', type: 'Gem', shape: [[1]] };
const sapphire = { id: 'sapphire', name: 'Sapphire', type: 'Gem', shape: [[1]] };
const amethyst = { id: 'amethyst', name: 'Amethyst', type: 'Gem', shape: [[1]] };

const itemsById = new Map(
  [sword, fortune, cheese, present, wolp, shaman, wand, ruby, sapphire, amethyst].map(
    (i) => [i.id, i],
  ),
);

const buffGrants = (run, id) =>
  run.events.filter(
    (e) =>
      e.type === 'buff' &&
      e.itemId === id &&
      Number(e.amount) > 0 &&
      e.meta?.script,
  );

// Present: combat-start random buffs
const runPresent = simulateEngine({
  placements: [{ id: 'present', key: 'pr', x: 0, y: 0, r: 0 }],
  itemsById,
  durationSec: 6,
  seed: 7,
});
ok(buffGrants(runPresent, 'present').length >= 1, 'present grants buffs on start');

// Cheese: max HP + random buff
const runCheese = simulateEngine({
  placements: [{ id: 'cheese', key: 'ch', x: 0, y: 0, r: 0 }],
  itemsById,
  durationSec: 20,
  seed: 5,
});
ok(
  runCheese.events.some((e) => e.itemId === 'cheese' && /max HP/i.test(e.label || '')),
  'cheese grants max HP',
);
ok(buffGrants(runCheese, 'cheese').length >= 1, 'cheese grants random buff');

// Fortune: CD most-buffs
const runFortune = simulateEngine({
  placements: [
    { id: 'amulet_of_fortune', key: 'af', x: 0, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'ws', x: 1, y: 0, r: 0 },
  ],
  itemsById,
  durationSec: 22,
  seed: 9,
});
ok(buffGrants(runFortune, 'amulet_of_fortune').length >= 1, 'fortune grants most-buffs');

// Wolpertinger: least buffs
const runWolp = simulateEngine({
  placements: [{ id: 'wolpertinger', key: 'wp', x: 0, y: 0, r: 0 }],
  itemsById,
  durationSec: 22,
  seed: 4,
});
ok(buffGrants(runWolp, 'wolpertinger').length >= 1, 'wolpertinger grants least buffs');

// Shaman: start Lucky from socketed gems, then spend on CD
const runShaman = simulateEngine({
  placements: [
    {
      id: 'wooden_sword',
      key: 'ws3',
      x: 0,
      y: 0,
      r: 0,
      gems: ['ruby', 'sapphire', 'amethyst'],
    },
    { id: 'shaman_mask', key: 'sm', x: 2, y: 0, r: 0 },
  ],
  itemsById,
  durationSec: 25,
  seed: 12,
});
ok(
  runShaman.events.some(
    (e) =>
      e.itemId === 'shaman_mask' &&
      e.type === 'buff' &&
      e.meta?.stack === 'lucky' &&
      Number(e.amount) > 0,
  ),
  'shaman grants lucky from gems on start',
);
ok(
  runShaman.events.some(
    (e) =>
      e.itemId === 'shaman_mask' &&
      ((e.type === 'buff' && Number(e.amount) < 0) ||
        (e.type === 'buff' && e.meta?.stack !== 'lucky' && Number(e.amount) > 0)),
  ),
  'shaman spends lucky and/or grants random buffs',
);

// Wand: least into mana/lucky/regen pool
const runWand = simulateEngine({
  placements: [{ id: 'wand', key: 'wd', x: 0, y: 0, r: 0 }],
  itemsById,
  durationSec: 20,
  seed: 2,
});
ok(buffGrants(runWand, 'wand').length >= 1, 'wand grants least buff from pool');

if (failed) {
  console.error(`FAIL: ${failed} buff-converter check(s)`);
  process.exit(1);
}
console.log('OK sim-buff-smoke');
