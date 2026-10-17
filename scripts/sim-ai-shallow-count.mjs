/**
 * Band AI — report HAND depth counts; fail if shallow > 0 (unless --allow-gaps).
 *   node scripts/sim-ai-shallow-count.mjs
 *   node scripts/sim-ai-shallow-count.mjs --allow-gaps
 */
import fs from 'fs';

const allowGaps = process.argv.includes('--allow-gaps');
const inv = JSON.parse(
  fs.readFileSync('assets/data/sim-parity-inventory.json', 'utf8'),
);
const byId = inv.byId || {};
const deep = Object.values(byId).filter((e) => e.depth === 'deep').length;
const shallow = Object.values(byId).filter((e) => e.depth === 'shallow').length;
const noop = Object.values(byId).filter((e) => e.depth === 'noop').length;
const hand = Object.keys(byId).length;
const shallowIds = Object.entries(byId)
  .filter(([, e]) => e.depth === 'shallow')
  .map(([id]) => id)
  .sort();

console.log(
  `HAND depth: hand=${hand} deep=${deep} shallow=${shallow} noop=${noop}`,
);

if (byId.chess_board?.depth !== 'deep') {
  console.error('FAIL: chess_board must be deep after movement/capture parity');
  process.exitCode = 1;
} else {
  console.log('OK: chess_board deep');
}

if (noop < 1) {
    console.error(`FAIL: expected noop>=1 (shop/wearable/chess pieces), got ${noop}`);
  process.exitCode = 1;
}

if (shallow > 0) {
  console.log(`Shallow ids (${shallow}): ${shallowIds.join(', ')}`);
  if (!allowGaps) {
    console.error(`FAIL: shallow=${shallow} > 0`);
    process.exitCode = 1;
  } else {
    console.log('OK: --allow-gaps (shallow remaining documented)');
  }
} else {
  console.log('OK: shallow=0');
}
