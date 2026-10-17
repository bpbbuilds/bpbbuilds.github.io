import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import {
  prepareGemSockets,
  tickGemSocketEffects,
} from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Wisp.gd', 'utf8');
assert.match(source, /func prepareInventory\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* natureSpeed\)/);
assert.match(source, /func onAttack\(damageRes[^)]*\):[\s\S]*damageAcc \/ damageForSpikes[\s\S]*giveSpikes\(spikes \* numProccs\)[\s\S]*miniActivate\(\)/);
assert.match(source, /GemMode\.Armor:[\s\S]*giveMaxHealth\(bonusHealth\)[\s\S]*onAfterEffectFinished\(false\)[\s\S]*consumed = true[\s\S]*miniActivate\(\)/);

const handler = getScriptHandler('wisp');
assert.equal(typeof handler?.onPrepare, 'function', 'Wisp inventory preparation is ported');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Wisp inventory cooldown is ported');

{
  const actor = createActor('player');
  const wisp = {
    itemId: 'wisp',
    placementKey: 'wisp',
    name: 'Wisp',
    params: { luck: 10, regen: 10, speed: 15, p1: 10, p2: 10 },
    buffPowers: { lucky: 1.5, regeneration: 2 },
    speedScale: 0,
    side: 'you',
    kind: 'gadget',
    alive: true,
  };
  const nature = { itemId: 'nature_item', placementKey: 'nature', side: 'you', kind: 'weapon' };
  const unrelated = { itemId: 'wooden_sword', placementKey: 'sword', side: 'you', kind: 'weapon' };
  const ctx = {
    t: 2,
    player: actor,
    events: [],
    pieces: [wisp, nature, unrelated],
    graph: {
      pieces: new Map([
        ['wisp', { key: 'wisp', id: 'wisp', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }],
        ['nature', { key: 'nature', id: 'nature_item', cells: ['1,0'], affectCells: [] }],
        ['sword', { key: 'sword', id: 'wooden_sword', cells: ['2,0'], affectCells: [] }],
      ]),
      filled: new Map([['0,0', 'wisp'], ['1,0', 'nature'], ['2,0', 'sword']]),
    },
    itemsById: new Map([
      ['wisp', { id: 'wisp', type: 'Gem' }],
      ['nature_item', { id: 'nature_item', type: 'Nature' }],
      ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
    ]),
    canAffect: null,
  };
  handler.onPrepare(wisp, ctx);
  assert.equal(wisp.speedScale, 0.15, 'Wisp speed only counts linked Nature items');
  handler.onCooldownEffect(wisp, ctx);
  assert.equal(actor.stacks.lucky, 15, 'Wisp Lucky uses source value and buff power');
  assert.equal(actor.stacks.regeneration, 20, 'Wisp Regeneration uses source value and buff power');
  assert.equal(wisp.alive, false, 'inventory Wisp consumes through onAfterEffectFinished');
  assert.ok(ctx.events.some((event) => event.type === 'activate' && event.meta?.handler === 'wisp'), 'inventory Wisp activates');
}

{
  const actor = createActor('player');
  const piece = {
    itemId: 'wisp',
    placementKey: 'zero-wisp',
    name: 'Wisp',
    params: { luck: 0, regen: 0, speed: 0 },
    side: 'you',
    kind: 'gadget',
    alive: true,
  };
  const ctx = { t: 0, player: actor, events: [], itemsById: new Map([['wisp', { type: 'Gem' }]]) };
  handler.onCooldownEffect(piece, ctx);
  assert.equal(actor.stacks.lucky, 0, 'explicit zero Wisp Lucky stays zero');
  assert.equal(actor.stacks.regeneration, 0, 'explicit zero Wisp Regeneration stays zero');
}

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

{
  const ctx = {
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    rng: () => 0,
    t: 1,
    bus: createCombatBus(),
    itemsById: byId,
    graph: { pieces: new Map(), filled: new Map() },
    pieces: [],
  };
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: 'wisp-weapon', x: 0, y: 0, r: 0, gems: ['wisp'] }],
    byId,
  );
  weapon.damageMin = weapon.damageMax = 20;
  weapon.accuracy = 100;
  prepareGemSockets(weapon, ctx);
  dealHit(weapon, ctx, 20);
  dealHit(weapon, ctx, 20);
  assert.equal(ctx.player.stacks.spikes, 2, 'Wisp weapon uses fractional source proc counts with stack rounding');
  assert.equal(ctx.events.filter((event) => event.meta?.handler === 'wisp' && event.meta?.miniActivate).length, 2, 'each Wisp weapon proc mini-activates');
}

{
  const socketCatalog = new Map(byId);
  socketCatalog.set('wisp', { ...byId.get('wisp'), gemPower: 2 });
  const ctx = {
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    rng: () => 0,
    t: 1,
    bus: createCombatBus(),
    itemsById: socketCatalog,
    graph: { pieces: new Map(), filled: new Map() },
    pieces: [],
  };
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'wisp-armor', x: 0, y: 0, r: 0, gems: ['wisp'] }],
    socketCatalog,
  );
  prepareGemSockets(armor, ctx);
  assert.equal(armor._socketGemTimers?.[0]?.gemPower, 2, 'Wisp armor retains socket gem power');
  tickGemSocketEffects(armor, ctx, 12);
  assert.equal(ctx.player.maxHp, 340, 'Wisp armor scales max health by source gem power');
  assert.equal(ctx.player.hp, 340, 'Wisp armor grants matching current health');
  assert.equal(ctx.events.filter((event) => event.meta?.handler === 'wisp' && event.meta?.miniActivate).length, 1, 'Wisp armor mini-activates after max health');
}

console.log('OK Wisp source parity');
