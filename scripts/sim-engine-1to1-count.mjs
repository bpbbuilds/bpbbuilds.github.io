/**
 * Phase 261 — fail if resolve still uses generic `cd_*` / silent `basic_cd`.
 *   node scripts/sim-engine-1to1-count.mjs
 *
 * bindPattern copies PATTERNS but sets handlerId to the item id — compare
 * function identity, not handlerId alone.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getScriptHandler,
  hydrateSimCoverage,
} from '../js/pages/sim/engine/scripts/registry.js';
import { PORT_HANDLERS } from '../js/pages/sim/engine/scripts/ports.js';
import { AUTO_PORTS } from '../js/pages/sim/engine/scripts/auto-ports.js';
import { HANDLERS } from '../js/pages/sim/engine/scripts/handlers.js';
import { PATTERNS } from '../js/pages/sim/engine/scripts/auto-patterns.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'data', 'sim-engine-1to1-count.json');

const SKIP_BASE = new Set([
  'weapon',
  'item',
  'bow',
  'food',
  'pet',
  'card',
  'gem',
]);

/** Census `trueWeaponCdTwins` — none kept on bindPattern `basic_cd`. */
const DOCUMENTED_BASIC_CD = new Set([]);

/** Auto-pattern stand-ins (not PORT aliases like `falcon_blade` / `aura_damage`). */
const GENERIC_PATTERN = new Set([
  'basic_cd',
  'double_strike',
  'cd_activate',
  'cd_lucky',
  'cd_mana',
  'cd_regen',
  'cd_heat',
  'cd_cold',
  'cd_poison',
  'start_regen',
  'start_max_hp',
  'start_spikes',
  'start_vampirism',
  'start_block',
  'start_mana',
  'start_heat',
  'start_lucky',
  'weapon_onhit_poison',
  'weapon_onhit_heat',
  'weapon_onhit_blind',
  'weapon_onhit_vampirism',
  'weapon_perm_bonus_on_hit',
  'precombat_link_damage',
  'aura_speed',
  'pet_strike',
]);

const coverage = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-item-coverage.json'), 'utf8'),
);
const inventory = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-item-inventory.json'), 'utf8'),
);
hydrateSimCoverage(coverage, inventory);

const gameItems = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_cache', 'game-items.json'), 'utf8'),
);

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

function parseAutoMap() {
  const src = fs.readFileSync(
    path.join(ROOT, 'js/pages/sim/engine/scripts/auto-ports.js'),
    'utf8',
  );
  const start = src.indexOf('const MAP = {');
  const end = src.indexOf('\n};', start);
  /** @type {Record<string, string>} */
  const MAP = {};
  for (const m of src.slice(start, end + 3).matchAll(/"([^"]+)": "([^"]+)"/g)) {
    MAP[m[1]] = m[2];
  }
  return MAP;
}

/**
 * @param {object | null} h
 * @returns {string | null}
 */
function matchingGenericPattern(h) {
  if (!h) return null;
  for (const key of GENERIC_PATTERN) {
    const p = PATTERNS[key] || (key === 'basic_cd' ? HANDLERS.basic_cd : null);
    if (!p) continue;
    if (h === p) return key;
    if (p.onCooldownEffect && h.onCooldownEffect === p.onCooldownEffect) {
      return key;
    }
    if (
      !p.onCooldownEffect &&
      p.onCombatStart &&
      h.onCombatStart === p.onCombatStart
    ) {
      return key;
    }
  }
  return null;
}

function isGenericHandlerId(hid) {
  const s = String(hid || '');
  if (GENERIC_PATTERN.has(s)) return true;
  return /^(cd_|start_|onhit_|weapon_onhit_)/.test(s);
}

const MAP = parseAutoMap();
ok(Object.keys(MAP).length >= 400, `MAP size ${Object.keys(MAP).length} ≥ 400`);

/** @type {{ id: string, pattern: string }[]} */
const mapGeneric = [];
for (const [id, pattern] of Object.entries(MAP)) {
  if (pattern === 'hand_port') continue;
  mapGeneric.push({ id, pattern });
}

ok(mapGeneric.length === 0, `MAP generic/other leftover ${mapGeneric.length}`);
if (mapGeneric.length) {
  console.error(
    mapGeneric
      .slice(0, 24)
      .map((r) => `${r.id}:${r.pattern}`)
      .join(', '),
  );
}

const ids = new Set([
  ...Object.keys(inventory.byId || {}),
  ...(gameItems.items || []).map((it) => it.id),
]);

/** @type {string[]} */
const silent = [];
/** @type {string[]} */
const missing = [];
let scanned = 0;

for (const id of [...ids].sort()) {
  if (SKIP_BASE.has(id)) continue;
  scanned += 1;
  const h = getScriptHandler(id);
  if (!h) {
    missing.push(id);
    continue;
  }
  if (isGenericHandlerId(h.handlerId) && !DOCUMENTED_BASIC_CD.has(id)) {
    silent.push(`${id} handlerId=${h.handlerId}`);
    continue;
  }
  const g = matchingGenericPattern(h);
  if (!g) continue;
  if (g === 'basic_cd' && DOCUMENTED_BASIC_CD.has(id)) continue;
  const port = PORT_HANDLERS[id];
  if (port && h.onCooldownEffect === port.onCooldownEffect) continue;
  silent.push(`${id} pattern=${g} handlerId=${h.handlerId}`);
}

ok(missing.length === 0, `every combat id has a handler (missing ${missing.length})`);
if (missing.length) console.error(missing.slice(0, 20).join(', '));

ok(silent.length === 0, `no silent generic resolve (got ${silent.length})`);
if (silent.length) console.error(silent.slice(0, 24).join('\n'));

let autoNotPort = 0;
for (const [id, pattern] of Object.entries(MAP)) {
  if (pattern !== 'hand_port') continue;
  if (AUTO_PORTS[id] !== PORT_HANDLERS[id]) {
    autoNotPort += 1;
    if (autoNotPort <= 8) console.error(`AUTO≠PORT ${id}`);
  }
}
ok(autoNotPort === 0, `AUTO_PORTS hand_port is PORT_HANDLERS (drift ${autoNotPort})`);

ok(DOCUMENTED_BASIC_CD.size === 0, 'trueWeaponCdTwins allowlist still empty');

const payload = {
  builtAt: new Date().toISOString(),
  scanned,
  mapSize: Object.keys(MAP).length,
  mapGenericCount: mapGeneric.length,
  silentGenericCount: silent.length,
  missingHandlerCount: missing.length,
  autoNotPort,
  documentedBasicCd: [...DOCUMENTED_BASIC_CD],
  silentSample: silent.slice(0, 40),
};

fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(`\nEngine 1:1 count OK → assets/data/sim-engine-1to1-count.json (scanned ${scanned})`);
