/**
 * Phase 265 — live capture schema + apply (does not invent fight HP).
 *   node scripts/sim-live-bands.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyLiveCapture,
  emptyLive,
  hpBand,
  isLiveFilled,
  livePlayerBandHolds,
} from '../js/pages/sim/engine/parity-live.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_DIR = path.join(__dirname, 'fixtures', 'parity');

const STAPLES = [
  'poison-garden-ranger',
  'pyro-furnace',
  'berserk-bloodline',
  'reaper-harvest',
  'history-3705',
  'history-3703',
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

{
  const b = hpBand(142, 200, 0.15, 25);
  ok(b.min <= 142 && b.max >= 142, `hpBand contains 142 (${b.min}–${b.max})`);
}

{
  ok(!isLiveFilled(emptyLive()), 'empty live is not filled');
  ok(!isLiveFilled({ playerEndHp: 10, capturedAt: 'x', notes: '' }), 'blank notes not filled');
}

{
  const fix = { live: emptyLive(), expect: { dummyEndHpMin: 100, dummyEndHpMax: 200 } };
  applyLiveCapture(fix, {
    playerEndHp: 150,
    opponentEndHp: 40,
    playerStamina: 11,
    notes: '7.5s vs Ranger, maxHP 200',
    opponentClass: 'Ranger',
    stacks: { heat: 2 },
    capturedAt: '2026-08-25T00:00:00.000Z',
  });
  ok(isLiveFilled(fix.live), 'applyLiveCapture fills live');
  ok(livePlayerBandHolds(fix.live), 'live player band wraps captured HP');
  ok(fix.live.opponentHpComparable === false, 'opponent HP marked not comparable');
  ok(fix.live.dummyEndHp === 40, 'opponent HP stored on live.dummyEndHp');
  ok(fix.expect.dummyEndHpMin === 100, 'dummy expect bands unchanged');
}

{
  let threw = false;
  try {
    applyLiveCapture({}, { playerEndHp: 1, notes: '' });
  } catch {
    threw = true;
  }
  ok(threw, 'applyLiveCapture requires notes');
}

const files = fs.readdirSync(FIX_DIR).filter((f) => f.endsWith('.json'));
ok(files.length >= 8, `parity fixtures ≥8 (got ${files.length})`);

let filled = 0;
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(FIX_DIR, f), 'utf8'));
  ok(data.live && typeof data.live === 'object', `${f}: has live object`);
  if (isLiveFilled(data.live)) {
    filled += 1;
    ok(livePlayerBandHolds(data.live), `${f}: live player band holds`);
  }
}

for (const slug of STAPLES) {
  ok(files.includes(`${slug}.json`), `staple fixture ${slug}.json exists`);
}

console.log(
  `live captures filled: ${filled}/${files.length} (PvP HP is not dummy expect; fill with npm run sim-live-capture)`,
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nLive-bands smoke passed');
