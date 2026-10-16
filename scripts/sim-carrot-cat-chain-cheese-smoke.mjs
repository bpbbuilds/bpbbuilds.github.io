import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { startBattleRage } from '../js/pages/sim/engine/battle-rage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const sources = {
  carrot: fs.readFileSync('tools/game-extract-full/Items/Carrot.gd', 'utf8'),
  cat: fs.readFileSync('tools/game-extract-full/Items/Exclusive/CatSpirit.gd', 'utf8'),
  chain: fs.readFileSync('tools/game-extract-full/Items/Exclusive/ChainWhip.gd', 'utf8'),
  cheese: fs.readFileSync('tools/game-extract-full/Items/Exclusive/Cheese.gd', 'utf8'),
  cheeseGoobert: fs.readFileSync('tools/game-extract-full/Items/Exclusive/CheeseGoobert.gd', 'utf8'),
};
assert.match(sources.carrot, /cleanseRandomDebuffs\(1\)[\s\S]*activate\(\)/);
assert.match(sources.cat, /func onPrepare\(\)[\s\S]*addCritChancePercent/);
assert.match(sources.cat, /useMana\(manaNeeded\)[\s\S]*giveLucky[\s\S]*giveEmpower[\s\S]*activate/);
assert.match(sources.chain, /func onPrepare\(\)[\s\S]*connectToOpponentBuffs/);
assert.match(sources.chain, /func onPreDealDamage_early/);
assert.match(sources.cheese, /giveMaxHealth\(\)[\s\S]*giveRandomBuffs[\s\S]*activate/);
assert.match(sources.cheeseGoobert, /giveMaxHealth\(\)[\s\S]*giveRandomBuffs/);

