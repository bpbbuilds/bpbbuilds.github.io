import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ForestDragon.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Nature\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_regeneration_changed", "onRegenChanged"\)[\s\S]*addSpeed\(speedPerNature \* getNumAffectedItems\(\)/);
assert.match(source, /func onRegenChanged\(amount, event\):[\s\S]*changeVaryingDamage\(amount \* damPerRegen\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*giveRegeneration\(regen\)[\s\S]*giveLucky\(luck\)/);
assert.equal(inventory.byId.forest_dragon?.file, 'Exclusive/ForestDragon.gd');
assert.equal(getScriptHandler('forest_dragon')?.handlerId, 'forest_dragon');

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
  const dragon = piece('forest_dragon', `${side}:dragon`, side);
  const nature = piece('fly_agaric', `${side}:nature`, side);
  const nonNature = piece('wooden_sword', `${side}:other`, side);
  const ctx = context(owner, foe, [dragon, nature, nonNature], graph(dragon, [nature, nonNature]));
  const handler = getScriptHandler('forest_dragon');

  // Existing Regeneration is not retroactively converted; only the source
  // signal emitted after preparation changes varying damage.
  owner.stacks.regeneration = 3;
  handler.onPrepare(dragon, ctx);
  assert.equal(dragon.speedScale, 0.1, `Forest Dragon counts linked Nature only on ${side}`);
  assert.equal(dragon.bonusDamage || 0, 0, `Forest Dragon ignores pre-existing Regeneration on ${side}`);

  grantStacks(owner, 'regeneration', 2, { originKey: `${side}:regen`, originId: 'test' });
  assert.equal(dragon.bonusDamage, 1.4, `Forest Dragon keeps fractional regen damage on ${side}`);
  assert.equal(dragon.removableBonusDamage, 0, `Forest Dragon damage is non-removable on ${side}`);

  const beforeRegen = owner.stacks.regeneration;
  const beforeLucky = owner.stacks.lucky;
  handler.onPreDealDamageEarly(dragon, ctx, { hit: false });
  assert.equal(owner.stacks.regeneration, beforeRegen, `Forest Dragon misses do not grant Regeneration on ${side}`);
  assert.equal(owner.stacks.lucky, beforeLucky, `Forest Dragon misses do not grant Lucky on ${side}`);
  handler.onPreDealDamageEarly(dragon, ctx, { hit: true });
  assert.equal(owner.stacks.regeneration, beforeRegen + 1, `Forest Dragon hit grants Regeneration on ${side}`);
  assert.equal(owner.stacks.lucky, beforeLucky + 1, `Forest Dragon hit grants Lucky on ${side}`);

  const zero = piece('forest_dragon', `${side}:dragon-zero`, side, {
    params: { regen: 0, p1: 0, luck: 0, p2: 0, dam: 0, p3: 0, speed: 0, p4: 0 },
  });
  const zeroCtx = context(owner, foe, [zero, nature], graph(zero, [nature]));
  const damageBeforeZero = zero.bonusDamage || 0;
  handler.onPrepare(zero, zeroCtx);
  assert.equal(Number(zero.speedScale) || 0, 0, `Forest Dragon zero speed parameter on ${side}`);
  grantStacks(owner, 'regeneration', 1, { originKey: `${side}:zero`, originId: 'test' });
  assert.equal(zero.bonusDamage || 0, damageBeforeZero, `Forest Dragon zero damage parameter on ${side}`);
  const regenBeforeZeroHit = owner.stacks.regeneration;
  const luckyBeforeZeroHit = owner.stacks.lucky;
  handler.onPreDealDamageEarly(zero, zeroCtx, { hit: true });
  assert.equal(owner.stacks.regeneration, regenBeforeZeroHit, `Forest Dragon zero Regeneration parameter on ${side}`);
  assert.equal(owner.stacks.lucky, luckyBeforeZeroHit, `Forest Dragon zero Lucky parameter on ${side}`);
}

console.log('OK Forest Dragon source-backed Nature targeting, reactive varying damage, hit grants, both sides, and zero parameters');
