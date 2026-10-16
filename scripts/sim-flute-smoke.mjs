import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Flute.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rules.byId || null };

assert.match(source, /func canAffect\(item\):[\s\S]*return true/);
assert.match(source, /func onPrepare\(\):[\s\S]*getP3\(\) \/ 100\.0 \* getNumAffectedItems\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveBlock\(\)[\s\S]*giveStamina\(getP1\(\)\)[\s\S]*giveLucky\(getP2\(\)\)/);
assert.equal(inventory.byId.flute?.file, 'Flute.gd');
assert.equal(getScriptHandler('flute')?.handlerId, 'flute');

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    side,
    alive: true,
    cooldown: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    triggerTime: item?.cooldown ?? 4,
    kind: 'passive',
    ...overrides,
  };
}

function graph(sourcePiece, targets) {
  const pieces = new Map([[sourcePiece.placementKey, {
    key: sourcePiece.placementKey,
    id: sourcePiece.itemId,
    cells: [],
    affectCells: targets.map((_, index) => ({ cell: `link-${index}`, color: 'primary' })),
  }]]);
  const filled = new Map();
  for (const [index, target] of targets.entries()) {
    pieces.set(target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(`link-${index}`, target.placementKey);
  }
  return { pieces, filled };
}

function context(owner, foe, pieces, board, rng) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph: board,
    itemsById: byId,
    canAffect,
    events: [],
    bus,
    rng,
    t: 5,
    activatePiece: () => true,
  };
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const flute = piece('flute', `${side}:flute`, side);
  const food = piece('banana', `${side}:food`, side);
  const peer = piece('wooden_sword', `${side}:peer`, side, { kind: 'weapon' });
  const ctx = context(owner, foe, [flute, food, peer], graph(flute, [food, peer]), () => 0);
  const handler = getScriptHandler('flute');

  handler.onPrepare(flute, ctx);
  assert.equal(flute.speedScale, 0.2, `Flute counts every affected item on ${side}`);
  assert.deepEqual(flute._fluteOpts, [0, 1, 2], `Flute resets choices on ${side}`);

  owner.block = 0;
  owner.stamina = 0;
  owner.stacks.lucky = 0;
  const rolls = [0, 0, 0.99];
  ctx.rng = () => rolls.shift() ?? 0;
  handler.onCooldownEffect(flute, ctx);
  assert.equal(owner.block, 14, `Flute block branch on ${side}`);
  handler.onCooldownEffect(flute, ctx);
  assert.equal(owner.stamina, 2, `Flute stamina branch on ${side}`);
  handler.onCooldownEffect(flute, ctx);
  assert.equal(owner.stacks.lucky, 2, `Flute Lucky branch on ${side}`);
  assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 3, `Flute activation count on ${side}`);

  const zero = piece('flute', `${side}:flute-zero`, side, { params: { p1: 0, p2: 0, p3: 0 } });
  const zeroCtx = context(owner, foe, [zero, food], graph(zero, [food]), () => 0);
  owner.stamina = 0;
  owner.stacks.lucky = 0;
  handler.onPrepare(zero, zeroCtx);
  assert.equal(Number(zero.speedScale) || 0, 0, `Flute zero speed parameter on ${side}`);
  zero._fluteOpts = [1];
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(owner.stamina, 0, `Flute zero stamina parameter on ${side}`);
  zero._fluteOpts = [2];
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(owner.stacks.lucky, 0, `Flute zero Lucky parameter on ${side}`);
}

console.log('OK Flute source-backed branches, affected-item speed, activation order, both sides, and zero parameters');
