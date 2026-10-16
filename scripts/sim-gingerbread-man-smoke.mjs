import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/GingerbreadMan.gd', 'utf8');
const foodSource = fs.readFileSync('tools/game-extract-full/Items/Food.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /extends Food/);
assert.match(foodSource, /func prepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* 0\.1\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMaxHealth\(\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*if character\(\)\.getLucky\(\) >= luckNeeded:[\s\S]*if character\(\)\.getHeat\(\) >= heatNeeded:[\s\S]*if character\(\)\.getMana\(\) >= manaNeeded:/);
assert.match(source, /useLucky\(luckNeeded\)[\s\S]*useHeat\(heatNeeded\)[\s\S]*useMana\(manaNeeded\)[\s\S]*giveEmpower\(getP5\(\)\)[\s\S]*giveRegeneration\(getP6\(\)\)/);
assert.match(source, /giveMaxHealth\(getP_m\("maxhealth_use"\)\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.gingerbread_man?.file, 'GingerbreadMan.gd');
assert.equal(getScriptHandler('gingerbread_man')?.handlerId, 'gingerbread_man');

function piece(side, overrides = {}) {
  const item = byId.get('gingerbread_man');
  return {
    ...item,
    itemId: 'gingerbread_man',
    placementKey: `${side}:gingerbread`,
    name: item?.name || 'Gingerbread Man',
    params: item?.params || {},
    side,
    alive: true,
    kind: 'food',
    cooldown: item?.cooldown ?? 3,
    baseCooldown: item?.cooldown ?? 3,
    ...overrides,
  };
}

function context(owner, foe, gingerbread) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces: [gingerbread],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: { rulesById: null },
    events: [],
    bus,
    rng: () => 0,
    t: 5,
  };
}

const handler = getScriptHandler('gingerbread_man');

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const gingerbread = piece(side);
  const ctx = context(owner, foe, gingerbread);

  handler.onCombatStart(gingerbread, ctx);
  assert.equal(owner.maxHp, 140, `Gingerbread Man grants source starting max health on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Gingerbread Man activates after starting max health on ${side}`);

  grantStacks(owner, 'lucky', 1, { originKey: 'source', originId: 'test' });
  grantStacks(owner, 'heat', 1, { originKey: 'source', originId: 'test' });
  grantStacks(owner, 'mana', 1, { originKey: 'source', originId: 'test' });
  handler.onCooldownEffect(gingerbread, ctx);
  assert.equal(owner.stacks.lucky, 0, `Gingerbread Man spends source Lucky on ${side}`);
  assert.equal(owner.stacks.heat, 0, `Gingerbread Man spends source Heat on ${side}`);
  assert.equal(owner.stacks.mana, 0, `Gingerbread Man spends source Mana on ${side}`);
  assert.equal(owner.stacks.empower, 1, `Gingerbread Man grants source Empower on ${side}`);
  assert.equal(owner.stacks.regeneration, 3, `Gingerbread Man grants source Regeneration on ${side}`);
  assert.equal(owner.maxHp, 160, `Gingerbread Man grants source cooldown max health on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Gingerbread Man activates after cooldown effects on ${side}`);

  gingerbread.paramMult = { maxhealth_use: 2 };
  grantStacks(owner, 'lucky', 1, { originKey: 'source', originId: 'test' });
  grantStacks(owner, 'heat', 1, { originKey: 'source', originId: 'test' });
  grantStacks(owner, 'mana', 1, { originKey: 'source', originId: 'test' });
  handler.onCooldownEffect(gingerbread, ctx);
  assert.equal(owner.maxHp, 200, `Gingerbread Man uses modified source maxhealth_use on ${side}`);

  const zero = piece(side, {
    placementKey: `${side}:gingerbread-zero`,
    params: {
      maxhealth: 0, p1: 0, luckt: 0, p2: 0, heatt: 0, p3: 0, manat: 0, p4: 0,
      empower: 0, p5: 0, regen: 0, p6: 0, maxhealth_use: 0, p7: 0,
    },
  });
  const zeroCtx = context(owner, foe, zero);
  const hpBefore = owner.maxHp;
  const empowerBeforeZero = owner.stacks.empower;
  const regenBeforeZero = owner.stacks.regeneration;
  handler.onCombatStart(zero, zeroCtx);
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(owner.maxHp, hpBefore, `Gingerbread Man honors explicit zero health parameters on ${side}`);
  assert.equal(owner.stacks.empower, empowerBeforeZero, `Gingerbread Man does not invent Empower from zero parameters on ${side}`);
  assert.equal(owner.stacks.regeneration, regenBeforeZero, `Gingerbread Man does not invent Regeneration from zero parameters on ${side}`);
}

console.log('OK Gingerbread Man source-backed Food preparation, nested resource gate, buff order, modified max health, both sides, and zero parameters');
