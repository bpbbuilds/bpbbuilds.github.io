import assert from 'node:assert/strict';
import fs from 'node:fs';

import rules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ExtraBags.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func affectsEmpty\(color\):[\s\S]*Affected\.Secondary/);
assert.match(source, /getNumEmptyAffectedCells\(Affected\.Secondary\)/);
assert.match(source, /func onSaleRoll\(item\):/);
assert.match(source, /func onItemRoll\(descr\):/);

const handler = getScriptHandler('extra_bags');
assert.equal(handler?.handlerId, 'extra_bags');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Extra Bags is preparation-time, not combat-start');

const sourcePiece = {
  itemId: 'extra_bags',
  placementKey: 'extra',
  params: { speed: 15, p3: 15 },
  speedScale: 0,
};
const cooldownTarget = {
  itemId: 'wooden_sword',
  placementKey: 'target',
  cooldown: 1.4,
  speedScale: 0,
};
const passiveTarget = {
  itemId: 'passive',
  placementKey: 'passive',
  cooldown: 0,
  speedScale: 0,
};

const secondaryCells = ['0,1', '1,0', '1,2', '2,1'];
const graph = {
  pieces: new Map([
    [sourcePiece.placementKey, {
      key: sourcePiece.placementKey,
      id: sourcePiece.itemId,
      cells: ['1,1'],
      affectCells: [
        { cell: '1,1', color: 'primary' },
        ...secondaryCells.map((cell) => ({ cell, color: 'secondary' })),
      ],
    }],
    ['bag', { key: 'bag', id: 'vineweave_basket', cells: ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2'], affectCells: [] }],
    [cooldownTarget.placementKey, { key: cooldownTarget.placementKey, id: cooldownTarget.itemId, cells: ['1,1'], affectCells: [] }],
    [passiveTarget.placementKey, { key: passiveTarget.placementKey, id: passiveTarget.itemId, cells: ['0,1'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,1', passiveTarget.placementKey],
    ['1,1', cooldownTarget.placementKey],
    ['0,0', 'bag'],
    ['0,2', 'bag'],
    ['1,0', 'bag'],
    ['1,2', 'bag'],
    ['2,0', 'bag'],
    ['2,1', 'bag'],
    ['2,2', 'bag'],
  ]),
};
const itemsById = new Map([
  ['extra_bags', { id: 'extra_bags', type: 'Skill', params: { speed: 15, p3: 15 } }],
  ['vineweave_basket', { id: 'vineweave_basket', type: 'Bag' }],
  ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon', cooldown: 1.4 }],
  ['passive', { id: 'passive', type: 'Skill', cooldown: null }],
]);
const ctx = {
  graph,
  itemsById,
  canAffect: { rulesById: rules.byId },
  pieces: [sourcePiece, cooldownTarget, passiveTarget],
};

handler.onPrepare(sourcePiece, ctx);
assert.ok(Math.abs(cooldownTarget.speedScale - 0.45) < 1e-9, 'three empty secondary bag cells grant 45% speed');
assert.equal(passiveTarget.speedScale, 0, 'non-cooldown primary targets are excluded');

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(
  ['extra_bags', 'vineweave_basket', 'wooden_sword']
    .map((id) => [id, catalog.find((item) => item.id === id)])
    .filter(([, item]) => item),
);
const run = simulateEngine({
  placements: [
    { id: 'vineweave_basket', key: 'bag', x: -1, y: -1, r: 0 },
    { id: 'extra_bags', key: 'extra', x: 0, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'target', x: -1, y: -1, r: 0 },
  ],
  itemsById: byId,
  canAffect: { rulesById: rules.byId },
  durationSec: 3,
  dummyAttacks: false,
});
const prepared = run.pieceSnapshots.find((snap) => snap.t === 2.5)?.byKey?.target;
assert.ok(prepared, 'engine snapshot retains the prepared cooldown item');
assert.ok(Math.abs(prepared.speedScale - 0.45) < 1e-9, 'engine runs Extra Bags during preparation');

console.log('OK Extra Bags source and prepare-time regression');
