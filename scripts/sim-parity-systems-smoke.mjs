/**
 * Band AF 195 — parity systems smoke (invuln charges, buff-protect, stun, peer goobert, charge pulse).
 *   node scripts/sim-parity-systems-smoke.mjs
 */
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import {
  createActor,
  grantInvuln,
  grantStun,
  grantBuffProtect,
  isInvulnerable,
  isStunned,
  consumeInvulnHit,
} from '../js/pages/sim/engine/actor.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { grantStacks, stealStack } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { emitChargePulse } from '../js/pages/sim/engine/charge-delivery.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

// --- 188 invuln charges ---
{
  const player = createActor('player');
  const dummy = createActor('dummy');
  grantInvuln(player, 0, 0, { charges: 1 });
  ok(isInvulnerable(player, 0), 'charge invuln active');
  const res = takeDamage(player, dummy, {
    amount: 40,
    canMiss: false,
    isAttack: true,
    nowT: 0,
    rng: () => 0.5,
  });
  ok(res.healthDamage === 0 && player.hp === player.maxHp, 'charge blocks one hit');
  ok((player.invulnCharges || 0) === 0, 'charge spent after hit');
  ok(!isInvulnerable(player, 0), 'no invuln after charge spent');
  const res2 = takeDamage(player, dummy, {
    amount: 10,
    canMiss: false,
    isAttack: true,
    nowT: 0.1,
    rng: () => 0.5,
  });
  ok(res2.healthDamage > 0, 'damage applies after charge spent');
}

// duration-only: consumeInvulnHit should not clear mid-window
{
  const player = createActor('player');
  grantInvuln(player, 2, 0);
  consumeInvulnHit(player, 0.5);
  ok(isInvulnerable(player, 0.5), 'duration invuln survives consumeInvulnHit');
}

// --- 189 buff-protect ---
{
  const from = createActor('player');
  const to = createActor('dummy');
  grantStacks(from, 'lucky', 3, {});
  grantBuffProtect(from, 1);
  const r = stealStack(from, to, 'lucky', 1, {});
  ok(r.protected && r.stolen === 0, 'buff-protect blocks one steal');
  ok((from.buffProtect || 0) === 0, 'protect consumed');
  ok((from.stacks.lucky || 0) === 3, 'lucky intact after protect');
  const r2 = stealStack(from, to, 'lucky', 1, {});
  ok(r2.stolen === 1 && (from.stacks.lucky || 0) === 2, 'second steal succeeds');
}

// --- 190 stun ---
{
  const dummy = createActor('dummy');
  grantStun(dummy, 1.5, 0);
  ok(isStunned(dummy, 0.5), 'stun active');
  ok(!isStunned(dummy, 1.6), 'stun expired');
}

{
  const hammer = {
    id: 'hammer',
    name: 'Hammer',
    type: 'Weapon',
    cooldown: 2,
    damageMin: 8,
    damageMax: 10,
    chance: 100,
    params: { dur_stun: 2 },
    shape: [[1]],
  };
  const itemsById = new Map([['hammer', hammer]]);
  const result = simulateEngine({
    placements: [{ id: 'hammer', key: 'h1', x: 0, y: 0, r: 0 }],
    itemsById,
    seed: 7,
    durationSec: 8,
  });
  const stunEv = (result.events || []).some(
    (e) => e.meta?.stack === 'stun' || /Stun/i.test(e.label || ''),
  );
  ok(stunEv, 'hammer emits stun');
  // Unit: grantStun + simulate skip covered separately; snapshot field present after grant
  const actor = createActor('dummy');
  grantStun(actor, 2, 1);
  const snap = {
    ...actor,
    stunnedUntil: actor.stunnedUntil,
  };
  ok(snap.stunnedUntil > 1, 'stunnedUntil on actor for HUD');
}

// --- 191 peer goobert ---
{
  const goobert = getScriptHandler('goobert');
  ok(typeof goobert?.onPeerActivated === 'function', 'goobert onPeerActivated');
  const piece = {
    itemId: 'goobert',
    name: 'Goobert',
    placementKey: 'g1',
    params: { p1: 2, heal: 12 },
    _goobertActs: 0,
  };
  const player = createActor('player');
  player.hp = 100;
  const events = [];
  const ctx = {
    t: 1,
    player,
    dummy: createActor('dummy'),
    events,
    rng: () => 0.5,
  };
  goobert.onPeerActivated(piece, { itemId: 'banana' }, ctx);
  ok(piece._goobertActs === 1 && player.hp === 100, 'peer tick 1/2 no heal');
  goobert.onPeerActivated(piece, { itemId: 'banana' }, ctx);
  ok(player.hp > 100, 'peer tick 2/2 heals');
  ok(events.some((e) => e.type === 'heal'), 'peer heal event');
}

// --- 192 charge pulse ---
{
  const staff = {
    itemId: 'lightning_staff',
    name: 'Lightning Staff',
    placementKey: 's1',
  };
  const battery = {
    itemId: 'battery',
    name: 'Battery',
    placementKey: 'b1',
    alive: true,
    numCharges: 0,
  };
  const events = [];
  /** Minimal graph compatible with neighborKeys / affectedTargets */
  const piecesMap = new Map([
    [
      's1',
      {
        key: 's1',
        id: 'lightning_staff',
        cells: ['0,0'],
        affectCells: [{ cell: '1,0', color: 'primary' }],
      },
    ],
    [
      'b1',
      {
        key: 'b1',
        id: 'battery',
        cells: ['1,0'],
        affectCells: [],
      },
    ],
  ]);
  const filled = new Map([
    ['0,0', 's1'],
    ['1,0', 'b1'],
  ]);
  const graph = { pieces: piecesMap, filled };
  const n = emitChargePulse(
    staff,
    {
      t: 1,
      events,
      graph,
      itemsById: new Map([
        ['lightning_staff', { id: 'lightning_staff' }],
        ['battery', { id: 'battery' }],
      ]),
      canAffect: () => true,
      pieces: [staff, battery],
      player: createActor('player'),
      dummy: createActor('dummy'),
      rng: () => 0.5,
    },
    { speedBoost: 0.05 },
  );
  ok(n >= 1, `charge pulse targets ≥1 (got ${n})`);
  ok(events.some((e) => e.meta?.chargePulse), 'chargePulse event');
  ok((battery.numCharges || 0) >= 1, 'neighbor received charge');
}

ok(failed === 0, `AF systems smoke clean (${failed} fails)`);
if (failed) process.exitCode = 1;
else console.log('\nAF parity systems smoke OK');
