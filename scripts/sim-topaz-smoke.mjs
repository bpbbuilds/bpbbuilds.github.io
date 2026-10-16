import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Gems/Topaz.gd', 'utf8');
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const tiers = ['chipped_topaz', 'flawed_topaz', 'regular_topaz', 'flawless_topaz', 'perfect_topaz'];

assert.match(source, /func prepareInventory\(\):[\s\S]*giveStaminaRegeneration\(getP2\(\) \/ 100\.0\)/);
assert.match(source, /func prepareWeapon\(\):[\s\S]*socket\.getItem\(\)\.addSpeed\(getP1\(\) \/ 100\)/);
assert.match(source, /func prepareArmor\(\):[\s\S]*changeStunResistance\(getGemPower\(\) \* getChance\(\)[\s\S]*changeCritResistance\(getGemPower\(\) \* getChance2\(\)/);

for (const id of tiers) {
  const row = inventory.byId[id];
  const gem = byId.get(id);
  assert.equal(row?.file, 'Gems/Topaz.gd', `${id} uses Topaz.gd`);
  assert.equal(row?.extends, 'Gem', `${id} extends Gem`);
  assert.ok(gem, `${id} has catalog data`);
  assert.equal(typeof getScriptHandler(id)?.onPrepare, 'function', `${id} has loose prepare handler`);

  const owner = createActor('player');
  const events = [];
  const handler = getScriptHandler(id);
  handler.onPrepare(
    {
      itemId: id,
      placementKey: `${id}:inventory`,
      name: gem.name,
      side: 'you',
      params: { ...gem.params, staminaregen: 99 },
    },
    { player: owner, dummy: createActor('dummy'), events, t: 0 },
  );
  const expectedRegen = 1 + Number(gem.params?.p2 || 0) / 100;
  assert.equal(owner.staminaRegen, expectedRegen, `${id} loose inventory uses source p2, not a named alias`);

  const weaponGem = {
    ...gem,
    params: { ...gem.params, attackspeed: 99 },
    gemPower: 2,
    bonusChanceAdd1: 10,
    bonusChanceAdd2: 5,
  };
  const weapon = {
    itemId: 'wooden_sword',
    placementKey: `${id}:weapon`,
    kind: 'weapon',
    gemIds: [id],
    speedScale: 0,
  };
  const weaponItems = new Map([
    ['wooden_sword', byId.get('wooden_sword')],
    [id, weaponGem],
  ]);
  prepareGemSockets(weapon, {
    player: createActor('player'),
    dummy: createActor('dummy'),
    bus: createCombatBus(),
    itemsById: weaponItems,
    events: [],
    rng: () => 0,
    t: 0,
  });
  assert.equal(weapon.speedScale, Number(gem.params?.p1 || 0) / 100, `${id} weapon socket uses source p1, not a named alias`);

  const armorOwner = createActor('player');
  const armor = {
    itemId: 'leather_armor',
    placementKey: `${id}:armor`,
    kind: 'armor',
    gemIds: [id],
  };
  const armorItems = new Map([
    ['leather_armor', byId.get('leather_armor')],
    [id, weaponGem],
  ]);
  prepareGemSockets(armor, {
    player: armorOwner,
    dummy: createActor('dummy'),
    bus: createCombatBus(),
    itemsById: armorItems,
    events: [],
    rng: () => 0,
    t: 0,
  });
  const expectedStun = 2 * (Number(gem.chance) + 10);
  const expectedCrit = 2 * (Number(gem.chance2) + 5);
  assert.equal(armorOwner.stunResistance, expectedStun, `${id} armor uses modified getChance with GemPower`);
  assert.equal(armorOwner.critResistance, expectedCrit, `${id} armor uses modified getChance2 with GemPower`);
}

const zero = byId.get('perfect_topaz');
const zeroOwner = createActor('player');
const zeroArmor = { itemId: 'leather_armor', placementKey: 'zero:armor', kind: 'armor', gemIds: ['perfect_topaz'] };
prepareGemSockets(zeroArmor, {
  player: zeroOwner,
  dummy: createActor('dummy'),
  bus: createCombatBus(),
  itemsById: new Map([
    ['leather_armor', byId.get('leather_armor')],
    ['perfect_topaz', { ...zero, chance: 0, chance2: 0, gemPower: -2 }],
  ]),
  events: [],
  rng: () => 0,
  t: 0,
});
assert.equal(zeroOwner.stunResistance, 0, 'zero/negative Topaz GemPower and chance stay inert');
assert.equal(zeroOwner.critResistance, 0, 'zero/negative Topaz GemPower and chance2 stay inert');

console.log('OK Topaz source, all tiers, positional inventory/weapon parameters, modified armor chances, GemPower scaling, and zero-safe regression');
