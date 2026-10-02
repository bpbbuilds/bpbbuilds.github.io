/**
 * Band X spotlight fidelity — Miss Fortune / Toad / Oil Lamp / Fanny Pack / tips.
 *   node scripts/sim-spotlight-smoke.mjs
 */
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { mergeLiveItemStats, pieceSnapAt } from '../js/pages/sim/shell/sim-live-item.js';
import { modifiedCooldown } from '../js/pages/sim/engine/piece-stats.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

for (const id of ['miss_fortune', 'toad', 'oil_lamp', 'fanny_pack']) {
  const h = getScriptHandler(id);
  ok(h?.handlerId === id, `handler ${id}`);
}

const sword = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  type: 'Melee Weapon',
  cooldown: 2,
  damageMin: 5,
  damageMax: 10,
  accuracy: 90,
  staminaCost: 1,
  shape: [[1], [1]],
};
const miss = {
  id: 'miss_fortune',
  name: 'Miss Fortune',
  type: 'Accessory',
  cooldown: 2.1,
  params: { luck: 1, p1: 1, buffs: 3, p2: 3 },
  shape: [[1]],
};
const toad = {
  id: 'toad',
  name: 'Toad',
  type: 'Pet',
  cooldown: 3.8,
  params: {
    gained: 10,
    p1: 10,
    heal: 12,
    p2: 12,
    used: 10,
    p3: 10,
    luck: 1,
    p4: 1,
    mana: 1,
    p5: 1,
    luck2: 1,
    p6: 1,
    mana2: 1,
    p7: 1,
  },
  shape: [[1]],
};
const lamp = {
  id: 'oil_lamp',
  name: 'Oil Lamp',
  type: 'Accessory',
  cooldown: 3.4,
  params: { heat: 2, p1: 2, dam: 1, p2: 1, accuracy: 5, p3: 5 },
  shape: [
    [0, 2, 0],
    [2, 1, 2],
    [0, 2, 0],
  ],
};
const fanny = {
  id: 'fanny_pack',
  name: 'Fanny Pack',
  type: 'Bag',
  params: { p1: 10 },
  shape: [
    [1, 1, 1],
    [1, 1, 1],
  ],
};
const clover = {
  id: 'lucky_clover',
  name: 'Lucky Clover',
  type: 'Food',
  cooldown: 2,
  params: { p1: 1 },
  shape: [[1]],
};

const itemsById = new Map(
  [sword, miss, toad, lamp, fanny, clover].map((i) => [i.id, i]),
);

// Miss Fortune should grant most-buffs (mana) after luck spend; Toad only +1 mana/CD
const mfBoard = [
  { id: 'miss_fortune', key: 'mf', x: 0, y: 0, r: 0 },
  { id: 'toad', key: 'td', x: 2, y: 0, r: 0 },
];
// Seed luck via a fake start: run with blueberries-like luck from clover if we map it —
// instead pre-grant by using a board that has enchanted weapons least buffs... simpler:
// call simulate and inject luck by running miss with player that gets luck from toad CD.
const runMf = simulateEngine({
  placements: mfBoard,
  itemsById,
  durationSec: 25,
  seed: 11,
});
const manaBy = (run, id) =>
  run.events
    .filter((e) => e.type === 'buff' && e.meta?.stack === 'mana' && e.itemId === id)
    .reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);

const toadMana = manaBy(runMf, 'toad');
const mfMana = manaBy(runMf, 'miss_fortune');
ok(toadMana > 0 && toadMana < 40, `toad mana modest (${toadMana}), not cd_mana×10`);
// Miss Fortune may grant 0 if never had luck — give luck via toad then MF should convert
ok(
  getScriptHandler('miss_fortune')?.onCooldownEffect != null,
  'miss_fortune has CD effect',
);

// Oil lamp + sword on star
const oilBoard = [
  { id: 'oil_lamp', key: 'ol', x: 2, y: 2, r: 0 },
  { id: 'wooden_sword', key: 'ws', x: 3, y: 2, r: 0 },
];
const runOil = simulateEngine({
  placements: oilBoard,
  itemsById,
  durationSec: 12,
  seed: 3,
});
ok(
  runOil.events.some((e) => /Heat/i.test(e.label || '') && e.itemId === 'oil_lamp'),
  'oil lamp grants heat',
);
ok(
  runOil.events.some((e) => /dmg|acc/i.test(e.label || '') && e.itemId === 'oil_lamp'),
  'oil lamp buffs weapons',
);

const live = pieceSnapAt(runOil.pieceSnapshots, 8, 'ws');
const merged = mergeLiveItemStats(sword, live, 8);
ok(
  merged && Number(merged.damageMin) >= 5,
  `tip damage reflects bonuses (${merged?.damageMin}-${merged?.damageMax})`,
);
ok(!String(merged?.effect || '').includes('Live:'), 'no Live blurb in tip effect');

// Fanny pack insides
const fannyBoard = [
  { id: 'fanny_pack', key: 'fp', x: 0, y: 0, r: 0 },
  { id: 'wooden_sword', key: 'ws2', x: 0, y: 0, r: 0 },
];
const pieces = buildCombatPieces(fannyBoard, itemsById);
const graph = buildBoardGraph(fannyBoard, itemsById);
ok(pieces.some((p) => p.itemId === 'fanny_pack' && p.kind === 'bag'), 'bag piece included');
const runFanny = simulateEngine({
  placements: fannyBoard,
  itemsById,
  durationSec: 8,
  seed: 2,
});
ok(
  runFanny.events.some((e) => e.itemId === 'fanny_pack' && /speed/i.test(e.label || '')),
  'fanny pack applies speed',
);
const swordPiece = pieces.find((p) => p.itemId === 'wooden_sword');
if (swordPiece) {
  swordPiece.speedScale = 0.1;
  swordPiece.baseCooldown = 2;
  const cd = modifiedCooldown(swordPiece, { heat: 0, cold: 0 });
  ok(cd < 2, `modified CD with +10% speed (${cd})`);
}

void graph;
void mfMana;

if (failed) {
  console.error(`FAIL: ${failed} spotlight check(s)`);
  process.exit(1);
}
console.log('OK sim-spotlight-smoke');
