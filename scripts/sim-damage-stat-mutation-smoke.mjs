import assert from 'node:assert/strict';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { makeRng } from '../js/pages/sim/engine/rng.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { purgeBonusDamage } from '../js/pages/sim/engine/piece-stats.js';

const ids = [
  'cupcake_staff',
  'dancing_dragon',
  'magic_mirror',
  'rainbow_goobert',
  'rainbow_goobert_adventurer',
  'rainbow_goobert_engineer',
  'rainbow_goobert_pyromancer',
];

for (const id of ids) assert.equal(getScriptHandler(id)?.handlerId, id, `${id}: handler`);

function context(pieces, itemsById, graph, player = createActor('player'), dummy = createActor('dummy')) {
  return {
    t: 0,
    player,
    dummy,
    events: [],
    rng: makeRng(7),
    pieces,
    itemsById,
    graph,
    canAffect: null,
  };
}

{
  const piece = {
    itemId: 'cupcake_staff',
    placementKey: 'cupcake',
    name: 'Cupcake Staff',
    params: { dam: 0.2 },
    bonusDamage: 0,
    removableBonusDamage: 0,
  };
  const ctx = context([piece], new Map([['cupcake_staff', { id: 'cupcake_staff' }]]), {
    pieces: new Map(),
    filled: new Map(),
  });
  getScriptHandler('cupcake_staff').onCombatStart(piece, ctx);
  grantStacks(ctx.player, 'heat', 1, { originId: 'test' });
  assert.equal(piece.bonusDamage, 0.2, 'Cupcake Staff keeps fractional damage per buff');
  assert.equal(purgeBonusDamage(piece, 1), 0, 'Varying damage is not removable damage');
  assert.equal(piece.bonusDamage, 0.2, 'Varying damage survives removable damage purge');
}

{
  const piece = {
    itemId: 'dancing_dragon',
    placementKey: 'dragon',
    name: 'Dancing Dragon',
    params: { p1: 0.5, p2: 2, p3: 2 },
    chance: 2,
    bonusDamage: 0,
    removableBonusDamage: 0,
  };
  const magic = { id: 'magic_staff', type: 'Magic Weapon' };
  const itemsById = new Map([
    ['dancing_dragon', { id: 'dancing_dragon', type: 'Ranged Weapon' }],
    ['magic_staff', magic],
  ]);
  const graph = {
    pieces: new Map([
      ['dragon', { id: 'dancing_dragon', affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['magic', { id: 'magic_staff', affectCells: [], cells: ['1,0'] }],
    ]),
    filled: new Map([['1,0', 'magic']]),
  };
  const ctx = context([piece, { itemId: 'magic_staff', placementKey: 'magic', name: 'Magic Staff' }], itemsById, graph);
  getScriptHandler('dancing_dragon').onCombatStart(piece, ctx);
  assert.equal(ctx.player.stacks.heat, 2, 'Dancing Dragon grants heat per magic item');
  assert.equal(piece.bonusDamage, 1, 'Dancing Dragon applies start heat damage');
  grantStacks(ctx.player, 'heat', 1, { originId: 'test' });
  assert.equal(piece.bonusDamage, 1.5, 'Dancing Dragon keeps fractional heat damage');
  grantStacks(ctx.player, 'lucky', 1, { originId: 'test' });
  assert.equal(ctx.player.stackResist.poison, 6, 'Dancing Dragon scales debuff resist per luck');
}

{
  const piece = {
    itemId: 'magic_mirror',
    placementKey: 'mirror',
    name: 'Cold Mirror',
    params: { p1: 20, p2: 20, max: 20 },
    chance: 20,
    chance2: 2,
  };
  const holy = { id: 'holy_spear', type: 'Holy Weapon' };
  const itemsById = new Map([
    ['magic_mirror', { id: 'magic_mirror', type: 'Spell' }],
    ['holy_spear', holy],
  ]);
  const graph = {
    pieces: new Map([
      ['mirror', { id: 'magic_mirror', affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['holy', { id: 'holy_spear', affectCells: [], cells: ['1,0'] }],
    ]),
    filled: new Map([['1,0', 'holy']]),
  };
  const ctx = context([piece, { itemId: 'holy_spear', placementKey: 'holy', name: 'Holy Spear' }], itemsById, graph);
  grantStacks(ctx.player, 'heat', 2, { originId: 'test' });
  grantStacks(ctx.player, 'lucky', 2, { originId: 'test' });
  getScriptHandler('magic_mirror').onCombatStart(piece, ctx);
  assert.equal(ctx.player.debuffReflectChance, 22, 'Cold Mirror adds +2% per affected Holy item');
  getScriptHandler('magic_mirror').onCooldownEffect(piece, ctx);
  const total = ['heat', 'lucky'].reduce((sum, stack) => sum + ctx.player.stacks[stack], 0);
  assert.equal(total, 5, 'Cold Mirror grants a capped proportional buff total');
}

for (const [id, params, expected] of [
  ['rainbow_goobert', { p1: 9, p2: 40, p3: 2, p4: 3, p5: 4 }, { heat: 0, regeneration: 0 }],
  ['rainbow_goobert_adventurer', { p1: 9, p2: 40, p3: 2, p4: 2, p5: 3, p6: 4 }, { heat: 0, regeneration: 2 }],
  ['rainbow_goobert_engineer', { p1: 9, p2: 40, p3: 2, p4: 1, p5: 3, p6: 2, p7: 4, blind: 3, dambonus: 4 }, { heat: 0, regeneration: 1 }],
  ['rainbow_goobert_pyromancer', { p1: 9, p2: 40, p3: 2, p4: 4, p5: 4, p6: 3, blind: 3 }, { heat: 4, regeneration: 0 }],
]) {
  const piece = {
    itemId: id,
    placementKey: id,
    name: id,
    params,
    blockGrant: 20,
  };
  const weapon = {
    itemId: 'wooden_sword',
    placementKey: `${id}:weapon`,
    name: 'Wooden Sword',
    damageMin: 4,
    damageMax: 6,
    empowerable: true,
  };
  const itemsById = new Map([
    [id, { id, type: 'Pet' }],
    ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
  ]);
  const graph = {
    pieces: new Map([
      [id, { id, affectCells: [{ cell: '1,0', color: 'primary' }] }],
      [weapon.placementKey, { id: 'wooden_sword', affectCells: [], cells: ['1,0'] }],
    ]),
    filled: new Map([['1,0', weapon.placementKey]]),
  };
  const player = createActor('player');
  player.hp = 50;
  const dummy = createActor('dummy');
  const ctx = context([piece, weapon], itemsById, graph, player, dummy);
  const handler = getScriptHandler(id);
  handler.onCombatStart(piece, ctx);
  for (let i = 0; i < 9; i += 1) handler.onPeerActivated(piece, weapon, ctx);
  assert.equal(player.block, 20, `${id}: block`);
  assert.equal(player.stacks.vampirism, 2, `${id}: vampirism`);
  assert.equal(player.stacks.heat || 0, expected.heat, `${id}: heat`);
  assert.equal(player.stacks.regeneration || 0, expected.regeneration, `${id}: regeneration`);
  assert.equal(weapon.bonusDamage, 4, `${id}: weapon damage mutation`);
  assert.equal(dummy.stacks.blind, 3, `${id}: blind`);
}

console.log('Damage/stat mutation candidate smoke passed: 7 handlers.');
