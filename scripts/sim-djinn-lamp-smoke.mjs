import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/DjinnLamp.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.djinn_lamp?.file, 'DjinnLamp.gd');
assert.equal(getScriptHandler('djinn_lamp')?.handlerId, 'djinn_lamp');
assert.match(source, /func onPrepare\(\):[\s\S]*affectedItems = getAffectedItems\(\)/);
assert.match(source, /connectForCombat\(character\(\), "character_block_changed", "checkStacks"\)/);
assert.match(source, /connectForCombat\(character\(\), "character_healed", "checkStacks"\)/);
assert.match(source, /if changeAmount > 0:/);
assert.match(source, /progress \+= min\(character\(\)\.getBlock\(\), stacksNeeded\) \/ float\(stacksNeeded\)/);
assert.match(source, /useBlock\(stacksNeeded, event\)/);
assert.match(source, /character\(\)\.loseHealth\(healthNeeded, self, event\)/);
assert.match(source, /affectedWeapon\.addBonusDamage\(bonusDamage\)/);
assert.match(source, /if numLucky < numSpikes:/);

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: { ...(item?.params || {}) },
    side,
    alive: true,
    cooldown: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    triggerTime: item?.cooldown ?? 4,
    damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0,
    kind: /weapon/i.test(item?.type || '') ? 'weapon' : 'passive',
    ...overrides,
  };
}

function fakeGraph(sourcePiece, target) {
  return {
    pieces: new Map([
      [sourcePiece.placementKey, {
        key: sourcePiece.placementKey,
        id: sourcePiece.itemId,
        cells: [],
        affectCells: [{ cell: 'lamp-link', color: 'primary' }],
      }],
      [target.placementKey, { key: target.placementKey, id: target.itemId, cells: [], affectCells: [] }],
    ]),
    filled: new Map([['lamp-link', target.placementKey]]),
  };
}

function context(owner, dummy, lamp, weapon, bus = createCombatBus()) {
  owner._combatBus = bus;
  dummy._combatBus = bus;
  owner._eventLog = [];
  dummy._eventLog = [];
  return {
    player: owner,
    dummy,
    pieces: [lamp, weapon],
    graph: fakeGraph(lamp, weapon),
    itemsById: byId,
    canAffect: null,
    events: [],
    bus,
    rng: () => 0,
    t: 5,
    activatePiece: () => true,
  };
}

function primeThreshold(owner, bus) {
  grantStacks(owner, 'block', 7, { originId: 'test' });
  grantStacks(owner, 'spikes', 7, { originId: 'test' });
  grantStacks(owner, 'mana', 7, { originId: 'test' });
  grantStacks(owner, 'lucky', 7, { originId: 'test' });
  owner.hp = 28;
  assert.ok(bus, 'combat bus available');
}

{
  const owner = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const lamp = piece('djinn_lamp', 'you:lamp');
  const weapon = piece('wooden_sword', 'you:weapon', 'you', { kind: 'weapon' });
  const bus = createCombatBus();
  const ctx = context(owner, dummy, lamp, weapon, bus);
  primeThreshold(owner, bus);

  getScriptHandler('djinn_lamp').onPrepare(lamp, ctx);
  bus.emit('character_mana_changed', { actor: owner, amount: -1 });
  assert.equal(lamp._djinnOn, false, 'negative source change does not activate');
  grantStacks(owner, 'regeneration', 1, { originId: 'unrelated' });
  assert.equal(lamp._djinnOn, false, 'unrelated buff does not activate');

  bus.emit('character_mana_changed', { actor: owner, amount: 1 });
  assert.equal(lamp._djinnOn, true, 'positive threshold change activates');
  assert.equal(weapon.bonusDamage, 27, 'source P3 damage bonus');
  assert.equal(owner.block, 0, 'block spent');
  assert.equal(owner.stacks.spikes, 0, 'spikes spent');
  assert.equal(owner.stacks.mana, 0, 'mana spent');
  assert.equal(owner.stacks.lucky, 0, 'Lucky spent');
  assert.equal(owner.hp, 1, 'source P2 health cost');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'activation follows source effects');
}

{
  const owner = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const lamp = piece('djinn_lamp', 'you:cooldown-lamp');
  const weapon = piece('wooden_sword', 'you:cooldown-weapon', 'you', { kind: 'weapon' });
  const ctx = context(owner, dummy, lamp, weapon);
  owner.stacks.lucky = 3;
  owner.stacks.spikes = 3;
  owner.stacks.mana = 5;
  getScriptHandler('djinn_lamp').onCooldownEffect(lamp, ctx);
  assert.equal(owner.stacks.spikes, 4, 'source tie picks Spikes before Mana');
  assert.equal(owner.stacks.mana, 5, 'source tie leaves Mana unchanged');

  owner.stacks.lucky = 2;
  owner.stacks.spikes = 3;
  owner.stacks.mana = 2;
  getScriptHandler('djinn_lamp').onCooldownEffect(lamp, ctx);
  assert.equal(owner.stacks.mana, 3, 'source nested tie picks Mana');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'cooldown activation follows grant');
}

{
  const owner = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const lamp = piece('djinn_lamp', 'you:zero-lamp', 'you', { params: { p1: 0, p2: 0, p3: 0 } });
  const weapon = piece('wooden_sword', 'you:zero-weapon', 'you', { kind: 'weapon' });
  const bus = createCombatBus();
  const ctx = context(owner, dummy, lamp, weapon, bus);
  primeThreshold(owner, bus);
  getScriptHandler('djinn_lamp').onPrepare(lamp, ctx);
  bus.emit('character_mana_changed', { actor: owner, amount: 1 });
  assert.equal(lamp._djinnOn, false, 'zero source thresholds are not replaced with one');
  assert.equal(weapon.bonusDamage || 0, 0, 'zero source damage remains zero');
  assert.equal(owner.stacks.mana, 7, 'zero threshold does not spend Mana');
}

console.log('OK Djinn Lamp source port');
