/**
 * Smoke: Tesla Coil charge collect + CD advance (Band T).
 *   node scripts/sim-tesla-smoke.mjs
 */
import fs from 'fs';
import { runSim } from '../js/pages/sim/engine/index.js';
import { hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';
import { buildBatteryChargePath } from '../js/pages/sim/engine/charge-path.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const coverage = JSON.parse(
  fs.readFileSync('assets/data/sim-item-coverage.json', 'utf8'),
);
const inventory = JSON.parse(
  fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'),
);
const canRules = JSON.parse(
  fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'),
);
const classMasks = JSON.parse(
  fs.readFileSync('assets/data/item-class-masks.json', 'utf8'),
);
hydrateSimCoverage(coverage, inventory);

const canAffect = {
  rulesById: canRules?.byId || null,
  classMasks: classMasks?.byId || null,
  classBits: classMasks?.classBits || {},
  hasAttackEffectIds: new Set(canRules?.hasAttackEffectIds || []),
  reactsToChargesIds: new Set(canRules?.reactsToChargesIds || []),
  gainsBuffsIds: new Set(canRules?.gainsBuffsIds || []),
  usesBuffsIds: new Set(canRules?.usesBuffsIds || []),
  gainedStacksById: canRules?.gainedStacksById || {},
  usedStacksById: canRules?.usedStacksById || {},
  craftedIds: new Set(canRules?.craftedIds || []),
  scriptFamilies: canRules?.scriptFamilies || {},
  parentById: canRules?.parentById || {},
  rarityRank: canRules?.rarityRank || {},
};

const batteryShape = [[6], [6], [6], [6], [1]];
const teslaShape = [
  [0, 2, 0],
  [2, 1, 2],
  [2, 1, 2],
  [2, 1, 2],
  [0, 2, 0],
];

/** @type {Map<string, object>} */
const itemsById = new Map([
  [
    'battery',
    {
      id: 'battery',
      name: 'Battery',
      type: 'Accessory',
      rarity: 'Unique',
      cooldown: 0,
      damageMin: 0,
      damageMax: 0,
      shape: batteryShape,
      params: { speed: 10, speed2: 5, dur: 2, p1: 10, p2: 5 },
    },
  ],
  [
    'tesla_coil',
    {
      id: 'tesla_coil',
      name: 'Tesla Coil',
      type: 'Accessory',
      rarity: 'Unique',
      cooldown: 5.5,
      damageMin: 0,
      damageMax: 0,
      staminaCost: 0,
      shape: teslaShape,
      params: { cdadvance: 3, sales: 80, weight: 1.5, p1: 3, p2: 80, p3: 1.5 },
    },
  ],
  [
    'star_sword',
    {
      id: 'star_sword',
      name: 'Star Sword',
      type: 'Weapon',
      rarity: 'Rare',
      cooldown: 4,
      damageMin: 5,
      damageMax: 8,
      accuracy: 90,
      staminaCost: 1,
      shape: [[1]],
      params: {},
    },
  ],
  [
    'off_star_sword',
    {
      id: 'off_star_sword',
      name: 'Offstar Sword',
      type: 'Weapon',
      rarity: 'Rare',
      cooldown: 4,
      damageMin: 5,
      damageMax: 8,
      accuracy: 90,
      staminaCost: 1,
      shape: [[1]],
      params: {},
    },
  ],
]);

// Battery column at x=4,y=4 → path (4,4)…(4,0). Tesla body at (4,1..3) on path.
// Star sword at (5,1) under Tesla ★. Off-star at (0,0).
const placements = [
  { id: 'battery', key: 'bat', x: 4, y: 4, r: 0 },
  { id: 'tesla_coil', key: 'tesla', x: 4, y: 1, r: 0 },
  { id: 'star_sword', key: 'star', x: 5, y: 1, r: 0 },
  { id: 'off_star_sword', key: 'off', x: 0, y: 0, r: 0 },
];

const handler = getScriptHandler('tesla_coil');
if (!handler?.onChargeReceived || !handler?.onCooldownEffect) {
  console.error('FAIL tesla_coil handler missing charge/CD hooks', handler?.handlerId);
  process.exit(1);
}
if (handler.handlerId !== 'tesla_coil') {
  console.error('FAIL expected MECH port tesla_coil, got', handler.handlerId);
  process.exit(1);
}

const path = buildBatteryChargePath({
  pathId: 'smoke',
  item: itemsById.get('battery'),
  placement: { x: 4, y: 4, r: 0, key: 'bat' },
  startT: 2.52,
  durPerTile: 2,
});
const teslaCells = new Set(['4,1', '4,2', '4,3']);
const pathHitsOnTesla = (path?.cells || []).filter((c) => teslaCells.has(c.cell)).length;
if (pathHitsOnTesla < 2) {
  console.error('FAIL fixture path should overlap Tesla body', path?.cells);
  process.exit(1);
}

const run = runSim({
  mode: 'engine',
  placements,
  itemsById,
  seed: 0x7e51a001,
  canAffect,
  durationSec: 30,
});

const evs = run.events || [];
const prepare = evs.find((e) => e.meta?.phase === 'tesla_prepare');
if (!prepare?.meta?.queue) {
  console.error('FAIL missing tesla_prepare queue');
  process.exit(1);
}

const queue = /** @type {string[]} */ (prepare.meta.queue);
const starIdx = queue.indexOf('star');
const offIdx = queue.indexOf('off');
if (starIdx < 0 || offIdx < 0) {
  console.error('FAIL queue missing star/off', queue);
  process.exit(1);
}
if (starIdx >= (prepare.meta.starCount || 0)) {
  console.error('FAIL star target not in star prefix', {
    starIdx,
    starCount: prepare.meta.starCount,
    queue,
  });
  process.exit(1);
}
if (offIdx < (prepare.meta.starCount || 0)) {
  console.error('FAIL off-star should be after star group', {
    offIdx,
    starCount: prepare.meta.starCount,
    queue,
  });
  process.exit(1);
}

const receives = evs.filter(
  (e) =>
    e.meta?.phase === 'charge_received' && e.placementKey === 'tesla',
);
if (receives.length < 1) {
  console.error('FAIL expected charge_received on Tesla, got', receives.length);
  process.exit(1);
}

const advances = evs.filter((e) => e.meta?.phase === 'tesla_advance');
if (advances.length < 1) {
  console.error('FAIL expected tesla_advance events');
  process.exit(1);
}

const firstAdvance = advances[0];
if (firstAdvance.meta?.cdAdvance !== 3) {
  console.error('FAIL cdAdvance want 3 got', firstAdvance.meta?.cdAdvance);
  process.exit(1);
}

const teslaDamage = evs.filter(
  (e) =>
    e.type === 'damage' &&
    e.itemId === 'tesla_coil' &&
    e.target === 'dummy',
);
if (teslaDamage.length) {
  console.error('FAIL Tesla must not deal dummy damage', teslaDamage);
  process.exit(1);
}

const spend = evs.find((e) => e.meta?.phase === 'tesla_spend');
if (!spend) {
  console.error('FAIL missing tesla_spend');
  process.exit(1);
}

console.log('sim-tesla-smoke OK', {
  pathHitsOnTesla,
  receives: receives.length,
  advances: advances.length,
  queue,
  starCount: prepare.meta.starCount,
  spendCharges: spend.meta?.teslaCharges,
});
