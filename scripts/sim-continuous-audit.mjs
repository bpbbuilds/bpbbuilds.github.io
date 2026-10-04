/**
 * Package 6 — non-mutating simulator audit entry point.
 *
 *   node scripts/sim-continuous-audit.mjs --check
 *   node scripts/sim-continuous-audit.mjs --check --family sim-charge-smoke
 *   node scripts/sim-continuous-audit.mjs --check --fixtures
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const requestedFamily = args.indexOf('--family') >= 0 ? args[args.indexOf('--family') + 1] : null;

if (args.includes('--family') && (!requestedFamily || !/^[a-z0-9-]+$/.test(requestedFamily))) {
  console.error('FAIL --family expects a simulator smoke stem such as sim-charge-smoke.');
  process.exit(2);
}

const checks = [
  ['patch drift', ['scripts/sim-patch-drift.mjs', '--check']],
  ['shared source surface', ['scripts/build-sim-system-surface.mjs', '--check']],
  ['fidelity ledger', ['scripts/build-sim-fidelity-ledger.mjs', '--check']],
  ['hook triage', ['scripts/audit-sim-gd-parity.mjs', '--require-triage']],
  ['call candidate report', ['scripts/audit-sim-gd-calls.mjs']],
  ['intentional noops', ['scripts/sim-noop-audit.mjs']],
  ['coverage honesty', ['scripts/sim-coverage-honesty.mjs']],
  ['combat log', ['scripts/sim-log-smoke.mjs']],
  ['wand/rib source ports', ['scripts/sim-wand-rib-smoke.mjs']],
  ['lifecycle', ['scripts/sim-lifecycle-smoke.mjs']],
  ['event contract', ['scripts/sim-event-contract-smoke.mjs']],
  ['socket ordering', ['scripts/sim-socket-split-smoke.mjs']],
  ['two-board symmetry', ['scripts/sim-vs-board-smoke.mjs']],
];

const disclosure = fs.readFileSync(path.join(ROOT, 'docs/sim/sim-validation.md'), 'utf8');
const disclosureRequired = [
  '## Continuous-audit ownership (Package 6)',
  '| Mismatch / evidence gap | Owner | Game source or evidence | Severity | Next evidence |',
  'Power of the Moon has no `CombatTimer.advanceTime` equivalent',
  'No retained live capture is filled (0/11 fixtures)',
];

if (requestedFamily) {
  const script = `scripts/${requestedFamily}.mjs`;
  if (!fs.existsSync(path.join(ROOT, script))) {
    console.error(`FAIL requested family smoke does not exist: ${script}`);
    process.exit(2);
  }
  checks.push([`requested family (${requestedFamily})`, [script]]);
}

if (args.includes('--fixtures')) {
  checks.push(['deterministic fixture bands', ['scripts/sim-parity-fixtures.mjs']]);
  checks.push(['live-capture schema', ['scripts/sim-live-bands.mjs']]);
}

let failed = 0;
console.log('\n=== mismatch disclosure ===');
if (disclosureRequired.every((needle) => disclosure.includes(needle))) {
  console.log('OK known simulator mismatch ownership remains published in docs/sim/sim-validation.md');
} else {
  failed += 1;
  console.error('FAIL docs/sim/sim-validation.md is missing the required open-mismatch ownership disclosure.');
}
for (const [name, command] of checks) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, command, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

console.log(`\nContinuous simulator audit: ${checks.length + 1 - failed}/${checks.length + 1} checks passed.`);
if (!args.includes('--fixtures')) {
  console.log('Fixture bands are not included by default: run with --fixtures for a harness/fixture change. Existing live-capture coverage remains a Package 5 requirement.');
}
if (failed) process.exitCode = 1;
