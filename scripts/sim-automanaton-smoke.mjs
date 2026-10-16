import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('automanaton');
assert.equal(typeof handler?.onPrepare, 'function', 'Automanaton installs its damage listener during preparation');

for (const side of ['you', 'them']) {
  const weapon = { itemId: 'automanaton', placementKey: `${side}:weapon`, params: { healtht: 50, speed: 20, dmgreduction: 15, dur_dmgreduction: 3, manat: 2, blind: 2, dur_blind: 4, cleanse: 1, chance2: 25 }, chance: 100, blockGrant: 6, damageMin: 8, damageMax: 8, staminaCost: 1, accuracy: 100 };
  const affected = { itemId: 'cooldown_item', placementKey: `${side}:affected`, cooldown: 2, speedScale: 0 };
  const manaItem = { itemId: 'mana_item', placementKey: `${side}:mana`, gainsMana: true, speedScale: 0 };
  const graph = { pieces: new Map([[weapon.placementKey, { key: weapon.placementKey, id: weapon.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }], [affected.placementKey, { key: affected.placementKey, id: affected.itemId, cells: ['1,0'], affectCells: [] }], [manaItem.placementKey, { key: manaItem.placementKey, id: manaItem.itemId, cells: ['2,0'], affectCells: [] }]]) , filled: new Map([['0,0', weapon.placementKey], ['1,0', affected.placementKey], ['2,0', manaItem.placementKey]]) };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const ctx = { t: 0, player, dummy, bus, events: [], rng: () => 0, pieces: [weapon, affected, manaItem], graph, itemsById: new Map([[weapon.itemId, { id: weapon.itemId, type: 'Weapon' }], [affected.itemId, { id: affected.itemId, type: 'Skill', cooldown: 2 }], [manaItem.itemId, { id: manaItem.itemId, type: 'Skill', gainsMana: true }]]), canAffect: null };

  handler.onPrepare(weapon, ctx);
  player.hp = 99.98;
  handler.onDealtDamage(weapon, ctx, { hit: true });
  assert.equal(weapon._autoLowHp, false, `dealing damage does not trigger source onDamaged on ${side}`);
  assert.equal(player.stacks.mana, 0, `source Mana cost is paid only from available Mana on ${side}`);

  grantStacks(player, 'mana', 3);
  player.stacks.poison = 1;
  player.stacks.cold = 1;
  handler.onDealtDamage(weapon, ctx, { hit: true });
  assert.equal(player.stacks.mana, 1, `a hit spends the source Mana requirement on ${side}`);
  assert.equal(dummy.stacks.blind, 2, `a qualifying hit applies source Blind on ${side}`);
  assert.equal(dummy.stunnedUntil, 1, `source chance can stun on ${side}`);

  player.hp = 90;
  bus.emit('character_damaged', { actor: player, t: 2 });
  assert.equal(weapon._autoLowHp, true, `taking damage below the source threshold activates once on ${side}`);
  assert.equal(affected.speedScale, 0.2, `low-health activation grants affected speed on ${side}`);
  assert.equal(affected.buffAmplificationChances.mana, 25, `low-health activation grants affected Mana amplification on ${side}`);
  assert.equal(manaItem.buffAmplificationChances.mana, 25, `low-health activation grants Mana-item amplification on ${side}`);
  assert.equal(player.damageResistancePct, 15, `low-health activation grants timed resistance on ${side}`);
  assert.equal(player.block, 6, `low-health activation grants source Block on ${side}`);
  bus.emit('character_damaged', { actor: player, t: 2.5 });
  assert.equal(affected.speedScale, 0.2, `low-health activation does not stack twice on ${side}`);
  tickTimedResistances([player], 5);
  assert.equal(player.damageResistancePct, 0, `source damage resistance expires after its timer on ${side}`);
}

console.log('OK Automanaton focused smoke');
