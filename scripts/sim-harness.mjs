/**
 * Headless sim harness — fixture boards + coverage + Band G parity checks.
 *   node scripts/sim-harness.mjs
 */
import fs from 'fs';
import { spawnSync } from 'child_process';
import { runSim } from '../js/pages/sim/engine/index.js';
import { hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';
import { getP1, getP } from '../js/pages/sim/engine/params.js';
import { takeDamage, dealDamage } from '../js/pages/sim/engine/damage.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { gainStacks } from '../js/pages/sim/engine/stacks.js';
import { makeRng } from '../js/pages/sim/engine/rng.js';
import {
  bindBuffPowerPieces,
  giveBuffPower,
  scaleByBuffPower,
  unbindBuffPowerPieces,
} from '../js/pages/sim/engine/buff-power.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { stoneGolemPort } from '../js/pages/sim/engine/scripts/ports-wave-d-weapons.js';

const coverage = JSON.parse(
  fs.readFileSync('assets/data/sim-item-coverage.json', 'utf8'),
);
const inventory = JSON.parse(
  fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'),
);
hydrateSimCoverage(coverage, inventory);

function item(id, extras = {}) {
  return {
    id,
    name: id,
    type: 'Weapon',
    rarity: 'Rare',
    cooldown: 2,
    damageMin: 8,
    damageMax: 12,
    accuracy: 90,
    staminaCost: 1,
    shape: [[1]],
    params: {},
    ...extras,
  };
}

/** @type {Map<string, object>} */
const itemsById = new Map(
  [
    item('wooden_sword'),
    item('pan'),
    item('broom', { params: { p1: 3 }, chance: 40, chanceTag: 'blind' }),
    item('axe'),
    item('katana', { rarity: 'Epic', damageMin: 10, damageMax: 16 }),
    item('hero_longsword', {
      rarity: 'Legendary',
      damageMin: 12,
      damageMax: 18,
      params: { p1: 5 },
    }),
    item('falcon_blade', {
      rarity: 'Legendary',
      damageMin: 9,
      damageMax: 14,
      params: { p1: 20 },
    }),
    item('poison_bow', {
      type: 'Weapon',
      effect: 'Poison',
      damageMin: 7,
      damageMax: 11,
      params: { p1: 8, poisont: 8 },
    }),
    item('banana', {
      type: 'Food',
      cooldown: 4,
      damageMin: 0,
      damageMax: 0,
      staminaCost: 0,
      params: { p1: 10, p2: 3 },
    }),
    item('healing_herbs', {
      type: 'Food',
      cooldown: 0,
      damageMin: 0,
      damageMax: 0,
      staminaCost: 0,
      params: { p1: 5 },
    }),
    item('amulet_of_life', {
      type: 'Accessory',
      cooldown: 0,
      damageMin: 0,
      damageMax: 0,
      staminaCost: 0,
      params: { p1: 25 },
    }),
    item('holy_armor', {
      type: 'Armor',
      block: 20,
      cooldown: 0,
      damageMin: 0,
      damageMax: 0,
      effect: 'Spikes',
      params: { p1: 6 },
    }),
  ].map((it) => [it.id, it]),
);

const fixtures = [
  {
    name: 'starter_weapons',
    placements: [
      { id: 'wooden_sword', key: 'a', x: 0, y: 0 },
      { id: 'pan', key: 'b', x: 1, y: 0 },
      { id: 'broom', key: 'c', x: 2, y: 0 },
    ],
    expect: { minEvents: 8 },
  },
  {
    name: 'class_synergy',
    placements: [
      { id: 'hero_longsword', key: 'h', x: 0, y: 0 },
      { id: 'axe', key: 'x', x: 1, y: 0 },
      { id: 'katana', key: 'k', x: 0, y: 1 },
    ],
    expect: {
      minEvents: 8,
      handlerInLog: 'hero_longsword',
    },
  },
  {
    name: 'falcon_double',
    placements: [{ id: 'falcon_blade', key: 'f', x: 0, y: 0 }],
    expect: { handlerInLog: 'falcon_blade' },
  },
  {
    name: 'start_buffs',
    placements: [
      { id: 'healing_herbs', key: 'hh', x: 0, y: 0 },
      { id: 'amulet_of_life', key: 'al', x: 1, y: 0 },
      { id: 'holy_armor', key: 'ha', x: 2, y: 0 },
      { id: 'poison_bow', key: 'pb', x: 0, y: 1 },
    ],
    expect: {
      handlerInLog: 'healing_herbs',
    },
  },
  {
    name: 'banana_food',
    placements: [{ id: 'banana', key: 'bn', x: 0, y: 0 }],
    expect: { handlerInLog: 'banana' },
  },
];

let failed = 0;

function unitChecks() {
  let ok = true;
  if (getP1({ p1: 7, poisont: 7 }) !== 7) {
    console.error('FAIL unit: getP1 p1 key');
    ok = false;
  }
  {
    const player = createActor('player');
    const piece = {
      itemId: 'stone_golem',
      placementKey: 'golem',
      blockGrant: 150,
      baseCooldown: 5.5,
      cooldown: 5.5,
      params: { regen: 7, p3: 7, buffedcd: 2.6, p4: 2.6 },
    };
    const ctx = {
      player,
      dummy: createActor('dummy'),
      pieces: [],
      events: [],
      rng: makeRng(3),
      graph: {
        pieces: new Map([['golem', { id: 'stone_golem', affectCells: [], cells: [] }]]),
        filled: new Map(),
      },
      itemsById: new Map([['stone_golem', { id: 'stone_golem', type: 'Ranged Weapon' }]]),
      canAffect: null,
    };
    stoneGolemPort.onPreCombatStart(piece, ctx);
    grantStacks(player, 'regeneration', 7, { originKey: 'test-regen' });
    if (
      player.block !== 150 ||
      player.stacks.regeneration !== 0 ||
      piece.baseCooldown !== 2.6 ||
      piece.cooldown !== 2.6
    ) {
      console.error('FAIL unit: Stone Golem regeneration activation', {
        block: player.block,
        regeneration: player.stacks.regeneration,
        baseCooldown: piece.baseCooldown,
        cooldown: piece.cooldown,
      });
      ok = false;
    }
  }
  if (getP({ a: 1, b: 2 }, 1) !== 2) {
    console.error('FAIL unit: getP named order');
    ok = false;
  }
  const rng = makeRng(1);
  const atk = createActor('player');
  const def = createActor('dummy');
  gainStacks(def, 'block', 5);
  def.damageReduction = 2;
  const res = takeDamage(def, atk, {
    amount: 20,
    canMiss: false,
    isAttack: true,
    rng,
  });
  // 20 - 2 DR = 18; block 5 → health 13
  if (res.reduced !== 2 || res.blocked !== 5 || res.healthDamage !== 13) {
    console.error(
      'FAIL unit: takeDamage order',
      res.reduced,
      res.blocked,
      res.healthDamage,
    );
    ok = false;
  }
  const atk2 = createActor('player');
  gainStacks(atk2, 'vampirism', 100);
  const def2 = createActor('dummy');
  const dealt = dealDamage(atk2, def2, {
    amount: 10,
    canMiss: false,
    isAttack: true,
    rng: makeRng(2),
  });
  if (dealt.vampHeal < 1) {
    console.error('FAIL unit: vampirism heal', dealt.vampHeal);
    ok = false;
  }
  {
    const whelp = { placementKey: 'whelp', buffPowers: {} };
    bindBuffPowerPieces([whelp]);
    giveBuffPower(whelp, 'poison', 1);
    giveBuffPower(whelp, 'poison', 1);
    const dummy = createActor('dummy');
    const g = grantStacks(dummy, 'poison', 3, { originKey: 'whelp' });
    unbindBuffPowerPieces();
    if (g.gained !== 9) {
      console.error('FAIL unit: death scythe poison buffPower 3×3', g.gained);
      ok = false;
    }
    if (scaleByBuffPower(3, 'poison', { piece: { buffPowers: { poison: 2 } } }) !== 6) {
      console.error('FAIL unit: scaleByBuffPower 3×2');
      ok = false;
    }
  }
  if (ok) console.log('OK unit: params + takeDamage/dealDamage');
  else failed += 1;
}

unitChecks();

for (const fix of fixtures) {
  const run = runSim({
    mode: 'engine',
    placements: fix.placements,
    itemsById,
    seed: 42,
    durationSec: 10,
  });
  const scriptedEvents = run.events.filter((e) => e.meta?.script).length;
  const cov = run.coverage;
  let ok = run.events.length > 2 && cov && cov.pct >= 80;
  if (fix.expect?.minEvents && run.events.length < fix.expect.minEvents) {
    ok = false;
  }
  if (fix.expect?.handlerInLog) {
    const found = run.events.some(
      (e) => e.meta?.handler === fix.expect.handlerInLog,
    );
    if (!found) ok = false;
  }
  if (
    fix.expect?.playerEndHpMin != null &&
    (run.playerEndHp ?? 0) < fix.expect.playerEndHpMin
  ) {
    ok = false;
  }
  if (!ok) failed += 1;
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${fix.name}: events=${run.events.length} scriptedEv=${scriptedEvents} coverage=${cov?.label} end=${run.summary?.endReason} pHP=${run.playerEndHp} dHP=${run.dummyEndHp}`,
  );
}

const total = coverage.totals.entries;
const dedicated = coverage.totals.dedicated ?? 0;
const family = coverage.totals.family ?? 0;
const scripted = coverage.totals.scripted ?? dedicated + family;
const supported = scripted + (coverage.totals.catalogFallback ?? 0);
const pct = total ? Math.round((supported / total) * 100) : 0;
const dedPct = coverage.goal?.dedicatedPct ?? 0;
const revPct = coverage.goal?.reviewedPct ?? 0;

const solid = coverage.totals.dedicatedSolid ?? 0;
const approx = coverage.totals.dedicatedApprox ?? 0;
const solidPct = coverage.goal?.solidPct ?? 0;
const parityPct = coverage.goal?.parityPct ?? 0;
const parityN = coverage.totals.dedicatedParity ?? 0;
/** Band Y — solid complete. Band AH — parity ratchet. */
const SOLID_PCT_FLOOR = 100;
const PARITY_PCT_FLOOR = 90;
/** Phase 270 — do not treat catalog floors as engine 1:1. */

console.log(
  `\nCoverage: entries=${total} dedicated=${dedicated} (solid=${solid} approx=${approx} parity=${parityN} stub=${coverage.totals.dedicatedStub ?? 0}) family=${family} fallback=${coverage.totals.catalogFallback}`,
);
console.log(
  `Progress: ${dedPct}% dedicated · ${revPct}% reviewed · ${solidPct}% solid · ${parityPct}% parity`,
);

if (solidPct < SOLID_PCT_FLOOR) {
  console.error(
    `FAIL: solidPct ${solidPct}% < floor ${SOLID_PCT_FLOOR}% (Band Y ratchet)`,
  );
  process.exitCode = 1;
  failed += 1;
} else {
  console.log(`OK: solidPct ≥ ${SOLID_PCT_FLOOR}%`);
}

if (parityPct < PARITY_PCT_FLOOR) {
  console.error(
    `FAIL: parityPct ${parityPct}% < floor ${PARITY_PCT_FLOOR}% (Band AH ratchet)`,
  );
  process.exitCode = 1;
  failed += 1;
} else {
  console.log(`OK: parityPct ≥ ${PARITY_PCT_FLOOR}% (AH fixtures + HAND)`);
}

if (pct < 80) {
  console.error('FAIL: coverage milestone < 80%');
  process.exitCode = 1;
} else {
  console.log('OK: coverage milestone ≥ 80%');
}

if (dedicated < 300) {
  console.error(`FAIL: expected ≥300 dedicated handlers, got ${dedicated}`);
  process.exitCode = 1;
  failed += 1;
} else {
  console.log('OK: dedicated catalog factory (≥300 items)');
}

if (revPct < 100) {
  console.error(`FAIL: expected 100% reviewed, got ${revPct}%`);
  process.exitCode = 1;
  failed += 1;
} else {
  console.log('OK: Bands I–P reviewed milestone (100%)');
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-staple-boards.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-staple-boards');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-staple-boards');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-debug-protocol-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-debug-protocol-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-debug-protocol-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-aq-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-aq-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-aq-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-cd-consume-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-cd-consume-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-cd-consume-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-core-leftover-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-core-leftover-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-core-leftover-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-engineer-box-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-engineer-box-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-engineer-box-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-socket-split-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-socket-split-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-socket-split-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-loose-gem-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-loose-gem-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-loose-gem-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-coverage-honesty.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-coverage-honesty');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-coverage-honesty');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-ar-buff-log.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-ar-buff-log');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-ar-buff-log');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-ar-milestone.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-ar-milestone');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-ar-milestone');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-ap-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-ap-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-ap-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-engine-1to1-count.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-engine-1to1-count');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-engine-1to1-count');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-parity-fixtures.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-parity-fixtures');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-parity-fixtures');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-live-bands.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-live-bands');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-live-bands');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-wildcard-boards.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-wildcard-boards');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-wildcard-boards');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-noop-audit.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-noop-audit');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-noop-audit');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-vs-board-smoke.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-vs-board-smoke');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-vs-board-smoke');
  }
}

{
  const r = spawnSync(process.execPath, ['scripts/sim-engine-claim.mjs'], {
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status) {
    console.error('FAIL: sim-engine-claim');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: sim-engine-claim');
  }
}

{
  const claim = JSON.parse(
    fs.readFileSync(new URL('../assets/data/sim-engine-claim.json', import.meta.url), 'utf8'),
  );
  if (claim.engine11Achieved || claim.claimEngine11) {
    console.error('FAIL: Phase 270 closeout — engine 1:1 must not be claimed');
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log('OK: Phase 270 engine11Achieved/claimEngine11 false');
  }
}

if (failed) {
  console.error(`FAIL: ${failed} check(s)`);
  process.exitCode = 1;
} else {
  console.log('OK: all fixtures + units');
}
