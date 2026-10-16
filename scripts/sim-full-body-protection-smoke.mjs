import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/FullBodyProtection.gd',
  'utf8',
);
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canBlock\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*item\.giveBuffPower\(Game\.EventType\.Block, blockAmp\)[\s\S]*connectForCombat\(character\(\), "pre_take_damage", "preTakeDamage"\)/);
assert.match(source, /func preTakeDamage\(damageRes: DamageResult\):[\s\S]*damageRes\.damageSource\.isAttackOrEffect\(\)[\s\S]*damageRes\.applyDamageReduction\(damReduction, self\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveBlock\(\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.full_body_protection?.file, 'Exclusive/FullBodyProtection.gd');
assert.equal(getScriptHandler('full_body_protection')?.handlerId, 'full_body_protection');

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
    kind: String(item?.type || '').toLowerCase() === 'armor' ? 'armor' : 'passive',
    blockGrant: Number(item?.block) || 0,
    baseCooldown: item?.cooldown ?? 4,
    cooldown: item?.cooldown ?? 4,
    ...overrides,
  };
}

function graph(sourcePiece, targets) {
  const pieces = new Map([
    [sourcePiece.placementKey, {
      key: sourcePiece.placementKey,
      id: sourcePiece.itemId,
      cells: [],
      affectCells: targets.map((_, index) => ({ cell: `link-${index}`, color: 'primary' })),
    }],
  ]);
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
  };
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const fullBody = piece('full_body_protection', `${side}:full-body`, side);
  const garlic = piece('garlic', `${side}:garlic`, side, { kind: 'food' });
  const armor = piece('leather_armor', `${side}:armor`, side);
  const helm = piece('leather_helm', `${side}:helm`, side, { kind: 'helmet' });
  const shoes = piece('leather_boots', `${side}:shoes`, side, { kind: 'shoes' });
  const pieces = [fullBody, garlic, armor, helm, shoes];
  const ctx = context(owner, foe, pieces, graph(fullBody, [garlic]));
  const handler = getScriptHandler('full_body_protection');

  handler.onPrepare(fullBody, ctx);
  assert.equal(garlic.buffPowers?.block, 1.35, `Full Body Protection applies source Block buff power during preparation on ${side}`);
  assert.equal(garlic.blockGrant, 3, `Full Body Protection does not flatten the target block tooltip on ${side}`);

  const attackDamage = { hit: true, damage: 20, damageReduction: 0, reductionSources: [] };
  ctx.bus.emit('pre_take_damage', {
    defender: owner,
    source: { isAttack: true },
    damage: attackDamage,
  });
  assert.equal(attackDamage.damageReduction, 8, `Full Body Protection applies source flat reduction per attack on ${side}`);
  assert.equal(attackDamage.reductionSources[0]?.amount, 8, `Full Body Protection records its per-hit reduction source on ${side}`);

  const effectDamage = { hit: true, damage: 20, damageReduction: 0, reductionSources: [] };
  ctx.bus.emit('pre_take_damage', {
    defender: owner,
    source: { isAttack: false, isEffectDamage: true },
    damage: effectDamage,
  });
  assert.equal(effectDamage.damageReduction, 8, `Full Body Protection applies source flat reduction to effect damage on ${side}`);

  const nonCombatDamage = { hit: true, damage: 20, damageReduction: 0, reductionSources: [] };
  ctx.bus.emit('pre_take_damage', {
    defender: owner,
    source: { isAttack: false, isEffectDamage: false },
    damage: nonCombatDamage,
  });
  assert.equal(nonCombatDamage.damageReduction, 0, `Full Body Protection ignores non-attack/non-effect damage on ${side}`);

  handler.onCooldownEffect(fullBody, ctx);
  assert.equal(owner.block, 10, `Full Body Protection gives its catalog Block on cooldown on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Full Body Protection activates after giving Block on ${side}`);
}

console.log('OK Full Body Protection source-backed preparation Block power, complete-set per-hit attack/effect reduction, cooldown Block, both sides, and exact source ordering');
