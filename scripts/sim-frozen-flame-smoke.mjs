import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FrozenFlame.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Ice\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*return item\.canDamage\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*heatCounter = 0[\s\S]*connectForCombat\(character\(\), "character_heat_changed", "onHeatChanged"\)[\s\S]*affected2Item = getFirstAffectedItem\(Affected\.Secondary\)[\s\S]*connectForCombat\(opponent\(\), "character_cold_changed", "onOpponentColdChanged"\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*var numAffected = getNumAffectedItems\(\)[\s\S]*giveBlock\(numAffected \* getBlock\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onHeatChanged\(amount, event\):[\s\S]*heatCounter \+= amount[\s\S]*var cold = int\(relHeat\) \* coldPerHeat[\s\S]*heatCounter %= heatNeeded[\s\S]*inflictCold\(cold, event\)/);
assert.match(source, /func onOpponentColdChanged\(amount, _event\):[\s\S]*affected2Item\.changeCritChancePercent\(amount \* getChance\(\)\)[\s\S]*affected2Item\.addCritSeverity\(amount \* critSeverityPerCold\)/);
assert.equal(inventory.byId.frozen_flame?.file, 'Exclusive/FrozenFlame.gd');
assert.equal(getScriptHandler('frozen_flame')?.handlerId, 'frozen_flame');

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
    kind: id === 'frozen_flame' ? 'passive' : 'weapon',
    damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0,
    critChance: 0,
    critSeverity: 2,
    ...overrides,
  };
}

function graph(sourcePiece, primaryTargets, secondaryTargets) {
  const targets = [
    ...primaryTargets.map((target) => ({ target, color: 'primary' })),
    ...secondaryTargets.map((target) => ({ target, color: 'secondary' })),
  ];
  const pieces = new Map([[sourcePiece.placementKey, {
    key: sourcePiece.placementKey,
    id: sourcePiece.itemId,
    cells: [],
    affectCells: targets.map((_, index) => ({ cell: `link-${index}`, color: targets[index].color })),
  }]]);
  const filled = new Map();
  targets.forEach(({ target }, index) => {
    pieces.set(target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(`link-${index}`, target.placementKey);
  });
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
  const flame = piece('frozen_flame', `${side}:frozen-flame`, side);
  const primaryIce = piece('frostbite', `${side}:primary-ice`, side, { damageMin: 8, damageMax: 8 });
  const secondaryWeapon = piece('broom', `${side}:secondary-weapon`, side, { damageMin: 10, damageMax: 10, kind: 'weapon' });
  const pieces = [flame, primaryIce, secondaryWeapon];
  const ctx = context(owner, foe, pieces, graph(flame, [primaryIce], [secondaryWeapon]));
  const handler = getScriptHandler('frozen_flame');

  handler.onPrepare(flame, ctx);
  assert.equal(flame._heatCounter, 0, `Frozen Flame resets its heat counter during preparation on ${side}`);
  handler.onCombatStart(flame, ctx);
  assert.equal(owner.block, 25, `Frozen Flame grants block only for primary Ice links on ${side}`);

  grantStacks(owner, 'heat', 5, { originKey: primaryIce.placementKey, originId: primaryIce.itemId });
  assert.equal(foe.stacks.cold || 0, 0, `Frozen Flame stores partial Heat below threshold on ${side}`);
  grantStacks(owner, 'heat', 1, { originKey: primaryIce.placementKey, originId: primaryIce.itemId });
  assert.equal(foe.stacks.cold, 2, `Frozen Flame converts each six Heat into P2 Cold on ${side}`);
  assert.equal(flame._heatCounter, 0, `Frozen Flame consumes its exact Heat threshold on ${side}`);
  assert.equal(secondaryWeapon.critChance, 3, `Frozen Flame adds P1 crit chance per opponent Cold on secondary item on ${side}`);
  assert.equal(secondaryWeapon.critSeverity, 2.04, `Frozen Flame adds P3 percent crit severity per opponent Cold on ${side}`);
  assert.equal(primaryIce.critChance, 0, `Frozen Flame does not modify its primary Ice target's crit chance on ${side}`);

  const overrideFlame = piece('frozen_flame', `${side}:frozen-flame-override`, side);
  const demonicFlask = piece('demonic_flask', `${side}:demonic-flask`, side, {
    kind: 'consumable',
    damageMin: 0,
    damageMax: 0,
  });
  const overrideCtx = context(
    owner,
    foe,
    [overrideFlame, demonicFlask],
    graph(overrideFlame, [], [demonicFlask]),
  );
  handler.onPrepare(overrideFlame, overrideCtx);
  grantStacks(foe, 'cold', 1, { originKey: overrideFlame.placementKey, originId: overrideFlame.itemId });
  assert.equal(demonicFlask.critChance, 1.5, `Frozen Flame honors source canDamage overrides on secondary items on ${side}`);

  const zero = piece('frozen_flame', `${side}:frozen-flame-zero`, side, {
    params: { heat: 0, p1: 0, cold: 0, p2: 0, critdam: 0, p3: 0 },
    block: 0,
    chance: 0,
  });
  const zeroTarget = piece('broom', `${side}:zero-target`, side, { damageMin: 10, damageMax: 10, kind: 'weapon' });
  const zeroCtx = context(owner, foe, [zero, zeroTarget], graph(zero, [], [zeroTarget]));
  handler.onPrepare(zero, zeroCtx);
  handler.onCombatStart(zero, zeroCtx);
  const coldBefore = foe.stacks.cold || 0;
  grantStacks(owner, 'heat', 1, { originKey: zero.placementKey, originId: zero.itemId });
  assert.equal(foe.stacks.cold || 0, coldBefore, `Frozen Flame zero Heat/Cold parameters do not divide or inflict invented Cold on ${side}`);
  assert.equal(zeroTarget.critChance, 0, `Frozen Flame zero crit chance parameter does not modify secondary items on ${side}`);
  assert.equal(zeroTarget.critSeverity, 2, `Frozen Flame zero crit severity parameter does not modify secondary items on ${side}`);
}

console.log('OK Frozen Flame source-backed primary Ice block, secondary damage listener, Heat-to-Cold threshold, crit modifiers, both sides, and zero parameters');
