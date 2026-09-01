/**
 * Phase 259 — print a GDScript-first audit of a bpb-sim-debug JSON file.
 *   node scripts/sim-audit-debug.mjs path/to/dump.json
 */
import fs from 'fs';
import {
  auditSimDebugDump,
  formatAuditReport,
} from '../js/pages/sim/engine/audit-debug.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/sim-audit-debug.mjs <dump.json>');
  process.exit(2);
}
let dump;
try {
  dump = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error('FAIL: could not read JSON', err?.message || err);
  process.exit(1);
}
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const audit = auditSimDebugDump(dump, inventory);
console.log(formatAuditReport(audit));
if (!audit.ok) process.exit(1);
