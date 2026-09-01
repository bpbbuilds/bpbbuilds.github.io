/**
 * Export assets/data/builds/infinite-combo-machine.json for offline/fallback load.
 * Run: node scripts/export-demo-build.mjs
 */
import fs from 'fs';
import { config } from '../js/shared/config.js';

const SLUG = 'infinite-combo-machine';
const OUT = `assets/data/builds/${SLUG}.json`;
const ITEM_SELECT =
  'id,gid,name,rarity,type,class,extra_types,tags,cost,effect,image,shape,sockets,accuracy,cooldown,stamina_cost,damage_min,damage_max,block,chance,chance_tag,params';

const headers = {
  apikey: config.supabasePublishableKey,
  Authorization: `Bearer ${config.supabasePublishableKey}`,
};

async function rest(path) {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
  return res.json();
}

const buildSel = [
  'id',
  'slug',
  'title',
  'hero_class',
  'blurb',
  'notes',
  'youtube_url',
  'thumbnail_path',
  'is_op',
  'author_name',
  'gold_count',
  'rank',
  'route_r3',
  'route_r10',
  'route_r3_item_id',
  'route_r10_item_id',
  'placements:build_placements(id,x,y,r,gems,priority,item:items(' +
    ITEM_SELECT.replace(/,/g, ',') +
    '))',
].join(',');

const builds = await rest(
  `builds?slug=eq.${SLUG}&is_public=eq.true&select=${encodeURIComponent(buildSel)}`,
);
const data = builds[0];
if (!data) throw new Error(`build not found: ${SLUG}`);

const run = JSON.parse(fs.readFileSync('assets/data/history-demo-run.json', 'utf8'));
const need = new Set();
for (const r of run.rounds || []) {
  for (const p of r.placements || []) if (p?.id) need.add(p.id);
}
for (const p of data.placements || []) if (p.item?.id) need.add(p.item.id);
if (data.route_r3_item_id) need.add(data.route_r3_item_id);
if (data.route_r10_item_id) need.add(data.route_r10_item_id);

const ids = [...need].map(encodeURIComponent).join(',');
const items = await rest(`items?id=in.(${ids})&select=${ITEM_SELECT}`);

/** Loadout starting bags — BuildEntry.getStartingBag (see CharacterClasses/*.tres). */
const CLASS_STARTING_BAGS = {
  Adventurer: ['bag_of_giving', 'sewing_case'],
  Berserker: ['berserker_bag', 'toolbox'],
  Engineer: ['engineer_box', 'engineer_bag_2'],
  Mage: ['scholar_bag', 'puzzlebox'],
  Pyromancer: ['fire_pit', 'portable_altar'],
  Ranger: ['ranger_bag', 'vineweave_basket'],
  Reaper: ['storage_coffin', 'relic_case'],
};

function inferBagItemId(heroClass, historyRun) {
  const starting = CLASS_STARTING_BAGS[heroClass] || [];
  for (const p of historyRun?.rounds?.[0]?.placements || []) {
    if (p?.id && starting.includes(p.id)) return p.id;
  }
  return starting[0] || null;
}

const bagItemId = inferBagItemId(data.hero_class, run);

const out = {
  exportedAt: new Date().toISOString(),
  build: {
    id: data.id,
    slug: data.slug,
    title: data.title,
    hero_class: data.hero_class,
    blurb: data.blurb,
    notes: data.notes,
    youtube_url: data.youtube_url,
    thumbnail_path: data.thumbnail_path,
    is_op: data.is_op,
    author_name: data.author_name,
    gold_count: data.gold_count,
    rank: data.rank,
    route_r3: data.route_r3,
    route_r10: data.route_r10,
    route_r3_item_id: data.route_r3_item_id,
    route_r10_item_id: data.route_r10_item_id,
    bag_item_id: bagItemId,
    placements: (data.placements || []).map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      r: p.r,
      gems: p.gems,
      priority: p.priority,
      item_id: p.item?.id,
    })),
  },
  items: items || [],
};

fs.mkdirSync('assets/data/builds', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(
  `wrote ${OUT}: ${out.items.length} items, ${out.build.placements.length} placements, ${Math.round(fs.statSync(OUT).size / 1024)}KB`,
);