function graphFor(sourceId, targetId, sourceKey, targetKey) {
  return {
    pieces: new Map([
      [sourceKey, { id: sourceId, cells: ['0,0'], affectCells: [] }],
      [targetKey, { id: targetId, cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', sourceKey],
      ['1,0', targetKey],
    ]),
  };
}

const carrot = getScriptHandler('carrot');
assert.equal(typeof carrot?.onCooldownEffect, 'function');
const carrotPlayer = createActor('player');
const carrotDummy = createActor('dummy');
carrotPlayer.stacks.lucky = 4;
grantStacks(carrotPlayer, 'poison', 1, { rng: () => 0 });
const carrotEvents = [];
const carrotPiece = {
  itemId: 'carrot',
  name: 'Carrot',
  placementKey: 'carrot',
  params: { p2: 4 },
  chance: 55,
};
carrot.onCooldownEffect(carrotPiece, {
  player: carrotPlayer,
  dummy: carrotDummy,
  events: carrotEvents,
  rng: () => 0,
  t: 3,
});
assert.equal(carrotPlayer.stacks.poison, 0, 'Carrot cleanses one debuff');
assert.equal(carrotPlayer.stacks.empower, 1, 'Carrot grants Empower after the Lucky gate');
assert.ok(
  carrotEvents.findIndex((event) => event.type === 'activate') >
    carrotEvents.findIndex((event) => event.meta?.stack === 'empower'),
  'Carrot activates after its source effects',
);

const cat = getScriptHandler('cat_spirit');
assert.equal(typeof cat?.onPrepare, 'function');
const catPlayer = createActor('player');
const catDummy = createActor('dummy');
const catPiece = {
  itemId: 'cat_spirit',
  name: 'Cat Spirit',
  placementKey: 'cat',
  params: { manat: 1, luck: 1, empower: 1 },
  chance: 25,
  kind: 'pet',
};
const catWeapon = {
  itemId: 'wooden_sword',
  name: 'Wooden Sword',
  placementKey: 'weapon',
  kind: 'weapon',
  damageMax: 5,
  critChance: 0,
};
const catItems = new Map([
  ['cat_spirit', { id: 'cat_spirit', chance: 25 }],
  ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
]);
const catGraph = graphFor('cat_spirit', 'wooden_sword', 'cat', 'weapon');
cat.onPrepare(catPiece, {
  player: catPlayer,
  dummy: catDummy,
  graph: catGraph,
  itemsById: catItems,
  pieces: [catPiece, catWeapon],
  canAffect: null,
});
assert.equal(catWeapon.critChance, 25, 'Cat Spirit buffs linked damage-capable items during preparation');
grantStacks(catPlayer, 'mana', 1, { rng: () => 0 });
const catEvents = [];
cat.onCooldownEffect(catPiece, {
  player: catPlayer,
  dummy: catDummy,
  events: catEvents,
  rng: () => 0,
  t: 4,
});
assert.equal(catPlayer.stacks.mana, 0, 'Cat Spirit spends its source Mana');
assert.equal(catPlayer.stacks.lucky, 1, 'Cat Spirit grants Lucky');
assert.equal(catPlayer.stacks.empower, 1, 'Cat Spirit grants Empower');
assert.ok(
  catEvents.findIndex((event) => event.type === 'activate') >
    catEvents.findIndex((event) => event.meta?.stack === 'empower'),
  'Cat Spirit activates after its source effects',
);

const chain = getScriptHandler('chain_whip');
assert.equal(typeof chain?.onPrepare, 'function');
assert.equal(typeof chain?.onPreDealDamageEarly, 'function');
const chainPlayer = createActor('player');
const chainDummy = createActor('dummy');
chainDummy.stacks.lucky = 3;
chainPlayer.hp = 50;
const chainBus = createCombatBus();
const chainPiece = {
  itemId: 'chain_whip',
  name: 'Chain Whip',
  placementKey: 'whip',
  params: { p1: 2, p2: 17, p3: 1 },
  baseCooldown: 2.4,
  cooldown: 2.4,
  staminaCost: 2.1,
  baseStaminaCost: 2.1,
  damageMin: 4,
  damageMax: 9,
  accuracy: 100,
  kind: 'weapon',
  alive: true,
  bonusDamage: 0,
};
const chainCtx = {
  player: chainPlayer,
  dummy: chainDummy,
  bus: chainBus,
  events: [],
  rng: () => 0,
  t: 5,
};
chain.onPrepare(chainPiece, chainCtx);
startBattleRage(chainPlayer, 5, 5, { bus: chainBus });
chain.onPreDealDamageEarly(chainPiece, chainCtx, { hit: true });
assert.equal(chainDummy.stacks.lucky, 1, 'Chain Whip strips the source purge count of opponent buffs');
assert.equal(chainPiece.bonusDamage, 2, 'Chain Whip converts each source purge into bonus damage');
assert.ok(chainPlayer.hp > 50, 'Chain Whip heals while the owner is raging');

for (const [id, source] of [['cheese', sources.cheese], ['cheese_goobert', sources.cheeseGoobert]]) {
  const handler = getScriptHandler(id);
  assert.equal(typeof handler?.onCooldownEffect, 'function');
  const player = createActor('player');
  player.hp = player.maxHp - 10;
  const events = [];
  handler.onCooldownEffect(
    {
      itemId: id,
      name: id === 'cheese' ? 'Cheese' : 'Cheese Goobert',
      placementKey: id,
      params: id === 'cheese' ? { maxhealth: 10, p2: 1 } : { maxhealth: 22, p3: 2 },
    },
    { player, dummy: createActor('dummy'), events, rng: () => 0, t: 6 },
  );
  assert.ok(player.maxHp > 100, `${id} grants source max health`);
  assert.ok(
    events.findIndex((event) => event.type === 'activate') >= events.findIndex((event) => event.type === 'heal'),
    `${id} activation follows max-health effect`,
  );
  void source;
}

console.log('OK Carrot / Cat Spirit / Chain Whip / Cheese source ports');
