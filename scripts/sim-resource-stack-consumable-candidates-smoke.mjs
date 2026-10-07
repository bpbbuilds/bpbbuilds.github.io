import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { tickTimedSpeeds } from '../js/pages/sim/engine/timed-speed.js';

const ids = [
  'arcane_boots', 'heart_shield', 'piercing_arrow', 'platin_customer_card',
  'scissorswords', 'spell_scroll_ice', 'staff_of_unhealing', 'stone',
  'stone_golem', 'stone_shoes', 'winged_boots', 'yggdrasil_leaf',
];
const sourceFiles = {
  arcane_boots: 'Items/Exclusive/ArcaneBoots.gd',
  heart_shield: 'Items/Exclusive/HeartShield.gd',
  piercing_arrow: 'Items/PiercingArrow.gd',
  platin_customer_card: 'Items/PlatinCustomerCard.gd',
  scissorswords: 'Items/Exclusive/Scissorswords.gd',
  spell_scroll_ice: 'Items/Exclusive/SpellScrollIce.gd',
  staff_of_unhealing: 'Items/StaffofUnhealing.gd',
  stone: 'Items/Stone.gd',
  stone_golem: 'Items/Exclusive/StoneGolem.gd',
  stone_shoes: 'Items/Exclusive/StoneShoes.gd',
  winged_boots: 'Items/Exclusive/WingedBoots.gd',
  yggdrasil_leaf: 'Items/YggdrasilLeaf.gd',
};

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const items = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

