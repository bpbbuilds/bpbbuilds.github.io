/**
 * Band Z Phases 147–155 — temp stacks, fatigue, hooks smoke.
 *   node scripts/sim-band-z-smoke.mjs
 */
import { simulateEngine, COMBAT_DELAY } from '../js/pages/sim/engine/simulate.js';
import { FATIGUE_TIME } from '../js/pages/sim/engine/fatigue.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { grantTemporaryStacks, tickTemporaryStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createActor } from '../js/pages/sim/engine/actor.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const itemsById = new Map(
  [
    {
      id: 'wooden_sword',
      name: 'Wooden Sword',
      type: 'Melee Weapon',
      cooldown: 1.2,
      staminaCost: 1,
      damageMin: 4,
      damageMax: 6,
      accuracy: 90,
      shape: [[1]],
    },
    {
      id: 'banana',
      name: 'Banana',
      type: 'Food',
      cooldown: 3,
      staminaCost: 0,
      params: { p1: 8, p2: 2 },
      shape: [[1]],
    },
    {
      id: 'carrot_goobert',
      name: 'Carrot Goobert',
      type: 'Pet',
      cooldown: 4,
      staminaCost: 0,
      params: { empower: 2, dur: 1.5, p1: 2, p2: 1, p3: 1.5 },
      shape: [[1]],
    },
    {
      id: 'poison_bow',
      name: 'Poison Bow',
      type: 'Ranged Weapon',
      cooldown: 1.5,
      staminaCost: 1,
      damageMin: 5,
      damageMax: 8,
      accuracy: 90,
      params: { p1: 5 },
      shape: [[1]],
    },
  ].map((i) => [i.id, i]),
);

// --- Unit: temp stacks expire ---
{
  const actor = createActor('player');
  const events = [];
  grantTemporaryStacks(actor, 'empower', 3, 1.0, 0, { originKey: 'test' });
  ok(actor.stacks.empower === 3, 'temp empower granted');
  tickTemporaryStacks(actor, 0.5, events);
  ok(actor.stacks.empower === 3, 'temp empower still active at 0.5s');
  tickTemporaryStacks(actor, 1.0, events);
  ok(actor.stacks.empower === 0, 'temp empower expired at 1.0s');
  ok(
    events.some((e) => e.meta?.expired && e.meta?.stack === 'empower'),
    'temp expire event emitted',
  );
}

ok(!!getScriptHandler('banana')?.onCooldownEffect, 'banana handler');
ok(!!getScriptHandler('carrot_goobert')?.onCooldownEffect, 'carrot_goobert handler');
ok(!!getScriptHandler('eggscalibur')?.onDealtDamage, 'eggscalibur onDealtDamage');
ok(!!getScriptHandler('electric_torch')?.onCooldownEffect, 'electric_torch handler');

// --- Fatigue after COMBAT_DELAY + FATIGUE_TIME ---
{
  const result = simulateEngine({
    placements: [{ id: 'wooden_sword', key: 'ws', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: COMBAT_DELAY + FATIGUE_TIME + 3,
    seed: 42,
  });
  const fatigueEv = result.events.filter((e) => e.meta?.fatigue);
  ok(fatigueEv.some((e) => e.meta?.phase === 'start'), 'fatigue_start event');
  ok(
    fatigueEv.some((e) => e.type === 'damage' && e.meta?.counter > 0),
    'fatigue damage ticks',
  );
  const firstFatigue = fatigueEv.find((e) => e.meta?.phase === 'start');
  ok(
    firstFatigue && Math.abs(firstFatigue.t - (COMBAT_DELAY + FATIGUE_TIME)) < 0.1,
    `fatigue starts ~${COMBAT_DELAY + FATIGUE_TIME}s (got ${firstFatigue?.t})`,
  );
}

// --- Food banana heals ---
{
  const result = simulateEngine({
    placements: [{ id: 'banana', key: 'bn', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 7,
  });
  ok(
    result.events.some((e) => e.type === 'heal' && e.label?.includes('Banana')),
    'banana heal event',
  );
  ok(
    result.events.some((e) => e.meta?.handler === 'banana' && e.type === 'activate'),
    'banana food activate',
  );
}

// --- Carrot goobert temp empower ---
{
  const result = simulateEngine({
    placements: [{ id: 'carrot_goobert', key: 'cg', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 12,
    seed: 11,
  });
  ok(
    result.events.some(
      (e) => e.meta?.handler === 'carrot_goobert' && e.meta?.temp && e.meta?.stack === 'empower',
    ),
    'carrot_goobert grants temp empower',
  );
  ok(
    result.events.some((e) => e.meta?.expired && e.meta?.stack === 'empower'),
    'carrot_goobert empower expires',
  );

  // Phase 159 — snapshot.temp for HUD scrub
  const snaps = result.snapshots || [];
  const withTemp = snaps.find((s) => s.player?.temp?.empower?.amount > 0);
  ok(!!withTemp, 'snapshot carries temp.empower while active');
  if (withTemp) {
    ok(
      withTemp.player.temp.empower.expiresAt > withTemp.t,
      'temp.empower expiresAt after snap t',
    );
    ok(withTemp.player.empower > 0, 'total empower count present with temp');
  }
  const afterExpire = snaps.find(
    (s) =>
      s.t > (withTemp?.player?.temp?.empower?.expiresAt ?? Infinity) - 1e-6 &&
      !(s.player?.temp?.empower?.amount > 0),
  );
  ok(!!afterExpire, 'later snapshot clears temp.empower after expiry');
}

// --- Poison bow on-hit poison ---
{
  const result = simulateEngine({
    placements: [{ id: 'poison_bow', key: 'pb', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 3,
  });
  ok(
    result.events.some((e) => e.type === 'debuff' && e.meta?.handler === 'poison_bow'),
    'poison_bow applies poison on hit',
  );
  ok(
    result.events.some((e) => e.type === 'damage' && e.itemId === 'poison_bow'),
    'poison_bow deals damage',
  );
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nBand Z smoke passed');
