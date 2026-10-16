import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/FlyAgaric.gd', 'utf8');
const foodSource = fs.readFileSync('tools/game-extract-full/Items/Food.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rules.byId || null };

assert.match(source, /extends Food/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictPoison\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(foodSource, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Food\)[\s\S]*item\.descriptor != descriptor/);
assert.match(foodSource, /func prepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* 0\.1\)/);
assert.equal(inventory.byId.fly_agaric?.file, 'FlyAgaric.gd');
assert.equal(getScriptHandler('fly_agaric')?.handlerId, 'fly_agaric');

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

function context(owner, foe, pieces, board) {
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
    rng: () => 0,
    t: 5,
    activatePiece: () => true,
  };
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const agaric = piece('fly_agaric', `${side}:agaric`, side);
  const food = piece('banana', `${side}:food`, side);
  const weapon = piece('wooden_sword', `${side}:weapon`, side, { kind: 'weapon' });
  const ctx = context(owner, foe, [agaric, food, weapon], graph(agaric, [food, weapon]));
  const handler = getScriptHandler('fly_agaric');

  handler.onPrepare(agaric, ctx);
  assert.equal(agaric.speedScale, 0.1, `Fly Agaric only speeds for affected Food on ${side}`);
  handler.onCooldownEffect(agaric, ctx);
  assert.equal(foe.stacks.poison, 1, `Fly Agaric poison on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Fly Agaric activation order on ${side}`);

  const zero = piece('fly_agaric', `${side}:agaric-zero`, side, { params: { p1: 0 } });
  const zeroCtx = context(owner, foe, [zero, food], graph(zero, [food]));
  foe.stacks.poison = 0;
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(foe.stacks.poison, 0, `Fly Agaric zero poison parameter on ${side}`);
  assert.equal(zeroCtx.events.at(-1)?.type, 'activate', `Fly Agaric still activates after zero effect on ${side}`);
}

console.log('OK Fly Agaric Food-only preparation, poison effect, activation order, both sides, and zero parameters');
