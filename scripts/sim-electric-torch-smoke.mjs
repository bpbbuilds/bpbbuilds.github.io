import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ElectricTorch.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)/);
assert.match(source, /onready var blindAmount: = int\(getP\("blind"\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getP_m\("dur_blind"\)[\s\S]*giveStacksTemporary[\s\S]*blindAmount[\s\S]*onAfterEffectFinished\(\)/);
assert.match(source, /func onChargeReceived\(_charge\):[\s\S]*numCharges == 1[\s\S]*addSpeed\(speedBonus\)/);
assert.match(source, /func onChargeLeft\(_charge\):[\s\S]*numCharges == 0[\s\S]*reduceSpeed\(speedBonus\)/);

const handler = getScriptHandler('electric_torch');
assert.equal(typeof handler?.onPrepare, 'function', 'Electric Torch initializes during source preparation');
assert.equal(handler?.onCombatStart, undefined, 'Electric Torch does not defer source preparation to combat start');
assert.equal(typeof handler?.onChargeReceived, 'function', 'Electric Torch handles charge receipt');
assert.equal(typeof handler?.onChargeLeft, 'function', 'Electric Torch handles charge removal');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Electric Torch exposes its blind cooldown effect');

const torch = {
  itemId: 'electric_torch',
  placementKey: 'you:torch',
  name: 'Electric Torch',
  params: { blind: 3, speed: 20, dur_blind: 2.5 },
  numCharges: 0,
  speedScale: 0,
  alive: true,
  cooldown: 2,
  triggerTime: 2,
};
const weapon = {
  itemId: 'wooden_sword',
  placementKey: 'you:weapon',
  name: 'Wooden Sword',
  kind: 'weapon',
  speedScale: 0,
  cooldown: 0,
};
const passive = {
  itemId: 'leather_armor',
  placementKey: 'you:passive',
  name: 'Leather Armor',
  kind: 'armor',
  speedScale: 0,
  cooldown: 0,
};
const itemsById = new Map([
  [torch.itemId, { id: torch.itemId, type: 'Accessory' }],
  [weapon.itemId, { id: weapon.itemId, type: 'Melee Weapon', cooldown: 1.4 }],
  [passive.itemId, { id: passive.itemId, type: 'Armor', cooldown: null }],
]);
const graph = {
  pieces: new Map([
    [torch.placementKey, { key: torch.placementKey, id: torch.itemId, cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    [weapon.placementKey, { key: weapon.placementKey, id: weapon.itemId, cells: ['1,0'], affectCells: [] }],
    [passive.placementKey, { key: passive.placementKey, id: passive.itemId, cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', torch.placementKey],
    ['1,0', weapon.placementKey],
    ['2,0', passive.placementKey],
  ]),
};
const canAffect = {
  rulesById: { electric_torch: { primary: { op: 'hasCooldown' } } },
};

function makeContext(piece = torch) {
  return {
    t: 1,
    rng: () => 0,
    graph,
    itemsById,
    canAffect,
    pieces: [piece, weapon, passive],
    player: { id: 'you', stacks: { mana: 0, blind: 0 }, hp: 10, maxHp: 20 },
    dummy: { id: 'them', stacks: { blind: 0 }, hp: 20, maxHp: 20 },
    events: [],
  };
}

const ctx = makeContext();
handler.onPrepare(torch, ctx);
assert.equal(torch._torchCharged, false, 'source preparation clears the charged state');

torch.numCharges = 1;
handler.onChargeReceived(torch, ctx);
assert.equal(torch._torchCharged, true, 'the first charge activates the torch state');
assert.equal(weapon.speedScale, 0.2, 'the typed speed bonus applies to linked cooldown items');
assert.equal(passive.speedScale, 0, 'non-cooldown links are excluded by source canAffect');

torch.numCharges = 2;
handler.onChargeReceived(torch, ctx);
assert.equal(weapon.speedScale, 0.2, 'additional charges do not apply the first-charge speed twice');

torch.numCharges = 0;
handler.onChargeLeft(torch, ctx);
assert.equal(torch._torchCharged, false, 'the final charge removal clears the torch state');
assert.equal(weapon.speedScale, 0, 'the final charge removal reverses the exact speed bonus');

torch.numCharges = 1;
handler.onChargeReceived(torch, ctx);
assert.equal(weapon.speedScale, 0.2, 'the torch can re-arm after returning to zero charges');

const cooldownCtx = makeContext();
handler.onPrepare(torch, cooldownCtx);
handler.onCooldownEffect(torch, cooldownCtx);
assert.equal(cooldownCtx.dummy.stacks.blind, 3, 'cooldown applies the typed Blind amount');
assert.equal(cooldownCtx.dummy._tempStacks[0].expiresAt, 3.5, 'cooldown uses the typed Blind duration');
assert.equal(torch.alive, false, 'source onAfterEffectFinished consumes the torch');
assert.equal(torch.cooldown, 999, 'source onAfterEffectFinished deactivates future cooldowns');

const zeroTorch = {
  ...torch,
  params: { blind: 0, speed: 0, dur_blind: 0 },
  placementKey: 'you:torch-zero',
  alive: true,
  cooldown: 2,
  triggerTime: 2,
  numCharges: 0,
  speedScale: 0,
};
weapon.speedScale = 0;
const zeroCtx = makeContext(zeroTorch);
zeroCtx.graph = {
  ...graph,
  pieces: new Map([
    [zeroTorch.placementKey, { ...graph.pieces.get(torch.placementKey), key: zeroTorch.placementKey }],
    [weapon.placementKey, graph.pieces.get(weapon.placementKey)],
    [passive.placementKey, graph.pieces.get(passive.placementKey)],
  ]),
  filled: new Map([
    ['0,0', zeroTorch.placementKey],
    ['1,0', weapon.placementKey],
    ['2,0', passive.placementKey],
  ]),
};
handler.onPrepare(zeroTorch, zeroCtx);
zeroTorch.numCharges = 1;
handler.onChargeReceived(zeroTorch, zeroCtx);
assert.equal(zeroTorch._torchCharged, true, 'typed zero speed still activates the charged state');
assert.equal(weapon.speedScale, 0, 'typed zero speed remains zero');
handler.onCooldownEffect(zeroTorch, zeroCtx);
assert.equal(zeroCtx.dummy.stacks.blind, 0, 'typed zero Blind remains zero');
assert.equal(zeroCtx.dummy._tempStacks, undefined, 'typed zero duration creates no temporary debuff');

console.log('OK Electric Torch source port');
