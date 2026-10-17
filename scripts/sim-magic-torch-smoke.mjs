import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/MagicTorch.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-perm.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'magic_torch');

assert.ok(sourceItem, 'Magic Torch: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)/);
assert.match(source, /tryUseMana\(manaNeeded\)/);
assert.match(source, /addBonusDamage\(damBonus\)/);
assert.match(source, /for item in getAffectedItems\(\):[\s\S]*item\.addBonusDamage\(damBonus\)/);
assert.match(port, /handlerId: 'magic_torch'/);
assert.match(port, /onPreDealDamageEarly\(piece, ctx, res\)/);

const targetItem = {
  id: 'target_weapon',
  type: 'Melee Weapon',
  damageMin: 4,
  damageMax: 8,
};
const torch = {
  itemId: 'magic_torch',
  placementKey: 'torch',
  name: 'Magic Torch',
  params: { p1: 0, p2: 2 },
  damageMin: 3,
  damageMax: 6,
  empowerable: true,
  speedScale: 0,
};
const target = {
  itemId: targetItem.id,
  placementKey: 'target',
  name: 'Target Weapon',
  damageMin: targetItem.damageMin,
  damageMax: targetItem.damageMax,
  empowerable: true,
  kind: 'weapon',
};
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  pieces: [torch, target],
  itemsById: new Map([
    ['magic_torch', sourceItem],
    [targetItem.id, targetItem],
  ]),
  graph: {
    pieces: new Map([
      ['torch', { key: 'torch', id: 'magic_torch', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
      ] }],
      ['target', { key: 'target', id: targetItem.id, cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'torch'], ['1,0', 'target']]),
  },
  canAffect: {
    rulesById: {
      magic_torch: { primary: { op: 'canBeEmpowered' } },
    },
  },
};

const handler = getScriptHandler('magic_torch');
assert.equal(handler?.handlerId, 'magic_torch');
ctx.player.stacks.mana = 1;
const hit = { hit: true, damage: 10 };
handler.onPreDealDamageEarly(torch, ctx, hit);
assert.equal(ctx.player.stacks.mana, 1,
  'Magic Torch: zero Mana cost does not consume Mana');
assert.equal(hit.damage, 10,
  'Magic Torch: permanent bonus does not mutate the already-rolled hit');
assert.equal(torch.bonusDamage, 2,
  'Magic Torch: successful hit permanently empowers the torch');
assert.equal(target.bonusDamage, 2,
  'Magic Torch: successful hit permanently empowers linked empowerable items');

const insufficient = {
  ...torch,
  placementKey: 'insufficient',
  params: { p1: 2, p2: 2 },
  bonusDamage: 0,
};
const insufficientHit = { hit: true, damage: 10 };
ctx.player.stacks.mana = 1;
handler.onPreDealDamageEarly(insufficient, ctx, insufficientHit);
assert.equal(ctx.player.stacks.mana, 1,
  'Magic Torch: insufficient Mana leaves Mana unchanged');
assert.equal(insufficient.bonusDamage || 0, 0,
  'Magic Torch: insufficient Mana grants no permanent damage');

const miss = { ...torch, placementKey: 'miss', params: { p1: 2, p2: 2 }, bonusDamage: 0 };
ctx.player.stacks.mana = 3;
handler.onPreDealDamageEarly(miss, ctx, { hit: false, damage: 10 });
assert.equal(ctx.player.stacks.mana, 3,
  'Magic Torch: miss does not spend Mana');
assert.equal(miss.bonusDamage || 0, 0,
  'Magic Torch: miss grants no permanent damage');

console.log('Magic Torch source/parity smoke passed.');
