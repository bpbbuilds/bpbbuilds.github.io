/**
 * Band AH 211 — emit scripts/fixtures/parity/*.json from DEMO layouts + history builds.
 *   node scripts/build-parity-fixtures.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { emptyLive } from '../js/pages/sim/engine/parity-live.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'fixtures', 'parity');

/** Mirrors scripts/_apply-build-placements.mjs DEMO_LAYOUTS (combat-relevant rows). */
const DEMO_LAYOUTS = {
  'infinite-combo-machine': [
    { item_id: 'berserker_bag', x: 0, y: 0 },
    { item_id: 'holdall', x: 3, y: 0 },
    { item_id: 'leather_bag', x: 6, y: 0 },
    { item_id: 'scholar_bag', x: 0, y: 3 },
    { item_id: 'box_of_prosperity', x: 6, y: 4 },
    { item_id: 'puzzlebag_t', x: 3, y: 4 },
    { item_id: 'goobert', x: 0, y: 0 },
    { item_id: 'blood_goobert', x: 2, y: 0 },
    { item_id: 'chili_goobert', x: 4, y: 0 },
    { item_id: 'ice_dragon', x: 6, y: 0 },
    { item_id: 'steel_goobert', x: 0, y: 3 },
    { item_id: 'power_puppy', x: 3, y: 2 },
    { item_id: 'obsidian_dragon', x: 6, y: 3 },
    { item_id: 'shelly', x: 3, y: 5 },
    { item_id: 'flame', x: 5, y: 3 },
    { item_id: 'piggy_of_riches', x: 3, y: 4 },
    { item_id: 'heart_container', x: 0, y: 5 },
    { item_id: 'oil_lamp', x: 2, y: 5 },
    { item_id: 'rope', x: 5, y: 5 },
    { item_id: 'lucky_clover', x: 8, y: 5 },
    { item_id: 'whetstone', x: 8, y: 3 },
    { item_id: 'wooden_sword', x: 7, y: 5 },
    { item_id: 'flame_badge', x: 5, y: 4 },
    { item_id: 'draconic_orb', x: 2, y: 3 },
  ],
  'poison-garden-ranger': [
    { item_id: 'ranger_bag', x: 2, y: 1 },
    { item_id: 'leather_bag', x: 5, y: 1 },
    { item_id: 'vineweave_basket', x: 0, y: 3 },
    { item_id: 'poison_goobert', x: 2, y: 1 },
    { item_id: 'poison_frog', x: 5, y: 1 },
    { item_id: 'snake', x: 0, y: 3 },
    { item_id: 'poison_ivy', x: 4, y: 4 },
    { item_id: 'healing_herbs', x: 7, y: 2 },
    { item_id: 'leaf_badge', x: 7, y: 3 },
  ],
  'pyro-furnace': [
    { item_id: 'fire_pit', x: 2, y: 1 },
    { item_id: 'leather_bag', x: 6, y: 1 },
    { item_id: 'chili_goobert', x: 2, y: 1 },
    { item_id: 'flame', x: 5, y: 2 },
    { item_id: 'frozen_flame', x: 6, y: 1 },
    { item_id: 'burning_banner', x: 0, y: 4 },
    { item_id: 'oil_lamp', x: 5, y: 4 },
    { item_id: 'flame_badge', x: 7, y: 4 },
  ],
  'reaper-harvest': [
    { item_id: 'storage_coffin', x: 2, y: 1 },
    { item_id: 'holdall', x: 5, y: 1 },
    { item_id: 'blood_goobert', x: 2, y: 1 },
    { item_id: 'ghost', x: 5, y: 1 },
    { item_id: 'heart_of_darkness', x: 5, y: 3 },
    { item_id: 'skull_badge', x: 0, y: 2 },
    { item_id: 'blood_amulet', x: 0, y: 3 },
  ],
  'berserk-bloodline': [
    { item_id: 'berserker_bag', x: 0, y: 0 },
    { item_id: 'holdall', x: 3, y: 0 },
    { item_id: 'leather_bag', x: 6, y: 0 },
    { item_id: 'scholar_bag', x: 0, y: 3 },
    { item_id: 'box_of_prosperity', x: 6, y: 4 },
    { item_id: 'blood_goobert', x: 0, y: 0 },
    { item_id: 'goobert', x: 4, y: 0 },
    { item_id: 'wooden_sword', x: 8, y: 0 },
    { item_id: 'claws_of_attack', x: 0, y: 2 },
    { item_id: 'axe', x: 2, y: 2 },
    { item_id: 'bloodthorne', x: 4, y: 2 },
    { item_id: 'heart_container', x: 5, y: 2 },
    { item_id: 'blood_amulet', x: 7, y: 2 },
    { item_id: 'bloody_dagger', x: 8, y: 2 },
    { item_id: 'hero_sword', x: 7, y: 4 },
    { item_id: 'piggy_of_riches', x: 0, y: 3 },
    { item_id: 'whetstone', x: 2, y: 3 },
    { item_id: 'dragon_claws', x: 3, y: 3 },
    { item_id: 'power_puppy', x: 0, y: 4 },
    { item_id: 'heart_of_darkness', x: 4, y: 3 },
    { item_id: 'flame', x: 8, y: 1 },
    { item_id: 'oil_lamp', x: 5, y: 4 },
    { item_id: 'rope', x: 3, y: 5 },
    { item_id: 'lucky_clover', x: 6, y: 5 },
    { item_id: 'flame_badge', x: 7, y: 5 },
    { item_id: 'customer_card', x: 8, y: 5 },
    { item_id: 'dagger', x: 2, y: 5 },
    { item_id: 'burning_torch', x: 1, y: 5 },
    { item_id: 'skull_badge', x: 0, y: 5 },
    { item_id: 'chili_goobert', x: 4, y: 5 },
  ],
};

