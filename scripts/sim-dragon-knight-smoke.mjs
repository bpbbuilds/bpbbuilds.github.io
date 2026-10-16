import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DragonKnight.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};

assert.equal(inventory.byId.dragon_knight?.file, 'Exclusive/DragonKnight.gd');
assert.equal(inventory.byId.dragon_knight?.extends, 'RubyWhelp');
assert.deepEqual(inventory.byId.dragon_knight?.overrides, ['onDealtDamage', 'onPrepare']);
assert.equal(getScriptHandler('dragon_knight')?.handlerId, 'dragon_knight');
assert.match(source, /^extends ["']res:\/\/Items\/RubyWhelp\.gd["']/m);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(item, "activated", "onItemActivated"\)/);
assert.match(source, /func onDealtDamage\(damageRes\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*heal\(getP_m\("heal"\), damageRes\.event\)/);
assert.match(source, /func onItemActivated\(event\):[\s\S]*advanceCooldownPercent\(cdAdvance\)/);
assert.match(fs.readFileSync('tools/game-extract-full/Items/RubyWhelp.gd', 'utf8'), /giveReflectStacks\(getP2\(\)[\s\S]*giveHeat\(getP1\(\)\)/);

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: { ...(item?.params || {}) },
    side: 'you',
    alive: true,
    cooldown: item?.cooldown ?? 999,
    baseCooldown: item?.cooldown ?? 999,
    triggerTime: item?.cooldown ?? 999,
    ...overrides,
  };
}

function graphFor(sourcePiece, targets) {
  const pieces = new Map([
    [sourcePiece.placementKey, {
      key: sourcePiece.placementKey,
      id: sourcePiece.itemId,
      cells: [],
      affectCells: targets.map((target, i) => ({ cell: `link-${i}`, color: 'primary' })),
    }],
  ]);
  const filled = new Map();
  targets.forEach((target, i) => {
    pieces.set(target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(`link-${i}`, target.placementKey);
  });
  return { pieces, filled };
}

function context(knight, targets) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    pieces: [knight, ...targets],
    graph: graphFor(knight, targets),
    itemsById: byId,
    canAffect,
    events: [],
    bus,
    rng: () => 0,
    t: 5,
    activatePiece: () => true,
  };
}

{
  const knight = piece('dragon_knight', 'you:knight', {
    kind: 'weapon',
    cooldown: 1.5,
    baseCooldown: 1.5,
    triggerTime: 1.5,
    _iterationCd: 1.5,
  });
  // Wooden Buckler is canActivate=true but has no cooldown or cooldown hook.
  // DragonKnight.gd must still connect to its activated signal.
  const startOnly = piece('wooden_buckler', 'you:buckler', {
    cooldown: 999,
    baseCooldown: 999,
    triggerTime: 999,
  });
  const ctx = context(knight, [startOnly]);
  const handler = getScriptHandler('dragon_knight');
  handler.onPrepare(knight, ctx);
  assert.ok(knight._dragonKnightKeys.has(startOnly.placementKey), 'canActivate link includes non-cooldown item');

  handler.onPreCombatStart(knight, ctx);
  handler.onCombatStart(knight, ctx);
  assert.equal(ctx.player.debuffReflectStacks, 4, 'Ruby Whelp parent grants Reflect');
  assert.equal(ctx.player.stacks.heat, 5, 'Ruby Whelp parent grants Heat');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'Ruby Whelp parent activates Dragon Knight');

  handler.onPeerActivated(knight, startOnly, ctx);
  assert.equal(knight.triggerTime, 1.275, 'linked activation advances armed iteration cooldown by source percent');

  ctx.player.hp = 80;
  handler.onDealtDamage(knight, ctx, { hit: false });
  assert.equal(ctx.player.hp, 80, 'miss does not heal');
  handler.onDealtDamage(knight, ctx, { hit: true });
  assert.equal(ctx.player.hp, 87, 'hit heals source P3 amount');
}

{
  const knight = piece('dragon_knight', 'you:unprepared', {
    kind: 'weapon',
    cooldown: 1.5,
    baseCooldown: 1.5,
    triggerTime: 1.5,
    _iterationCd: 1.5,
  });
  const startOnly = piece('wooden_buckler', 'you:unprepared-buckler');
  const ctx = context(knight, [startOnly]);
  getScriptHandler('dragon_knight').onPeerActivated(knight, startOnly, ctx);
  assert.equal(knight.triggerTime, 1.5, 'unprepared source has no activation connection');
}

{
  const knight = piece('dragon_knight', 'you:zero', {
    kind: 'weapon',
    params: { heat: 0, p1: 0, reflect: 0, p2: 0, heal: 0, p3: 0, advance: 0, p4: 0 },
  });
  const target = piece('wooden_buckler', 'you:zero-target');
  const ctx = context(knight, [target]);
  const handler = getScriptHandler('dragon_knight');
  handler.onPrepare(knight, ctx);
  handler.onPreCombatStart(knight, ctx);
  handler.onCombatStart(knight, ctx);
  assert.equal(ctx.player.debuffReflectStacks, 0, 'zero Reflect remains zero');
  assert.equal(ctx.player.stacks.heat, 0, 'zero Heat remains zero');
  ctx.player.hp = 80;
  handler.onDealtDamage(knight, ctx, { hit: true });
  assert.equal(ctx.player.hp, 80, 'zero heal remains zero');
}

console.log('OK Dragon Knight source port');
