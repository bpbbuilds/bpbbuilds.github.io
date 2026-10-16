import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import affectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/GoldArmor.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onShopEntered\(\):[\s\S]*giveGold\(gold\)/);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Holy\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*if item\.hasType\(Type\.Weapon\):[\s\S]*item\.reduceSpeed\(speedMalus\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveRegeneration\(getNumAffectedItems\(\) \* regen\)[\s\S]*giveBlock\(\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*cleanseRandomDebuffs\(cleanse\)[\s\S]*if character\(\)\.getDebuffStacks\(\) == 0:[\s\S]*giveBlock\(block\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.gold_armor?.file, 'Exclusive/GoldArmor.gd');
assert.equal(getScriptHandler('gold_armor')?.handlerId, 'gold_armor');

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    side,
    alive: true,
    kind: /weapon/i.test(item?.type || '') ? 'weapon' : id === 'gold_armor' ? 'armor' : 'accessory',
    cooldown: item?.cooldown ?? 0,
    baseCooldown: item?.cooldown ?? 0,
    speedScale: 0,
    blockGrant: Number(item?.block) || 0,
    ...overrides,
  };
}

function graph(sourcePiece, links) {
  const pieces = new Map([[
    sourcePiece.placementKey,
    {
      key: sourcePiece.placementKey,
      id: sourcePiece.itemId,
      cells: [],
      affectCells: links.map(({ color }, index) => ({ cell: `link-${index}`, color })),
    },
  ]]);
  const filled = new Map();
  for (const [index, { target }] of links.entries()) {
    pieces.set(target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(`link-${index}`, target.placementKey);
  }
  return { pieces, filled };
}

function context(owner, foe, pieces, board, rng = () => 0) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph: board,
    itemsById: byId,
    canAffect: { rulesById: affectRules.byId },
    events: [],
    bus,
    rng,
    t: 5,
  };
}

const handler = getScriptHandler('gold_armor');

for (const side of ['you', 'them']) {
  const owner = createActor('player', { maxHp: 200 });
  const foe = createActor('dummy', { maxHp: 200 });
  const armor = piece('gold_armor', `${side}:gold-armor`, side);
  const holyArmor = piece('holy_armor', `${side}:holy-armor`, side);
  const holySpear = piece('holy_spear', `${side}:holy-spear`, side);
  const weapon = piece('wooden_sword', `${side}:weapon`, side);
  const nonWeapon = piece('healing_herbs', `${side}:non-weapon`, side);
  const pieces = [armor, holyArmor, holySpear, weapon, nonWeapon];
  const ctx = context(
    owner,
    foe,
    pieces,
    graph(armor, [
      { target: holyArmor, color: 'primary' },
      { target: holySpear, color: 'primary' },
      { target: holyArmor, color: 'secondary' },
    ]),
  );

  handler.onPrepare(armor, ctx);
  assert.ok(Math.abs(weapon.speedScale + 0.5) < 1e-9, `Gold Armor reduces every weapon speed during preparation on ${side}`);
  assert.equal(nonWeapon.speedScale || 0, 0, `Gold Armor does not slow non-weapons on ${side}`);

  handler.onCombatStart(armor, ctx);
  assert.equal(owner.stacks.regeneration, 6, `Gold Armor counts primary Holy targets for start Regeneration on ${side}`);
  assert.equal(owner.block, 120, `Gold Armor gives its catalog Block at combat start on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Gold Armor activates after start buffs on ${side}`);

  owner.block = 0;
  ctx.events.length = 0;
  handler.onCooldownEffect(armor, ctx);
  assert.equal(owner.block, 25, `Gold Armor gives its cooldown Block when no debuffs remain on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Gold Armor activates after cooldown effects on ${side}`);
  assert.ok(ctx.events.findIndex((event) => event.type === 'activate') > -1, `Gold Armor cooldown activation is projected on ${side}`);

  const zero = piece('gold_armor', `${side}:gold-armor-zero`, side, {
    params: { gold: 0, p1: 0, regen: 0, p2: 0, cleanse: 0, p3: 0, block: 0, p4: 0, speed: 0, p5: 0 },
    blockGrant: 0,
  });
  const zeroCtx = context(owner, foe, [zero], graph(zero, []));
  handler.onPrepare(zero, zeroCtx);
  handler.onCombatStart(zero, zeroCtx);
  const blockBefore = owner.block;
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(owner.block, blockBefore, `Gold Armor honors explicit zero Block and Regen parameters on ${side}`);
  assert.equal(zeroCtx.events.at(-1)?.type, 'activate', `Gold Armor still activates with zero parameters on ${side}`);
}

console.log('OK Gold Armor source-backed preparation, Holy targeting, start/cooldown ordering, Block, both sides, and zero parameters');
