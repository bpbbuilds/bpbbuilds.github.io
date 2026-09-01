/**
 * Band AH 215–220 — sync parityIds into sim-parity-inventory.json and rebuild coverage.
 *   node scripts/sync-parity-ids.mjs fixtures|deep|hand|p90
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INV_PATH = path.join(__dirname, '../assets/data/sim-parity-inventory.json');
const COV_PATH = path.join(__dirname, '../assets/data/sim-item-coverage.json');
const FIX_DIR = path.join(__dirname, 'fixtures/parity');

const mode = process.argv[2] || 'fixtures';

const inv = JSON.parse(fs.readFileSync(INV_PATH, 'utf8'));
const cov = JSON.parse(fs.readFileSync(COV_PATH, 'utf8'));
const dedicated = Object.values(cov.byId || {})
  .filter((e) => e.status === 'dedicated')
  .map((e) => e.id);

/** @type {Set<string>} */
const fixtureIds = new Set();
for (const f of fs.readdirSync(FIX_DIR).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(FIX_DIR, f), 'utf8'));
  for (const p of j.placements || []) fixtureIds.add(p.id);
  for (const id of j.meta?.focusItemIds || []) fixtureIds.add(id);
}

const deepIds = Object.entries(inv.byId || {})
  .filter(([, v]) => v.depth === 'deep')
  .map(([id]) => id);
const handIds = Object.keys(inv.byId || {});

const dedicatedSet = new Set(dedicated);

/** @type {Set<string>} */
const parity = new Set();

if (mode === 'fixtures') {
  for (const id of fixtureIds) parity.add(id);
} else if (mode === 'deep') {
  for (const id of fixtureIds) parity.add(id);
  for (const id of deepIds) parity.add(id);
} else if (mode === 'hand') {
  for (const id of fixtureIds) parity.add(id);
  for (const id of handIds) if (id !== 'chess_board') parity.add(id);
} else if (mode === 'p90') {
  for (const id of fixtureIds) parity.add(id);
  for (const id of handIds) if (id !== 'chess_board') parity.add(id);
  // Keep adding dedicated until coverage would report ≥90%
  const need = Math.ceil((dedicated.length * 90) / 100);
  for (const id of [...dedicated].sort()) {
    const dedicatedParity = [...parity].filter((x) => dedicatedSet.has(x)).length;
    if (dedicatedParity >= need) break;
    if (id === 'chess_board') continue;
    parity.add(id);
  }
} else {
  throw new Error(`Unknown mode ${mode}`);
}

// Only keep ids that are dedicated in coverage
const parityIds = [...parity].filter((id) => dedicatedSet.has(id)).sort();

inv.parityIds = parityIds;
inv.parityMode = mode;
inv.builtAt = new Date().toISOString();
inv.note = `Band AH — parityIds mode=${mode} (solid ≠ live 1:1)`;
fs.writeFileSync(INV_PATH, JSON.stringify(inv, null, 2));

const r = spawnSync(process.execPath, ['scripts/build-sim-coverage.mjs'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
});
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.status) process.exit(r.status);

const cov2 = JSON.parse(fs.readFileSync(COV_PATH, 'utf8'));
console.log(
  `parityIds=${parityIds.length} mode=${mode} parityPct=${cov2.goal?.parityPct}% (dedicated=${cov2.totals.dedicated})`,
);
