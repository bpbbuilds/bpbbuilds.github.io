import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { startBattleRage } from '../js/pages/sim/engine/battle-rage.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Toolbox.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-hard.js', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.toolbox?.file, 'Exclusive/Toolbox.gd');
assert.deepEqual(inventory.byId.toolbox?.overrides, ['doCooldownEffect', 'onCombatStart', 'onPrepare']);
assert.match(source, /func canLockBag\(\):[\s\S]*return true/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.canBeEmpowered\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(opponent\(\), "character_attacked", "onOpponentDamaged"\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*getItemsInside\(\)[\s\S]*reduceSpeed\(speedReduction\)[\s\S]*addBonusDamageFactor\(damBonusFactor\)/);
assert.match(source, /func onOpponentDamaged\(damageRes: DamageResult\):[\s\S]*isBattleRaging\(\)[\s\S]*damageRes\.hasHit\(\)[\s\S]*damageRes\.damageSource\.canApplyLifesteal\(\)[\s\S]*ceil\(getP_m\("lifesteal"\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*startBattleRage\(self, getP_m\("dur_rage"\)\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(portSource, /handlerId: 'toolbox'/);
assert.match(portSource, /onPrepare\(piece, ctx\)/);
assert.match(portSource, /modifiedParamValue\(/);
assert.match(portSource, /afterEffectFinished\(piece, ctx, 'toolbox'/);

const catalogToolbox = byId.get('toolbox');
assert.equal(catalogToolbox?.params?.p1, catalogToolbox?.params?.speedreduction);
assert.equal(catalogToolbox?.params?.p2, catalogToolbox?.params?.dambonus);
assert.equal(catalogToolbox?.params?.p3, catalogToolbox?.params?.dur_rage);
assert.equal(catalogToolbox?.params?.p4, catalogToolbox?.params?.lifesteal);

const handler = getScriptHandler('toolbox');
assert.equal(handler?.handlerId, 'toolbox');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

function makeFixture(side = 'you') {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const opponent = createActor(side === 'you' ? 'dummy' : 'player');
  const bus = createCombatBus();
  const bagKey = `${side}:toolbox`;
  const weaponKey = `${side}:weapon`;
  const passiveKey = `${side}:passive`;
  const toolbox = {
    ...catalogToolbox,
    itemId: 'toolbox',
    placementKey: bagKey,
    name: 'Toolbox',
    kind: 'bag',
    side,
    alive: true,
    charges: 1,
    baseCooldown: 5,
    cooldown: 5,
    params: { p1: 15, p2: 25, p3: 4.75, p4: 50 },
    paramAdd: { lifesteal: 10, dur_rage: 0.5 },
  };
  const weapon = {
    itemId: 'wooden_sword',
    placementKey: weaponKey,
    name: 'Empowerable Sword',
    kind: 'weapon',
    side,
    cells: ['1,0'],
    damageMin: 5,
    damageMax: 10,
    speedScale: 0,
    bonusDamageFactor: 1,
    alive: true,
  };
  const passive = {
    itemId: 'passive',
    placementKey: passiveKey,
    name: 'Passive Item',
    kind: 'accessory',
    side,
    cells: ['2,0'],
    damageMin: 0,
    damageMax: 0,
    speedScale: 0,
    bonusDamageFactor: 1,
    alive: true,
  };
  const graph = {
    pieces: new Map([
      [bagKey, { key: bagKey, id: 'toolbox', cells: ['1,0', '2,0'], affectCells: [] }],
      [weaponKey, { key: weaponKey, id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
      [passiveKey, { key: passiveKey, id: 'passive', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['1,0', weaponKey],
      ['2,0', passiveKey],
    ]),
  };
  const events = [];
  const ctx = {
    t: 1,
    player: owner,
    dummy: opponent,
    bus,
    events,
    graph,
    pieces: [toolbox, weapon, passive],
    itemsById: new Map([
      ['toolbox', toolbox],
      ['wooden_sword', weapon],
      ['passive', passive],
    ]),
  };
  return { owner, opponent, bus, toolbox, weapon, passive, ctx };
}

for (const side of ['you', 'them']) {
  const { owner, opponent, bus, toolbox, weapon, passive, ctx } = makeFixture(side);
  handler.onPrepare(toolbox, ctx);
  handler.onCombatStart(toolbox, ctx);

  assert.equal(weapon.speedScale, -0.15, `Toolbox uses p1 speed reduction on ${side}`);
  assert.equal(weapon.bonusDamageFactor, 1.25, `Toolbox uses p2 bonus damage factor on ${side}`);
  assert.equal(passive.speedScale, 0, `Toolbox ignores non-empowerable speed targets on ${side}`);
  assert.equal(passive.bonusDamageFactor, 1, `Toolbox ignores non-empowerable damage targets on ${side}`);
  assert.equal(ctx.events.some((event) => event.type === 'activate'), false, `Toolbox aura does not activate at combat start on ${side}`);

  owner.hp = 100;
  startBattleRage(owner, 5, ctx.t, { bus, sourceId: toolbox.itemId });
  bus.emit('piece_dealt_damage', {
    piece: { side, placementKey: `${side}:weapon` },
    hit: { hit: true, damage: 20, healthDamage: 20 },
    t: 1.1,
  });
  assert.equal(owner.hp, 100, `Toolbox ignores the owner's own attack signal on ${side}`);

  bus.emit('character_damaged', {
    actor: owner,
    attacker: owner,
    t: 1.15,
    hit: true,
    healthDamage: 4,
    damage: { damage: 11, healthDamage: 4, damageSource: { canApplyLifesteal: true } },
  });
  assert.equal(owner.hp, 100, `Toolbox ignores owner-origin damage signals on ${side}`);

  bus.emit('character_damaged', {
    actor: owner,
    attacker: opponent,
    t: 1.2,
    hit: true,
    healthDamage: 4,
    damage: { damage: 11, healthDamage: 4, damageSource: { canApplyLifesteal: true } },
  });
  assert.equal(owner.hp, 107, `Toolbox uses modified lifesteal and full damage with ceil on ${side}`);

  bus.emit('character_damaged', {
    actor: owner,
    attacker: opponent,
    t: 1.3,
    hit: true,
    healthDamage: 4,
    damage: { damage: 11, healthDamage: 4, damageSource: { isEffectDamage: true } },
  });
  assert.equal(owner.hp, 107, `Toolbox rejects effect damage as non-lifesteal on ${side}`);

  const beforeCooldownEvents = ctx.events.length;
  assert.equal(handler.onCooldownEffect(toolbox, ctx), true, `Toolbox handles cooldown on ${side}`);
  assert.equal(owner.battleRage, true, `Toolbox starts Battle Rage on ${side}`);
  assert.equal(owner.battleRageUntil, 1 + 5.25, `Toolbox uses modified p3 rage duration on ${side}`);
  assert.equal(toolbox.alive, false, `Toolbox consumes through onAfterEffectFinished on ${side}`);
  assert.equal(toolbox.charges, 0, `Toolbox clears charges through onAfterEffectFinished on ${side}`);
  assert.equal(toolbox._cdLocked, true, `Toolbox locks its bag after the cooldown effect on ${side}`);
  assert.ok(ctx.events.slice(beforeCooldownEvents).some((event) => event.type === 'activate' && event.meta?.handler === 'toolbox'), `Toolbox activation is projected after rage starts on ${side}`);
}

const zero = makeFixture('you');
zero.toolbox.params = { p1: 0, p2: 0, p3: 0, p4: 0 };
zero.toolbox.paramAdd = {};
handler.onCooldownEffect(zero.toolbox, zero.ctx);
assert.equal(zero.owner.battleRage, undefined, 'zero Toolbox rage duration stays inert');
assert.equal(zero.toolbox._cdLocked, true, 'zero Toolbox still finishes and locks its bag');

console.log('OK Toolbox source, p-slot aura mapping, empowerable-only contents, opponent-hit lifesteal, modified parameters, Battle Rage, and Bag cleanup regression');
