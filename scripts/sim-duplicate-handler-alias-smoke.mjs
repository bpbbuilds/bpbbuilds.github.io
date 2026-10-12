import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

await import('../js/pages/sim/engine/scripts/registry.js');
const { PORT_HANDLERS, CANONICAL_DUPLICATE_HANDLERS } =
  await import('../js/pages/sim/engine/scripts/ports.js');

const ids = [
  'amulet_of_alchemy',
  'badger_spirit',
  'crow',
  'double_rainbow',
  'evil_hat',
  'full_body_protection',
  'heart_of_darkness',
  'mana_crystal',
  'mercury_elemental',
  'no_rush_please',
  'paradise_birb',
  'robodog',
  'spirit_bells',
  'stone_badge',
  'thorn_elemental',
  'thornburst',
  'torch',
  'turtle',
  'wolpertinger',
];

const audit = spawnSync(process.execPath, ['scripts/audit-sim-gd-parity.mjs', '--require-triage'], {
  encoding: 'utf8',
});
assert.equal(audit.status, 0, audit.stderr || audit.stdout);

const report = JSON.parse(fs.readFileSync('scripts/_cache/sim-gd-parity-report.json', 'utf8'));
const duplicateIds = report.duplicateRegistrations.map((row) => row.id).sort();
assert.deepEqual(duplicateIds, [...ids].sort(), 'duplicate audit list is intentional and complete');
assert.equal(report.totals.duplicateRegistrations, ids.length, 'duplicate count is stable');
assert.deepEqual(Object.keys(CANONICAL_DUPLICATE_HANDLERS).sort(), [...ids].sort());

for (const id of ids) {
  assert.equal(
    PORT_HANDLERS[id],
    CANONICAL_DUPLICATE_HANDLERS[id],
    `${id}: registry resolves to its declared canonical handler`,
  );
  assert.equal(PORT_HANDLERS[id]?.handlerId, id, `${id}: canonical handler id`);
}

console.log(`Duplicate handler canonicalization passed: ${ids.length} intentional resolutions.`);
