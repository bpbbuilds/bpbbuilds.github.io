import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Bow.gd', 'utf8');
assert.match(source, /affectedWeapon = getFirstAffectedItem\(\)/);
assert.match(source, /connectForCombat\(affectedWeapon, "attacked", "onWeaponAttacked"\)/);

for (const id of ['bow', 'bow_and_arrow', 'lucky_bow', 'poison_bow', 'thorn_bow']) {
  assert.equal(typeof getScriptHandler(id)?.onPrepare, 'function', `${id} prepares through Bow`);
}

function makeCtx(bowId, params = {}) {
  const bus = createCombatBus();
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bow = {
    itemId: bowId,
    name: bowId,
    placementKey: 'bow',
    side: 'you',
    kind: 'weapon',
    params,
    damageMin: 3,
    damageMax: 3,
    staminaCost: 1,
    accuracy: 100,
    alive: true,
    bonusDamage: 0,
  };
  const first = { itemId: 'first_weapon', placementKey: 'first', kind: 'weapon', side: 'you' };
  const second = { itemId: 'second_weapon', placementKey: 'second', kind: 'weapon', side: 'you' };
  const itemsById = new Map([
    [bowId, { id: bowId, type: 'Weapon' }],
    ['first_weapon', { id: 'first_weapon', type: 'Weapon' }],
    ['second_weapon', { id: 'second_weapon', type: 'Weapon' }],
  ]);
  const graph = {
    pieces: new Map([
      ['bow', { id: bowId, cells: ['0,0'], affectCells: [{ cell: '1,0' }, { cell: '2,0' }] }],
      ['first', { id: 'first_weapon', cells: ['1,0'], affectCells: [] }],
      ['second', { id: 'second_weapon', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'bow'], ['1,0', 'first'], ['2,0', 'second']]),
  };
  return {
    bow,
    first,
    second,
    ctx: { t: 1, player, dummy, bus, events: [], rng: () => 0, graph, itemsById, pieces: [bow, second, first] },
  };
}

function attacked(ctx, piece, hit) {
  ctx.bus.emit('item_attacked', { piece, hit, t: ctx.t });
}

{
  const { bow, ctx } = makeCtx('bow');
  getScriptHandler('bow').onPrepare(bow, ctx);
  assert.equal(bow._bowAffectedWeapon, 'first', 'Bow selects the first affected weapon, not piece order');
}

{
  const { bow, first, second, ctx } = makeCtx('bow_and_arrow', { p1: 2, p2: 4 });
  getScriptHandler('bow_and_arrow').onPrepare(bow, ctx);
  attacked(ctx, second, { hit: true, damage: 9 });
  assert.equal(bow.bonusDamage, 0, 'Bow and Arrow ignores later affected weapons');
  attacked(ctx, first, { hit: true, damage: 9 });
  attacked(ctx, first, { hit: true, damage: 9 });
  attacked(ctx, first, { hit: true, damage: 9 });
  assert.equal(bow.bonusDamage, 4, 'Bow and Arrow grows only from the prepared weapon and caps at p2');
}

{
  const { bow, first, ctx } = makeCtx('lucky_bow', { p1: 2 });
  getScriptHandler('lucky_bow').onPrepare(bow, ctx);
  attacked(ctx, first, { hit: true, critical: true });
  assert.equal(bow._luckyExtra, true, 'Lucky Bow arms from its prepared weapon critical');
  const handled = getScriptHandler('lucky_bow').onCooldownEffect(bow, ctx);
  assert.equal(handled, true, 'Lucky Bow cooldown fires');
  assert.equal(bow._luckyExtra, false, 'Lucky Bow consumes the prepared critical extra attack');
  assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 2, 'Lucky Bow makes its source extra attack');
}

{
  const { bow, first, ctx } = makeCtx('poison_bow', { p1: 5, p2: 1 });
  getScriptHandler('poison_bow').onPrepare(bow, ctx);
  attacked(ctx, first, { hit: true, damage: 7 });
  assert.equal(bow._poisonAcc, 7, 'Poison Bow banks prepared weapon damage');
  getScriptHandler('poison_bow').onCooldownEffect(bow, ctx);
  assert.equal(ctx.dummy.stacks.poison, 1, 'Poison Bow converts its prepared weapon damage into poison');
}

{
  const { bow, first, ctx } = makeCtx('thorn_bow', { p1: 2, p2: 3 });
  getScriptHandler('thorn_bow').onPrepare(bow, ctx);
  grantStacks(ctx.player, 'spikes', 2);
  attacked(ctx, first, { hit: true, damage: 5 });
  assert.equal(bow._thornBonusN, 1, 'Thorn Bow spends spikes after its prepared weapon hit');
  assert.equal(bow.bonusDamage, 3, 'Thorn Bow adds its prepared-hit bonus');
}

console.log('OK shared Bow prepare and all derived bow listeners');
