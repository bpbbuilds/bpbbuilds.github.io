/**
 * Band Y Phases 135–143 — theme ports smoke.
 *   node scripts/sim-band-y-smoke.mjs
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
  'tesla_coil',
  // 135
  'carrot',
  'crow',
  'fedora',
  'seal_the_deal',
  'jynx_torquilla',
  'prismatic_wand',
  'garlic',
  // 136
  'mana_crystal',
  'eggscalibur',
  'badger_spirit',
  'book_of_basics',
  'shiny_mantle',
  'rainbow_orb',
  'magitecc_armor',
  // 137
  'devouring_sphere',
  'snowball',
  'burning_blade',
  'electric_torch',
  'molten_greatsword',
  'pocket_sand',
  'lump_of_coal',
  // 138+140
  'knife_to_meet_you',
  'scissorswords',
  'toolbox',
  'relic_case',
  'steel_goobert',
  'corrupted_crystal',
  'rainbow_goobert_berserker',
  'speak_with_animals',
  'wolf_emblem',
  'amulet_of_the_wild',
  // 139
  'angel_crystal',
  'blood_manipulation',
  'power_of_the_moon',
  'sloth',
  'bionic_armor',
  'stone_armor',
  'vampiric_armor',
  'heart_of_darkness',
  // 141
  'squirrel',
  'turtle',
  'rat_chef',
  'blood_goobert',
  'carrot_goobert',
  'spirit_bells',
  'paradise_birb',
  'mr_struggles',
  // 142
  'dark_ritual',
  'spell_scroll_dark',
  'dragon_knight',
  'echoing_battlecry',
  'cthulhu',
  'dig_deeper',
  'evil_cap',
  'extra_angy',
  // 143
  'slice_of_bread',
  'lightning_potion',
  'heavy_drinking',
  'no_rush_please',
  'platin_customer_card',
  'sandbag',
  'evil_hat',
  // 144
  'amethyst_egg',
  'recombobulator',
  'gold_armor',
  'skull_badge',
  'generator',
  'cog_badge',
  'time_dilator',
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
  cost: 4,
  shape: [[1], [1]],
};
const food = {
  id: 'carrot',
  name: 'Carrot',
  type: 'Food',
  cooldown: 3,
  chance: 50,
  params: { p2: 2 },
  cost: 3,
  shape: [[1]],
};
const seal = {
  id: 'seal_the_deal',
  name: 'Seal the Deal',
  type: 'Accessory',
  cooldown: 4,
  params: { regent: 2, vamp: 1, luckt: 2, spikes: 1, manat: 2, empower: 1 },
  cost: 8,
  shape: [[1]],
};
const coal = {
  id: 'lump_of_coal',
  name: 'Lump of Coal',
  type: 'Gem',
  cooldown: 3,
  params: {},
  cost: 2,
  shape: [[1]],
};
const squirrel = {
  id: 'squirrel',
  name: 'Squirrel',
  type: 'Pet',
  cooldown: 4,
  params: {},
  cost: 6,
  shape: [[1]],
};
const evilHat = {
  id: 'evil_hat',
  name: 'Evil Hat',
  type: 'Accessory',
  cooldown: 4,
  params: { buffs: 2, buffs2: 1 },
  cost: 8,
  shape: [[1]],
};
const garlic = {
  id: 'garlic',
  name: 'Garlic',
  type: 'Food',
  cooldown: 3,
  chance: 100,
  block: 4,
  params: { p1: 1 },
  cost: 3,
  shape: [[1]],
};
const snowball = {
  id: 'snowball',
  name: 'Snowball',
  type: 'Consumable',
  params: { cold: 2 },
  cost: 2,
  shape: [[1]],
};
const battery = {
  id: 'battery',
  name: 'Battery',
  type: 'Accessory',
  cooldown: 6,
  params: { speed: 10, speed2: 5, dur: 0.15 },
  cost: 6,
  shape: [[1]],
};
const tesla = {
  id: 'tesla_coil',
  name: 'Tesla Coil',
  type: 'Accessory',
  cooldown: 4,
  params: {},
  cost: 10,
  shape: [[1]],
};
const egg = {
  id: 'amethyst_egg',
  name: 'Amethyst Egg',
  type: 'Pet',
  cooldown: 4,
  params: { p1: 2 },
  cost: 8,
  shape: [[1]],
};
const recomb = {
  id: 'recombobulator',
  name: 'Recombobulator',
  type: 'Accessory',
  cooldown: 3.5,
  params: {},
  cost: 10,
  shape: [[1]],
};
const goldArmor = {
  id: 'gold_armor',
  name: 'Gold Armor',
  type: 'Armor',
  cooldown: 4,
  block: 10,
  params: { regen: 1, cleanse: 1, block: 4 },
  cost: 12,
  shape: [[1]],
};
const skull = {
  id: 'skull_badge',
  name: 'Skull Badge',
  type: 'Accessory',
  cooldown: 3,
  params: {},
  cost: 4,
  shape: [[1]],
};
const generator = {
  id: 'generator',
  name: 'Generator',
  type: 'Accessory',
  cooldown: 5,
  staminaCost: 1,
  params: { speed: 10, speed2: 5, dur: 0.15 },
  cost: 8,
  shape: [[1]],
};
const cogBadge = {
  id: 'cog_badge',
  name: 'Cog Badge',
  type: 'Accessory',
  cooldown: 4,
  params: { speed: 10, speed2: 5, dur: 0.15 },
  cost: 6,
  shape: [[1]],
};
const dilator = {
  id: 'time_dilator',
  name: 'Time Dilator',
  type: 'Accessory',
  cooldown: 3,
  params: { slow: 10, speed: 15 },
  cost: 8,
  shape: [[1]],
};

const itemsById = new Map(
  [
    sword,
    food,
    seal,
    coal,
    squirrel,
    evilHat,
    garlic,
    snowball,
    battery,
    tesla,
    egg,
    recomb,
    goldArmor,
    skull,
    generator,
    cogBadge,
    dilator,
  ].map((i) => [i.id, i]),
);

function place(itemId, x, y, key) {
  return { id: itemId, x, y, r: 0, key };
}

// 135 carrot cleanse / empower path
{
  const run = simulateEngine({
    seed: 1351,
    durationSec: 12,
    placements: [place('carrot', 0, 0, 'a'), place('wooden_sword', 1, 0, 'b')],
    itemsById,
  });
  ok(run.events.some((e) => e.meta?.handler === 'carrot'), '135 carrot activates');
}

// 135 seal converters
{
  const run = simulateEngine({
    seed: 1352,
    durationSec: 10,
    placements: [place('seal_the_deal', 0, 0, 'a')],
    itemsById,
  });
  ok(
    run.events.some((e) => e.meta?.handler === 'seal_the_deal'),
    '135 seal_the_deal activates',
  );
}

// 137 coal + snowball
{
  const run = simulateEngine({
    seed: 1371,
    durationSec: 8,
    placements: [place('lump_of_coal', 0, 0, 'a'), place('snowball', 1, 0, 'b')],
    itemsById,
  });
  ok(run.events.some((e) => e.meta?.handler === 'lump_of_coal'), '137 coal activates');
  ok(run.events.some((e) => e.meta?.handler === 'snowball'), '137 snowball start');
}

// 141 squirrel
{
  const run = simulateEngine({
    seed: 1411,
    durationSec: 10,
    placements: [place('squirrel', 0, 0, 'a')],
    itemsById,
  });
  ok(run.events.some((e) => e.meta?.handler === 'squirrel'), '141 squirrel activates');
}

// 143 evil hat dual random
{
  const run = simulateEngine({
    seed: 1431,
    durationSec: 10,
    placements: [place('evil_hat', 0, 0, 'a')],
    itemsById,
  });
  ok(run.events.some((e) => e.meta?.handler === 'evil_hat'), '143 evil_hat activates');
}

// tesla HAND + garlic block
{
  const run = simulateEngine({
    seed: 9001,
    durationSec: 8,
    placements: [
      place('tesla_coil', 0, 0, 't'),
      place('battery', 1, 0, 'b'),
      place('garlic', 2, 0, 'g'),
    ],
    itemsById,
  });
  ok(run.events.some((e) => e.meta?.handler === 'garlic'), 'garlic activates');
  ok(getScriptHandler('tesla_coil')?.handlerId === 'tesla_coil', 'tesla_coil HAND');
}

// 144 outliers
{
  const run = simulateEngine({
    seed: 1441,
    durationSec: 12,
    placements: [
      place('amethyst_egg', 0, 0, 'e'),
      place('recombobulator', 1, 0, 'r'),
      place('gold_armor', 2, 0, 'g'),
      place('skull_badge', 0, 1, 's'),
    ],
    itemsById,
  });
  ok(run.events.some((e) => e.meta?.handler === 'amethyst_egg'), '144 amethyst_egg');
  ok(run.events.some((e) => e.meta?.handler === 'recombobulator'), '144 recombobulator');
  ok(run.events.some((e) => e.meta?.handler === 'gold_armor'), '144 gold_armor');
  ok(run.events.some((e) => e.meta?.handler === 'skull_badge'), '144 skull_badge');
}
{
  const run = simulateEngine({
    seed: 1442,
    durationSec: 10,
    placements: [
      place('generator', 0, 0, 'gen'),
      place('cog_badge', 1, 0, 'cog'),
      place('wooden_sword', 2, 0, 'ws'),
      place('time_dilator', 0, 1, 'td'),
    ],
    itemsById,
  });
  ok(run.events.some((e) => e.meta?.handler === 'generator'), '144 generator');
  ok(run.events.some((e) => e.meta?.handler === 'cog_badge'), '144 cog_badge');
  ok(run.events.some((e) => e.meta?.handler === 'time_dilator'), '144 time_dilator');
}

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log(`\nAll ${IDS.length} handlers + smoke asserts OK`);
