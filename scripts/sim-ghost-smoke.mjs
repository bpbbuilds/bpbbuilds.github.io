import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Ghost.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*character\(\)\.giveUnhealing\(unhealing\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*var useEvents = useRandomBuffs\(1\)[\s\S]*if useEvents != null:[\s\S]*heal\(getP_m\("heal"\), useEvents\[0\]\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.ghost?.file, 'Exclusive/Ghost.gd');
assert.equal(getScriptHandler('ghost')?.handlerId, 'ghost');

function piece(side = 'you', overrides = {}) {
  const item = byId.get('ghost');
  return {
    ...item,
    itemId: 'ghost',
    placementKey: `${side}:ghost`,
    name: item?.name || 'Ghost',
    params: item?.params || {},
    side,
    alive: true,
    kind: 'pet',
    cooldown: item?.cooldown ?? 3,
    baseCooldown: item?.cooldown ?? 3,
    ...overrides,
  };
}

function context(owner, foe, ghost) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces: [ghost],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: { rulesById: null },
    events: [],
    bus,
    rng: () => 0,
    t: 5,
  };
}

const handler = getScriptHandler('ghost');

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const ghost = piece(side);
  const ctx = context(owner, foe, ghost);

  handler.onPrepare(ghost, ctx);
  assert.equal(owner.unhealing, 0.3, `Ghost applies its source Unhealing during preparation on ${side}`);
  assert.equal(owner.stacks.lucky, 0, `Ghost does not consume a buff during preparation on ${side}`);

  owner.hp = 50;
  grantStacks(owner, 'lucky', 1, { originKey: 'source', originId: 'test' });
  ghost.paramMult = { heal: 2 };
  handler.onCooldownEffect(ghost, ctx);
  assert.equal(owner.stacks.lucky, 0, `Ghost spends exactly one random available buff on ${side}`);
  assert.equal(owner.hp, 74, `Ghost uses the modified source heal amount on ${side}`);
  const healIndex = ctx.events.findIndex((event) => event.type === 'heal');
  const activateIndex = ctx.events.findIndex((event) => event.type === 'activate');
  assert.ok(healIndex >= 0, `Ghost logs its heal even though activation is visual-only on ${side}`);
  assert.equal(ctx.events[healIndex].actor, side === 'you' ? 'player' : 'dummy', `Ghost heal event belongs to its owner on ${side}`);
  assert.equal(activateIndex > healIndex, true, `Ghost activates after spending and healing on ${side}`);

  ctx.events.length = 0;
  owner.hp = 50;
  handler.onCooldownEffect(ghost, ctx);
  assert.equal(ctx.events.some((event) => event.type === 'heal'), false, `Ghost does not heal without an available buff on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Ghost still activates when its random buff spend has no candidate on ${side}`);

  const zero = piece(side, {
    placementKey: `${side}:ghost-zero`,
    params: { unhealing: 0, p1: 0, heal: 0, p2: 0 },
  });
  const zeroCtx = context(owner, foe, zero);
  owner.unhealing = 0;
  owner.hp = 50;
  handler.onPrepare(zero, zeroCtx);
  grantStacks(owner, 'lucky', 1, { originKey: zero.placementKey, originId: zero.itemId });
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(owner.unhealing, 0, `Ghost honors an explicit zero Unhealing parameter on ${side}`);
  assert.equal(owner.hp, 50, `Ghost honors an explicit zero heal parameter on ${side}`);
}

console.log('OK Ghost source-backed preparation Unhealing, random buff spend, modified heal, activation order, and zero parameters');
