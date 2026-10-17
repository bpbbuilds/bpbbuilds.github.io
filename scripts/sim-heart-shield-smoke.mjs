import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/HeartShield.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*item\.giveBuffPower\(Game\.EventType\.Block, blockFactor\)[\s\S]*item\.changeHealAmp\(healamp\)[\s\S]*item\.changeAmplificiationChancePercent\(Game\.EventType\.Regeneration, getChance2\(\)\)/);
assert.match(source, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\), blockedDamageRes\.event\)[\s\S]*giveRegeneration\(regenOnBlock, blockedDamageRes\.event\)[\s\S]*regenGiven \+= regenOnBlock[\s\S]*activate\(\)/);
assert.match(source, /func onRegenChanged\(amount, event\):[\s\S]*useRegeneration\(regenNeeded, event\)[\s\S]*giveMaxHealth\(getP_m\("maxhealth"\), event2\)/);
assert.match(source, /func preTakeDamage\(damageRes: DamageResult\):[\s\S]*if activated:[\s\S]*damageRes\.damageSource\.isAttackOrEffect\(\)[\s\S]*rollChance\(\)/);
assert.equal(inventory.byId.heart_shield?.file, 'Exclusive/HeartShield.gd');
assert.equal(getScriptHandler('heart_shield')?.handlerId, 'heart_shield');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: 'you',
    kind: id === 'heart_shield' ? 'armor' : 'gadget',
    alive: true,
    blockGrant: Number(item.block) || 0,
    ...overrides,
  };
}

function graph(heart, targets) {
  const pieces = new Map([
    [heart.placementKey, { id: heart.itemId, cells: [], affectCells: targets.map((_, i) => ({ cell: `cell-${i}`, color: 'primary' })) }],
  ]);
  const filled = new Map();
  targets.forEach((target, i) => {
    pieces.set(target.placementKey, { id: target.itemId, cells: [], affectCells: [] });
    filled.set(`cell-${i}`, target.placementKey);
  });
  return { pieces, filled };
}

function context(player, pieces, board) {
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    rng: () => 0,
    events: [],
    t: 5,
    pieces,
    graph: board,
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('heart_shield');
const player = createActor('player', { maxHp: 100 });
const heart = piece('heart_shield', 'you:heart-shield');
const blocker = piece('wooden_buckler', 'you:blocker', { blockGrant: 10 });
const healer = piece('health_potion', 'you:healer', {
  params: { heal: 10, lifesteal: 5 },
});
const pieces = [heart, blocker, healer];
const ctx = context(player, pieces, graph(heart, [blocker, healer]));
handler.onPrepare(heart, ctx);
assert.equal(blocker.buffPowers.block, 1.3, 'Heart Shield adds source Block buff power to affected items');
assert.equal(healer.paramMult.heal, 1.3, 'Heart Shield changes affected heal parameters');
assert.equal(healer.paramMult.lifesteal, 1.3, 'Heart Shield changes affected lifesteal parameters');
assert.equal(healer.buffAmplificationChances.regeneration, 30, 'Heart Shield adds source Regeneration amplification');
assert.equal(player._healAmp, 0, 'Heart Shield does not apply affected-item healing amp globally');
assert.equal(player._shields?.length, 1, 'Heart Shield registers its source shield during preparation');

const shield = player._shields[0];
shield.afterBlock({ t: 5 });
assert.equal(player.stacks.regeneration, 1, 'Heart Shield gives source Regeneration after a block');
assert.equal(heart._regenGiven, 1);
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Heart Shield activates after its block effects');

grantStacks(player, 'regeneration', 6, { originKey: 'test', originId: 'test' });
assert.equal(player.stacks.regeneration, 0, 'Heart Shield spends the source regeneration threshold');
assert.equal(player.maxHp, 250, 'Heart Shield gives source max health');
assert.equal(player.hp, 250, 'Heart Shield heals by its max-health gain');
assert.equal(heart._heartActive, true, 'Heart Shield enters its active state at the threshold');

const damage = { damage: 25 };
ctx.bus.emit('pre_take_damage', {
  defender: player,
  damage,
  source: { isAttack: true, isMelee: false, isEffectDamage: false },
});
assert.equal(damage.damage, 5, 'Active Heart Shield blocks the source ranged/effect amount');

const zeroPlayer = createActor('player', { maxHp: 100 });
const zeroHeart = piece('heart_shield', 'you:heart-shield-zero', {
  chance: 0,
  chance2: 0,
  params: {
    damblock: 0,
    p1: 0,
    stamina: 0,
    p2: 0,
    block: 0,
    p3: 0,
    healamp: 0,
    p4: 0,
    regen: 0,
    p5: 0,
    max_regen: 0,
    p6: 0,
    regent: 0,
    p7: 0,
    maxhealth: 0,
    p8: 0,
  },
});
const zeroCtx = context(zeroPlayer, [zeroHeart], graph(zeroHeart, []));
handler.onPrepare(zeroHeart, zeroCtx);
grantStacks(zeroPlayer, 'regeneration', 1, { originKey: 'test', originId: 'test' });
assert.equal(zeroPlayer.maxHp, 100, 'Heart Shield honors explicit zero max health');
assert.equal(zeroPlayer.stacks.regeneration, 1, 'Heart Shield honors explicit zero threshold spend');
assert.equal(zeroHeart._heartActive, true, 'Heart Shield still fills on a positive regeneration change with zero threshold');
assert.equal(zeroHeart._regenGiven, 0, 'Heart Shield honors explicit zero regeneration-on-block');

console.log('OK Heart Shield source-backed preparation modifiers, block effects, threshold conversion, active damage block, and zero parameters');
