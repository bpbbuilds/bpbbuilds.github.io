/**
 * Per-item .gd → JS port hook parity.
 *
 *   node scripts/audit-sim-gd-parity.mjs
 *
 * For every item in assets/data/sim-item-inventory.json this compares the
 * hooks the game script overrides against the hooks the resolved JS handler
 * implements, and records which port module owns the id (duplicate exports
 * are silently shadowed by ports.js spread order, so they are reported too).
 *
 * Writes scripts/_cache/sim-gd-parity-report.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(ROOT, 'tools/game-extract-full');

/** gd hook → JS hooks that can legitimately carry it. */
const HOOK_MAP = {
  // The simulator runs an explicit prepare pass before combat-start hooks;
  // keep direct onPrepare ports visible instead of treating them as gaps.
  onPrepare: ['onPrepare', 'onPreCombatStart', 'onCombatStart'],
  onPreCombatStart: ['onPreCombatStart', 'onCombatStart'],
  onCombatStart: ['onCombatStart', 'onPreCombatStart'],
  combatStartInventory: ['onCombatStart', 'onPreCombatStart'],
  onPostCombatStart: ['onPostCombatStart'],
  doCooldownEffect: ['onCooldownEffect'],
  // Card.gd dispatches doRevealEffect from trigger(); cards are scheduled by
  // the simulator's cooldown/reveal queue, so the resolved card port exposes
  // that lifecycle through onCooldownEffect.
  doRevealEffect: ['onCooldownEffect'],
  onPreDealDamage_early: ['onPreDealDamageEarly', 'onCooldownEffect'],
  onPreDealDamage_late: ['onPreDealDamageEarly', 'onCooldownEffect'],
  onDealtDamage: ['onDealtDamage', 'onCooldownEffect'],
  onChargeReceived: ['onChargeReceived'],
  onDamaged: ['onCombatStart', 'onPreCombatStart', 'onDealtDamage'],
  afterBlock: ['onCombatStart', 'onPreCombatStart', 'onDealtDamage'],
  onTriggerPotion: ['onCombatStart', 'onCooldownEffect', 'onDrink'],
  trigger: ['onCombatStart', 'onCooldownEffect', 'onPeerActivated'],
  addToInventory: [],
  onShopEntered: [],
  combatEnd: [],
};

/** Hooks that only matter out of combat — never a parity gap. */
const OUT_OF_COMBAT = new Set(['addToInventory', 'onShopEntered', 'combatEnd']);

/** Source-review records exist only for currently missing hooks. */
const HOOK_TRIAGE = {};

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

/** Which port modules export each id (last one wins in ports.js). */
function portModuleOwners() {
  const dir = path.join(ROOT, 'js/pages/sim/engine/scripts');
  /** @type {Map<string, string[]>} */
  const owners = new Map();
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) files.push(p);
    }
  };
  walk(dir);
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    for (const m of src.matchAll(/handlerId:\s*'([a-z0-9_]+)'/g)) {
      const list = owners.get(m[1]) || [];
      if (!list.includes(rel)) list.push(rel);
      owners.set(m[1], list);
    }
  }
  return owners;
}

/** Full text of the item's game script, for evidence checks. */
function gdSource(file) {
  if (!file) return '';
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === file) hits.push(p);
    }
  };
  const items = path.join(GAME, 'Items');
  if (fs.existsSync(items)) walk(items);
  return hits.length ? fs.readFileSync(hits[0], 'utf8') : '';
}

const inv = loadJson('assets/data/sim-item-inventory.json');
const parity = loadJson('assets/data/sim-parity-inventory.json');
const coverage = loadJson('assets/data/sim-item-coverage.json');
const owners = portModuleOwners();

const registry = await import(
  pathToFileURL(path.join(ROOT, 'js/pages/sim/engine/scripts/registry.js')).href,
);

const SKIP = new Set(coverage.byId ? Object.keys(coverage.byId).filter((id) => coverage.byId[id].status === 'base') : []);

