import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const CASES = [
  ['halberd', 'Exclusive/Halberd.gd'], ['heart_container', 'HeartContainer.gd'],
  ['hero_sword', 'HeroSword.gd'], ['ice_armor', 'Exclusive/IceArmor.gd'],
  ['just_stats', 'Exclusive/JustStats.gd'], ['laboratory', 'Exclusive/Laboratory.gd'],
  ['leaf_badge', 'Exclusive/LeafBadge.gd'], ['level_up', 'Exclusive/LevelUp.gd'],
  ['light_flower', 'Exclusive/LightFlower.gd'], ['lucky_bow', 'LuckyBow.gd'],
  ['lucky_clover', 'LuckyClover.gd'], ['magic_torch', 'MagicTorch.gd'],
  ['mananana', 'Exclusive/Mananana.gd'], ['molten_dagger', 'Exclusive/MoltenDagger.gd'],
  ['molten_spear2', 'Exclusive/MoltenSpear2.gd'], ['moon_armor', 'Exclusive/MoonArmor.gd'],
  ['more_stats', 'Exclusive/MoreStats.gd'], ['null_blade', 'Exclusive/NullBlade.gd'],
];

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item, itemId: id, placementKey: key, side, name: item?.name || id,
    params: item?.params || {}, alive: true, kind: /weapon/i.test(item?.type || '') ? 'weapon' : 'passive',
    cooldown: item?.cooldown ?? 3, baseCooldown: item?.cooldown ?? 3, damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0, accuracy: item?.accuracy ?? 100, staminaCost: item?.staminaCost || 0,
    ...overrides,
  };
}

function graph(source, targets = []) {
  const pieces = new Map([[source.placementKey, {
    key: source.placementKey, id: source.itemId, cells: [],
    affectCells: targets.map((_, i) => ({ cell: `link-${i}`, color: i ? 'secondary' : 'primary' })),
  }]]);
  const filled = new Map();
  targets.forEach((target, i) => {
    pieces.set(target.placementKey, { key: target.placementKey, id: target.itemId, cells: [], affectCells: [] });
    filled.set(`link-${i}`, target.placementKey);
  });
  return { pieces, filled };
}

function context(owner, foe, pieces, board, rng = () => 0) {
  const bus = createCombatBus();
  owner._combatBus = foe._combatBus = bus;
  return { player: owner, dummy: foe, pieces, graph: board, itemsById: byId, canAffect: null,
    events: [], bus, rng, t: 5, round: 5, activatePiece: () => true };
}

