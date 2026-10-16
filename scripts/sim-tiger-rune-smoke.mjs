import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/TigerRune.gd', 'utf8');
const socketsSource = fs.readFileSync('js/pages/sim/engine/gem-sockets.js', 'utf8');
const gemsSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-gems.js', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.tiger_rune?.file, 'Exclusive/TigerRune.gd');
assert.deepEqual(inventory.byId.tiger_rune?.overrides, []);
assert.match(source, /func prepareInventory\(\):[\s\S]*getItemsAndGems\(\)[\s\S]*changeAmplificiationChancePercent_allBuffs/);
assert.match(source, /func prepareWeapon\(\):[\s\S]*pre_deal_damage_late[\s\S]*preAttack/);
assert.match(source, /func preAttack\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollChance\(vampChance\)[\s\S]*giveVampirism\(vampirism\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func prepareArmor\(\):[\s\S]*connectToCharacterBuffs\("onBuffsChanged"\)/);
assert.match(source, /buffCounter %= buffsNeeded[\s\S]*giveBlock\(getGemPower\(\) \* block/);
assert.match(gemsSource, /function tigerInventory\(id\)/);
assert.match(gemsSource, /buffAmpChance/);
assert.match(socketsSource, /fam === 'tiger'/);
assert.match(socketsSource, /_preDealLate/);
assert.match(socketsSource, /gemPower/);

const tiger = {
  ...byId.get('tiger_rune'),
  id: 'tiger_rune',
  itemId: 'tiger_rune',
  name: 'Tiger Rune',
  chance: 11,
  gemPower: 1,
};
const itemsById = new Map(byId);
itemsById.set('tiger_rune', tiger);

function makeContext() {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    events: [],
    t: 2,
    rng: () => 0,
    itemsById,
    pieces: [],
    allPieces: [],
  };
}

const looseCtx = makeContext();
const looseTiger = {
  ...tiger,
  itemId: 'tiger_rune',
  placementKey: 'loose-tiger',
  kind: 'gem',
};
const looseOther = { itemId: 'other', placementKey: 'other', buffAmpChance: 2 };
looseCtx.pieces = [looseTiger, looseOther];
const looseHandler = getScriptHandler('tiger_rune');
assert.equal(looseHandler?.handlerId, 'tiger_rune');
looseHandler.onPrepare(looseTiger, looseCtx);
assert.equal(looseOther.buffAmpChance, 13, 'loose Tiger Rune amplifies every inventory item and gem');

const weaponCtx = makeContext();
const weapon = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'tiger-weapon',
  name: 'Tiger Weapon',
  kind: 'weapon',
  damageMax: 10,
  gemIds: ['tiger_rune'],
};
weaponCtx.pieces = [weapon];
weaponCtx.allPieces = [weapon];
prepareGemSockets(weapon, weaponCtx);
assert.equal(weapon._preDealLate?.length, 1, 'weapon Tiger Rune hooks the late pre-deal phase');
weapon._preDealLate[0]({ hit: false });
assert.equal(weaponCtx.player.stacks.vampirism, 0, 'misses do not grant Vampirism');
weapon._preDealLate[0]({ hit: true });
assert.equal(weaponCtx.player.stacks.vampirism, 1, 'hits grant the source Vampirism amount');
assert.equal(weaponCtx.events.at(-1)?.meta?.miniActivate, true, 'weapon proc projects miniActivate');
assert.equal(weaponCtx.events.filter((event) => event.type === 'activate').length, 0, 'miniActivate does not inflate activations');

const armorCtx = makeContext();
const armor = {
  ...byId.get('leather_armor'),
  itemId: 'leather_armor',
  placementKey: 'tiger-armor',
  name: 'Tiger Armor',
  kind: 'armor',
  gemIds: ['tiger_rune'],
};
const poweredTiger = { ...tiger, gemPower: 2 };
armorCtx.itemsById = new Map(itemsById);
armorCtx.itemsById.set('tiger_rune', poweredTiger);
armorCtx.pieces = [armor];
armorCtx.allPieces = [armor];
prepareGemSockets(armor, armorCtx);
grantStacks(armorCtx.player, 'lucky', 6, { originKey: 'buff-source', originId: 'source' });
assert.equal(armorCtx.player.block, 6, 'Tiger Rune grants proportional Block for partial buff progress');
grantStacks(armorCtx.player, 'mana', 4, { originKey: 'buff-source', originId: 'source' });
assert.equal(armorCtx.player.block, 16, 'Tiger Rune scales each source buff event by Gem Power');
assert.equal(armor._tigerBuffCounter, 0, 'Tiger Rune keeps the source remainder after a full cycle');

const zeroCtx = makeContext();
const zeroArmor = { ...armor, placementKey: 'zero-tiger-armor' };
const zeroTiger = {
  ...tiger,
  params: { vampirism: 0, p1: 0, buffs: 0, p2: 0, block: 0, p3: 0, chance_vamp: 0, p4: 0 },
  gemPower: 0,
};
zeroCtx.itemsById = new Map(itemsById);
zeroCtx.itemsById.set('tiger_rune', zeroTiger);
zeroCtx.pieces = [zeroArmor];
zeroCtx.allPieces = [zeroArmor];
prepareGemSockets(zeroArmor, zeroCtx);
assert.doesNotThrow(() => grantStacks(zeroCtx.player, 'lucky', 1), 'zero Tiger Rune thresholds stay safe');
assert.equal(zeroCtx.player.block, 0, 'zero Tiger Rune values do not create Block');

console.log('OK Tiger Rune source, loose amplification, pre-deal Vampirism, mini activation, Gem Power Block, remainder, and zero-safe regression');
