import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/ThornBow.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-basic.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('const thornBowPort'),
  handlerSource.indexOf('const woodenSwordPort'),
);

assert.equal(inventory.byId.thorn_bow?.file, 'ThornBow.gd');
assert.deepEqual(inventory.byId.thorn_bow?.overrides, ['doCooldownEffect', 'onCombatStart', 'onPrepare']);
assert.match(source, /func hasAttackEffect\(\) -> bool:[\s\S]*return true/);
assert.match(source, /func onPrepare\(\):[\s\S]*bonusCounter = 0[\s\S]*setState\(bonusCounter\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveSpikes\(getP1\(\)\)[\s\S]*activate\(null, false\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useStamina\(\)[\s\S]*dealDamage\(\)[\s\S]*activate\(res\)[\s\S]*reduceBonusDamage\(tempBonusDam \* bonusCounter, false\)/);
assert.match(source, /func onWeaponAttacked\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollDoubleAttackEffect\(\)[\s\S]*useSpikes\(1, damageRes\.event\)[\s\S]*addBonusDamage\(tempBonusDam\)/);
assert.match(port, /prepareBow\(piece, ctx/);
assert.match(port, /forAttackEffects\(piece, ctx\.rng/);
assert.match(port, /spendStacks\(ctx\.player, 'spikes', 1/);
assert.match(port, /addBonusDamage\(piece, per\)/);
assert.match(port, /weaponStrike\(piece, ctx, 'thorn_bow'/);

function makeContext(params = { p1: 2, p2: 3 }, doubleAttackEffectChance = 0) {
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const thorn = {
    itemId: 'thorn_bow',
    name: 'Thorn Bow',
    placementKey: 'thorn',
    side: 'you',
    kind: 'weapon',
    params,
    damageMin: 9,
    damageMax: 9,
    staminaCost: 1,
    accuracy: 100,
    alive: true,
    bonusDamage: 0,
    doubleAttackEffectChance,
  };
  const first = {
    itemId: 'first_weapon',
    name: 'Linked Weapon',
    placementKey: 'first',
    side: 'you',
    kind: 'weapon',
  };
  const second = {
    itemId: 'second_weapon',
    name: 'Unlinked Weapon',
    placementKey: 'second',
    side: 'you',
    kind: 'weapon',
  };
  const itemsById = new Map([
    ['thorn_bow', { id: 'thorn_bow', type: 'Ranged Weapon' }],
    ['first_weapon', { id: 'first_weapon', type: 'Weapon' }],
    ['second_weapon', { id: 'second_weapon', type: 'Weapon' }],
  ]);
  const graph = {
    pieces: new Map([
      ['thorn', { id: 'thorn_bow', cells: ['0,0'], affectCells: [{ cell: '1,0' }, { cell: '2,0' }] }],
      ['first', { id: 'first_weapon', cells: ['1,0'], affectCells: [] }],
      ['second', { id: 'second_weapon', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'thorn'], ['1,0', 'first'], ['2,0', 'second']]),
  };
  return {
    thorn,
    first,
    second,
    ctx: {
      t: 1,
      player,
      dummy,
      bus,
      events: [],
      rng: () => 0,
      graph,
      itemsById,
      pieces: [thorn, first, second],
    },
  };
}

function attacked(ctx, piece, hit) {
  ctx.bus.emit('item_attacked', { piece, hit, t: ctx.t });
}

const runtime = getScriptHandler('thorn_bow');
assert.equal(runtime?.handlerId, 'thorn_bow');

{
  const { thorn, first, second, ctx } = makeContext();
  runtime.onPrepare(thorn, ctx);
  assert.equal(thorn._bowAffectedWeapon, 'first', 'Thorn Bow listens to the first affected weapon');
  runtime.onCombatStart(thorn, ctx);
  assert.equal(ctx.player.stacks.spikes, 2, 'combat start grants source P1 spikes');
  attacked(ctx, second, { hit: true, damage: 5 });
  assert.equal(thorn.bonusDamage, 0, 'unlinked attacks do not charge Thorn Bow');
  attacked(ctx, first, { hit: false, damage: 0 });
  assert.equal(thorn.bonusDamage, 0, 'misses do not charge Thorn Bow');
  attacked(ctx, first, { hit: true, damage: 5 });
  assert.equal(ctx.player.stacks.spikes, 1, 'a linked hit spends one spike');
  assert.equal(thorn._thornBonusN, 1, 'a linked hit records one temporary bonus');
  assert.equal(thorn.bonusDamage, 3, 'a linked hit adds source P2 damage');
  const dummyBefore = ctx.dummy.hp;
  runtime.onCooldownEffect(thorn, ctx);
  assert.equal(ctx.dummy.hp, dummyBefore - 12, 'Thorn Bow strikes with its temporary damage');
  assert.equal(thorn.bonusDamage, 0, 'the temporary damage is removed after the strike');
  assert.equal(thorn._thornBonusN, 0, 'the temporary bonus counter resets after the strike');
}

{
  const { thorn, first, ctx } = makeContext({ p1: 2, p2: 3 }, 1);
  runtime.onPrepare(thorn, ctx);
  grantStacks(ctx.player, 'spikes', 2);
  attacked(ctx, first, { hit: true, damage: 5 });
  assert.equal(ctx.player.stacks.spikes, 0, 'double attack effect spends one spike per effect');
  assert.equal(thorn._thornBonusN, 2, 'double attack effect records both bonuses');
  assert.equal(thorn.bonusDamage, 6, 'double attack effect adds source P2 twice');
}

{
  const { thorn, first, ctx } = makeContext({ p1: 0, p2: 0 });
  runtime.onPrepare(thorn, ctx);
  runtime.onCombatStart(thorn, ctx);
  attacked(ctx, first, { hit: true, damage: 5 });
  assert.equal(ctx.player.stacks.spikes, 0, 'zero source spikes remain zero');
  assert.equal(thorn.bonusDamage, 0, 'zero source bonus damage remains zero');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'combat-start activation remains present at zero values');
}

console.log('OK Thorn Bow source, linked weapon listener, spike spending, double attack effects, temporary damage, and zero-safe values regression');
