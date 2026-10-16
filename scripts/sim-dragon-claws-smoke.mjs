import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DragonClaws.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};

assert.equal(inventory.byId.dragon_claws?.file, 'Exclusive/DragonClaws.gd');
assert.equal(getScriptHandler('dragon_claws')?.handlerId, 'dragon_claws');
assert.match(source, /^extends Item/m);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*battle_rage_started[\s\S]*battle_rage_ended[\s\S]*changeResistChance\(Game\.EventType\.Poison/);
assert.match(source, /func onBattleRageStarted\(_event\):[\s\S]*item\.addSpeed\(getP1\(\) \/ 100\)/);
assert.match(source, /func onBattleRageEnded\(_event\):[\s\S]*item\.reduceSpeed\(getP1\(\) \/ 100\)/);

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: { ...(item?.params || {}) },
    side: 'you',
    alive: true,
    cooldown: item?.cooldown ?? 999,
    baseCooldown: item?.cooldown ?? 999,
    triggerTime: item?.cooldown ?? 999,
    ...overrides,
  };
}

function graphFor(claws, targets) {
  return {
    pieces: new Map([
      [claws.placementKey, {
        key: claws.placementKey,
        id: claws.itemId,
        cells: [],
        affectCells: targets.map((target, i) => ({ cell: `claw-${i}`, color: 'primary' })),
      }],
      ...targets.map((target) => [target.placementKey, {
        key: target.placementKey,
        id: target.itemId,
        cells: [],
        affectCells: [],
      }]),
    ]),
    filled: new Map(targets.map((target, i) => [`claw-${i}`, target.placementKey])),
  };
}

function context(claws, targets) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const pieces = [claws, ...targets];
  return {
    player,
    dummy,
    pieces,
    graph: graphFor(claws, targets),
    itemsById: byId,
    canAffect,
    events: [],
    bus,
    rng: () => 0,
    t: 5,
  };
}

{
  const claws = piece('dragon_claws', 'you:claws');
  const sword = piece('wooden_sword', 'you:sword');
  const deactivatedCooldown = piece('deer_totem', 'you:deer', {
    cooldown: 999,
    triggerTime: 999,
  });
  const potion = piece('health_potion', 'you:potion', { cooldown: 500, baseCooldown: 500 });
  const ctx = context(claws, [sword, deactivatedCooldown, potion]);
  const handler = getScriptHandler('dragon_claws');
  assert.equal(typeof handler?.onPrepare, 'function', 'source preparation hook is registered');
  assert.equal(handler?.onCombatStart, undefined, 'source has no combat-start hook');
  handler.onPrepare(claws, ctx);
  assert.equal(ctx.player.stackResist.poison, 10, 'source getChance poison resistance');

  ctx.bus.emit('battle_rage_started', { actor: ctx.dummy, t: 5 });
  assert.equal(sword.speedScale || 0, 0, 'opponent Rage is ignored');
  ctx.bus.emit('battle_rage_started', { actor: ctx.player, t: 6 });
  assert.equal(sword.speedScale, 0.4, 'linked cooldown item gains source P1 speed');
  assert.equal(deactivatedCooldown.speedScale, 0.4, 'static hasCooldown survives runtime deactivation');
  assert.equal(potion.speedScale || 0, 0, 'non-cooldown link is excluded');
  ctx.bus.emit('battle_rage_ended', { actor: ctx.player, t: 8 });
  assert.equal(sword.speedScale, 0, 'Rage end removes source speed');
  assert.equal(deactivatedCooldown.speedScale, 0, 'Rage end removes deactivated-item speed');
}

{
  const claws = piece('dragon_claws', 'you:zero-claws', {
    chance: 0,
    params: { p1: 0 },
  });
  const sword = piece('wooden_sword', 'you:zero-sword');
  const ctx = context(claws, [sword]);
  getScriptHandler('dragon_claws').onPrepare(claws, ctx);
  assert.equal(ctx.player.stackResist.poison, 0, 'zero source chance remains zero');
  ctx.bus.emit('battle_rage_started', { actor: ctx.player, t: 5 });
  assert.equal(sword.speedScale || 0, 0, 'zero source speed remains zero');
}

console.log('OK Dragon Claws source port');
