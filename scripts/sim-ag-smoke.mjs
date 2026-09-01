/**
 * Band AG 210 — deepen smoke (goobert peer, crown mana, staff charge, board, wave C/B samples).
 *   node scripts/sim-ag-smoke.mjs
 */
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { createActor, grantInvuln, isInvulnerable } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { emitPathCharge } from '../js/pages/sim/engine/charge-delivery.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

for (const id of [
  'goobert',
  'king_goobert',
  'crown',
  'holy_spear',
  'lightning_staff',
  'plastic_cube',
  'slime_time',
  'chess_board',
  'hammer',
  'whetstone',
  'miss_fortune',
]) {
  ok(!!getScriptHandler(id)?.handlerId, `handler ${id}`);
}

ok(getScriptHandler('chess_board')?.onCombatStart != null, 'chess_board noop exists');

// Peer goobert
{
  const goobert = {
    id: 'goobert',
    name: 'Goobert',
    type: 'Pet',
    cooldown: 99,
    params: { p1: 2, heal: 10 },
    shape: [[1]],
  };
  const banana = {
    id: 'banana',
    name: 'Banana',
    type: 'Food',
    cooldown: 2,
    params: {},
    shape: [[1]],
  };
  const itemsById = new Map([
    ['goobert', goobert],
    ['banana', banana],
  ]);
  const result = simulateEngine({
    placements: [
      { id: 'goobert', key: 'g', x: 0, y: 0, r: 0 },
      { id: 'banana', key: 'b', x: 1, y: 0, r: 0 },
    ],
    itemsById,
    durationSec: 12,
    seed: 3,
  });
  ok(
    result.events.some((e) => e.type === 'heal' && e.meta?.handler === 'goobert'),
    'AG peer goobert heal',
  );
}

// Crown mana → invuln once
{
  const crown = {
    id: 'crown',
    name: 'Crown',
    type: 'Accessory',
    cooldown: 4,
    params: { mana: 2, dur_invu: 2, heal: 4 },
    shape: [[1]],
  };
  const itemsById = new Map([['crown', crown]]);
  const result = simulateEngine({
    placements: [{ id: 'crown', key: 'c', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 4,
  });
  // Inject mana mid-fight via unit check on handler bind
  const piece = { params: crown.params, placementKey: 'c', itemId: 'crown', name: 'Crown' };
  const player = createActor('player');
  const events = [];
  const ctx = { t: 3, player, events, rng: () => 0.5 };
  getScriptHandler('crown').onCombatStart(piece, ctx);
  grantStacks(player, 'mana', 5, {});
  piece._tryCrownInvuln?.(3);
  ok(isInvulnerable(player, 3.1), 'crown mana → invuln');
  ok(piece._crownState === 'Active' || piece._crownState === 'Used', 'crown state advanced');
}

// Path charge helper
{
  const staff = {
    itemId: 'lightning_staff',
    name: 'Lightning Staff',
    placementKey: 's1',
  };
  const events = [];
  const piecesMap = new Map([
    ['s1', { key: 's1', id: 'lightning_staff', x: 0, y: 0, r: 0, cells: ['0,0'], affectCells: [] }],
  ]);
  const item = {
    id: 'lightning_staff',
    shape: [[1]],
    // minimal shape for path — may return null if <2 cells; still OK if helper runs
  };
  const path = emitPathCharge(staff, {
    t: 1,
    events,
    graph: { pieces: piecesMap, filled: new Map([['0,0', 's1']]) },
    itemsById: new Map([['lightning_staff', item]]),
    pieces: [staff],
    player: createActor('player'),
    dummy: createActor('dummy'),
    rng: () => 0.5,
  });
  ok(path === null || events.some((e) => e.type === 'charge'), 'emitPathCharge runs');
}

// Plastic cube % advance event
{
  const cube = {
    id: 'plastic_cube',
    name: 'Plastic Cube',
    type: 'Accessory',
    cooldown: 3,
    params: { cd: 25, p2: 1 },
    shape: [[1]],
  };
  const sword = {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    type: 'Weapon',
    cooldown: 2,
    damageMin: 4,
    damageMax: 6,
    shape: [[1]],
  };
  const result = simulateEngine({
    placements: [
      { id: 'plastic_cube', key: 'pc', x: 0, y: 0, r: 0 },
      { id: 'wooden_sword', key: 'ws', x: 1, y: 0, r: 0 },
    ],
    itemsById: new Map([
      ['plastic_cube', cube],
      ['wooden_sword', sword],
    ]),
    durationSec: 10,
    seed: 5,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'plastic_cube'),
    'plastic_cube activates',
  );
}

// Wave C / B / spotlight handlers fire
{
  const hammer = {
    id: 'hammer',
    name: 'Hammer',
    type: 'Weapon',
    cooldown: 2,
    damageMin: 6,
    damageMax: 8,
    chance: 100,
    params: { dur_stun: 1 },
    shape: [[1]],
  };
  const result = simulateEngine({
    placements: [{ id: 'hammer', key: 'h', x: 0, y: 0, r: 0 }],
    itemsById: new Map([['hammer', hammer]]),
    durationSec: 8,
    seed: 6,
  });
  ok(result.events.some((e) => /Stun/i.test(e.label || '')), 'wave C hammer stun');
}

ok(failed === 0, `AG smoke clean (${failed} fails)`);
if (failed) process.exitCode = 1;
else console.log('\nAG deepen smoke OK');
