import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADMIN_TABS, ADMIN_TAB_LABELS, normalizeTab, urlForTab } from '../js/pages/admin/tabs.js';
import { filterAuditRows, verdictMeta } from '../js/pages/admin/tab-sim-audit.js';

assert.ok(ADMIN_TABS.includes('sim-audit'), 'Sim audit must be an addressable Admin tab');
assert.equal(ADMIN_TAB_LABELS['sim-audit'], 'Sim audit');
assert.equal(normalizeTab('SIM-AUDIT'), 'sim-audit');

const previousLocation = globalThis.location;
globalThis.location = new URL('https://example.test/admin/?source=test');
assert.equal(urlForTab('sim-audit', '/'), '/admin/?tab=sim-audit');
globalThis.location = previousLocation;

const shell = fs.readFileSync(new URL('../js/pages/admin/shell.js', import.meta.url), 'utf8');
assert.match(shell, /mountSimAuditPanel\(stage, \{ root: ctx\.root \}\)/, 'Shell must mount the dedicated audit panel');
assert.match(shell, /from '\.\/tab-sim-audit\.js'/, 'Shell must import the audit panel');

const rows = [
  { id: 'stun', name: 'Stun', category: 'state', class: 'Neutral', verdict: 'evidence_pending', reason: 'proof missing' },
  { id: 'chess', name: 'Chess Board', category: 'unsupported-mode', class: 'Neutral', verdict: 'confirmed_gap', reason: 'unsupported' },
  { id: 'sword', name: 'Sword', category: 'weapon', class: 'Ranger', verdict: 'verified_1to1', reason: 'proof retained' },
];
assert.deepEqual(filterAuditRows(rows, { query: 'stun', verdict: 'all', category: 'all', className: 'all' }).map((row) => row.id), ['stun']);
assert.deepEqual(filterAuditRows(rows, { query: '', verdict: 'confirmed_gap', category: 'all', className: 'all' }).map((row) => row.id), ['chess']);
assert.deepEqual(filterAuditRows(rows, { query: '', verdict: 'all', category: 'all', className: 'Ranger' }).map((row) => row.id), ['sword']);
assert.equal(verdictMeta('verified_1to1').glyph, '✓');
assert.equal(verdictMeta('confirmed_gap').glyph, '×');
assert.equal(verdictMeta('evidence_pending').glyph, '?');
assert.match(fs.readFileSync(new URL('../js/pages/admin/admin.css', import.meta.url), 'utf8'), /\.admin-sim-audit/, 'Audit panel requires scoped responsive styles');
assert.match(fs.readFileSync(new URL('../scripts/sim-continuous-audit.mjs', import.meta.url), 'utf8'), /sim-audit-dashboard/, 'Continuous audit must reject a stale Admin dashboard');

console.log('OK admin sim audit: tab and shell contract');
