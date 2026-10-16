import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Frostbite.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*gaveVampirism = false[\s\S]*connectForCombat\(character\(\), "character_vampirism_changed", "onVampirismChanged"\)[\s\S]*connectForCombat\(opponent\(\), "character_cold_changed", "onOpponentColdChanged"\)/);
assert.match(source, /func onVampirismChanged\(amount, _event\):[\s\S]*changeVaryingDamage\(amount\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\) and rollChance\(\)[\s\S]*inflictCold\(getP1\(\)/);
assert.match(source, /func onOpponentColdChanged\(amount, event\):[\s\S]*changeVaryingDamage\(damagePerCold \* amount\)[\s\S]*opponent\(\)\.getCold\(\) >= coldNeeded[\s\S]*giveVampirism\(vampirism, event\)/);
assert.equal(inventory.byId.frostbite?.file, 'Exclusive/Frostbite.gd');
assert.equal(getScriptHandler('frostbite')?.handlerId, 'frostbite');

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
  const frostbite = piece('frostbite', `${side}:frostbite`, side);
  const ctx = context(owner, foe, [frostbite]);
  const handler = getScriptHandler('frostbite');

  owner.stacks.vampirism = 2;
  foe.stacks.cold = 5;
  handler.onPrepare(frostbite, ctx);
  assert.equal(frostbite.bonusDamage || 0, 0, `Frostbite ignores pre-existing Vampirism/Cold on ${side}`);

  grantStacks(owner, 'vampirism', 2, { originKey: `${side}:vamp`, originId: 'test' });
  assert.equal(frostbite.bonusDamage, 2, `Frostbite uses exact Vampirism varying damage on ${side}`);
  assert.equal(frostbite.removableBonusDamage, 0, `Frostbite Vampirism damage is non-removable on ${side}`);

  grantStacks(foe, 'cold', 10, { originKey: `${side}:cold1`, originId: 'test' });
  assert.equal(frostbite.bonusDamage, 6, `Frostbite uses fractional Cold damage scaling on ${side}`);
  assert.equal(owner.stacks.vampirism, 4, `Frostbite waits for the Cold threshold on ${side}`);

  grantStacks(foe, 'cold', 20, { originKey: `${side}:cold2`, originId: 'test' });
  assert.equal(frostbite.bonusDamage, 26, `Frostbite accumulates exact Cold and threshold Vampirism damage on ${side}`);
  assert.equal(frostbite.removableBonusDamage, 0, `Frostbite Cold damage remains non-removable on ${side}`);
  assert.equal(owner.stacks.vampirism, 16, `Frostbite grants source Vampirism at the Cold threshold on ${side}`);

  const coldBeforeHit = foe.stacks.cold;
  handler.onPreDealDamageEarly(frostbite, ctx, { hit: false });
  assert.equal(foe.stacks.cold, coldBeforeHit, `Frostbite misses do not inflict Cold on ${side}`);
  handler.onPreDealDamageEarly(frostbite, ctx, { hit: true });
  assert.equal(foe.stacks.cold, coldBeforeHit + 1, `Frostbite inflicts Cold in the early hit hook on ${side}`);

  const zero = piece('frostbite', `${side}:frostbite-zero`, side, {
    params: { p1: 0, dam: 0, p2: 0, p3: 30, vampirism: 0, p4: 0 },
    chance: 0,
  });
  const zeroCtx = context(owner, foe, [zero]);
  handler.onPrepare(zero, zeroCtx);
  const zeroDamage = zero.bonusDamage || 0;
  grantStacks(foe, 'cold', 30, { originKey: `${side}:zero-cold`, originId: 'test' });
  assert.equal(zero.bonusDamage || 0, zeroDamage, `Frostbite zero Cold multiplier remains zero on ${side}`);
  assert.equal(owner.stacks.vampirism, 16, `Frostbite zero Vampirism parameter does not invent a grant on ${side}`);
  handler.onPreDealDamageEarly(zero, zeroCtx, { hit: true });
  assert.equal(foe.stacks.cold, coldBeforeHit + 31, `Frostbite zero Cold parameter does not invent a hit effect on ${side}`);
}

console.log('OK Frostbite source-backed preparation listeners, exact Vampirism/Cold damage, early Cold infliction, threshold Vampirism, both sides, and zero parameters');
