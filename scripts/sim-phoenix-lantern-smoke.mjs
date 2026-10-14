import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { dealDamage } from '../js/pages/sim/engine/damage.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

for (const [id, source] of [
  ['phoenix', 'Exclusive/Phoenix.gd'],
  ['phoenix2', 'Exclusive/Phoenix2.gd'],
  ['dark_lantern', 'Exclusive/DarkLantern.gd'],
]) {
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} runtime handler`);
  assert.equal(
    JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8')).byId[id]?.file,
    source,
    `${id} source inventory`,
  );
}

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    kind: /weapon/i.test(item?.type || '') ? 'weapon' : 'passive',
    side: 'you',
    alive: true,
    cooldown: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    triggerTime: item?.cooldown ?? 4,
    damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0,
    accuracy: item?.accuracy ?? 100,
    staminaCost: item?.staminaCost || 0,
    chance: item?.chance || 0,
    chance2: item?.chance2 || 0,
    bonusDamageFactor: 1,
    critChance: 0,
    ...overrides,
  };
}

function graphFor(source, targets) {
  const pieces = new Map([
    [source.placementKey, { key: source.placementKey, id: source.itemId, cells: [], affectCells: targets.map((_, i) => ({ cell: `link-${i}`, color: 'primary' })) }],
  ]);
  const filled = new Map();
  targets.forEach((target, i) => {
    pieces.set(target.placementKey, { key: target.placementKey, id: target.itemId, cells: [], affectCells: [] });
    filled.set(`link-${i}`, target.placementKey);
  });
  return { pieces, filled };
}

function context(player, dummy, pieces, graph) {
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = [];
  dummy._eventLog = [];
  return {
    t: 5,
    player,
    dummy,
    pieces,
    graph,
    itemsById: byId,
    canAffect: null,
    events: [],
    bus,
    rng: () => 0,
    logChain: { nextId: (() => { let n = 0; return () => n++; })() },
  };
}

// Phoenix: Weapon.prepare connects before lethal damage, consumes all Heat, and
// reincarnates for reincarnate_health × Heat exactly once.
{
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const phoenix = piece('phoenix', 'phoenix');
  const ctx = context(player, dummy, [phoenix], graphFor(phoenix, []));
  const handler = getScriptHandler('phoenix');
  handler.onPrepare(phoenix, ctx);
  grantStacks(player, 'heat', 3, { originId: phoenix.itemId });
  dealDamage(dummy, player, {
    amount: 200,
    canMiss: false,
    canCrit: false,
    isAttack: true,
    nowT: ctx.t,
    bus: ctx.bus,
    rng: ctx.rng,
  });
  assert.equal(player.dead, false, 'Phoenix prevents lethal damage when Heat is available');
  assert.equal(player.hp, 18, 'Phoenix reincarnates at reincarnate_health × Heat');
  assert.equal(player.stacks.heat, 0, 'Phoenix consumes all Heat on reincarnation');
  assert.equal(ctx.events.filter((event) => event.itemId === 'phoenix' && event.type === 'activate').length, 1, 'Phoenix activates once on reincarnation');
}

// Enraged Phoenix inherits Phoenix's resurrection listener and adds crit chance
// from each affected Fire item (Phoenix2.gd getNumAffected_type(Type.Fire)).
{
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const enraged = piece('phoenix2', 'enraged');
  const fire = piece('phoenix', 'fire');
  const ctx = context(player, dummy, [enraged, fire], graphFor(enraged, [fire]));
  const handler = getScriptHandler('phoenix2');
  assert.equal(typeof handler.onPrepare, 'function', 'Enraged Phoenix exposes inherited Phoenix prepare');
  handler.onPrepare(enraged, ctx);
  assert.equal(enraged.critChance, 6, 'Enraged Phoenix gains its configured crit chance per Fire item');
  grantStacks(player, 'heat', 2, { originId: enraged.itemId });
  dealDamage(dummy, player, {
    amount: 200,
    canMiss: false,
    canCrit: false,
    isAttack: true,
    nowT: ctx.t,
    bus: ctx.bus,
    rng: ctx.rng,
  });
  assert.equal(player.dead, false, 'Enraged Phoenix inherits Phoenix reincarnation');
  assert.equal(player.hp, 12, 'Enraged Phoenix uses the inherited resurrection health');
}

// Dark Lantern reacts to any reincarnation. Enraged Phoenix counts as six Fire
// types through getTypeMultiplicity(Type.Fire), so its linked effect is 5 × 6.
{
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const lantern = piece('dark_lantern', 'lantern');
  const enraged = piece('phoenix2', 'enraged');
  const ctx = context(player, dummy, [lantern, enraged], graphFor(lantern, [enraged]));
  const handler = getScriptHandler('dark_lantern');
  handler.onPrepare(lantern, ctx);
  ctx.bus.emit('reincarnated', { actor: player, sourceId: enraged.itemId, t: ctx.t });
  assert.equal(dummy.hp, 70, 'Dark Lantern deals damage for Enraged Phoenix Fire multiplicity');
}

// Combat-start activation is only the item's activation pulse. The source does
// not grant invulnerability until the later lethal-hit reincarnation path.
{
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player.block = 25;
  const lantern = piece('dark_lantern', 'lantern');
  const ctx = context(player, dummy, [lantern], graphFor(lantern, []));
  const handler = getScriptHandler('dark_lantern');
  handler.onPrepare(lantern, ctx);
  handler.onCombatStart(lantern, ctx);
  assert.equal(player.hp, 50, 'Dark Lantern combat start removes 50% max HP');
  assert.equal(player.block, 25, 'Dark Lantern loseHealth bypasses Block');
  assert.equal(player.invulnUntil, 0, 'Dark Lantern does not grant invulnerability at combat start');
  assert.equal(
    ctx.events.filter((event) => event.type === 'activate' && event.itemId === 'dark_lantern').length,
    1,
    'Dark Lantern still emits its combat-start activation event',
  );
}

// Cross-item lifecycle: the game gives Dark Lantern High trigger priority, so
// it wins the shared lethal trigger before either Normal-priority Phoenix. Its
// reincarnation signal still drives the Fire-multiplicity pulse exactly once.
{
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const phoenix = piece('phoenix', 'phoenix');
  const enraged = piece('phoenix2', 'enraged');
  const lantern = piece('dark_lantern', 'lantern');
  const ctx = context(player, dummy, [phoenix, enraged, lantern], graphFor(lantern, [phoenix, enraged]));
  getScriptHandler('phoenix').onPrepare(phoenix, ctx);
  getScriptHandler('phoenix2').onPrepare(enraged, ctx);
  getScriptHandler('dark_lantern').onPrepare(lantern, ctx);
  grantStacks(player, 'heat', 2, { originId: phoenix.itemId });
  dealDamage(dummy, player, {
    amount: 200,
    canMiss: false,
    canCrit: false,
    isAttack: true,
    nowT: ctx.t,
    bus: ctx.bus,
    rng: ctx.rng,
  });
  assert.equal(player.hp, 50, 'Dark Lantern wins the High-priority lethal trigger');
  assert.equal(player.stacks.heat, 2, 'Dark Lantern does not consume Phoenix Heat');
  assert.equal(dummy.hp, 65, 'Dark Lantern reacts to Phoenix and Enraged Phoenix Fire multiplicity');
  assert.equal(ctx.events.filter((event) => event.type === 'activate' && event.itemId === 'phoenix').length, 0, 'Phoenix does not preempt the higher-priority lantern');
  assert.equal(ctx.events.filter((event) => event.type === 'activate' && event.itemId === 'dark_lantern').length, 1, 'Dark Lantern activates once in the combined path');
}

console.log('OK Phoenix, Enraged Phoenix, and Dark Lantern lifecycle/synergy');
