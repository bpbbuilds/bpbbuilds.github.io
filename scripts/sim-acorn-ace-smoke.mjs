import assert from 'node:assert/strict';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = inventory.byId.acorn_ace;
assert.equal(source.file, 'Exclusive/AcornAce.gd');
assert.ok(source.overrides.includes('onPrepare'), 'Acorn Ace reduces Staff stamina during prepare');

const acorn = {
  id: 'acorn_ace',
  name: 'Acorn Ace',
  type: 'Skill',
  params: { stamina2: 15 },
  shape: [[1]],
};
const staff = {
  id: 'critwood_staff',
  name: 'Critwood Staff',
  type: 'Weapon',
  cooldown: 3,
  staminaCost: 10,
  shape: [[1]],
};
const unrelated = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  type: 'Weapon',
  cooldown: 3,
  staminaCost: 10,
  shape: [[1]],
};
const itemsById = new Map([[acorn.id, acorn], [staff.id, staff], [unrelated.id, unrelated]]);
const handler = getScriptHandler(acorn.id);
assert.equal(typeof handler?.onPrepare, 'function', 'Acorn Ace implements its source preparation hook');

for (const side of ['you', 'them']) {
  const pieces = buildCombatPieces(
    [
      { id: acorn.id, key: `${side}:ace`, x: 0, y: 0, r: 0, side },
      { id: staff.id, key: `${side}:staff`, x: 1, y: 0, r: 0, side },
      { id: unrelated.id, key: `${side}:other`, x: 2, y: 0, r: 0, side },
    ],
    itemsById,
  );
  const ace = pieces.find((piece) => piece.itemId === acorn.id);
  const critwood = pieces.find((piece) => piece.itemId === staff.id);
  const other = pieces.find((piece) => piece.itemId === unrelated.id);
  assert.ok(ace, `Acorn Ace remains in the combat inventory for preparation on ${side}`);
  assert.ok(critwood, `Critwood Staff remains in the combat inventory on ${side}`);
  assert.ok(other, `Unrelated weapon remains in the combat inventory on ${side}`);
  handler.onPrepare(ace, { pieces, itemsById });
  assert.equal(critwood.staminaCost, 8.5, `Acorn Ace applies source stamina2 reduction to Critwood Staff on ${side}`);
  assert.equal(other.staminaCost, 10, `Acorn Ace does not reduce unrelated weapon stamina on ${side}`);
}

const engineRun = simulateEngine({
  placements: [
    { id: acorn.id, key: 'engine:ace', x: 0, y: 0, r: 0 },
    { id: staff.id, key: 'engine:staff', x: 1, y: 0, r: 0 },
  ],
  itemsById: new Map([[acorn.id, acorn], [staff.id, staff]]),
  durationSec: 1,
  dummyAttacks: false,
});
assert.equal(engineRun.summary.pieceCount, 2, 'Preparation-only Acorn Ace stays in a real engine inventory');
assert.equal(
  engineRun.pieceSnapshots[0].byKey['engine:staff'].staminaCost,
  8.5,
  'The real engine snapshots Acorn Ace before Critwood Staff cooldown arming',
);

console.log('OK Acorn Ace focused smoke');
