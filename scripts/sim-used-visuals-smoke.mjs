import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SIM_VISUAL_VARIANTS,
  visualStateAt,
  visualStateForPiece,
} from '../js/pages/sim/engine/visual-state.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const expected = {
  phoenix: ['ash'],
  phoenix2: ['ash'],
  dark_lantern: ['used'],
  deer_totem: ['active'],
  dual_wielding: ['active'],
  full_body_protection: ['active'],
  vampiric_gloves: ['active'],
  pumpkin: ['glowing'],
  lucky_cat: ['none', 'one', 'two'],
  scale: ['base', 'left', 'right'],
};

for (const [id, states] of Object.entries(expected)) {
  assert.ok(SIM_VISUAL_VARIANTS[id], `${id} has a visual variant map`);
  for (const state of states) {
    assert.match(
      SIM_VISUAL_VARIANTS[id][state],
      /\.png$/,
      `${id}:${state} points to a PNG`,
    );
    assert.ok(
      fs.existsSync(`assets/item-sprites/${SIM_VISUAL_VARIANTS[id][state]}`),
      `${id}:${state} asset is imported`,
    );
  }
}

assert.equal(visualStateForPiece({ itemId: 'phoenix', _phxUsed: false }), null);
assert.equal(visualStateForPiece({ itemId: 'phoenix', _phxUsed: true }), 'ash');
assert.equal(visualStateForPiece({ itemId: 'phoenix2', _phxUsed: true }), 'ash');
assert.equal(visualStateForPiece({ itemId: 'dark_lantern', _lanternUsed: true }), 'used');
assert.equal(visualStateForPiece({ itemId: 'deer_totem', _deerRageActive: true }), 'active');
assert.equal(visualStateForPiece({ itemId: 'dual_wielding', _dualWieldingActive: true }), 'active');
assert.equal(visualStateForPiece({ itemId: 'full_body_protection', _fbpActive: true }), 'active');
assert.equal(visualStateForPiece({ itemId: 'vampiric_gloves', _vampiricGlovesActive: true }), 'active');
assert.equal(visualStateForPiece({ itemId: 'pumpkin', _pumpkinGlowing: true }), 'glowing');
assert.equal(visualStateForPiece({ itemId: 'lucky_cat', _luckyCatState: 'two' }), 'two');
assert.equal(visualStateForPiece({ itemId: 'scale', _scaleState: 'left' }), 'left');

const snapshots = [
  { t: 0, byKey: { a: { visualState: null } } },
  { t: 2, byKey: { a: { visualState: 'ash' } } },
];
assert.equal(visualStateAt(snapshots, 1, 'a'), null);
assert.equal(visualStateAt(snapshots, 2.5, 'a'), 'ash');
assert.equal(visualStateAt(snapshots, 2.5, 'missing'), null);

const sourceChecks = [
  ['tools/game-extract-full/Items/Potion.gd', /func empty\(\)/],
  ['tools/game-extract-full/Items/Exclusive/Phoenix.gd', /setTexture\(ashSprite\)/],
  ['tools/game-extract-full/Items/Exclusive/DarkLantern.gd', /DarkLantern_used\.png/],
  ['tools/game-extract-full/Items/Exclusive/DeerTotem.gd', /DeerTotem_active\.png/],
  ['tools/game-extract-full/Items/Exclusive/DualWielding.gd', /DualWielding_active\.png/],
  ['tools/game-extract-full/Items/Exclusive/FullBodyProtection.gd', /FullBodyProtection_active\.png/],
  ['tools/game-extract-full/Items/Exclusive/LuckyCat.gd', /LuckyCat_both_paws\.png/],
  ['tools/game-extract-full/Items/Exclusive/Scale.gd', /Scale_(left|right)\.png/],
  ['tools/game-extract-full/Items/VampiricGloves.gd', /VampiricGloves_active\.png/],
  ['tools/game-extract-full/Items/Pumpkin.gd', /Pumpkin_glowing\.png/],
];
for (const [file, pattern] of sourceChecks) {
  assert.match(fs.readFileSync(file, 'utf8'), pattern, `${file} source evidence`);
}

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8')).byId;
const liveArt = JSON.parse(fs.readFileSync('assets/data/item-live-art.json', 'utf8')).items;
const potionRows = Object.entries(inventory).filter(([, row]) => /(?:Potion|Flask)\.gd$/i.test(row.file || ''));
assert.ok(potionRows.length > 0, 'potion source inventory is present');
for (const [id] of potionRows) {
  assert.equal(liveArt[id]?.kind, 'potion', `${id} uses the live potion art surface`);
}

const gameItems = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const itemsById = new Map((gameItems.items || []).map((item) => [item.id, item]));
const phoenixRun = simulateEngine({
  placements: [
    { id: 'phoenix', key: 'phoenix:0', x: 0, y: 0, r: 0 },
    { id: 'oil_lamp', key: 'oil:0', x: 1, y: 0, r: 0 },
  ],
  itemsById,
  playerHp: 20,
  dummyAttackDamage: 200,
  dummyAttackCd: 0.2,
  durationSec: 5,
  seed: 1,
});
assert.ok(
  phoenixRun.pieceSnapshots.some((snap) => snap.byKey['phoenix:0']?.visualState === 'ash'),
  'Phoenix snapshots switch to Ash after resurrection',
);
const lanternRun = simulateEngine({
  placements: [{ id: 'dark_lantern', key: 'dark:0', x: 0, y: 0, r: 0 }],
  itemsById,
  playerHp: 20,
  dummyAttackDamage: 200,
  dummyAttackCd: 0.2,
  durationSec: 5,
  seed: 1,
});
assert.ok(
  lanternRun.pieceSnapshots.some((snap) => snap.byKey['dark:0']?.visualState === 'used'),
  'Dark Lantern snapshots switch to used art after reincarnation',
);

console.log('sim used-item visual state smoke: ok');
