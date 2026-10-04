/**
 * Package 0 — source-backed, one-row-per-catalog-item Sim fidelity ledger.
 *
 *   node scripts/build-sim-fidelity-ledger.mjs
 *   node scripts/build-sim-fidelity-ledger.mjs --check
 *
 * This is intentionally a ledger, not a parity claim. `source_ported` means
 * the extract and a non-shallow port are present; only retained fixtures/live
 * evidence may later promote a row to fixture/live validated.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/data/sim-fidelity-ledger.json');
const ITEMS_DIR = path.join(ROOT, 'tools/game-extract-full/Items');

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

function digestExtract() {
  const hash = crypto.createHash('sha256');
  for (const file of walk(ITEMS_DIR).filter((x) => x.endsWith('.gd')).sort()) {
    hash.update(path.relative(ITEMS_DIR, file).replace(/\\/g, '/'));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function digestFile(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
}

function setFromEntries(rows) {
  return new Set((rows || []).map((row) => row?.id).filter(Boolean));
}

function noCombatIndex(noops) {
  const byId = new Map();
  for (const row of [...(noops.shopNoCombat || []), ...(noops.wearablesShopOnly || [])]) {
    byId.set(row.id, { kind: 'no_combat', reason: row.why, source: row.gd || null });
  }
  for (const id of noops.chessPieces || []) {
    byId.set(id, {
      kind: 'no_combat',
      reason: 'Chess piece has no independent combat cooldown; Chess Board AI owns movement.',
      source: 'Items/Exclusive/ChessBoard.gd',
    });
  }
  if (noops.chessBoard?.id) {
    byId.set(noops.chessBoard.id, {
      kind: 'deferred',
      reason: noops.chessBoard.why,
      source: noops.chessBoard.gd || null,
    });
  }
  return byId;
}

function portModuleOwners() {
  const owners = new Map();
  const dir = path.join(ROOT, 'js/pages/sim/engine/scripts');
  for (const file of walk(dir).filter((x) => x.endsWith('.js'))) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/handlerId:\s*'([a-z0-9_]+)'/g)) {
      const list = owners.get(match[1]) || [];
      if (!list.includes(rel)) list.push(rel);
      owners.set(match[1], list);
    }
  }
  return owners;
}

const gameRaw = readJson('scripts/_cache/game-items.json');
const catalog = Array.isArray(gameRaw) ? gameRaw : gameRaw.items || [];
const inventory = readJson('assets/data/sim-item-inventory.json');
const coverage = readJson('assets/data/sim-item-coverage.json');
const parity = readJson('assets/data/sim-parity-inventory.json');
const noops = readJson('assets/data/sim-intentional-noops.json');
const hookAudit = fs.existsSync(path.join(ROOT, 'scripts/_cache/sim-gd-parity-report.json'))
  ? readJson('scripts/_cache/sim-gd-parity-report.json')
  : { rows: [] };
const callAudit = fs.existsSync(path.join(ROOT, 'scripts/_cache/sim-gd-calls-report.json'))
  ? readJson('scripts/_cache/sim-gd-calls-report.json')
  : { gaps: [] };

const hookById = new Map((hookAudit.rows || []).map((row) => [row.id, row]));
const callById = new Map((callAudit.gaps || []).map((row) => [row.id, row]));
const noCombat = noCombatIndex(noops);
const explicitFalseNoops = setFromEntries(noops.portedFalseNoops);
const owners = portModuleOwners();

// Sapphire's inventory cooldown is represented, but its socketed source path
// rolls in `pre_deal_damage_late` before making the host strike spectral. The
// engine has no late pre-deal dispatch yet (see sim-validation); do not let a
// source alias plus a post-hit approximation promote either tier to complete.
const SOURCE_PORT_BLOCKERS = new Map([
  [
    'flawed_sapphire',
    'Socketed Sapphire requires Core pre_deal_damage_late spectral dispatch before damage resolution.',
  ],
  [
    'flawless_sapphire',
    'Socketed Sapphire requires Core pre_deal_damage_late spectral dispatch before damage resolution.',
  ],
  [
    'perfect_sapphire',
    'Socketed Sapphire requires Core pre_deal_damage_late spectral dispatch before damage resolution.',
  ],
  [
    'joker',
    'Joker quadruple branch requires Card.doRevealEffect-only dispatch; the engine currently only exposes state-changing Card.trigger.',
  ],
]);

const registry = await import(
  pathToFileURL(path.join(ROOT, 'js/pages/sim/engine/scripts/registry.js')).href,
);

const rows = catalog
  .map((item) => {
    const id = item.id;
    const source = inventory.byId?.[id] || null;
    const cov = coverage.byId?.[id] || null;
    const depth = parity.byId?.[id]?.depth || cov?.depth || null;
    const hook = hookById.get(id) || null;
    const call = callById.get(id) || null;
    const exception = noCombat.get(id) || null;
    const handler = registry.getScriptHandler(id);
    const handlerId = handler?.handlerId || cov?.handlerId || null;
    const portBlocker = SOURCE_PORT_BLOCKERS.get(id) || null;
    const hookGaps = hook?.missing || [];
    const callCandidates = call?.missing || [];

    let status = 'unreviewed';
    let fidelity = 'incomplete';
    let knownDelta = null;
    if (exception?.kind === 'no_combat') {
      status = 'no_combat';
      fidelity = 'no_combat';
      knownDelta = exception.reason;
    } else if (exception?.kind === 'deferred') {
      status = 'deferred';
      fidelity = 'incomplete';
      knownDelta = exception.reason;
    } else if (explicitFalseNoops.has(id)) {
      status = 'source_ported';
      fidelity = 'source_ported';
    } else if (source && handlerId && portBlocker) {
      status = 'port_present';
      fidelity = 'incomplete';
      knownDelta = portBlocker;
    } else if (source && depth === 'deep' && handlerId && hookGaps.length === 0) {
      status = 'source_ported';
      fidelity = 'source_ported';
    } else if (source && handlerId) {
      status = 'port_present';
      fidelity = 'incomplete';
    } else if (!source) {
      status = 'source_unresolved';
      fidelity = 'incomplete';
      knownDelta = 'Catalog item has no resolved combat-script inventory row.';
    }
    if (hookGaps.length) knownDelta = `Lifecycle hook audit: ${hookGaps.map((x) => x.hook).join(', ')}.`;
    else if (callCandidates.length) knownDelta = `Source-call review candidate: ${callCandidates.map((x) => x.call).join(', ')}.`;

    return {
      id,
      name: item.name || item.displayName || id,
      type: item.type || null,
      class: item.class || null,
      gameVersion: item.gameVersion || null,
      source: {
        script: source?.file || exception?.source || null,
        extends: source?.extends || null,
        family: source?.family || null,
        overrides: source?.overrides || [],
        ...(source?.directOverrides ? { directOverrides: source.directOverrides } : {}),
        ...(source?.inheritedOverrides ? { inheritedOverrides: source.inheritedOverrides } : {}),
        ...(source?.inheritedFiles ? { inheritedFiles: source.inheritedFiles } : {}),
        ...(source?.sceneFile ? { sceneFile: source.sceneFile } : {}),
        ...(source?.sourceSetup ? { sourceSetup: source.sourceSetup } : {}),
        ...(source?.sourceMethods ? { sourceMethods: source.sourceMethods } : {}),
      },
      sim: {
        runtimeHandler: handlerId,
        handlerModules: handlerId ? owners.get(handlerId) || [] : [],
        coverageStatus: cov?.status || null,
        depth,
      },
      audit: {
        lifecycleHookGaps: hookGaps,
        ...(hook?.hookTriage ? { lifecycleHookTriage: hook.hookTriage } : {}),
        callReviewCandidates: callCandidates,
        duplicateRegistration: hook?.duplicateModules || null,
      },
      status,
      fidelity,
      knownDelta,
      evidence: {
        focusedRegression: null,
        fixture: null,
        liveCapture: null,
      },
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const count = (fn) => rows.filter(fn).length;
const ledger = {
  schema: 1,
  note:
    'Generated Package 0 fidelity ledger. source_ported is not a fixture/live 1:1 claim; empty evidence fields require future audit work.',
  source: {
    catalog: 'scripts/_cache/game-items.json',
    catalogSha256: digestFile('scripts/_cache/game-items.json'),
    extractItemsSha256: digestExtract(),
    inventoryExtractedAt: inventory.extractedAt || null,
    catalogItems: rows.length,
  },
  totals: {
    catalogItems: rows.length,
    sourcePorted: count((row) => row.status === 'source_ported'),
    portPresentIncomplete: count((row) => row.status === 'port_present'),
    sourceUnresolved: count((row) => row.status === 'source_unresolved'),
    noCombat: count((row) => row.status === 'no_combat'),
    deferred: count((row) => row.status === 'deferred'),
    lifecycleHookGap: count((row) => row.audit.lifecycleHookGaps.length > 0),
    untriagedLifecycleHookGap: count(
      (row) => row.audit.lifecycleHookGaps.length > 0 && !row.audit.lifecycleHookTriage,
    ),
    callReviewCandidate: count((row) => row.audit.callReviewCandidates.length > 0),
    duplicateRegistration: count((row) => row.audit.duplicateRegistration?.length > 1),
  },
  rows,
};

const rendered = `${JSON.stringify(ledger, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== rendered) {
    console.error('FAIL sim-fidelity-ledger is stale; run node scripts/build-sim-fidelity-ledger.mjs');
    process.exit(1);
  }
  console.log(`OK sim-fidelity-ledger: ${rows.length} catalog rows`);
} else {
  fs.writeFileSync(OUT, rendered);
  console.log(JSON.stringify(ledger.totals, null, 2));
  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
}
