/**
 * Phase 262 — coverage meter must not count empty unique gem stubs / noops
 * as scripted combat.
 *   node scripts/sim-coverage-honesty.mjs
 */
import fs from 'fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import {
  classifyCoverageHandler,
  classifyCoverageItem,
  computeCoverage,
} from '../js/pages/sim/engine/coverage.js';
import { hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';

const coverage = JSON.parse(fs.readFileSync('assets/data/sim-item-coverage.json', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
hydrateSimCoverage(coverage, inventory);

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
    shape: it.shape || [[1]],
    params: it.params || {},
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

{
  const empty = classifyCoverageHandler(
    { handlerId: 'stat_gem', family: 'unique' },
    { id: 'stat_gem', type: 'Gem' },
  );
  ok(empty.handlerExists && !empty.engineMatch, 'empty unique gem stub is not engine match');
  ok(empty.reason === 'empty_stub', `empty stub reason (${empty.reason})`);
}

{
  const bag = classifyCoverageItem('leather_bag', byId.get('leather_bag'));
  ok(bag.handlerExists && !bag.engineMatch, 'leather_bag: handler exists, not engine match');
  ok(bag.reason === 'noop', `leather_bag reason noop (${bag.reason})`);
}

{
  const ruby = classifyCoverageItem('chipped_ruby', byId.get('chipped_ruby'));
  ok(ruby.engineMatch, 'chipped_ruby inventory port is engine match');
}

{
  const sword = classifyCoverageItem('wooden_sword', byId.get('wooden_sword'));
  ok(sword.engineMatch, 'wooden_sword is engine match');
}

{
  const placements = [
    { id: 'leather_bag', key: 'a', x: 0, y: 0 },
    { id: 'coins', key: 'b', x: 3, y: 0 },
    { id: 'chess_board', key: 'c', x: 6, y: 0 },
  ];
  const cov = computeCoverage(placements, byId);
  ok(cov.handlerExists === 3, `noop board handlerExists 3 (${cov.handlerExists})`);
  ok(cov.scripted === 0 && cov.engineMatch === 0, `noop board scripted 0 (${cov.scripted})`);
  ok(cov.catalogCd === 0, `noop board catalogCd 0 (${cov.catalogCd})`);
  ok(cov.pct === 0, `noop board pct 0 (${cov.pct}%)`);
}

{
  const placements = [
    { id: 'chipped_ruby', key: 'r', x: 0, y: 0 },
    { id: 'chipped_emerald', key: 'e', x: 1, y: 0 },
    { id: 'chipped_sapphire', key: 's', x: 2, y: 0 },
  ];
  const cov = computeCoverage(placements, byId);
  ok(cov.scripted === 3, `loose gems engine match 3 (${cov.scripted})`);
  const run = simulateEngine({
    placements,
    itemsById: byId,
    durationSec: 8,
    seed: 2621,
  });
  ok(run.coverage?.scripted === 3, `simulate coverage scripted 3 (${run.coverage?.scripted})`);
  ok(
    run.coverage?.handlerExists === 3,
    `simulate handlerExists 3 (${run.coverage?.handlerExists})`,
  );
}

{
  const mixed = computeCoverage(
    [
      { id: 'wooden_sword', key: 'w', x: 0, y: 0 },
      { id: 'leather_bag', key: 'b', x: 2, y: 0 },
    ],
    byId,
  );
  ok(mixed.scripted === 1, `mixed board scripted 1 (${mixed.scripted})`);
  ok(mixed.handlerExists === 2, `mixed handlerExists 2 (${mixed.handlerExists})`);
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nCoverage honesty smoke passed');
