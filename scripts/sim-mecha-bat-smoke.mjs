import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MechaBat.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-c.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mecha_bat');
const targetItem = catalog.find((item) => item.id === 'shortbow');

assert.ok(sourceItem, 'Mecha Bat: extracted catalog row');
assert.ok(targetItem, 'Mecha Bat: canDamage fixture');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canDamage\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getLucky\(\) >= luckNeeded[\s\S]*useLucky\(luckUsed\)[\s\S]*useStamina\(\)[\s\S]*giveVampirism\(numVamp\)[\s\S]*activate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*character_attacked[\s\S]*onOpponentDamaged/);
assert.match(source, /damageRes\.hasHit\(\)[\s\S]*damageRes\.damageSource\.canApplyLifesteal\(\)[\s\S]*damageRes\.damageSource\.origin in getAffectedItems\(\)/);
assert.match(port, /handlerId: 'mecha_bat'/);
assert.match(port, /onPrepare\(piece, ctx\)/);

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  const mecha = {
    itemId: 'mecha_bat',
    placementKey: 'mecha',
    name: 'Mecha Bat',
    params: { ...params },
    side: 'you',
    alive: true,
    numCharges: 0,
    staminaCost: sourceItem.staminaCost,
  };
  const target = {
    itemId: 'shortbow',
    placementKey: 'target',
    name: 'Shortbow',
    side: 'you',
    alive: true,
    kind: 'weapon',
    damageMin: 2,
    damageMax: 3,
  };
  return {
    t: 2,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [mecha, target],
    itemsById: new Map([
      ['mecha_bat', sourceItem],
      ['shortbow', targetItem],
    ]),
    graph: {
      pieces: new Map([
        ['mecha', { key: 'mecha', id: 'mecha_bat', cells: ['0,0'], affectCells: [
          { cell: '1,0', color: 'primary' },
        ] }],
        ['target', { key: 'target', id: 'shortbow', cells: ['1,0'], affectCells: [] }],
      ]),
      filled: new Map([['0,0', 'mecha'], ['1,0', 'target']]),
    },
    canAffect: {
      rulesById: { mecha_bat: { primary: { op: 'canDamage' } } },
    },
  };
}

const handler = getScriptHandler('mecha_bat');
assert.equal(handler?.handlerId, 'mecha_bat');

const ctx = makeContext();
const mecha = ctx.pieces[0];
handler.onPrepare(mecha, ctx);
mecha.numCharges = 1;
handler.onChargeReceived(mecha, ctx);
assert.equal(mecha._mechaLifesteal, true,
  'Mecha Bat: one received charge enables lifesteal');
ctx.player.hp = 100;
ctx.bus.emit('character_damaged', {
  actor: ctx.player,
  attacker: ctx.dummy,
  t: 2,
  hit: true,
  damage: {
    damage: 10,
    damageSource: { originPiece: ctx.pieces[1], canApplyLifesteal: true },
  },
});
assert.equal(ctx.player.hp, 103,
  'Mecha Bat: opponent hit heals ceil(full damage × lifesteal)');
assert.equal(ctx.events.at(-1)?.type, 'heal',
  'Mecha Bat: lifesteal is logged as a heal after the incoming hit');

const noLifestealHp = ctx.player.hp;
ctx.bus.emit('character_damaged', {
  actor: ctx.player,
  attacker: ctx.dummy,
  hit: true,
  damage: {
    damage: 10,
    damageSource: { originPiece: ctx.pieces[1], canApplyLifesteal: false },
  },
});
assert.equal(ctx.player.hp, noLifestealHp,
  'Mecha Bat: non-lifestealable damage does not heal');

ctx.player.stamina = 2;
grantStacks(ctx.player, 'lucky', 10, { originKey: 'setup', originId: 'setup' });
handler.onCooldownEffect(mecha, ctx);
assert.equal(ctx.player.stacks.lucky, 9,
  'Mecha Bat: cooldown spends the exact Lucky amount');
assert.equal(ctx.player.stacks.vampirism, 6,
  'Mecha Bat: Lucky and stamina branches add both exact Vampirism values');
assert.equal(ctx.player.stamina, 0.5,
  'Mecha Bat: cooldown spends the exact catalog stamina cost');
assert.equal(ctx.events.at(-1)?.type, 'activate',
  'Mecha Bat: activation follows its Vampirism grant');

const zeroCtx = makeContext({
  ...sourceItem.params,
  vampirism: 0,
  p1: 0,
  luckt: 0,
  p2: 0,
  luck: 0,
  p3: 0,
  vampirism2: 0,
  p4: 0,
  lifesteal: 0,
  p5: 0,
});
const zero = zeroCtx.pieces[0];
zero.staminaCost = 0;
handler.onPrepare(zero, zeroCtx);
zeroCtx.player.stamina = 0;
zeroCtx.player.stacks.lucky = 0;
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroCtx.player.stacks.vampirism, 0,
  'Mecha Bat: explicit zero Vampirism values do not invent a grant');
assert.equal(zeroCtx.events.some((event) => event.type === 'activate'), false,
  'Mecha Bat: zero branches do not invent activation');

console.log('Mecha Bat source/parity smoke passed.');
