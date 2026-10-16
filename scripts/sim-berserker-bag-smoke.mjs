import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { startBattleRage, tickBattleRage } from '../js/pages/sim/engine/battle-rage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('berserker_bag');
assert.equal(typeof handler?.onPrepare, 'function', 'Berserker Bag binds during preparation');

for (const side of ['you', 'them']) {
  const bag = {
    itemId: 'berserker_bag',
    placementKey: `${side}:bag`,
    side,
    name: 'Berserker Bag',
    alive: true,
    params: { healtht: 50, speed_rage: 35, damresistance: 25, dur_rage: 1.5 },
  };
  const cooldownItem = {
    itemId: 'wooden_sword',
    placementKey: `${side}:cooldown`,
    side,
    name: 'Wooden Sword',
    cells: ['0,0'],
    cooldown: 2,
    baseCooldown: 2,
    speedScale: 0,
    alive: true,
  };
  const passiveItem = {
    itemId: 'passive',
    placementKey: `${side}:passive`,
    side,
    name: 'Passive Item',
    cells: ['0,0'],
    cooldown: 0,
    baseCooldown: 0,
    speedScale: 0,
    alive: true,
  };
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const opponent = createActor(side === 'you' ? 'dummy' : 'player');
  const bus = createCombatBus();
  const events = [];
  const ctx = {
    t: 2,
    player: owner,
    dummy: opponent,
    bus,
    events,
    graph: {
      pieces: new Map([
        [bag.placementKey, { key: bag.placementKey, id: bag.itemId, cells: ['0,0'], affectCells: [] }],
        [cooldownItem.placementKey, { key: cooldownItem.placementKey, id: cooldownItem.itemId, cells: cooldownItem.cells, affectCells: [] }],
        [passiveItem.placementKey, { key: passiveItem.placementKey, id: passiveItem.itemId, cells: passiveItem.cells, affectCells: [] }],
      ]),
      filled: new Map([['0,0', cooldownItem.placementKey]]),
    },
    pieces: [bag, cooldownItem, passiveItem],
    itemsById: new Map([
      [bag.itemId, { id: bag.itemId, type: 'Bag' }],
      [cooldownItem.itemId, { id: cooldownItem.itemId, type: 'Melee Weapon', cooldown: 2 }],
      [passiveItem.itemId, { id: passiveItem.itemId, type: 'Accessory' }],
    ]),
  };

  handler.onPrepare(bag, ctx);
  owner.hp = owner.maxHp / 2;
  bus.emit('character_damaged', { actor: owner, hit: true, t: 2 });
  assert.equal(owner.damageResistancePct, 0, `the exact source threshold does not trigger rage on ${side}`);
  owner.hp -= owner.maxHp * 0.001;
  bus.emit('character_damaged', { actor: owner, hit: true, t: 2.1 });
  assert.equal(owner.battleRage, true, `low health starts Battle Rage on ${side}`);
  assert.equal(owner.damageResistancePct, 25, `Battle Rage adds source resistance to its owner on ${side}`);
  assert.equal(cooldownItem.speedScale, 0.35, `Battle Rage speeds cooldown-capable contents on ${side}`);
  assert.equal(passiveItem.speedScale, 0, `Battle Rage ignores passive contents on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.actor === (side === 'you' ? 'player' : 'dummy') && event.meta?.handler === 'berserker_bag'), `Berserker Bag activates when rage starts on ${side}`);

  startBattleRage(opponent, 1, 2.2, { bus });
  assert.equal(owner.damageResistancePct, 25, `opponent Battle Rage does not affect this bag on ${side}`);
  tickBattleRage(owner, 3.6, { bus });
  assert.equal(owner.damageResistancePct, 0, `Battle Rage resistance ends with the owner rage on ${side}`);
  assert.equal(cooldownItem.speedScale, 0, `Battle Rage speed ends with the owner rage on ${side}`);
}

console.log('OK Berserker Bag focused smoke');
