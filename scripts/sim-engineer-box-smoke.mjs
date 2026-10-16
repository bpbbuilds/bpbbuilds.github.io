/**
 * Phase 255 — Port-O-Charger queues emitCharge(delay), not addSpeed at start.
 *   node scripts/sim-engineer-box-smoke.mjs
 */
import fs from 'fs';
import { COMBAT_DELAY, simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { canEmitCharge } from '../js/pages/sim/engine/charge-delivery.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const GAME_ITEMS = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const SOURCE = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/EngineerBox.gd',
  'utf8',
);
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
    chance: it.chance,
    chance2: it.chance2,
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

ok(/^extends Bag/m.test(SOURCE), 'source extends Bag');
ok(/func onCombatEnd\(\):[\s\S]*chargeTimer\.stop\(\)[\s\S]*queuedEmitters\.clear\(\)/.test(SOURCE), 'source clears the queue on combat end');
ok(/func canApplyEffect\(toItem\):[\s\S]*toItem\.has_method\("emitCharge"\)/.test(SOURCE), 'source targets only items with emitCharge');
ok(/func onPrepare\(\):[\s\S]*EventBus\.connectEvent\(item, "charge_emitted"/.test(SOURCE), 'source connects charge signals during preparation');
ok(/queuedEmitters\.push_back\(item\)[\s\S]*chargeTimer\.start\(delay\)/.test(SOURCE), 'source queues and restarts the delay timer');
ok(/queuedEmitters\.pop_front\(\)[\s\S]*emitter\.emitCharge\(chargeSpeed\)/.test(SOURCE), 'source re-emits the oldest queued charge at chargeSpeed');

const SOURCE_CHARGE_EMITTERS = [
  'battery',
  'charge_splitter',
  'cog_badge',
  'con_trap_tron',
  'generator',
  'lightning_staff',
  'mana_crystal',
];
for (const id of SOURCE_CHARGE_EMITTERS) {
  ok(
    typeof getScriptHandler(id)?.emitCharge === 'function',
    `${id} exposes the source emitCharge interface`,
  );
}
ok(
  canEmitCharge({ itemId: 'battery' }) === true &&
    canEmitCharge({ itemId: 'mana_crystal' }) === true,
  'source charge emitters are accepted as Engineer Box targets',
);
ok(
  canEmitCharge({ itemId: 'wooden_sword' }) === false,
  'items without source emitCharge are rejected as Engineer Box targets',
);

for (const id of SOURCE_CHARGE_EMITTERS) {
  const placements = [{ id, key: 'emitter', x: 0, y: 0, r: 0 }];
  const pieces = buildCombatPieces(placements, byId);
  const piece = pieces[0];
  const events = [];
  const ctx = {
    t: 0,
    player: createActor('player'),
    dummy: createActor('dummy'),
    events,
    graph: buildBoardGraph(placements, byId),
    pieces,
    itemsById: byId,
    chargeJobs: [],
    bus: createCombatBus(),
  };
  getScriptHandler(id).emitCharge(piece, ctx, 1.5);
  ok(
    events.some((event) => event.type === 'activate' && event.itemId === id),
    `${id} re-emission activates the source item`,
  );
  ok(
    events.some((event) => event.type === 'charge' && event.itemId === id),
    `${id} re-emission sends a charge path`,
  );
}

const run = simulateEngine({
  placements: [
    { id: 'engineer_box', key: 'box', x: 0, y: 0, r: 0 },
    { id: 'battery', key: 'bat', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 12,
  seed: 2551,
});

const startSnap = (run.pieceSnapshots || []).find(
  (s) => Math.abs(Number(s.t) - COMBAT_DELAY) < 0.05,
);
const startScale = Number(startSnap?.byKey?.bat?.speedScale) || 0;
ok(startScale === 0, `battery speedScale at combat start is 0 (got ${startScale})`);

const sparks = (run.events || []).filter(
  (e) => e.type === 'activate' && e.itemId === 'battery' && e.meta?.emitCharge,
);
ok(sparks.length === 2, `battery emitCharge twice (start + delayed), got ${sparks.length}`);
ok(Math.abs(Number(sparks[0]?.t) - COMBAT_DELAY) < 0.05, `first spark at COMBAT_DELAY (${sparks[0]?.t})`);
const delayedAt = COMBAT_DELAY + 5;
ok(
  sparks[1] && Math.abs(Number(sparks[1].t) - delayedAt) < 0.08,
  `second spark ~delay 5s after start (${sparks[1]?.t}, expect ~${delayedAt})`,
);
ok(Number(sparks[1]?.meta?.speedFactor) === 1.5, `re-emit uses box speed/100 (${sparks[1]?.meta?.speedFactor})`);

if (failed) process.exit(1);
