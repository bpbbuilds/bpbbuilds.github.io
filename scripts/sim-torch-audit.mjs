/**
 * Headless Torch activation audit for the bloodthorne permalink.
 *   node scripts/sim-torch-audit.mjs
 * Does not print secrets from .env.
 */
import fs from 'fs';
import { runSim } from '../js/pages/sim/engine/index.js';
import { hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';
import { buildSimDebugReport } from '../js/pages/sim/engine/log-export.js';
import {
  mapItem,
  applyShapes,
  applySocketOffsets,
} from '../js/pages/build/map-item.js';

function loadEnv() {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync('.env')) return out;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function historyRound(history, r) {
  return (history?.rounds || []).find((x) => Number(x.round) === r) || null;
}

function placementsFrom(build, r) {
  const hr = historyRound(build.history, r);
  if (hr?.placements?.length) {
    return hr.placements.map((p, i) => ({
      id: p.id || p.item_id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      key:
        p.key ||
        `${p.id || p.item_id}:${i}:${p.x},${p.y}:${Number(p.r) || 0}`,
      gems: Array.isArray(p.gems) ? p.gems.filter(Boolean) : [],
    }));
  }
  return (build.placements || []).map((p, i) => {
    const id = p.item?.id || p.item_id;
    return {
      id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      key: `${id}:${i}:${p.x},${p.y}:${Number(p.r) || 0}`,
      gems: Array.isArray(p.gems) ? p.gems.filter(Boolean) : [],
    };
  });
}

function itemsFromBuild(build) {
  /** @type {object[]} */
  const rows = [];
  for (const p of build.placements || []) {
    if (p.item) rows.push(p.item);
  }
  return rows;
}

const ITEM_SELECT =
  'id,gid,name,rarity,type,class,extra_types,tags,cost,effect,image,shape,sockets,accuracy,cooldown,stamina_cost,damage_min,damage_max,block,chance,chance_tag,params';

/**
 * @param {string} base
 * @param {string} key
 * @param {string} slug
 */
async function fetchBuild(base, key, slug) {
  const q = new URL(`${base}/rest/v1/builds`);
  q.searchParams.set(
    'select',
    `id,slug,title,hero_class,history,placements:build_placements(id,x,y,r,gems,item:items(${ITEM_SELECT}))`,
  );
  q.searchParams.set('slug', `eq.${slug}`);
  q.searchParams.set('is_public', 'eq.true');
  const res = await fetch(q, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`build ${slug} HTTP ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

/**
 * @param {string} base
 * @param {string} key
 * @param {string[]} ids
 */
async function fetchItems(base, key, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const q = new URL(`${base}/rest/v1/items`);
  q.searchParams.set('select', ITEM_SELECT);
  q.searchParams.set('id', `in.(${unique.join(',')})`);
  const res = await fetch(q, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`items HTTP ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

const env = loadEnv();
const base = env.SUPABASE_PROJECT_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY;
if (!base || !key) {
  console.error('FAIL: missing SUPABASE_PROJECT_URL / SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const slug = process.argv[2] || 'bpbb-bloodthorne-bat-build-0jtgrl';
const oppSlug = process.argv[3] || 'bpbb-cool-card-unhealing-build-e989c5';
const round = Number(process.argv[4] || 6);
const seed = Number(process.argv[5] || 2965184550) >>> 0;

const [build, opp] = await Promise.all([
  fetchBuild(base, key, slug),
  fetchBuild(base, key, oppSlug),
]);
if (!build) {
  console.error('FAIL: build not found', slug);
  process.exit(1);
}

const youPl = placementsFrom(build, round);
const themPl = opp ? placementsFrom(opp, round) : [];
const itemRows = [
  ...itemsFromBuild(build),
  ...(opp ? itemsFromBuild(opp) : []),
];
const have = new Set(itemRows.map((i) => i.id));
const need = [
  ...new Set(
    [...youPl, ...themPl]
      .map((p) => p.id)
      .filter((id) => id && !have.has(id)),
  ),
];
itemRows.push(...(await fetchItems(base, key, need)));
const gemNeed = [
  ...new Set(
    [...youPl, ...themPl]
      .flatMap((p) => p.gems || [])
      .filter((g) => g && !itemRows.some((i) => i.id === g)),
  ),
];
itemRows.push(...(await fetchItems(base, key, gemNeed)));

const mapped = itemRows.map(mapItem);
applyShapes(mapped, null);
applySocketOffsets(mapped, null);
/** @type {Map<string, object>} */
const itemsById = new Map(mapped.map((i) => [i.id, i]));

hydrateSimCoverage(
  JSON.parse(fs.readFileSync('assets/data/sim-item-coverage.json', 'utf8')),
  JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8')),
);

const hr = historyRound(build.history, round);
const ohr = opp ? historyRound(opp.history, round) : null;

const run = runSim({
  mode: 'engine',
  placements: youPl,
  opponentPlacements: themPl,
  itemsById,
  seed,
  round,
  opponentRound: round,
  playerMaxHp: hr?.health ?? null,
  playerMaxStamina: hr?.stamina ?? null,
  opponentMaxHp: ohr?.health ?? null,
  opponentMaxStamina: ohr?.stamina ?? null,
  durationSec: 40,
});

const report = buildSimDebugReport(run, {
  placements: youPl,
  opponentPlacements: themPl,
  itemsById,
  seed,
  slug,
  round,
  title: build.title,
  opponentSlug: opp?.slug || null,
  opponentTitle: opp?.title || null,
  opponentRound: round,
});

const torch =
  (report.weaponAudits?.weapons || []).find((w) => w.itemId === 'torch') ||
  null;

const out = {
  slug,
  oppSlug: opp?.slug || null,
  round,
  seed,
  endReason: run.summary?.endReason,
  combatDurationSec: report.combatDurationSec,
  hasTorch: youPl.some((p) => p.id === 'torch'),
  torch,
  note: report.weaponAudits?.note,
};

fs.writeFileSync('_tmp-torch-audit.json', JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      endReason: out.endReason,
      combatDurationSec: out.combatDurationSec,
      hasTorch: out.hasTorch,
      torch: torch && {
        activationCount: torch.activationCount,
        hits: torch.hits,
        misses: torch.misses,
        crits: torch.crits,
        grows: torch.grows,
        lastCombatT: torch.lastCombatT,
        activationsPerCombatSec: torch.activationsPerCombatSec,
        endBonusDamage: torch.endBonusDamage,
        endCritChance: torch.endCritChance,
        chanceRolls: torch.chanceRolls,
        chanceProcs: torch.chanceProcs,
        swings: torch.swings.map((s) => ({
          combatT: Math.round(Number(s.combatT) * 100) / 100,
          outcome: s.outcome,
          amount: s.amount,
          grew: s.grew,
          critChance: s.critChance,
          heat: s.heat,
          pieceSpeed: s.pieceSpeed,
          bonusDamage: s.bonusDamage,
        })),
      },
      wrote: '_tmp-torch-audit.json',
    },
    null,
    2,
  ),
);
