/**
 * Package 6 — source baseline and game-patch drift detector.
 *
 *   node scripts/sim-patch-drift.mjs --write-baseline
 *   node scripts/sim-patch-drift.mjs --check
 *
 * `--write-baseline` is deliberately explicit. It is the final acknowledgement
 * step after the changed rows have been reviewed and their ledger fidelity has
 * been downgraded where needed. This script never rewrites the ledger.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'assets/data/sim-patch-baseline.json');
const EXTRACT = path.join(ROOT, 'tools/game-extract-full');
const ITEMS_DIR = path.join(EXTRACT, 'Items');
const VALIDATED = new Set(['fixture_validated', 'live_validated']);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relative = (file) => path.relative(ROOT, file).replace(/\\/g, '/');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function catalogItems(raw) {
  return Array.isArray(raw) ? raw : raw.items || [];
}

function scriptHooks(source) {
  return [...new Set([...source.matchAll(/^\s*func\s+([A-Za-z0-9_]+)\s*\(/gm)].map((match) => match[1]))].sort();
}

function itemScriptIndex() {
  const exact = new Map();
  const byName = new Map();
  for (const file of walk(ITEMS_DIR).filter((file) => file.endsWith('.gd'))) {
    const rel = path.relative(ITEMS_DIR, file).replace(/\\/g, '/');
    exact.set(rel, file);
    const list = byName.get(path.basename(file)) || [];
    list.push(file);
    byName.set(path.basename(file), list);
  }
  return { exact, byName };
}

function resolveScript(index, sourcePath) {
  if (!sourcePath) return null;
  const normalized = sourcePath.replace(/\\/g, '/');
  if (index.exact.has(normalized)) return index.exact.get(normalized);
  const candidates = index.byName.get(path.basename(normalized)) || [];
  return candidates.length === 1 ? candidates[0] : null;
}

function buildSnapshot() {
  const ledger = readJson('assets/data/sim-fidelity-ledger.json');
  const surface = readJson('assets/data/sim-system-surface.json');
  const catalog = catalogItems(readJson('scripts/_cache/game-items.json'));
  const index = itemScriptIndex();
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  const ledgerById = new Map(ledger.rows.map((row) => [row.id, row]));
  const allIds = [...new Set([...ledgerById.keys(), ...catalogById.keys()])].sort();
  const rows = Object.fromEntries(
    allIds.map((id) => {
        const row = ledgerById.get(id) || {
          id,
          source: { script: null },
          status: 'unrepresented',
          fidelity: 'incomplete',
        };
        const script = resolveScript(index, row.source?.script);
        const source = script ? fs.readFileSync(script, 'utf8') : null;
        const item = catalogById.get(id) || null;
        return [id, {
          catalogSha256: item ? sha256(JSON.stringify(stable(item))) : null,
          sourcePath: script ? path.relative(ITEMS_DIR, script).replace(/\\/g, '/') : row.source?.script || null,
          sourceSha256: source == null ? null : sha256(source),
          hooks: source == null ? [] : scriptHooks(source),
          status: row.status,
          fidelity: row.fidelity,
        }];
      }),
  );

  const core = {};
  for (const sourcePath of Object.keys(surface.source?.extractFiles || {}).sort()) {
    const file = path.join(EXTRACT, sourcePath);
    core[sourcePath] = fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
  }

  return {
    schema: 1,
    note: 'Generated source baseline. Do not update after a game patch until changed rows have been re-reviewed.',
    generatedFrom: {
      catalog: 'scripts/_cache/game-items.json',
      ledger: 'assets/data/sim-fidelity-ledger.json',
      extract: 'tools/game-extract-full',
    },
    catalog: {
      sha256: sha256(JSON.stringify(stable(catalog))),
      itemCount: catalog.length,
      ids: [...catalogById.keys()].sort(),
    },
    core,
    rows,
  };
}

function keys(object = {}) {
  return Object.keys(object).sort();
}

function changedIds(before, after, predicate) {
  return [...new Set([...keys(before.rows), ...keys(after.rows)])]
    .filter((id) => predicate(before.rows[id], after.rows[id]))
    .sort();
}

function diff(before, after) {
  const beforeCatalogIds = new Set(before.catalog?.ids || keys(before.rows).filter((id) => before.rows[id]?.catalogSha256));
  const afterCatalogIds = new Set(after.catalog?.ids || keys(after.rows).filter((id) => after.rows[id]?.catalogSha256));
  const added = [...afterCatalogIds].filter((id) => !beforeCatalogIds.has(id)).sort();
  const removed = [...beforeCatalogIds].filter((id) => !afterCatalogIds.has(id)).sort();
  const catalogChanged = changedIds(before, after, (oldRow, newRow) =>
    Boolean(oldRow && newRow && oldRow.catalogSha256 !== newRow.catalogSha256));
  const scriptChanged = changedIds(before, after, (oldRow, newRow) =>
    Boolean(oldRow && newRow && (
      oldRow.sourcePath !== newRow.sourcePath ||
      oldRow.sourceSha256 !== newRow.sourceSha256 ||
      JSON.stringify(oldRow.hooks) !== JSON.stringify(newRow.hooks)
    )));
  const coreChanged = [...new Set([...keys(before.core), ...keys(after.core)])]
    .filter((key) => before.core[key] !== after.core[key]);
  const direct = [...new Set([...added, ...catalogChanged, ...scriptChanged])].sort();
  const coreImpacted = coreChanged.length
    ? keys(after.rows).filter((id) => {
      const row = after.rows[id];
      return row.sourcePath && row.fidelity !== 'no_combat';
    })
    : [];
  const review = [...new Set([...direct, ...coreImpacted])].sort();
  const retainedValidation = review.filter((id) => VALIDATED.has(after.rows[id]?.fidelity));
  return { added, removed, catalogChanged, scriptChanged, coreChanged, direct, coreImpacted, review, retainedValidation };
}

function printList(label, values, limit = 18) {
  const suffix = values.length > limit ? `, … +${values.length - limit}` : '';
  console.log(`${label}: ${values.length}${values.length ? ` (${values.slice(0, limit).join(', ')}${suffix})` : ''}`);
}

const write = process.argv.includes('--write-baseline');
const check = process.argv.includes('--check');
if (write && check) {
  console.error('Use either --write-baseline or --check, not both.');
  process.exit(2);
}

const current = buildSnapshot();
const baseline = fs.existsSync(BASELINE)
  ? JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  : null;
if (write) {
  if (baseline) {
    const pending = diff(baseline, current);
    if (pending.retainedValidation.length) {
      printList('Validated rows still carrying stale confidence', pending.retainedValidation);
      console.error('FAIL cannot acknowledge source drift while affected fixture/live-validated rows retain their confidence. Downgrade them to incomplete after review first.');
      process.exit(1);
    }
  }
  fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Wrote ${relative(BASELINE)} (${Object.keys(current.rows).length} ledger rows).`);
  process.exit(0);
}

if (!baseline) {
  console.error(`FAIL missing ${relative(BASELINE)}; review the extract and run with --write-baseline once.`);
  process.exit(1);
}

const changes = diff(baseline, current);
const hasDrift = changes.added.length || changes.removed.length || changes.catalogChanged.length || changes.scriptChanged.length || changes.coreChanged.length;

console.log(`Patch-drift baseline: ${baseline.catalog?.itemCount ?? 0} → ${current.catalog.itemCount} catalog rows.`);
printList('Added catalog rows', changes.added);
printList('Removed catalog rows', changes.removed);
printList('Catalog parameter/data changes', changes.catalogChanged);
printList('Item script/hook changes', changes.scriptChanged);
printList('Shared-core changes', changes.coreChanged);
printList('Required review wave', changes.review);
printList('Validated rows that must be downgraded before acknowledging patch', changes.retainedValidation);

if (hasDrift) {
  console.error('FAIL source drift detected. Re-review the listed wave, downgrade any fixture/live-validated rows, regenerate the ledger, then explicitly run --write-baseline.');
  process.exitCode = 1;
} else {
  console.log('OK patch baseline matches catalog, item scripts/hooks/parameters, and tracked shared core.');
}

if (!check && hasDrift) {
  console.log('Tip: use --check in CI. This read-only invocation has not changed any baseline.');
}
