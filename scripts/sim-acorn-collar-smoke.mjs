import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rules.byId || null };

assert.equal(inventory.byId.acorn_collar.file, 'AcornCollar.gd');
assert.equal(inventory.byId.acorn_collar.extends, 'RangerCollar');
assert.ok(inventory.byId.acorn_collar.overrides.includes('onPrepare'));

const handler = getScriptHandler('acorn_collar');
assert.equal(typeof handler?.onPrepare, 'function', 'Acorn Collar implements its source preparation hook');

for (const side of ['you', 'them']) {
  const placements = [
    { id: 'acorn_collar', key: `${side}:collar`, x: 0, y: 0, r: 0, side },
    { id: 'acorn_ace', key: `${side}:ace`, x: 3, y: 0, r: 0, side },
    { id: 'wooden_sword', key: `${side}:sword`, x: 1, y: 0, r: 0, side },
    { id: 'mana_orb', key: `${side}:orb`, x: -1, y: 0, r: 0, side },
  ];
  const graph = buildBoardGraph(placements, byId);
  const pieces = buildCombatPieces(placements, byId);
  const collar = pieces.find((piece) => piece.itemId === 'acorn_collar');
  const sword = pieces.find((piece) => piece.itemId === 'wooden_sword');
  const orb = pieces.find((piece) => piece.itemId === 'mana_orb');
  assert.ok(collar && sword && orb, `Acorn Collar fixture builds on ${side}`);

  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const ctx = { player, dummy: createActor(side === 'you' ? 'dummy' : 'player'), pieces, itemsById: byId, graph, canAffect, rng: () => 0 };
  handler.onPrepare(collar, ctx);
  assert.equal(sword.staminaCost, 0.9, `One Acorn Ace applies inherited Ranger Collar stamina reduction on ${side}`);
  assert.equal(orb.staminaCost, 0, `Acorn Collar does not modify non-damaging target stamina on ${side}`);

  grantStacks(player, 'lucky', 2, { rng: () => 0 });
  assert.equal(sword.critChance, 10, `Lucky grants source crit chance only to affected damage item on ${side}`);
  assert.equal(orb.critChance || 0, 0, `Lucky does not grant crit chance to non-damaging target on ${side}`);
}

const engineRun = simulateEngine({
  placements: [
    { id: 'acorn_collar', key: 'engine:collar', x: 0, y: 0, r: 0 },
    { id: 'acorn_ace', key: 'engine:ace', x: 3, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'engine:sword', x: 1, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 1,
  dummyAttacks: false,
});
assert.equal(engineRun.summary.pieceCount, 3, 'Preparation-only collar and Acorn Ace remain in a real engine inventory');
assert.equal(
  engineRun.pieceSnapshots[0].byKey['engine:sword'].staminaCost,
  0.9,
  'The real engine snapshots inherited Ranger Collar preparation before cooldown arming',
);

console.log('OK Acorn Collar focused smoke');
