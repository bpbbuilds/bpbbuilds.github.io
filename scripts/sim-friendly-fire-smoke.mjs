import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FriendlyFire.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Fire\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumAffected_type\(Type\.Fire\) \* getP3\(\) \/ 100\.0\)[\s\S]*maxHeatReached = 0[\s\S]*connectForCombat\(character\(\), "character_heat_changed", "onHeatChanged"\)/);
assert.match(source, /func onHeatChanged\(_amount, event\):[\s\S]*threshold3[\s\S]*dealEffectDamage\(dam, event\)[\s\S]*threshold2[\s\S]*giveRegeneration\(getP7\(\), event\)[\s\S]*threshold1[\s\S]*giveLucky\(getP5\(\), event\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getMana\(\) >= manaNeeded[\s\S]*useMana\(manaNeeded\)[\s\S]*giveHeat\(getP2\(\)\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.friendly_fire?.file, 'Exclusive/FriendlyFire.gd');
assert.equal(getScriptHandler('friendly_fire')?.handlerId, 'friendly_fire');

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
    kind: 'pet',
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
  const fire = piece('friendly_fire', `${side}:friendly-fire`, side);
  const fireLink = piece('burning_coal', `${side}:fire`, side, { kind: 'passive' });
  const nonFire = piece('wooden_sword', `${side}:plain`, side, { kind: 'weapon' });
  const ctx = context(owner, foe, [fire, fireLink, nonFire], graph(fire, [fireLink, nonFire]));
  const handler = getScriptHandler('friendly_fire');

  owner.stacks.heat = 10;
  handler.onPrepare(fire, ctx);
  assert.equal(fire.speedScale, 0.1, `Friendly Fire counts linked Fire only on ${side}`);
  assert.equal(fire._ffMax, 0, `Friendly Fire starts with zero recorded heat threshold on ${side}`);
  assert.equal(owner.stacks.lucky, 0, `Friendly Fire does not retroactively trigger Lucky on ${side}`);

  grantStacks(owner, 'heat', 10, { originKey: `${side}:heat1`, originId: 'test' });
  assert.equal(owner.stacks.lucky, 5, `Friendly Fire threshold one grants source Lucky on ${side}`);
  assert.equal(fire._ffMax, 20, `Friendly Fire records threshold one maximum on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Friendly Fire activates after Lucky threshold on ${side}`);

  grantStacks(owner, 'heat', 20, { originKey: `${side}:heat2`, originId: 'test' });
  assert.equal(owner.stacks.regeneration, 15, `Friendly Fire threshold two grants source Regeneration on ${side}`);
  assert.equal(fire._ffMax, 40, `Friendly Fire records threshold two maximum on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Friendly Fire activates after Regeneration threshold on ${side}`);

  const hpBefore = foe.hp;
  grantStacks(owner, 'heat', 20, { originKey: `${side}:heat3`, originId: 'test' });
  assert.equal(foe.hp, hpBefore - 100, `Friendly Fire threshold three deals source damage on ${side}`);
  assert.equal(fire._ffMax, 60, `Friendly Fire records threshold three maximum on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Friendly Fire activates after damage threshold on ${side}`);

  const zero = piece('friendly_fire', `${side}:friendly-fire-zero`, side, {
    params: {
      manat: 0, p1: 0, heat: 0, p2: 0, speed: 0, p3: 0,
      heatt1: 0, p4: 0, luck: 0, p5: 0, heatt2: 0, p6: 0,
      regen: 0, p7: 0, heatt3: 0, p8: 0,
    },
  });
  const zeroCtx = context(owner, foe, [zero], graph(zero, []));
  handler.onPrepare(zero, zeroCtx);
  assert.equal(Number(zero.speedScale) || 0, 0, `Friendly Fire zero speed parameter on ${side}`);
  const zeroHp = foe.hp;
  const zeroEvents = zeroCtx.events.length;
  grantStacks(owner, 'heat', 1, { originKey: `${side}:zero`, originId: 'test' });
  assert.equal(foe.hp, zeroHp, `Friendly Fire zero damage threshold does not invent damage on ${side}`);
  assert.equal(zeroCtx.events.length, zeroEvents, `Friendly Fire zero thresholds do not invent effects on ${side}`);
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const fire = piece('friendly_fire', `${side}:cooldown`, side);
  const ctx = context(owner, foe, [fire], graph(fire, []));
  const handler = getScriptHandler('friendly_fire');
  owner.stacks.mana = 1;
  handler.onPrepare(fire, ctx);
  handler.onCooldownEffect(fire, ctx);
  assert.equal(owner.stacks.mana, 0, `Friendly Fire spends source Mana before activation on ${side}`);
  assert.equal(owner.stacks.heat, 2, `Friendly Fire grants source Heat before activation on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Friendly Fire cooldown activates after resource effects on ${side}`);
}

console.log('OK Friendly Fire source-backed Fire targeting, heat thresholds, exact effects, activation order, both sides, and zero parameters');
