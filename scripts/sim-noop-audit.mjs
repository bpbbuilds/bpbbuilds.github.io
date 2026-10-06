/**
 * Phase 267 — shop/chess/wearable noops match GD; false noops are ported.
 *   node scripts/sim-noop-audit.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AK_NOOP_IDS, AN_SHOP_NOOP_IDS } from '../js/pages/sim/engine/scripts/ports-ak-noop.js';
import { getScriptHandler, hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';
import { classifyCoverageItem } from '../js/pages/sim/engine/coverage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const EXTRACT = path.join(ROOT, 'tools', 'game-extract-full');

const list = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-intentional-noops.json'), 'utf8'),
);
const coverage = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-item-coverage.json'), 'utf8'),
);
const inventory = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-item-inventory.json'), 'utf8'),
);
hydrateSimCoverage(coverage, inventory);

const parity = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-parity-inventory.json'), 'utf8'),
);

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const shopIds = list.shopNoCombat.map((r) => r.id);
const wearIds = list.wearablesShopOnly.map((r) => r.id);
const chessIds = list.chessPieces;
const expectedNoop = new Set([...shopIds, ...wearIds, ...chessIds]);

ok(
  [...expectedNoop].every((id) => AK_NOOP_IDS.includes(id)),
  `AK_NOOP_IDS covers listed shop/wear/chess (${AK_NOOP_IDS.length})`,
);
ok(
  AK_NOOP_IDS.every((id) => expectedNoop.has(id)),
  'AK_NOOP_IDS has no extra ids',
);
ok(
  wearIds.every((id) => AN_SHOP_NOOP_IDS.includes(id)),
  'AN_SHOP_NOOP_IDS matches wearables',
);

for (const row of list.portedFalseNoops) {
  ok(!AK_NOOP_IDS.includes(row.id), `${row.id} is not an AK noop`);
  const h = getScriptHandler(row.id);
  // Game bag `onPrepare` maps to the engine's pre-combat hook; start-only
  // checking incorrectly rejected Puzzlebag T even though its listener must
  // arm before any combat-start stack spend.
  ok(
    typeof h?.onPreCombatStart === 'function' ||
      typeof h?.onCombatStart === 'function' ||
      typeof h?.onPrepare === 'function',
    `${row.id} has combat lifecycle hook`,
  );
  ok(classifyCoverageItem(row.id).reason !== 'noop', `${row.id} coverage not noop`);
}

ok(parity.byId.chess_board?.depth === 'noop', 'chess_board inventory depth noop (unsupported combat mode)');
ok(list.chessBoard.gameCombat === true, 'list records chess_board game combat');
ok(list.chessBoard.sim === 'unsupported_mode', 'list records supported-mode boundary');

const boardGd = fs.readFileSync(path.join(EXTRACT, list.chessBoard.gd), 'utf8');
ok(/func doCooldownEffect/.test(boardGd), 'ChessBoard.gd has doCooldownEffect');

for (const row of [...list.shopNoCombat, ...list.wearablesShopOnly]) {
  if (!row.gd) continue;
  const fp = path.join(EXTRACT, row.gd);
  ok(fs.existsSync(fp), `${row.id}: ${row.gd} exists`);
  const src = fs.readFileSync(fp, 'utf8');
  ok(!/func doCooldownEffect/.test(src), `${row.id}: no doCooldownEffect`);
  ok(!/func onCombatStart/.test(src), `${row.id}: no onCombatStart`);
}

for (const row of list.portedFalseNoops) {
  const fp = path.join(EXTRACT, row.gd);
  ok(fs.existsSync(fp), `ported ${row.id}: ${row.gd}`);
  const src = fs.readFileSync(fp, 'utf8');
  ok(/func onPrepare/.test(src) || /func doCooldownEffect/.test(src), `${row.id} GD has combat prepare/CD`);
}

ok(parity.byId.bag_of_stones?.depth !== 'noop', 'bag_of_stones is not a false noop');
ok(parity.byId.puzzlebag_z?.depth === 'deep', 'puzzlebag_z deep');

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nNoop audit 267 passed');
