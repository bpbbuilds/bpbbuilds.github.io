import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import noops from '../assets/data/sim-intentional-noops.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const canAffectRules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: canAffectRules.byId,
  craftedIds: new Set(canAffectRules.craftedIds),
  classMasks: canAffectRules.classMasks,
  classBits: canAffectRules.classBits,
  rarityRank: canAffectRules.rarityRank,
};

function source(id, file, sceneFile, extendsName, overrides) {
  const row = inventory.byId[id];
  assert.ok(row, `${id} has a source inventory row`);
  assert.equal(row.file, file);
  if (sceneFile) assert.equal(row.sceneFile, sceneFile);
  assert.equal(row.extends, extendsName);
  assert.deepEqual(row.overrides, overrides);
  return row;
}

const cog = source('cog', 'Exclusive/Cog.gd', null, 'Item', ['onCombatStart']);
const cogBadge = source(
  'cog_badge',
  'Exclusive/CogBadge.gd',
  null,
  'Item',
  ['doCooldownEffect'],
);
const trap = source(
  'con_trap_tron',
  'Exclusive/ConTrapTron.gd',
  null,
  'Item',
  ['onPrepare'],
);
assert.match(fs.readFileSync('tools/game-extract-full/Items/Coins.tscn', 'utf8'), /node name="Coins"/);
assert.ok(fs.existsSync('tools/game-extract-full/Items/Exclusive/Cog.tscn'));
assert.ok(fs.existsSync('tools/game-extract-full/Items/Exclusive/CogBadge.tscn'));
const coinNoop = [...noops.shopNoCombat, ...noops.wearablesShopOnly].find(
  (row) => row.id === 'coins',
);
assert.equal(coinNoop?.why, 'currency; no Item combat script in extract');
for (const id of ['cog', 'cog_badge', 'con_trap_tron']) {
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} has an explicit handler`);
}

// Cog.gd counts only canAffect(isCrafted) star targets and grants block once
// at combat start. The fake graph keeps this test independent of placement UI.
{
  const crafted = {
    id: 'crafted_test',
    name: 'Crafted Test Weapon',
    type: 'Melee Weapon',
    isCrafted: true,
    cooldown: 1,
    shape: [[1]],
  };
  const items = new Map([
    [byId.get('cog').id, byId.get('cog')],
    [crafted.id, crafted],
  ]);
  const cogPiece = {
    itemId: 'cog',
    placementKey: 'cog',
    name: 'Cog',
    kind: 'passive',
    blockGrant: 5,
    side: 'you',
    alive: true,
    params: {},
  };
  const targetPiece = {
    itemId: crafted.id,
    placementKey: 'crafted',
    kind: 'weapon',
    side: 'you',
    alive: true,
    cooldown: 1,
  };
  const graph = {
    pieces: new Map([
      ['cog', { key: 'cog', id: 'cog', affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['crafted', { key: 'crafted', id: crafted.id, affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'crafted']]),
  };
  const player = createActor('player');
  const events = [];
  getScriptHandler('cog').onCombatStart(cogPiece, {
    player,
    dummy: createActor('dummy'),
    events,
    t: 2.5,
    graph,
    itemsById: items,
    canAffect,
    pieces: [cogPiece, targetPiece],
  });
  assert.equal(player.block, 5);
  assert.ok(events.some((event) => event.meta?.handler === 'cog'));
}

// CogBadge.gd uses its explicit 14-cell path, activates before sending it,
// broadcasts charge_emitted, then disables its cooldown without consuming.
{
  const placements = [{ id: 'cog_badge', key: 'badge', x: 0, y: 0, r: 0 }];
  const pieces = buildCombatPieces(placements, byId);
  const badge = pieces.find((piece) => piece.itemId === 'cog_badge');
  assert.ok(badge);
  const events = [];
  const bus = createCombatBus();
  let chargeSignal = 0;
  bus.on('charge_emitted', () => { chargeSignal += 1; });
  const handler = getScriptHandler('cog_badge');
  handler.onCooldownEffect(badge, {
    player: createActor('player'),
    dummy: createActor('dummy'),
    events,
    t: 4,
    graph: buildBoardGraph(placements, byId),
    itemsById: byId,
    canAffect,
    pieces,
    chargeJobs: [],
    bus,
  });
  assert.equal(events.find((event) => event.type === 'activate')?.itemId, 'cog_badge');
  const charge = events.find((event) => event.type === 'charge' && event.meta?.phase === 'start');
  assert.equal(charge?.meta?.chargePath?.cells?.length, 14);
  assert.equal(chargeSignal, 1);
  assert.equal(badge.alive, true);
  assert.equal(badge.cooldown, 999);
}

// ConTrapTron.gd caches its first linked cooldown item in onPrepare, applies
// the speed malus immediately, and later emits two charge paths plus the
// base/bonus cooldown advance when the owner falls below 70% health.
{
  const trapItem = byId.get('con_trap_tron');
  const targetItem = {
    id: 'trap_test_gadget',
    name: 'Trap Test Gadget',
    type: 'Accessory',
    cooldown: 3,
    shape: [[1]],
  };
  const items = new Map([[trapItem.id, trapItem], [targetItem.id, targetItem]]);
  const trapPiece = {
    itemId: 'con_trap_tron',
    placementKey: 'trap',
    name: 'Con-Trap-Tron',
    kind: 'passive',
    side: 'you',
    alive: true,
    params: trapItem.params,
    chance: trapItem.chance,
    chance2: trapItem.chance2,
  };
  const targetPiece = {
    itemId: targetItem.id,
    placementKey: 'target',
    name: targetItem.name,
    kind: 'gadget',
    side: 'you',
    alive: true,
    cooldown: 3,
    triggerTime: 6,
  };
  const graph = {
    pieces: new Map([
      ['trap', { key: 'trap', id: trapPiece.itemId, x: 0, y: 0, r: 0, affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['target', { key: 'target', id: targetPiece.itemId, affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'target']]),
  };
  const player = createActor('player', { maxHp: 100 });
  player.hp = 60;
  const dummy = createActor('dummy');
  const events = [];
  const bus = createCombatBus();
  const ctx = {
    player,
    dummy,
    events,
    t: 5,
    graph,
    itemsById: items,
    canAffect: { rulesById: canAffectRules.byId },
    pieces: [trapPiece, targetPiece],
    chargeJobs: [],
    bus,
    rng: () => 0,
  };
  const handler = getScriptHandler('con_trap_tron');
  handler.onPrepare(trapPiece, ctx);
  assert.equal(targetPiece.speedScale, -0.1);
  bus.emit('character_damaged', { actor: player, hit: true, t: 5 });
  assert.ok(events.some((event) => event.meta?.handler === 'con_trap_tron' && event.type === 'activate'));
  assert.equal(targetPiece.triggerTime, 1);
  assert.equal(events.filter((event) => event.type === 'charge' && event.meta?.phase === 'start').length, 2);
}

console.log('OK Cog, Cog Badge, Coins, and Con-Trap-Tron source ports');
