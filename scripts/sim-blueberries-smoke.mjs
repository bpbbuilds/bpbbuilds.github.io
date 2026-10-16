import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rules.byId || null };
const handler = getScriptHandler('blueberries');
assert.equal(typeof handler?.onPrepare, 'function', 'Blueberries inherits Food preparation speed');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const key = `${side}:blueberries`;
  const foodKey = `${side}:banana`;
  const graph = buildBoardGraph([
    { id: 'blueberries', key, x: 0, y: 0, r: 0 },
    { id: 'banana', key: foodKey, x: 0, y: -1, r: 0 },
  ], itemsById);
  const events = [];
  player._eventLog = events;
  const piece = {
    itemId: 'blueberries',
    placementKey: key,
    side,
    name: 'Blueberries',
    kind: 'food',
    params: { mana: 1, manat: 10, luck: 1 },
    speedScale: 0,
    cooldown: 3.5,
    alive: true,
  };
  const ctx = {
    t: 2,
    player,
    dummy,
    events,
    graph,
    itemsById,
    canAffect,
    rng: () => 0.5,
  };

  handler.onPrepare(piece, ctx);
  assert.equal(piece.speedScale, 0.1, `Blueberries inherits source Food speed preparation on ${side}`);

  player.stacks.mana = 9;
  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.stacks.mana, 10, `Blueberries fills Mana to the source cap on ${side}`);
  assert.equal(player.stacks.lucky, 0, `Blueberries does not grant Lucky without overflow on ${side}`);

  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.stacks.mana, 10, `Blueberries keeps Mana at the source cap on overflow on ${side}`);
  assert.equal(player.stacks.lucky, 1, `Blueberries grants Lucky only for source overflow on ${side}`);
  const ownerId = side === 'you' ? 'player' : 'dummy';
  assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'blueberries' && event.actor === ownerId).length, 2, `Blueberries activation is attributed to the owner on ${side}`);
}

console.log('OK Blueberries focused smoke');