for (const id of ids) {
  assert.ok(fs.existsSync(`tools/game-extract-full/${sourceFiles[id]}`), `${id} source exists`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} explicit handler`);
  assert.equal(inventory.byId[id]?.file != null, true, `${id} inventory source`);
}

function context() {
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    t: 1, player, dummy, bus, events: [], rng: () => 0,
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: items, canAffect: null, pieces: [],
  };
}

function piece(id, key, extra = {}) {
  const item = items.get(id);
  return {
    itemId: id, placementKey: key, name: item?.name || id,
    params: item?.params || {}, side: 'you', alive: true,
    cooldown: Number(item?.cooldown) || 2, triggerTime: Number(item?.cooldown) || 2,
    baseCooldown: Number(item?.cooldown) || 2,
    damageMin: Number(item?.damageMin) || 0, damageMax: Number(item?.damageMax) || 0,
    accuracy: Number(item?.accuracy) || 100, staminaCost: Number(item?.staminaCost) || 0,
    chance: Number(item?.chance) || 30, blockGrant: Number(item?.block) || 0,
    bonusDamageFactor: 1, ...extra,
  };
}

function link(ctx, source, target, targetItem = target.itemId) {
  ctx.graph.pieces.set(source.placementKey, { key: source.placementKey, id: source.itemId, affectCells: [{ cell: '0,0', color: 'primary' }] });
  ctx.graph.pieces.set(target.placementKey, { key: target.placementKey, id: targetItem, affectCells: [] });
  ctx.graph.filled.set('0,0', target.placementKey);
  ctx.pieces.push(source, target);
}

// Arcane Boots consumes mana, grants the source stacks, and expires linked speed.
{
  const ctx = context(); const boots = piece('arcane_boots', 'boots'); const weapon = piece('wooden_sword', 'sword');
  link(ctx, boots, weapon); ctx.player.hp = 60; grantStacks(ctx.player, 'mana', 2);
  getScriptHandler('arcane_boots').onCombatStart(boots, ctx); ctx.bus.emit('player_damaged', { healthDamage: 1 });
  assert.equal(ctx.player.stacks.mana, 0); assert.equal(ctx.player.stacks.lucky, 3); assert.equal(weapon._timedSpeeds?.length, 1);
  tickTimedSpeeds([weapon], 5); assert.equal(weapon._timedSpeeds.length, 0);
}

// Heart Shield spends the regeneration threshold and gives max health/heal amp.
{
  const ctx = context(); const shield = piece('heart_shield', 'shield');
  getScriptHandler('heart_shield').onCombatStart(shield, ctx); grantStacks(ctx.player, 'regeneration', 7);
  assert.equal(ctx.player.stacks.regeneration, 0); assert.equal(ctx.player.maxHp, 250); assert.equal(ctx.player._healAmp, 0.3);
  const damage = { damage: 25, reduced: 0 };
  ctx.bus.emit('pre_take_damage', { defender: ctx.player, source: { isAttack: false, isEffectDamage: true }, damage });
  assert.equal(damage.damage, 5);
}

// Piercing Arrow strips Block in the late critical-hit phase, before Block absorbs damage.
{
  const ctx = context(); const arrow = piece('piercing_arrow', 'arrow'); const weapon = piece('wooden_sword', 'sword');
  link(ctx, arrow, weapon); getScriptHandler('piercing_arrow').onCombatStart(arrow, ctx); ctx.dummy.block = 20;
  weapon._preDealLate.forEach((fn) => fn({ critical: true, damage: 10 }));
  assert.equal(ctx.dummy.block, 5);
}

// Platinum Customer Card gives its affected Legendary/Godly targets' reflect stacks at pre-combat.
{
  const ctx = context(); const card = piece('platin_customer_card', 'card'); const target = piece('heart_shield', 'target');
  link(ctx, card, target); getScriptHandler('platin_customer_card').onPreCombatStart(card, ctx);
  assert.equal(ctx.player.debuffReflectStacks, 2);
}

// Scissorswords retains Lightsaber's weapon strike and adds its hit/miss branches.
{
  const ctx = context(); const sword = piece('scissorswords', 'sword', { damageMin: 10, damageMax: 10 });
  const handler = getScriptHandler('scissorswords'); handler.onCombatStart(sword, ctx);
  handler.onDealtDamage(sword, ctx, { hit: false }); assert.equal(ctx.player.stacks.lucky, 5);
  handler.onDealtDamage(sword, ctx, { hit: true }); assert.equal(ctx.dummy.stacks.blind, 10); assert.equal(ctx.player.stacks.blind, 10);
}

// Ice Scroll removes all cold only on a real lethal hit and converts it to Block.
{
  const ctx = context(); const scroll = piece('spell_scroll_ice', 'scroll');
  getScriptHandler('spell_scroll_ice').onCombatStart(scroll, ctx); grantStacks(ctx.dummy, 'cold', 3); ctx.player.hp = 0;
  ctx.bus.emit('player_damaged', { healthDamage: 5 });
  assert.equal(ctx.dummy.stacks.cold, 0); assert.equal(ctx.player.block, 6); assert.equal(scroll.alive, false);
}

// Staff of Unhealing spends stamina/mana, enables temporary Unhealing, then expires on a tick.
{
  const ctx = context(); const staff = piece('staff_of_unhealing', 'staff', { staminaCost: 1.3 }); ctx.player.hp = 50; grantStacks(ctx.player, 'mana', 4);
  const handler = getScriptHandler('staff_of_unhealing'); handler.onCombatStart(staff, ctx); handler.onCooldownEffect(staff, ctx);
  assert.equal(ctx.player.stacks.mana, 0); assert.equal(ctx.player.unhealing, 1); handler.onTick(staff, { ...ctx, t: 4 }); assert.equal(ctx.player.unhealing, 0);
}

// Stone is one-ammo, strips Block in pre-hit, and is consumed after its throw.
{
  const ctx = context(); const stone = piece('stone', 'stone', { damageMin: 2, damageMax: 2, accuracy: 100 }); ctx.dummy.block = 4;
  const handler = getScriptHandler('stone'); handler.onCombatStart(stone, ctx); handler.onPreDealDamageLate(stone, ctx, {}); handler.onCooldownEffect(stone, ctx);
  assert.equal(stone.alive, false); assert.equal(ctx.dummy.block, 0);
}

// Stone Golem listens from prepare and only counts Bag of Stones links.
{
  const ctx = context(); const golem = piece('stone_golem', 'golem'); const bag = piece('bag_of_stones', 'bag');
  link(ctx, golem, bag); const handler = getScriptHandler('stone_golem'); handler.onPrepare(golem, ctx); grantStacks(ctx.player, 'regeneration', 7);
  assert.equal(ctx.player.block, 150); assert.equal(golem.baseCooldown, 2.6);
}

// Stone Shoes applies and later restores typed ranged/effect reduction.
{
  const ctx = context(); const shoes = piece('stone_shoes', 'shoes'); const handler = getScriptHandler('stone_shoes');
  handler.onCombatStart(shoes, ctx); ctx.player.hp = 60; ctx.bus.emit('player_damaged', { healthDamage: 1 });
  assert.equal(ctx.dummy.rangedDmgFactor, -0.35); assert.equal(ctx.dummy.effectDmgFactor, -0.35);
  handler.onTick(shoes, { ...ctx, t: 9 }); assert.equal(ctx.dummy.rangedDmgFactor, 0); assert.equal(ctx.dummy.effectDmgFactor, 0);
}

// Winged Boots threshold grants Empower, cleanses, and Dodge once.
{
  const ctx = context(); const boots = piece('winged_boots', 'winged'); grantStacks(ctx.player, 'poison', 1);
  getScriptHandler('winged_boots').onCombatStart(boots, ctx); ctx.player.hp = 60; ctx.bus.emit('player_damaged', { healthDamage: 1 });
  assert.equal(ctx.player.stacks.empower, 1); assert.equal(ctx.player.stacks.poison, 0); assert.equal(ctx.player.dodgeStacks, 3);
}

// Yggdrasil Leaf counts Nature links and reacts to used mana thresholds.
{
  const ctx = context(); const leaf = piece('yggdrasil_leaf', 'leaf'); const nature = piece('stone', 'nature');
  link(ctx, leaf, nature); const handler = getScriptHandler('yggdrasil_leaf'); handler.onPrepare(leaf, ctx); handler.onCombatStart(leaf, ctx);
  assert.equal(ctx.player.stacks.mana, 2); assert.equal(ctx.player.stacks.regeneration, 1);
  grantStacks(ctx.player, 'mana', 5); ctx.player.hp = 80; spendStacks(ctx.player, 'mana', 5, { originKey: 'test', originId: 'test' });
  assert.equal(leaf._manaUsed, 0); assert.equal(ctx.player.hp, 100);
}

console.log('OK resource/stack/consumable candidates: Arcane, Heart, Piercing, Platin, Scissorswords, Ice Scroll, Staff, Stone, Golem, Shoes, Winged, Yggdrasil');
