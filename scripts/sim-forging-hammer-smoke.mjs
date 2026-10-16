import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ForgingHammer.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_empower_changed", "onEmpowerChanged"\)/);
assert.match(source, /func onEmpowerChanged\(amount, _event\):[\s\S]*changeVaryingDamage\(amount \* getP1\(\)/);
assert.equal(inventory.byId.forging_hammer?.file, 'Exclusive/ForgingHammer.gd');
assert.equal(getScriptHandler('forging_hammer')?.handlerId, 'forging_hammer');

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
    kind: 'weapon',
    ...overrides,
  };
}

function context(owner, foe, pieces) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: { rulesById: null },
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
  const hammer = piece('forging_hammer', `${side}:hammer`, side);
  const ctx = context(owner, foe, [hammer]);
  const handler = getScriptHandler('forging_hammer');

  handler.onPrepare(hammer, ctx);
  grantStacks(owner, 'empower', 3, { originKey: `${side}:empower`, originId: 'test' });
  assert.equal(hammer.bonusDamage, 3, `Forging Hammer follows Empower delta on ${side}`);
  assert.equal(hammer.removableBonusDamage, 0, `Forging Hammer varying damage is non-removable on ${side}`);

  spendStacks(owner, 'empower', 1, { originKey: `${side}:spend`, originId: 'test' });
  assert.equal(hammer.bonusDamage, 2, `Forging Hammer handles negative Empower delta on ${side}`);
  assert.equal(hammer.removableBonusDamage, 0, `Forging Hammer keeps negative delta out of removable damage on ${side}`);

  const zero = piece('forging_hammer', `${side}:hammer-zero`, side, { params: { p1: 0 } });
  const zeroCtx = context(owner, foe, [zero]);
  handler.onPrepare(zero, zeroCtx);
  const damageBeforeZero = zero.bonusDamage || 0;
  grantStacks(owner, 'empower', 1, { originKey: `${side}:zero`, originId: 'test' });
  assert.equal(zero.bonusDamage || 0, damageBeforeZero, `Forging Hammer zero Empower multiplier on ${side}`);
}

console.log('OK Forging Hammer source-backed Empower deltas, non-removable damage, both sides, and zero parameter');
