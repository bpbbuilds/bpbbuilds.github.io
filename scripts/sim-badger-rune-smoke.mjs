import assert from 'node:assert/strict';

import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('badger_rune');
assert.equal(typeof handler?.onPrepare, 'function', 'Badger Rune applies its inventory preparation hook');

for (const side of ['you', 'them']) {
  const rune = { itemId: 'badger_rune', placementKey: `${side}:rune`, side, params: { stamina: 20, attackspeed: 10 } };
  const inventoryItem = { itemId: 'item', placementKey: `${side}:item`, side, staminaCost: 5, baseStaminaCost: 5, staminaFactor: 1 };
  const opponentItem = { itemId: 'opponent_item', placementKey: `${side}:opponent`, side: side === 'you' ? 'them' : 'you', staminaCost: 5, baseStaminaCost: 5, staminaFactor: 1 };
  handler.onPrepare(rune, { pieces: [rune, inventoryItem, opponentItem] });
  assert.equal(inventoryItem.staminaCost, 4, `owner inventory stamina is reduced by source P${side} on ${side}`);
  assert.equal(opponentItem.staminaCost, 5, `opponent inventory stamina is unchanged on ${side}`);

  const bus = createCombatBus();
  const host = { itemId: 'weapon', placementKey: `${side}:host`, side, kind: 'weapon', damageMin: 10, damageMax: 10, gemIds: ['badger_rune'], speedScale: 0 };
  const ctx = { t: 0, bus, pieces: [host], itemsById: new Map([[host.itemId, { id: host.itemId, type: 'Weapon' }], ['badger_rune', { id: 'badger_rune', type: 'Gem', params: { attackspeed: 10 }, name: 'Badger Rune' }]]) };
  prepareGemSockets(host, ctx);
  bus.emit('piece_dealt_damage', { piece: host, hit: { hit: true, damage: 10 }, t: 1 });
  assert.equal(host.speedScale, 0.1, `socketed weapon gains source attack speed after a hit on ${side}`);
}

console.log('OK Badger Rune focused smoke');
