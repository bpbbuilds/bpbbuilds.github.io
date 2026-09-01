/**
 * Phase 259 — dump protocol: surface flags; never treat missing kind as a dump;
 * empty automated flags are not a live-game pass.
 *   node scripts/sim-debug-protocol-smoke.mjs
 */
import fs from 'fs';
import {
  auditSimDebugDump,
  formatAuditReport,
} from '../js/pages/sim/engine/audit-debug.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { buildSimDebugReport } from '../js/pages/sim/engine/log-export.js';

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

{
  const bad = auditSimDebugDump({ events: [] }, inventory);
  ok(!bad.ok, 'reject JSON without kind bpb-sim-debug');
}

{
  const canned = JSON.parse(
    fs.readFileSync('scripts/fixtures/debug/phase-259-sample.json', 'utf8'),
  );
  const audit = auditSimDebugDump(canned, inventory);
  const text = formatAuditReport(audit);
  ok(audit.ok, 'canned dump has kind');
  ok(audit.paramChecks.length === 1, 'canned paramChecks preserved (not stripped)');
  ok(audit.mismatches.length === 1, 'canned ui.mismatches preserved (not stripped)');
  ok(text.includes('HungryBlade.gd'), 'maps hungry_blade to HungryBlade.gd');
  ok(text.includes('meleeVampirismLimit'), 'prints expectedKey for GD audit');
  ok(text.includes('onPreDealDamage_early'), 'points at convert-timing hook');
}

{
  const empty = {
    kind: 'bpb-sim-debug',
    placements: [{ id: 'wooden_sword' }],
    paramChecks: [],
    ui: { mismatches: [] },
  };
  const audit = auditSimDebugDump(empty, inventory);
  const text = formatAuditReport(audit);
  ok(audit.emptyFlagsAreNotALivePass, 'empty flags detected');
  ok(
    text.includes('empty paramChecks/ui.mismatches only means'),
    'empty automated flags still warn: not a live pass',
  );
}

{
  const GAME_ITEMS = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
  const byId = new Map();
  for (const it of GAME_ITEMS.items || []) {
    byId.set(it.id, {
      id: it.id,
      name: it.name,
      type: it.type,
      extraTypes: it.extraTypes,
      cooldown: it.cooldown,
      damageMin: it.damageMin,
      damageMax: it.damageMax,
      accuracy: it.accuracy,
      staminaCost: it.staminaCost,
      params: it.params,
      shape: it.shape || [[1]],
    });
  }
  const placements = [{ id: 'wooden_sword', key: 'w', x: 0, y: 0, r: 0 }];
  const run = simulateEngine({
    placements,
    itemsById: byId,
    durationSec: 6,
    seed: 2591,
  });
  const dump = buildSimDebugReport(run, { itemsById: byId, placements, seed: 2591 });
  const audit = auditSimDebugDump(dump, inventory);
  ok(audit.ok && dump.kind === 'bpb-sim-debug', 'engine export is bpb-sim-debug');
  const text = formatAuditReport(audit);
  ok(text.includes('WoodenSword.gd'), 'wooden_sword maps to WoodenSword.gd');
}

if (failed) process.exit(1);
console.log('OK: sim-debug-protocol-smoke');
