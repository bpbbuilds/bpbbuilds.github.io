/**
 * Phase 264 — staple-class dumps have empty ui.mismatches.
 * Regenerates dumps when run via `npm run sim-ar-milestone`.
 *   node scripts/sim-ar-milestone.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SUMMARY = path.join(ROOT, 'assets', 'data', 'sim-staple-boards.json');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

ok(fs.existsSync(SUMMARY), 'sim-staple-boards.json exists (run npm run sim-staple-boards)');
if (!fs.existsSync(SUMMARY)) {
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
const dumps = summary.dumps || [];
ok(dumps.length === 6, `six staple dumps (got ${dumps.length})`);

for (const d of dumps) {
  ok(
    (d.mismatchCount || 0) === 0,
    `${d.heroClass}: ui.mismatches empty (got ${d.mismatchCount})`,
  );
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAR milestone 264: staple ui.mismatches empty');
