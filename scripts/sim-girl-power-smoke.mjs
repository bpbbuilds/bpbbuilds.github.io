import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import affectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import classMasks from '../assets/data/item-class-masks.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/GirlPower.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func isAffectingDistinct\(color = Affected\.Primary\) -> bool:[\s\S]*return color == Affected\.Primary/);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.isClassItem\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(speed \* getNumDistinctAffectedItems\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*if curRegen < curEmpower:[\s\S]*giveRegeneration\(regen\)[\s\S]*elif curRegen > curEmpower:[\s\S]*giveEmpower\(empower\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.girl_power?.file, 'Exclusive/GirlPower.gd');
assert.equal(getScriptHandler('girl_power')?.handlerId, 'girl_power');

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
    kind: id === 'girl_power' ? 'skill' : 'weapon',
    cooldown: item?.cooldown ?? 0,
    baseCooldown: item?.cooldown ?? 0,
    ...overrides,
  };
}

function graph(sourcePiece, targets) {
  const pieces = new Map([[
    sourcePiece.placementKey,
    {
      key: sourcePiece.placementKey,
      id: sourcePiece.itemId,
      cells: [],
      affectCells: targets.map((target, index) => ({ cell: `link-${index}`, color: 'primary' })),
    },
  ]]);
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

function context(owner, foe, pieces, board, rng = () => 0) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph: board,
    itemsById: byId,
    canAffect: {
      rulesById: affectRules.byId,
      classMasks: classMasks.byId,
      classBits: classMasks.classBits,
    },
    events: [],
    bus,
    rng,
    t: 5,
  };
}

const handler = getScriptHandler('girl_power');

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const girl = piece('girl_power', `${side}:girl-power`, side);
  const classA = piece('lucky_clover', `${side}:class-a`, side);
  const classB = piece('carrot', `${side}:class-b`, side);
  const neutral = piece('wooden_sword', `${side}:neutral`, side);
  const pieces = [girl, classA, classB, neutral];
  const ctx = context(owner, foe, pieces, graph(girl, [classA, classB, neutral]));

  handler.onPrepare(girl, ctx);
  assert.ok(Math.abs(girl.speedScale - 0.7) < 1e-9, `Girl Power counts distinct primary class items only during preparation on ${side}`);

  grantStacks(owner, 'empower', 5, { originKey: 'test', originId: 'test' });
  grantStacks(owner, 'regeneration', 2, { originKey: 'test', originId: 'test' });
  handler.onCooldownEffect(girl, ctx);
  assert.equal(owner.stacks.regeneration, 4, `Girl Power raises Regeneration when it trails Empower on ${side}`);
  assert.equal(owner.stackGrantByOrigin.regeneration.girl_power, 2, `Girl Power preserves its buff origin on ${side}`);

  owner.stacks.empower = 2;
  owner.stacks.regeneration = 5;
  handler.onCooldownEffect(girl, ctx);
  assert.equal(owner.stacks.empower, 4, `Girl Power raises Empower when it trails Regeneration on ${side}`);

  owner.stacks.empower = 4;
  owner.stacks.regeneration = 4;
  handler.onCooldownEffect(girl, { ...ctx, rng: () => 0 });
  assert.equal(owner.stacks.regeneration, 6, `Girl Power chooses Regeneration on a tied low random roll on ${side}`);
  owner.stacks.empower = 4;
  owner.stacks.regeneration = 4;
  handler.onCooldownEffect(girl, { ...ctx, rng: () => 0.99 });
  assert.equal(owner.stacks.empower, 6, `Girl Power chooses Empower on a tied high random roll on ${side}`);

  const zero = piece('girl_power', `${side}:girl-power-zero`, side, {
    params: { regen: 0, p1: 0, empower: 0, p2: 0, speed: 0, p3: 0 },
  });
  const zeroCtx = context(owner, foe, [zero, classA, classB, neutral], graph(zero, [classA, classB, neutral]));
  handler.onPrepare(zero, zeroCtx);
  const speedBefore = zero.speedScale || 0;
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(zero.speedScale || 0, speedBefore, `Girl Power honors explicit zero speed on ${side}`);
  assert.equal(zeroCtx.events.at(-1)?.type, 'activate', `Girl Power still activates with zero buff values on ${side}`);
}

console.log('OK Girl Power source-backed class/distinct preparation, buff comparison branches, origin, both sides, and zero parameters');
