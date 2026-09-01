/**
 * Phase 1 playback seam — seed, permalink/scrubber clock, speed, board query params.
 *   node scripts/sim-playback-smoke.mjs
 */
import { runSim, seedFromQuery } from '../js/pages/sim/engine/index.js';
import {
  buildPermalinkQuery,
  parseDummyBlock,
  parseSimRound,
  readSimQuery,
} from '../js/pages/sim/sim-permalink.js';
import {
  COMBAT_DELAY,
  combatDurationSec,
  toCombatLogTime,
  toEngineTime,
} from '../js/pages/sim/sim-combat-time.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const wooden = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  type: 'Melee Weapon',
  cooldown: 2.2,
  staminaCost: 1,
  damageMin: 4,
  damageMax: 6,
  accuracy: 90,
  shape: [[1]],
  params: {},
};
const itemsById = new Map([['wooden_sword', wooden]]);
const placements = [{ id: 'wooden_sword', x: 0, y: 0, r: 0, key: 'p:sword' }];

/** Mirrors mountRun() initialT resolution in page.js */
function resolveInitialT(startT) {
  return startT != null && Number.isFinite(Number(startT)) ? Number(startT) : undefined;
}

/** Mirrors scrubber mount initial engine time */
function scrubberStartEngine(initialT, useCombatClock = true) {
  if (initialT != null && Number.isFinite(initialT)) return Number(initialT);
  return useCombatClock ? COMBAT_DELAY : 0;
}

// —— Seed determinism ——
const runA = runSim({ mode: 'engine', placements, itemsById, seed: 12345, durationSec: 8 });
const runB = runSim({ mode: 'engine', placements, itemsById, seed: 12345, durationSec: 8 });
const runC = runSim({ mode: 'engine', placements, itemsById, seed: 99999, durationSec: 8 });

ok(runA.events.length === runB.events.length, 'same seed → same event count');
ok(
  JSON.stringify(runA.events.map((e) => [e.t, e.type, e.amount])) ===
    JSON.stringify(runB.events.map((e) => [e.t, e.type, e.amount])),
  'same seed → identical event stream',
);
ok(runA.summary?.seed === 12345, 'run summary carries explicit seed');
ok(runC.summary?.seed === 99999, 'alternate explicit seed stored on run');

globalThis.location = { search: '?seed=0xdeadbeef&mode=engine' };
ok(seedFromQuery() === 0xdeadbeef >>> 0, 'seedFromQuery parses hex uint32');

globalThis.location = { search: '' };
ok(seedFromQuery() === null, 'seedFromQuery empty → null (page default applies)');

const runDefault = runSim({ mode: 'engine', placements, itemsById, durationSec: 8 });
ok(runDefault.summary?.seed === 0xb0bd2026, 'default seed when URL has no seed');

// —— Scrubber clock + round-reset initialT ——
ok(resolveInitialT(0) === 0, 'round change startT=0 → initialT 0 (not skipped)');
ok(resolveInitialT(null) === undefined, 'no URL t → initialT undefined');
ok(resolveInitialT(4.2) === 4.2, 'permalink t → initialT preserved');

ok(scrubberStartEngine(undefined) === COMBAT_DELAY, 'fresh load starts at combat delay');
ok(scrubberStartEngine(0) === 0, 'round reset starts at engine t=0');
ok(toCombatLogTime(scrubberStartEngine(undefined)) === 0, 'default scrubber shows combat 0.0');
ok(toCombatLogTime(scrubberStartEngine(0)) === 0, 'round reset scrubber shows combat 0.0');

const engineDur = 30;
ok(
  Math.abs(combatDurationSec(engineDur) - (engineDur - COMBAT_DELAY)) < 1e-9,
  'combat duration subtracts COMBAT_DELAY',
);
ok(Math.abs(toEngineTime(5) - (5 + COMBAT_DELAY)) < 1e-9, 'combat ↔ engine time map');

// —— Permalink / query (slug, draft, speed, seek) ——
globalThis.location = {
  search: '?slug=my-build&round=3&seed=42&speed=2&t=1.25&dummyBlock=8&oppSlug=foe&oppRound=2',
};
const q = readSimQuery();
ok(q.slug === 'my-build', 'readSimQuery slug');
ok(q.round === 3, 'readSimQuery round');
ok(q.seed === '42', 'readSimQuery seed string');
ok(q.speed === 2, 'readSimQuery speed');
ok(Math.abs(q.t - 1.25) < 1e-9, 'readSimQuery seek t');
ok(q.dummyBlock === 8, 'readSimQuery dummyBlock');
ok(q.oppSlug === 'foe' && q.oppRound === 2, 'readSimQuery opponent params');

const permalink = buildPermalinkQuery({
  slug: 'my-build',
  round: 3,
  seed: 42,
  mode: 'engine',
  t: 1.25,
  speed: 2,
  dummyBlock: 8,
  oppSlug: 'foe',
  oppRound: 2,
});
ok(permalink.includes('slug=my-build'), 'permalink includes slug');
ok(permalink.includes('round=3'), 'permalink includes round');
ok(permalink.includes('seed=42'), 'permalink includes seed');
ok(permalink.includes('speed=2'), 'permalink includes non-1 speed');
ok(permalink.includes('t=1.25'), 'permalink includes seek t');
ok(!buildPermalinkQuery({ seed: 1, mode: 'engine', speed: 1 }).includes('speed='), 'speed=1 omitted');

const draftLink = buildPermalinkQuery({ seed: 0xb0bd2026, mode: 'engine' });
ok(!draftLink.includes('slug='), 'draft permalink has no slug until published');

ok(parseSimRound('2') === 2, 'parseSimRound');
ok(parseSimRound('0') === null, 'parseSimRound rejects 0');
ok(parseDummyBlock('4') === 4, 'parseDummyBlock');
ok(parseDummyBlock('') === 0, 'parseDummyBlock empty → 0');

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nAll playback smoke checks passed.');
