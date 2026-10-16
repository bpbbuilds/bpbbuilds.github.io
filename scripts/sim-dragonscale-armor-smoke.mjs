import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DragonscaleArmor.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.dragonscale_armor?.file, 'Exclusive/DragonscaleArmor.gd');
assert.equal(inventory.byId.dragonscale_armor?.extends, 'Item');
assert.deepEqual(inventory.byId.dragonscale_armor?.overrides, ['onPrepare']);
assert.equal(getScriptHandler('dragonscale_armor')?.handlerId, 'dragonscale_armor');
assert.match(source, /^extends Item/m);
assert.match(source, /func onPrepare\(\):[\s\S]*battle_rage_started[\s\S]*battle_rage_ended/);
assert.match(source, /func onBattleRageStarted\(event\):[\s\S]*giveBlock\(getBlock\(\), true, event\)[\s\S]*changeDamageResistance\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onBattleRageEnded\(_event\):[\s\S]*changeDamageResistance\( - getP1\(\)\)/);

function piece(overrides = {}) {
  const item = byId.get('dragonscale_armor');
  return {
    ...item,
    itemId: 'dragonscale_armor',
    placementKey: 'you:armor',
    name: item.name,
    params: { ...(item.params || {}) },
    side: 'you',
    alive: true,
    cooldown: 999,
    baseCooldown: 999,
    triggerTime: 999,
    blockGrant: item.block,
    ...overrides,
  };
}

function context(armor) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    pieces: [armor],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
    events: [],
    bus,
    rng: () => 0,
    t: 5,
  };
}

{
  const armor = piece();
  const ctx = context(armor);
  const handler = getScriptHandler('dragonscale_armor');
  assert.equal(typeof handler.onPrepare, 'function', 'source preparation hook is registered');
  assert.equal(handler.onCombatStart, undefined, 'source has no combat-start hook');
  handler.onPrepare(armor, ctx);

  ctx.bus.emit('battle_rage_started', { actor: ctx.dummy, t: 5 });
  assert.equal(ctx.player.block, 0, 'opponent Rage does not grant this armor Block');
  assert.equal(ctx.player.damageResistancePct, 0, 'opponent Rage does not add this armor resistance');
  assert.equal(ctx.events.length, 0, 'opponent Rage does not activate this armor');

  ctx.bus.emit('battle_rage_started', { actor: ctx.player, t: 6 });
  assert.equal(ctx.player.block, 55, 'owner Rage grants catalog Block');
  assert.equal(ctx.player.damageResistancePct, 8, 'owner Rage adds source P1 resistance');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'Block/resistance land before activation');
  ctx.bus.emit('battle_rage_ended', { actor: ctx.player, t: 8 });
  assert.equal(ctx.player.damageResistancePct, 0, 'owner Rage end removes exactly source P1 resistance');
}

{
  const armor = piece({ params: { p1: 0, damreduction: 0 } });
  const ctx = context(armor);
  getScriptHandler('dragonscale_armor').onPrepare(armor, ctx);
  ctx.bus.emit('battle_rage_started', { actor: ctx.player, t: 5 });
  assert.equal(ctx.player.damageResistancePct, 0, 'zero resistance remains zero');
  ctx.bus.emit('battle_rage_ended', { actor: ctx.player, t: 8 });
  assert.equal(ctx.player.damageResistancePct, 0, 'zero resistance reversal remains zero');
}

console.log('OK Dragonscale Armor source port');