const FOCUS = {
  'pyro-furnace': ['chili_goobert', 'frozen_flame', 'oil_lamp'],
  'poison-garden-ranger': ['poison_goobert', 'healing_herbs'],
  'berserk-bloodline': ['blood_goobert', 'bloodthorne', 'goobert'],
  'reaper-harvest': ['blood_goobert', 'ghost'],
  'infinite-combo-machine': ['goobert', 'ice_dragon', 'oil_lamp'],
  'history-3703': ['battery', 'tesla_coil', 'thunder_drake'],
  'history-3705': ['bag_of_giving', 'falcon_blade', 'death_lotus'],
  'history-3709': ['oil_lamp', 'enchanted_weapons'],
  'history-3708': ['bloodthorne', 'blood_goobert'],
};

function emptyExpect() {
  return {
    playerEndHpMin: null,
    playerEndHpMax: null,
    dummyEndHpMin: null,
    dummyEndHpMax: null,
  };
}

/**
 * @param {string} slug
 * @param {string} source
 * @param {{ item_id?: string, id?: string, x: number, y: number, r?: number, gems?: string[], key?: string }[]} rows
 */
function toFixture(slug, source, rows) {
  const placements = rows.map((p, i) => {
    const id = p.item_id || p.id;
    return {
      id,
      key: p.key || `${slug}:${i}:${id}`,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      gems: Array.isArray(p.gems) ? p.gems : [],
    };
  });
  return {
    name: slug,
    slug,
    source,
    seed: 42,
    durationSec: 30,
    placements,
    expect: emptyExpect(),
    live: emptyLive(),
    meta: { focusItemIds: FOCUS[slug] || [] },
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [slug, layout] of Object.entries(DEMO_LAYOUTS)) {
  const fix = toFixture(slug, 'demo_layout', layout);
  const out = path.join(OUT_DIR, `${slug}.json`);
  fs.writeFileSync(out, JSON.stringify(fix, null, 2));
  console.log(`Wrote ${out} (${fix.placements.length} pcs)`);
}

const historyPath = path.join(__dirname, '../assets/data/author-history-builds.json');
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
for (const runId of [3703, 3709, 3708, 3705]) {
  const b = history.builds.find((x) => x.runId === runId);
  if (!b) {
    console.warn(`Missing history run ${runId}`);
    continue;
  }
  const slug = b.slug || `history-${runId}`;
  const fix = toFixture(slug, 'author_history', b.placements || []);
  const out = path.join(OUT_DIR, `${slug}.json`);
  fs.writeFileSync(out, JSON.stringify(fix, null, 2));
  console.log(`Wrote ${out} (${fix.placements.length} pcs)`);
}

console.log('Parity fixtures built.');
