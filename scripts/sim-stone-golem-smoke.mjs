import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StoneGolem.gd', 'utf8');
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceItem = catalog.find((item) => item.id === 'stone_golem');
const handler = getScriptHandler('stone_golem');

assert.ok(sourceItem, 'Stone Golem: extracted catalog row');
assert.equal(inventory.byId.stone_golem?.file, 'Exclusive/StoneGolem.gd');
assert.equal(inventory.byId.stone_golem?.extends, 'Weapon');
assert.deepEqual(inventory.byId.stone_golem?.overrides, [
  'onPreCombatStart',
  'onDealtDamage',
  'onPreDealDamage_early',
  'onPrepare',
]);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.isA\(bagOfStonesDescriptor\)/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*addBonusDamage\(getP\("bonusdam"\) \* getNumAffectedItems\(\)\)/);
assert.match(source, /func onRegenChanged\(amount, event\):[\s\S]*useRegeneration\(regenThreshold, event\)[\s\S]*giveBlock\(getBlock\(\), true, event2\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*giveEmpower\(empower\)/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*rollChance\(\)[\s\S]*stun\(getP_m\("dur_stun"\), damageRes\.event\)/);
assert.equal(handler?.handlerId, 'stone_golem');
assert.equal(typeof handler?.onPreCombatStart, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');

function context({ params = sourceItem.params, blockGrant = sourceItem.block, chance = 100 } = {}) {
  const player = createActor('player', { maxHp: 100, maxStamina: 10 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const piece = {
    ...sourceItem,
    itemId: 'stone_golem',
    placementKey: 'you:golem',
    side: 'you',
    kind: 'weapon',
    name: 'Stone Golem',
    alive: true,
    charges: 1,
    chance,
    accuracy: 100,
    damageMin: 8,
    damageMax: 8,
    staminaCost: 0,
    blockGrant,
    baseCooldown: 5.5,
    cooldown: 5.5,
    params,
  };
  const bag = {
    itemId: 'bag_of_stones',
    placementKey: 'you:bag',
    cells: ['1,0'],
    affectCells: [],
  };
  const unrelated = {
    itemId: 'stone',
    placementKey: 'you:unrelated',
    cells: ['0,1'],
    affectCells: [],
  };
  const graph = {
    pieces: new Map([
      [piece.placementKey, { key: piece.placementKey, id: piece.itemId, cells: ['0,0'], affectCells: [] }],
      [bag.placementKey, bag],
      [unrelated.placementKey, unrelated],
    ]),
    filled: new Map([
      ['0,0', piece.placementKey],
      ['1,0', bag.placementKey],
      ['0,1', unrelated.placementKey],
    ]),
  };
  return {
    t: 3,
    player,
    dummy,
    events: [],
    rng: () => 0,
    pieces: [piece, bag, unrelated],
    graph,
    itemsById: new Map([
      ['stone_golem', sourceItem],
      ['bag_of_stones', { id: 'bag_of_stones', type: 'Bag' }],
      ['stone', { id: 'stone', type: 'Ranged Weapon', tags: ['Stone'] }],
    ]),
    canAffect: null,
    notifyPreDealDamageEarly(piece, hitCtx, hit) {
      handler.onPreDealDamageEarly(piece, hitCtx, hit);
    },
    notifyDealtDamage(piece, hitCtx, hit) {
      handler.onDealtDamage(piece, hitCtx, hit);
    },
    piece,
  };
}

const combat = context();
handler.onPrepare(combat.piece, combat);
handler.onPreCombatStart(combat.piece, combat);
assert.equal(combat.piece.bonusDamage, 10, 'Stone Golem counts only its adjacent Bag of Stones');
grantStacks(combat.player, 'regeneration', 6, { originKey: 'you:herbs' });
assert.equal(combat.player.block, 0, 'Stone Golem waits below its source threshold');
grantStacks(combat.player, 'regeneration', 1, { originKey: 'you:herbs' });
assert.equal(combat.player.stacks.regeneration, 0, 'Stone Golem uses the exact Regeneration threshold');
assert.equal(combat.player.block, 150, 'Stone Golem grants its catalog Block value');
assert.equal(combat.piece.baseCooldown, 2.6, 'Stone Golem applies its activated cooldown');
assert.equal(combat.piece.cooldown, 2.6, 'Stone Golem updates its live cooldown');

handler.onPreDealDamageEarly(combat.piece, combat, { hit: true });
assert.equal(combat.player.stacks.empower, 1, 'Stone Golem grants Empower in the source early-hit hook');
handler.onDealtDamage(combat.piece, combat, { hit: true });
assert.equal(combat.dummy.stunnedUntil, 3.5, 'Stone Golem applies its source stun duration');
const beforeMiss = combat.player.stacks.empower;
handler.onPreDealDamageEarly(combat.piece, combat, { hit: false });
handler.onDealtDamage(combat.piece, combat, { hit: false });
assert.equal(combat.player.stacks.empower, beforeMiss, 'Stone Golem does not grant Empower on a miss');

const strike = context();
handler.onPrepare(strike.piece, strike);
handler.onPreCombatStart(strike.piece, strike);
assert.equal(handler.onCooldownEffect(strike.piece, strike), true, 'Stone Golem uses the inherited weapon strike path');
assert.equal(strike.dummy.hp, 82, 'Stone Golem deals its bonus-damage-enhanced ranged hit');
assert.equal(strike.player.stacks.empower, 1, 'Stone Golem grants Empower through the live early-hit callback');
assert.equal(strike.dummy.stunnedUntil, 3.5, 'Stone Golem stun runs through the live dealt-damage callback');
assert.equal(strike.events.filter((event) => event.type === 'activate').length, 1, 'Stone Golem activates after its strike');

const zero = context({
  params: { empower: 0, regen: 0, p4: 0, bonusdam: 0, dur_stun: 0 },
  blockGrant: 0,
  chance: 100,
});
handler.onPrepare(zero.piece, zero);
handler.onPreCombatStart(zero.piece, zero);
grantStacks(zero.player, 'regeneration', 1, { originKey: 'you:herbs' });
assert.equal(zero.player.stacks.regeneration, 1, 'Stone Golem preserves a zero regeneration spend');
assert.equal(zero.player.block, 0, 'Stone Golem preserves a zero Block grant');
assert.equal(zero.piece.cooldown, 0, 'Stone Golem preserves a zero activated cooldown');
handler.onPreDealDamageEarly(zero.piece, zero, { hit: true });
handler.onDealtDamage(zero.piece, zero, { hit: true });
assert.equal(zero.player.stacks.empower, 0, 'Stone Golem preserves a zero Empower value');
assert.equal(zero.dummy.stunnedUntil, 0, 'Stone Golem preserves a zero stun duration');

console.log('OK Stone Golem source/parity smoke');
