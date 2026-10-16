import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const row = inventory.byId.crow;
assert.ok(row);
assert.equal(row.file, 'Exclusive/Crow.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect', 'onPrepare']);
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Crow.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*hasCooldown\(\) or item\.inflictsDebuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*numActivations = 0/);
assert.match(source, /addSpeed\(speedBonus\)[\s\S]*changeAmplificiationChancePercent_allDebuffs/);
assert.equal(getScriptHandler('crow')?.handlerId, 'crow');

const crow = {
  itemId: 'crow',
  placementKey: 'crow',
  name: 'Crow',
  kind: 'pet',
  alive: true,
  params: { p1: 6, p2: 10, p3: 1, speed: 6, max: 10, luck: 1 },
  chance: 6,
  cooldown: 3,
  baseCooldown: 3,
};
const weapon = {
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  name: 'Wooden Sword',
  kind: 'weapon',
  alive: true,
  cooldown: 2,
  baseCooldown: 2,
  speedScale: 0,
};
const ivy = {
  itemId: 'poison_ivy',
  placementKey: 'ivy',
  name: 'Poison Ivy',
  kind: 'passive',
  alive: true,
  cooldown: 0,
  baseCooldown: 0,
  speedScale: 0,
  debuffAmpChance: 0,
};
const items = new Map([
  ['crow', { id: 'crow', type: 'Pet', params: crow.params }],
  ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
  ['poison_ivy', { id: 'poison_ivy', type: 'Accessory', extraTypes: ['Nature'] }],
]);
const ctx = {
  player: createActor('player'),
  dummy: createActor('dummy'),
  t: 3,
  events: [],
  pieces: [crow, weapon, ivy],
  itemsById: items,
  graph: {
    pieces: new Map([
      ['crow', { key: 'crow', id: 'crow', affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }],
      ['weapon', { key: 'weapon', id: 'wooden_sword', affectCells: [] }],
      ['ivy', { key: 'ivy', id: 'poison_ivy', affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'weapon'], ['2,0', 'ivy']]),
  },
  canAffect: null,
  rng: () => 0,
};
const handler = getScriptHandler('crow');
handler.onPrepare(crow, ctx);
assert.equal(crow._crowActs, 0);
ctx.dummy.stacks.lucky = 1;
handler.onCooldownEffect(crow, ctx);
assert.equal(crow._crowActs, 1);
assert.equal(weapon.speedScale, 0.06);
assert.equal(ivy.speedScale, 0.06);
assert.equal(weapon.debuffAmpChance, 6);
assert.equal(ivy.debuffAmpChance, 6);
assert.equal(ctx.dummy.stacks.lucky, 0);
assert.equal(ctx.player.stacks.lucky, 1);

// The shared grant path must carry an affected item's all-debuff amplification
// into its poison infliction, offsetting equal target resistance.
ctx.dummy.stackResist.poison = 6;
grantStacks(ctx.dummy, 'poison', 1, {
  piece: ivy,
  originKey: ivy.placementKey,
  originId: ivy.itemId,
  rng: () => 0,
});
assert.equal(ctx.dummy.stacks.poison, 1);

console.log('OK Crow source port');