const rows = [];
for (const [id, entry] of Object.entries(inv.byId || {})) {
  if (SKIP.has(id)) continue;
  const handler = registry.getScriptHandler(id);
  const jsHooks = handler
    ? Object.keys(handler).filter((k) => typeof handler[k] === 'function')
    : [];
  const gdHooks = entry.overrides || [];
  const missing = [];
  for (const hook of gdHooks) {
    if (OUT_OF_COMBAT.has(hook)) continue;
    const accepts = HOOK_MAP[hook];
    if (!accepts) {
      missing.push({ hook, why: 'unmapped gd hook' });
      continue;
    }
    if (!accepts.some((j) => jsHooks.includes(j))) {
      missing.push({ hook, why: `no JS hook among ${accepts.join('/')}` });
    }
  }
  const dup = (owners.get(id) || []).length > 1 ? owners.get(id) : null;
  rows.push({
    id,
    file: entry.file,
    extends: entry.extends,
    family: entry.family,
    depth: parity.byId?.[id]?.depth || coverage.byId?.[id]?.depth || null,
    handlerId: handler?.handlerId || null,
    gdHooks,
    jsHooks,
    missing,
    hookTriage: missing.length ? HOOK_TRIAGE[id] || null : null,
    duplicateModules: dup,
  });
}

const gaps = rows.filter((r) => r.missing.length);
const noHandler = rows.filter((r) => !r.handlerId);
const dupes = rows.filter((r) => r.duplicateModules);
const shallow = rows.filter((r) => r.depth === 'shallow');
const untriagedHookGaps = gaps.filter((row) => !row.hookTriage);
const staleTriage = Object.keys(HOOK_TRIAGE).filter((id) => !gaps.some((row) => row.id === id));
const triageByStatus = gaps.reduce((counts, row) => {
  const status = row.hookTriage?.status || 'untriaged';
  counts[status] = (counts[status] || 0) + 1;
  return counts;
}, /** @type {Record<string, number>} */ ({}));

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    items: rows.length,
    noHandler: noHandler.length,
    hookGaps: gaps.length,
    duplicateRegistrations: dupes.length,
    shallow: shallow.length,
    untriagedHookGaps: untriagedHookGaps.length,
    staleHookTriage: staleTriage.length,
  },
  gdHookHistogram: Object.entries(
    rows.reduce((acc, r) => {
      for (const h of r.gdHooks) acc[h] = (acc[h] || 0) + 1;
      return acc;
    }, /** @type {Record<string, number>} */ ({})),
  ).sort((a, b) => b[1] - a[1]),
  noHandler: noHandler.map((r) => r.id),
  duplicateRegistrations: dupes.map((r) => ({ id: r.id, modules: r.duplicateModules })),
  hookGaps: gaps,
  hookTriage: gaps.map((row) => ({
    id: row.id,
    missing: row.missing.map((entry) => entry.hook),
    ...row.hookTriage,
  })),
  hookTriageByStatus: triageByStatus,
  staleHookTriage: staleTriage,
  shallowIds: shallow.map((r) => r.id),
  rows,
};

const out = path.join(ROOT, 'scripts/_cache/sim-gd-parity-report.json');
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals, null, 1));
console.log('gd hook histogram:', JSON.stringify(report.gdHookHistogram));
console.log('no handler:', report.noHandler.join(', ') || '(none)');
console.log('duplicate registrations:', JSON.stringify(report.duplicateRegistrations, null, 1));
console.log(
  'hook gaps:',
  gaps
    .map((g) => `${g.id} [${g.missing.map((m) => m.hook).join(',')}] gd=${g.gdHooks.join('/')} js=${g.jsHooks.join('/') || 'none'}`)
    .join('\n  '),
);
if (process.argv.includes('--require-triage') && (untriagedHookGaps.length || staleTriage.length)) {
  console.error(`FAIL hook triage: ${untriagedHookGaps.length} untriaged, ${staleTriage.length} stale`);
  process.exitCode = 1;
}
console.log(`wrote ${path.relative(ROOT, out)}`);
