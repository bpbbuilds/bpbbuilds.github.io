import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DragonskinBoots.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.dragonskin_boots?.file, 'Exclusive/DragonskinBoots.gd');
assert.equal(inventory.byId.dragonskin_boots?.extends, 'Item');
assert.deepEqual(inventory.byId.dragonskin_boots?.overrides, ['onPrepare']);
assert.equal(getScriptHandler('dragonskin_boots')?.handlerId, 'dragonskin_boots');
assert.match(source, /^extends Item/m);
assert.match(source, /func onPrepare\(\):[\s\S]*hasActivated = false[\s\S]*battle_rage_started[\s\S]*changeResistChance\(Game\.EventType\.Cold, getChance\(\)/);
assert.match(source, /func onBattleRageStarted\(event\):[\s\S]*cleanseRandomDebuffs\(getP1\(\), event\)[\s\S]*giveEmpower\(getP2\(\), event\)[\s\S]*giveBlock\(getBlock\(\), true, event\)/);

function piece(overrides = {}) {
  const item = byId.get('dragonskin_boots');
  return {
    ...item,
    itemId: 'dragonskin_boots',
    placementKey: 'you:boots',
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

function context(boots) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    pieces: [boots],
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
  const boots = piece();
  const ctx = context(boots);
  const handler = getScriptHandler('dragonskin_boots');
  assert.equal(typeof handler.onPrepare, 'function', 'source preparation hook is registered');
  assert.equal(handler.onCombatStart, undefined, 'source has no combat-start hook');
  handler.onPrepare(boots, ctx);
  assert.equal(ctx.player.stackResist.cold, 20, 'source chance grants Cold resistance during preparation');

  ctx.player.stacks.poison = 2;
  ctx.player.stacks.blind = 1;
  ctx.bus.emit('battle_rage_started', { actor: ctx.dummy, t: 5 });
  assert.equal(ctx.player.stacks.empower, 0, 'opponent Rage does not grant Empower');
  assert.equal(ctx.player.block, 0, 'opponent Rage does not grant Block');
  assert.equal(ctx.player.stacks.poison + ctx.player.stacks.blind, 3, 'opponent Rage does not cleanse debuffs');

  ctx.bus.emit('battle_rage_started', { actor: ctx.player, t: 6 });
  assert.equal(ctx.player.stacks.empower, 1, 'owner Rage grants source P2 Empower');
  assert.equal(ctx.player.block, 25, 'owner Rage grants catalog Block');
  assert.ok(ctx.player.stacks.poison + ctx.player.stacks.blind < 3, 'owner Rage cleanses source P1 debuffs');
}

{
  const boots = piece({ chance: 0, params: { p1: 0, p2: 0 } });
  const ctx = context(boots);
  getScriptHandler('dragonskin_boots').onPrepare(boots, ctx);
  assert.equal(ctx.player.stackResist.cold, 0, 'zero Cold chance remains zero');
  ctx.player.stacks.poison = 2;
  ctx.bus.emit('battle_rage_started', { actor: ctx.player, t: 5 });
  assert.equal(ctx.player.stacks.empower, 0, 'zero Empower remains zero');
  assert.equal(ctx.player.block, 25, 'zero typed parameters do not erase catalog Block');
  assert.equal(ctx.player.stacks.poison, 2, 'zero cleanse remains zero');
}

console.log('OK Dragonskin Boots source port');
