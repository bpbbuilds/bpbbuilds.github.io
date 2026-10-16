/**
 * Build the Admin simulator-audit artifact.
 *
 * This artifact is deliberately conservative: source coverage is useful audit
 * evidence, but it is never a 1:1 verdict until retained proof is current.
 *
 *   node scripts/build-sim-audit-dashboard.mjs
 *   node scripts/build-sim-audit-dashboard.mjs --check
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ITEM_LEDGER = 'assets/data/sim-fidelity-ledger.json';
const SYSTEM_SURFACE = 'assets/data/sim-system-surface.json';
const OUT = 'assets/data/sim-audit-dashboard.json';
const PUBLIC_SUMMARY_OUT = 'assets/data/sim-fidelity-summary.json';

const VERDICTS = Object.freeze([
  'verified_1to1',
  'confirmed_gap',
  'evidence_pending',
  'no_independent_combat',
]);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function auditEvidence(evidence, expectedSourceHash) {
  if (!evidence || typeof evidence !== 'object') return false;
  const regression = evidence.focusedRegression || evidence.regression;
  const projections = evidence.projections || evidence.projectedEffects;
  const requiredProjections = Array.isArray(evidence.requiredProjections)
    ? evidence.requiredProjections
    : ['log', 'meter', 'hud'];
  const fixture = evidence.fixture || evidence.deterministicFixture;
  const sourceFresh = !evidence.sourceHash || evidence.sourceHash === expectedSourceHash;
  const projected = Array.isArray(projections) && requiredProjections.every((key) => projections.includes(key));
  const liveSatisfied = !evidence.liveRequired || Boolean(evidence.liveCapture);
  return Boolean(regression && fixture && projected && sourceFresh && liveSatisfied);
}

function itemVerdict(row, expectedSourceHash) {
  if (row.status === 'unsupported_mode' || (row.knownDelta && row.status !== 'no_combat')) return 'confirmed_gap';
  if (auditEvidence(row.evidence, expectedSourceHash)) return 'verified_1to1';
  if (row.status === 'no_combat') return 'no_independent_combat';
  return 'evidence_pending';
}

function mechanicVerdict(row, expectedSourceHash) {
  if (row.disposition === 'unsupported' || row.disposition === 'unmapped') return 'confirmed_gap';
  return auditEvidence(row.evidence, expectedSourceHash) ? 'verified_1to1' : 'evidence_pending';
}

function reasonFor(verdict, sourceStatus, note) {
  if (verdict === 'verified_1to1') return 'Current source mapping, automated regression, and applicable UI projections are retained.';
  if (verdict === 'confirmed_gap') return note || 'The behavior is documented as unsupported or has a confirmed difference.';
  if (verdict === 'no_independent_combat') return note || 'This catalog entry has no independent combat behavior to compare.';
  return sourceStatus
    ? `Current source evidence is ${sourceStatus}, but the retained 1:1 proof is incomplete.`
    : 'Retained 1:1 proof is incomplete.';
}

function countVerdicts(rows) {
  return Object.fromEntries(VERDICTS.map((verdict) => [
    verdict,
    rows.filter((row) => row.verdict === verdict).length,
  ]));
}

/**
 * @param {any} itemLedger
 * @param {any} systemSurface
 */
