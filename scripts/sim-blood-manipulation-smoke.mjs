import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rules.byId || null };
const handler = getScriptHandler('blood_manipulation');
assert.equal(typeof handler?.onPrepare, 'function', 'Blood Manipulation applies source stats during preparation');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const manipulationKey = `${side}:blood_manipulation`;
  const amuletKey = `${side}:blood_amulet`;
  const placements = [
    { id: 'blood_manipulation', key: manipulationKey, x: 0, y: 0, r: 0 },
    { id: 'blood_amulet', key: amuletKey, x: 0, y: 1, r: 0 },
  ];
  const graph = buildBoardGraph(placements, itemsById);
  const piece = {
    itemId: 'blood_manipulation',
    placementKey: manipulationKey,
    side,
    name: 'Blood Manipulation',
    params: { unhealing: 15, vampirism: 1, speed: 30 },
    speedScale: 0,
  };
  const amulet = {
    itemId: 'blood_amulet',
    placementKey: amuletKey,
    side,
    name: 'Blood Amulet',
    kind: 'gadget',
  };
  const ctx = {
    t: 0,
    player,
    dummy,
    events: [],
    bus: createCombatBus(),
    graph,
    itemsById,
    canAffect,
    pieces: [piece, amulet],
  };

  handler.onPrepare(piece, ctx);
  assert.equal(player.unhealing, 0.15, `source Unhealing applies during preparation on ${side}`);
  assert.equal(piece.speedScale, 0.3, `source Vampiric link count applies speed during preparation on ${side}`);

  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.stacks.vampirism, 1, `Blood Manipulation grants source Vampirism on cooldown on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'blood_manipulation'), `Blood Manipulation activates on cooldown on ${side}`);
}

console.log('OK Blood Manipulation focused smoke');
