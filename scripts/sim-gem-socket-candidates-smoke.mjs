import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import {
  prepareGemSockets,
  tickGemSocketEffects,
} from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const sourceFiles = {
  regular_emerald: 'Gems/Emerald.gd',
  regular_ruby: 'Gems/Ruby.gd',
  regular_sapphire: 'Gems/Sapphire.gd',
  regular_topaz: 'Gems/Topaz.gd',
  wisp: 'Exclusive/Wisp.gd',
};

for (const [id, file] of Object.entries(sourceFiles)) {
  assert.ok(fs.existsSync(`tools/game-extract-full/Items/${file}`), `${id} source exists`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} has an explicit handler`);
}

function piece(id, key, side = 'you') {
  const item = byId.get(id);
  return {
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    side,
    alive: true,
    cooldown: Number(item?.cooldown) || 999,
    triggerTime: Number(item?.cooldown) || 999,
    bonusDamageFactor: 1,
    accuracy: 100,
  };
}

function context(player = createActor('player'), dummy = createActor('dummy')) {
  return {
    player,
    dummy,
    events: [],
    rng: () => 0,
    t: 5,
    bus: createCombatBus(),
    itemsById: byId,
    graph: { pieces: new Map(), filled: new Map() },
    pieces: [],
  };
}

// The four Regular tiers retain their source aliases and inventory effects.
for (const [id, sceneFile, source] of [
  ['regular_emerald', 'Gems/RegularEmerald.tscn', 'Gems/Emerald.gd'],
  ['regular_ruby', 'Gems/RegularRuby.tscn', 'Gems/Ruby.gd'],
  ['regular_sapphire', 'Gems/RegularSapphire.tscn', 'Gems/Sapphire.gd'],
  ['regular_topaz', 'Gems/RegularTopaz.tscn', 'Gems/Topaz.gd'],
]) {
  assert.equal(inventory.byId[id]?.sceneFile, sceneFile, `${id} scene alias`);
  assert.equal(inventory.byId[id]?.file, source, `${id} inherited source`);
}
{
  const ctx = context();
  getScriptHandler('regular_emerald').onCooldownEffect(piece('regular_emerald', 'emerald'), ctx);
  assert.equal(ctx.player.stacks.regeneration, 3, 'Regular Emerald inventory regeneration');
}
{
  const ctx = context();
  getScriptHandler('regular_ruby').onCooldownEffect(piece('regular_ruby', 'ruby'), ctx);
  assert.equal(ctx.dummy.hp, ctx.dummy.maxHp - 10, 'Regular Ruby inventory effect damage');
  assert.equal(ctx.player.hp, ctx.player.maxHp, 'Regular Ruby inventory lifesteal');
}
{
  const ctx = context();
  getScriptHandler('regular_sapphire').onCooldownEffect(piece('regular_sapphire', 'sapphire'), ctx);
  assert.equal(ctx.dummy.stacks.cold, 4, 'Regular Sapphire inventory cold');
}
{
  const ctx = context();
  getScriptHandler('regular_topaz').onPrepare(piece('regular_topaz', 'topaz'), ctx);
  assert.equal(ctx.player.staminaRegen, 1.2, 'Regular Topaz inventory stamina regeneration');
}

// Socketed Regular effects still follow the source prepareWeapon/prepareArmor paths.
{
  const ctx = context();
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: 'emerald-socket', x: 0, y: 0, r: 0, gems: ['regular_emerald'] }],
    byId,
  );
  weapon.damageMin = weapon.damageMax = 20;
  weapon.accuracy = 100;
  prepareGemSockets(weapon, ctx);
  dealHit(weapon, ctx, 20);
  assert.equal(ctx.dummy.stacks.poison, 1, 'Regular Emerald socket poison');
}
{
  const ctx = context();
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'sapphire-armor', x: 0, y: 0, r: 0, gems: ['regular_sapphire'] }],
    byId,
  );
  prepareGemSockets(armor, ctx);
  ctx.player.stacks.mana = 5;
  ctx.player._buffListeners?.forEach((fn) => fn({ stack: 'mana', amount: 5 }));
  assert.ok(ctx.player.block > 0, 'Regular Sapphire armor converts mana to block');
}
{
  const ctx = context();
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'topaz-armor', x: 0, y: 0, r: 0, gems: ['regular_topaz'] }],
    byId,
  );
  prepareGemSockets(armor, ctx);
  assert.equal(ctx.player.stunResistance, 20, 'Regular Topaz armor stun resistance');
  assert.equal(ctx.player.critResistance, 10, 'Regular Topaz armor crit resistance');
}

// Wisp inventory, weapon, and armor modes all have source-backed behavior.
{
  const ctx = context();
  getScriptHandler('wisp').onCooldownEffect(piece('wisp', 'wisp'), ctx);
  assert.equal(ctx.player.stacks.lucky, 10, 'Wisp inventory luck');
  assert.equal(ctx.player.stacks.regeneration, 10, 'Wisp inventory regeneration');
}
{
  const ctx = context();
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: 'wisp-weapon', x: 0, y: 0, r: 0, gems: ['wisp'] }],
    byId,
  );
  weapon.damageMin = weapon.damageMax = 20;
  weapon.accuracy = 100;
  prepareGemSockets(weapon, ctx);
  dealHit(weapon, ctx, 20);
  dealHit(weapon, ctx, 20);
  assert.equal(ctx.player.stacks.spikes, 1, 'Wisp weapon damage threshold grants spikes');
}
{
  const ctx = context();
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'wisp-armor', x: 0, y: 0, r: 0, gems: ['wisp'] }],
    byId,
  );
  prepareGemSockets(armor, ctx);
  assert.equal(armor._socketGemTimers?.[0]?.remaining, 12, 'Wisp armor arms its own cooldown');
  tickGemSocketEffects(armor, ctx, 12);
  assert.equal(ctx.player.maxHp, 270, 'Wisp armor grants temporary max health');
  assert.equal(ctx.player.hp, 270, 'Wisp armor grants matching current health');

  const run = simulateEngine({
    placements: [{ id: 'leather_armor', key: 'wisp-run', x: 0, y: 0, r: 0, gems: ['wisp'] }],
    itemsById: byId,
    durationSec: 15,
    playerMaxHp: 200,
    dummyAttacks: false,
  });
  assert.equal(run.playerMaxHp, 270, 'Wisp armor timer runs in the simulator loop');
}

console.log('OK gem/socket candidates: Regular Emerald, Ruby, Sapphire, Topaz, Wisp');