export function buildAuditDashboard(itemLedger, systemSurface) {
  const itemSourceHash = itemLedger?.source?.extractItemsSha256 || itemLedger?.source?.extractSha256 || null;
  const items = (itemLedger?.rows || []).map((row) => {
    const verdict = itemVerdict(row, itemSourceHash);
    return {
      scope: 'item',
      id: row.id,
      name: row.name || row.id,
      category: row.type || 'Unknown',
      class: row.class || 'Unknown',
      verdict,
      reason: reasonFor(verdict, row.status, row.knownDelta),
      sourceStatus: row.status || 'unreviewed',
      fidelity: row.fidelity || 'incomplete',
      source: row.source || {},
      simulator: row.sim || {},
      audit: row.audit || {},
      evidence: row.evidence || null,
      knownDelta: row.knownDelta || null,
    };
  });
  const mechanics = (systemSurface?.rows || []).map((row) => {
    const sourceHash = systemSurface?.source?.extractFiles?.[row.source] || null;
    const verdict = mechanicVerdict(row, sourceHash);
    return {
      scope: 'mechanic',
      id: row.id,
      name: row.id.replaceAll('-', ' '),
      category: row.category || 'unknown',
      verdict,
      reason: reasonFor(verdict, row.disposition, row.note),
      sourceStatus: row.disposition || 'unmapped',
      source: row.source || null,
      functions: row.functions || [],
      simulator: { owners: row.simOwners || [] },
      evidence: row.evidence || null,
      knownDelta: row.note || null,
    };
  });
  const allRows = [...items, ...mechanics];
  return {
    schema: 1,
    note: 'Generated audit evidence. A green check is reserved for retained source-verified proof; source ports and partial ownership remain pending.',
    source: {
      itemLedger: ITEM_LEDGER,
      itemLedgerSha256: itemLedger?._inputSha256 || null,
      itemExtractSha256: itemSourceHash,
      systemSurface: SYSTEM_SURFACE,
      systemSurfaceSha256: systemSurface?._inputSha256 || null,
      systemExtractFiles: systemSurface?.source?.extractFiles || {},
    },
    totals: {
      items: items.length,
      mechanics: mechanics.length,
      rows: allRows.length,
      ...countVerdicts(allRows),
    },
    items,
    mechanics,
  };
}

/**
 * Build the small public artifact consumed by the simulator banner. The full
 * dashboard is intentionally admin-only in shape; the sim only needs the
 * retained item verdict for each catalog id.
 *
 * @param {any} dashboard
 * @param {string | null} dashboardSha256
 */
export function buildPublicFidelitySummary(dashboard, dashboardSha256 = null) {
  const items = Array.isArray(dashboard?.items) ? dashboard.items : [];
  return {
    schema: 1,
    note: 'Generated public fidelity summary. Only retained source-and-automated 1:1 evidence earns verified_1to1.',
    source: {
      dashboard: OUT,
      dashboardSha256,
      itemExtractSha256: dashboard?.source?.itemExtractSha256 || null,
    },
    totals: {
      items: items.length,
      ...countVerdicts(items),
    },
    byId: Object.fromEntries(items.map((row) => [row.id, row.verdict])),
  };
}

function sourceWithInputHash(rel) {
  const bytes = fs.readFileSync(path.join(ROOT, rel));
  return { ...JSON.parse(bytes.toString('utf8')), _inputSha256: sha256(bytes) };
}

function renderOutputs() {
  const dashboard = buildAuditDashboard(
    sourceWithInputHash(ITEM_LEDGER),
    sourceWithInputHash(SYSTEM_SURFACE),
  );
  const dashboardOutput = `${JSON.stringify(dashboard, null, 2)}\n`;
  const summary = buildPublicFidelitySummary(dashboard, sha256(dashboardOutput));
  return {
    dashboardOutput,
    summaryOutput: `${JSON.stringify(summary, null, 2)}\n`,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { dashboardOutput, summaryOutput } = renderOutputs();
  const outPath = path.join(ROOT, OUT);
  const summaryPath = path.join(ROOT, PUBLIC_SUMMARY_OUT);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
    const currentSummary = fs.existsSync(summaryPath)
      ? fs.readFileSync(summaryPath, 'utf8')
      : '';
    if (current !== dashboardOutput || currentSummary !== summaryOutput) {
      console.error('FAIL sim-audit-dashboard is stale; run node scripts/build-sim-audit-dashboard.mjs');
      process.exit(1);
    }
    console.log('OK sim-audit-dashboard and sim-fidelity-summary');
  } else {
    fs.writeFileSync(outPath, dashboardOutput);
    fs.writeFileSync(summaryPath, summaryOutput);
    console.log(`Wrote ${OUT} and ${PUBLIC_SUMMARY_OUT}`);
  }
}
