/**
 * Diff placeable catalog vs shipped detector-classes.json (retrain backlog).
 *
 *   node scripts/screenshot-detector/audit-class-gaps.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../screenshot-to-build/catalog.mjs';
import { buildClassList } from './classes.mjs';
import { loadCatalogWithTypes } from './sample-layouts.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const classesPath = path.join(ROOT, 'assets/data/detector-classes.json');

async function main() {
  const env = loadEnv();
  const catalog = await loadCatalogWithTypes(env);
  const expected = buildClassList(catalog);
  if (!fs.existsSync(classesPath)) {
    console.error('missing', classesPath);
    process.exit(1);
  }
  const shipped = JSON.parse(fs.readFileSync(classesPath, 'utf8'));
  const shippedIds = new Set((shipped.classes || []).map((c) => String(c.id)));
  const shippedNames = new Set((shipped.classes || []).map((c) => String(c.name || '').toLowerCase()));

  const missing = expected.classes.filter(
    (c) => !shippedIds.has(c.id) && !shippedNames.has(c.name.toLowerCase()),
  );
  const extra = (shipped.classes || []).filter(
    (c) => !expected.byId.has(String(c.id)),
  );

  console.log(`catalog placeable=${expected.classes.length}`);
  console.log(`detector-classes.json=${shipped.count ?? (shipped.classes || []).length}`);
  console.log(`missing from detector (${missing.length}):`);
  for (const c of missing.slice(0, 80)) {
    console.log(`  ${c.id}\t${c.name}\t${c.type}`);
  }
  if (missing.length > 80) console.log(`  … +${missing.length - 80} more`);
  if (extra.length) {
    console.log(`extra in detector not in catalog (${extra.length}):`);
    for (const c of extra.slice(0, 40)) {
      console.log(`  ${c.id}\t${c.name}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