for (const [id, source] of CASES) {
  assert.equal(inventory.byId[id]?.file, source, `${id} source alias`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} dedicated handler`);
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100, block: 10 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100, block: 3 });

  const halberd = piece('halberd', `${side}:halberd`, side, { kind: 'weapon' });
  const armor = piece('ice_armor', `${side}:armor`, side, { kind: 'armor', blockGrant: 10 });
  const halberdCtx = context(owner, foe, [halberd, armor], graph(halberd, [armor]));
  getScriptHandler('halberd').onPrepare(halberd, halberdCtx);
  assert.equal(armor.buffPowers.block, 1.35, `Halberd Block power on ${side}`);
  getScriptHandler('halberd').onPreDealDamageEarly(halberd, halberdCtx, { hit: true, damage: 4 });
  assert.equal(halberd.bonusDamage, 1, `Halberd permanent damage on ${side}`);
  getScriptHandler('halberd').onPreDealDamageLate(halberd, halberdCtx, { hit: true });
  assert.equal(foe.block, 0, `Halberd late block removal on ${side}`);
  assert.equal(owner.block, 11, `Halberd leftover Block on ${side}`);

  const heart = piece('heart_container', `${side}:heart`, side);
  const heartCtx = context(owner, foe, [heart], graph(heart));
  getScriptHandler('heart_container').onPrepare(heart, heartCtx);
  owner.stacks.regeneration = 6;
  getScriptHandler('heart_container').onCooldownEffect(heart, heartCtx);
  assert.equal(owner.maxHp, 200, `Heart Container max HP on ${side}`);
  assert.equal(owner.stacks.empower, 2, `Heart Container Empower on ${side}`);

  const hero = piece('hero_sword', `${side}:hero`, side, { kind: 'weapon' });
  const heroPeer = piece('halberd', `${side}:hero-peer`, side, { kind: 'weapon' });
  const heroCtx = context(owner, foe, [hero, heroPeer], graph(hero, [heroPeer]));
  getScriptHandler('hero_sword').onCombatStart(hero, heroCtx);
  assert.equal(heroPeer.bonusDamage, 1, `Hero Sword linked damage on ${side}`);

  const ice = piece('ice_armor', `${side}:ice`, side, { kind: 'armor' });
  const iceCtx = context(owner, foe, [ice], graph(ice));
  getScriptHandler('ice_armor').onCombatStart(ice, iceCtx);
  owner.stacks.heat = 1;
  getScriptHandler('ice_armor').onCooldownEffect(ice, iceCtx);
  assert.equal(foe.stacks.cold, 6, `Ice Armor Cold on ${side}`);
  assert.equal(iceCtx.events.at(-1)?.type, 'activate', `Ice Armor activation order on ${side}`);

  const stats = piece('just_stats', `${side}:stats`, side);
  const statsCtx = context(owner, foe, [stats], graph(stats));
  const beforeRegen = owner.staminaRegen;
  getScriptHandler('just_stats').onCombatStart(stats, statsCtx);
  assert.ok(owner.maxHp > 200 && owner.staminaRegen > beforeRegen, `Just Stats start grants on ${side}`);

  const lab = piece('laboratory', `${side}:lab`, side);
  const labCtx = context(owner, foe, [lab], graph(lab));
  owner.stacks.lucky = 1;
  getScriptHandler('laboratory').onPreCombatStart(lab, labCtx);
  getScriptHandler('laboratory').onCooldownEffect(lab, labCtx);
  assert.equal(owner.stacks.heat >= 4, true, `Laboratory phase one on ${side}`);

  const leaf = piece('leaf_badge', `${side}:leaf`, side);
  const leafWeapon = piece('halberd', `${side}:leaf-weapon`, side, { kind: 'weapon' });
  const leafCtx = context(owner, foe, [leaf, leafWeapon], graph(leaf, [leafWeapon]));
  getScriptHandler('leaf_badge').onPrepare(leaf, leafCtx);
  grantStacks(owner, 'lucky', 1, { originKey: leaf.placementKey, originId: leaf.itemId });
  assert.equal(leafWeapon.critChance, 2, `Leaf Badge lucky crit on ${side}`);

  const level = piece('level_up', `${side}:level`, side);
  const levelCtx = context(owner, foe, [level], graph(level));
  getScriptHandler('level_up').onPrepare(level, levelCtx);
  assert.equal(level.speedScale, 0.2, `Level Up prepare speed on ${side}`);
  getScriptHandler('level_up').onCooldownEffect(level, levelCtx);
  assert.equal(levelCtx.events.at(-1)?.type, 'activate', `Level Up activation order on ${side}`);

  const flower = piece('light_flower', `${side}:flower`, side);
  const flowerPrimary = piece('banana', `${side}:flower-primary`, side);
  const holy = piece('holy_armor', `${side}:holy`, side, { kind: 'armor' });
  const flowerCtx = context(owner, foe, [flower, flowerPrimary, holy], graph(flower, [flowerPrimary, holy]));
  getScriptHandler('light_flower').onPrepare(flower, flowerCtx);
  assert.equal(owner.buffCleanseProtectChance >= 25, true, `Light Flower prepare protection on ${side}`);
  owner.stacks.mana = 1; owner.stacks.poison = 1;
  getScriptHandler('light_flower').onCooldownEffect(flower, flowerCtx);
  assert.equal(flowerCtx.events.at(-1)?.type, 'activate', `Light Flower activation order on ${side}`);

  const bow = piece('lucky_bow', `${side}:bow`, side, { kind: 'weapon' });
  const bowCtx = context(owner, foe, [bow], graph(bow));
  getScriptHandler('lucky_bow').onPrepare(bow, bowCtx);
  getScriptHandler('lucky_bow').onDealtDamage(bow, bowCtx, { critical: true });
  assert.equal(bow._luckyExtra, true, `Lucky Bow crit arms extra hit on ${side}`);
  const clover = piece('lucky_clover', `${side}:clover`, side);
  const cloverCtx = context(owner, foe, [clover], graph(clover));
  getScriptHandler('lucky_clover').onCombatStart(clover, cloverCtx);
  assert.equal(clover.alive, false, `Lucky Clover consumes on ${side}`);

  const torch = piece('magic_torch', `${side}:torch`, side, { kind: 'weapon' });
  const torchPeer = piece('halberd', `${side}:torch-peer`, side, { kind: 'weapon' });
  const torchCtx = context(owner, foe, [torch, torchPeer], graph(torch, [torchPeer]));
  owner.stacks.mana = 1;
  const torchHit = { hit: true, damage: 4 };
  getScriptHandler('magic_torch').onPreDealDamageEarly(torch, torchCtx, torchHit);
  assert.equal(torchHit.damage, 5, `Magic Torch current hit on ${side}`);
  assert.equal(torchPeer.bonusDamage, 1, `Magic Torch linked damage on ${side}`);

  const manana = piece('mananana', `${side}:manana`, side);
  const food = piece('banana', `${side}:food`, side);
  const mananaCtx = context(owner, foe, [manana, food], graph(manana, [food]));
  getScriptHandler('mananana').onPrepare(manana, mananaCtx);
  assert.equal(manana.speedScale, 0.1, `Mananana inherited Food speed on ${side}`);

  const dagger = piece('molten_dagger', `${side}:dagger`, side, { kind: 'weapon' });
  const daggerCtx = context(owner, foe, [dagger], graph(dagger));
  owner.stacks.heat = 1;
  const daggerHit = { hit: true, damage: 3 };
  getScriptHandler('molten_dagger').onPreDealDamageEarly(dagger, daggerCtx, daggerHit);
  assert.equal(daggerHit.damage, 5, `Molten Dagger current hit on ${side}`);

  const spear = piece('molten_spear2', `${side}:spear`, side, { kind: 'weapon' });
  const fire = piece('flame', `${side}:fire`, side);
  const spearCtx = context(owner, foe, [spear, fire], graph(spear, [fire]));
  getScriptHandler('molten_spear2').onPrepare(spear, spearCtx);
  owner.stacks.heat = 2; foe.block = 5;
  const spearHit = { hit: false, damage: 3 };
  getScriptHandler('molten_spear2').onPreDealDamageEarly(spear, spearCtx, spearHit);
  getScriptHandler('molten_spear2').onPreDealDamageLate(spear, spearCtx, spearHit);
  assert.equal(spearHit.hit, true, `Molten Spear converts miss on ${side}`);
  assert.equal(foe.block, 0, `Molten Spear late strip on ${side}`);

  const moon = piece('moon_armor', `${side}:moon`, side, { kind: 'armor' });
  const magic = piece('magic_torch', `${side}:magic`, side, { kind: 'weapon' });
  const moonCtx = context(owner, foe, [moon, magic], graph(moon, [magic]));
  getScriptHandler('moon_armor').onCombatStart(moon, moonCtx);
  getScriptHandler('moon_armor').onCooldownEffect(moon, moonCtx);
  assert.equal(moonCtx.events.at(-1)?.type, 'activate', `Moon Armor activation order on ${side}`);

  const more = piece('more_stats', `${side}:more`, side);
  const moreWeapon = piece('halberd', `${side}:more-weapon`, side, { kind: 'weapon' });
  const moreCtx = context(owner, foe, [more, moreWeapon], graph(more));
  getScriptHandler('more_stats').onCombatStart(more, moreCtx);
  assert.equal(moreWeapon.bonusDamageFactor, 1.05, `More Stats global damage factor on ${side}`);

  const nullBlade = piece('null_blade', `${side}:null`, side, { kind: 'weapon' });
  const nullCtx = context(owner, foe, [nullBlade], graph(nullBlade));
  owner.stacks.lucky = 1; owner.stacks.regeneration = 1; foe.stacks.heat = 1;
  const nullHit = { hit: true, damage: 10 };
  getScriptHandler('null_blade').onPreDealDamageEarly(nullBlade, nullCtx, nullHit);
  assert.equal(nullHit.damage, 12, `Null Blade current damage on ${side}`);
  assert.equal(nullBlade.speedScale, 0.05, `Null Blade empty-foe speed on ${side}`);
}

console.log('OK Halberd through Null Blade source-port wave');
