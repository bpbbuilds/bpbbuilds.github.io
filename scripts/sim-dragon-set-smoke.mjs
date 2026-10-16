import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DragonSet.gd', 'utf8');
const parentSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.dragon_set?.file, 'Exclusive/DragonSet.gd');
assert.equal(inventory.byId.dragon_set?.extends, 'Item');
assert.deepEqual(inventory.byId.dragon_set?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.equal(getScriptHandler('dragon_set')?.handlerId, 'dragon_set');
assert.match(source, /^extends Item/m);
assert.match(source, /func onPrepare\(\):[\s\S]*battle_rage_started[\s\S]*battle_rage_ended/);
assert.match(source, /countAllInInventoryOfType\(dragonArmorDescr\)[\s\S]*countAllInInventoryOfType\(dragonBootsDescr\)[\s\S]*countAllInInventoryOfType\(dragonClawsDescr\)/);
assert.match(source, /connectForCombat\(opponent\(\), "character_attacked", "onOpponentDamaged"\)/);
assert.match(source, /func preCombatStart\(\):[\s\S]*deactivateCooldown\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveHeat\(heat\)[\s\S]*activate\(\)/);
assert.match(source, /damageRes\.hasHit\(\) and damageRes\.damageSource\.canApplyLifesteal\(\)/);
assert.match(source, /getP_m\("lifesteal"\)[\s\S]*lifestealMax[\s\S]*ceil\(curLifesteal \* damageRes\.damage\)/);
assert.match(parentSource, /func activateCooldown\(\):[\s\S]*set_physics_process\(true\)/);
assert.match(parentSource, /func deactivateCooldown\(\):[\s\S]*set_physics_process\(false\)/);

function piece(id, key, side = 'you', overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: { ...(item?.params || {}) },
    side,
    alive: true,
    cooldown: item?.cooldown ?? 999,
    baseCooldown: item?.cooldown ?? 999,
    triggerTime: item?.cooldown ?? 999,
    kind: /weapon/i.test(item?.type || '') ? 'weapon' : 'passive',
    ...overrides,
  };
}

function context(setPiece, pieces) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    pieces,
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
    events: [],
    bus,
    rng: () => 0,
    t: 5,
  };
}

const handler = getScriptHandler('dragon_set');

{
  const setPiece = piece('dragon_set', 'you:set');
  const ctx = context(setPiece, [setPiece]);
  handler.onPrepare(setPiece, ctx);
  assert.equal(setPiece.cooldown, 0.7, 'prepare does not disable cooldown before preCombatStart');
  handler.onPreCombatStart(setPiece, ctx);
  assert.equal(setPiece.cooldown, 999, 'preCombatStart disables cooldown');

  const opponent = createActor('dummy', { maxHp: 100 });
  ctx.bus.emit('battle_rage_started', { actor: opponent, t: 5 });
  assert.equal(setPiece._cdLocked, true, 'opponent Rage does not arm this set');
  ctx.bus.emit('battle_rage_started', { actor: ctx.player, t: 6 });
  assert.equal(setPiece._cdLocked, false, 'owner Rage arms this set');
  ctx.bus.emit('battle_rage_ended', { actor: opponent, t: 7 });
  assert.equal(setPiece._cdLocked, false, 'opponent Rage end does not disable this set');
  ctx.bus.emit('battle_rage_ended', { actor: ctx.player, t: 8 });
  assert.equal(setPiece._cdLocked, true, 'owner Rage end disables this set');
}

{
  const setPiece = piece('dragon_set', 'you:full-set', 'you', {
    params: { heat: 1, p1: 1, lifesteal: 2, p2: 2, max: 30, p3: 30 },
  });
  const setPieces = [
    setPiece,
    piece('dragonscale_armor', 'you:armor'),
    piece('dragonskin_boots', 'you:boots'),
    piece('dragon_claws', 'you:claws'),
  ];
  const ctx = context(setPiece, setPieces);
  handler.onPrepare(setPiece, ctx);
  ctx.player.battleRage = true;
  ctx.player.stacks.heat = 10;
  ctx.player.hp = 50;
  const attacker = piece('wooden_sword', 'opp:sword', 'them', { kind: 'weapon' });
  ctx.bus.emit('piece_dealt_damage', {
    piece: attacker,
    hit: { hit: false, damage: 10, healthDamage: 0 },
    t: 5,
  });
  assert.equal(ctx.player.hp, 50, 'miss does not trigger Dragon Set lifesteal');
  ctx.bus.emit('piece_dealt_damage', {
    piece: attacker,
    hit: { hit: true, damage: 10, healthDamage: 10, canApplyLifesteal: false },
    t: 5,
  });
  assert.equal(ctx.player.hp, 50, 'non-lifesteal damage source does not trigger Dragon Set');
  ctx.bus.emit('piece_dealt_damage', {
    piece: attacker,
    hit: { hit: true, damage: 10, healthDamage: 10 },
    t: 5,
  });
  assert.equal(ctx.player.hp, 52, 'complete dragon set heals capped heat-scaled lifesteal');

  handler.onCooldownEffect(setPiece, ctx);
  assert.equal(ctx.player.stacks.heat, 11, 'cooldown effect grants source Heat');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'Heat is granted before activation');
}

{
  const setPiece = piece('dragon_set', 'you:zero', 'you', {
    params: { heat: 0, p1: 0, lifesteal: 0, p2: 0, max: 0, p3: 0 },
  });
  const ctx = context(setPiece, [setPiece]);
  handler.onPrepare(setPiece, ctx);
  ctx.player.battleRage = true;
  handler.onCooldownEffect(setPiece, ctx);
  assert.equal(ctx.player.stacks.heat, 0, 'zero Heat remains zero');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'zero Heat still activates');
}

{
  const setPiece = piece('dragon_set', 'you:missing-set');
  const ctx = context(setPiece, [setPiece, piece('dragonscale_armor', 'you:armor-only')]);
  handler.onPrepare(setPiece, ctx);
  ctx.player.hp = 50;
  ctx.bus.emit('piece_dealt_damage', {
    piece: piece('wooden_sword', 'opp:sword', 'them', { kind: 'weapon' }),
    hit: { hit: true, damage: 10, healthDamage: 10 },
    t: 5,
  });
  assert.equal(ctx.player.hp, 50, 'incomplete set does not install opponent attack lifesteal');
}

console.log('OK Dragon Set source port');
