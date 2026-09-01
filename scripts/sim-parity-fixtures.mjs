/**
 * Band AH 213–214 — run parity fixtures; write/assert end-HP bands.
 *   node scripts/sim-parity-fixtures.mjs
 *   node scripts/sim-parity-fixtures.mjs --write-bands
 *   node scripts/sim-parity-fixtures.mjs --tighten
 *
 * Default: assert all fixtures that already have expect bands.
 * --write-bands: measure engine HP and write loose (±15%) bands for FIRST3 (or all with --all).
 * --tighten: rewrite all bands at ±10% (min width 15 HP).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSim } from '../js/pages/sim/engine/index.js';
import { hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';
import { hpBand, isLiveFilled } from '../js/pages/sim/engine/parity-live.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_DIR = path.join(__dirname, 'fixtures', 'parity');
const GAME_ITEMS = path.join(__dirname, '_cache', 'game-items.json');

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write-bands');
const TIGHTEN = argv.includes('--tighten');
const ALL = argv.includes('--all');

const FIRST3 = new Set(['pyro-furnace', 'poison-garden-ranger', 'berserk-bloodline']);

const coverage = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../assets/data/sim-item-coverage.json'), 'utf8'),
);
const inventory = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../assets/data/sim-item-inventory.json'), 'utf8'),
);
hydrateSimCoverage(coverage, inventory);

const gameItems = JSON.parse(fs.readFileSync(GAME_ITEMS, 'utf8'));
/** @type {Map<string, object>} */
const catalog = new Map((gameItems.items || []).map((it) => [it.id, it]));

/**
 * @param {string[]} ids
 * @returns {Map<string, object>}
 */
function itemsFor(ids) {
  /** @type {Map<string, object>} */
  const m = new Map();
  for (const id of ids) {
    const it = catalog.get(id);
    if (it) {
      m.set(id, {
        ...it,
        shape: it.shape || [[1]],
        params: it.params || {},
      });
    } else {
      // Stub so missing catalog ids don't crash; sim may skip
      m.set(id, {
        id,
        name: id,
        type: 'Accessory',
        cooldown: 5,
        damageMin: 0,
        damageMax: 0,
        shape: [[1]],
        params: {},
      });
    }
  }
  return m;
}

/**
 * @param {number} hp
 * @param {number} maxHp
 * @param {number} frac
 * @param {number} minWidth
 */
function band(hp, maxHp, frac, minWidth) {
  return hpBand(hp, maxHp, frac, minWidth);
}

function loadFixtures() {
  return fs
    .readdirSync(FIX_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const p = path.join(FIX_DIR, f);
      return { file: f, path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
    });
}

/**
 * @param {object} fix
 */
function runFixture(fix) {
  const ids = [...new Set(fix.placements.map((p) => p.id))];
  const itemsById = itemsFor(ids);
  const placements = fix.placements.map((p) => ({
    id: p.id,
    key: p.key,
    x: p.x,
    y: p.y,
    r: p.r || 0,
    gems: p.gems || [],
  }));
  return runSim({
    mode: 'engine',
    placements,
    itemsById,
    seed: fix.seed ?? 42,
    durationSec: fix.durationSec ?? 30,
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const fixtures = loadFixtures();
ok(fixtures.length >= 8, `fixture count ≥8 (got ${fixtures.length})`);

const writeFrac = TIGHTEN ? 0.1 : 0.15;
const minWidth = TIGHTEN ? 15 : 25;
const writeSet = TIGHTEN || ALL ? null : FIRST3;

for (const { file, path: fp, data } of fixtures) {
  const name = data.name || data.slug || file;
  let run;
  try {
    run = runFixture(data);
  } catch (e) {
    ok(false, `${name}: sim threw ${e.message || e}`);
    continue;
  }
  const last = (run.snapshots || []).slice(-1)[0] || {};
  const ph = Number(
    run.playerEndHp ?? last.player?.hp ?? run.summary?.player?.hp,
  );
  const dh = Number(
    run.dummyEndHp ?? last.dummy?.hp ?? run.summary?.dummy?.hp,
  );
  const pMax = Number(run.playerMaxHp ?? last.player?.maxHp) || 200;
  const dMax = Number(run.dummyMaxHp ?? last.dummy?.maxHp) || 1200;

  if (!Number.isFinite(ph) || !Number.isFinite(dh)) {
    ok(false, `${name}: could not read end HP`);
    continue;
  }

  const shouldWrite =
    WRITE ||
    TIGHTEN ||
    (WRITE && (!writeSet || writeSet.has(name)));

  if (WRITE || TIGHTEN) {
    if (!writeSet || writeSet.has(name) || TIGHTEN || ALL) {
      const pb = band(ph, pMax, writeFrac, minWidth);
      const db = band(dh, dMax, writeFrac, minWidth);
      data.expect = {
        playerEndHpMin: pb.min,
        playerEndHpMax: pb.max,
        dummyEndHpMin: db.min,
        dummyEndHpMax: db.max,
      };
      data.meta = {
        ...(data.meta || {}),
        simBaseline: {
          playerEndHp: ph,
          dummyEndHp: dh,
          seed: data.seed,
          durationSec: data.durationSec,
          measuredAt: new Date().toISOString(),
          toleranceFrac: writeFrac,
        },
      };
      fs.writeFileSync(fp, JSON.stringify(data, null, 2));
      console.log(`WROTE bands ${name}: pHP=${ph}→[${pb.min},${pb.max}] dHP=${dh}→[${db.min},${db.max}]`);
    }
  }

  const ex = data.expect || {};
  if (
    ex.playerEndHpMin == null ||
    ex.playerEndHpMax == null ||
    ex.dummyEndHpMin == null ||
    ex.dummyEndHpMax == null
  ) {
    if (FIRST3.has(name) || TIGHTEN) {
      ok(false, `${name}: missing expect bands`);
    } else {
      console.log(`SKIP ${name}: no bands yet`);
    }
    continue;
  }

  ok(
    Math.round(ph) >= ex.playerEndHpMin && Math.round(ph) <= ex.playerEndHpMax,
    `${name}: player HP ${Math.round(ph)} in [${ex.playerEndHpMin},${ex.playerEndHpMax}]`,
  );
  ok(
    Math.round(dh) >= ex.dummyEndHpMin && Math.round(dh) <= ex.dummyEndHpMax,
    `${name}: dummy HP ${Math.round(dh)} in [${ex.dummyEndHpMin},${ex.dummyEndHpMax}]`,
  );

  if (isLiveFilled(data.live)) {
    const liveHp = Math.round(Number(data.live.playerEndHp));
    const inLiveBand =
      data.live.playerEndHpMin != null &&
      data.live.playerEndHpMax != null &&
      Math.round(ph) >= data.live.playerEndHpMin &&
      Math.round(ph) <= data.live.playerEndHpMax;
    console.log(
      `  LIVE ${name}: game pHP=${liveHp} sim pHP=${Math.round(ph)} (dummy fight ≠ PvP; ${inLiveBand ? 'sim inside live player band' : 'sim outside live player band — expected until opponent boards'})`,
    );
  }
}

ok(failed === 0, `parity fixtures clean (${failed} fails)`);
if (failed) process.exitCode = 1;
else console.log('\nParity fixtures OK');
