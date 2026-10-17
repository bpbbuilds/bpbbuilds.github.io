import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor, giveStamina } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MercuryElemental.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-c.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'mercury_elemental');
const targetItem = catalog.find((item) => item.id === 'greatsword');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));

assert.ok(sourceItem, 'Mercury Elemental: extracted catalog row');
assert.ok(targetItem, 'Mercury Elemental: melee target fixture');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.descriptor\.isMeleeWeapon\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*character_attacked[\s\S]*character_used_stamina/);
assert.match(source, /giveBlock\(getBlock\(\) \/ 100\.0 \* damageRes\.damage\)/);
assert.match(source, /staminaRegen = getP\("stamina"\) \* getNumDistinctAffectedItems\(\)/);
assert.match(source, /var ticks = floor\(staminaUsed \/ staminaThreshold\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveStamina\(staminaRegen\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'mercury_elemental'/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.doesNotMatch(port, /onCombatStart\(piece, ctx\) \{[\s\S]{0,900}handlerId: 'mercury_elemental'/);

function makeContext(params = sourceItem.params, blockGrant = sourceItem.block) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  const mercury = {
    itemId: 'mercury_elemental',
    placementKey: 'mercury',
    name: 'Mercury Elemental',
    params: { ...params },
    side: 'you',
    kind: 'pet',
    alive: true,
    blockGrant,
  };
  const weaponA = {
    itemId: 'greatsword',
    placementKey: 'weapon-a',
    name: 'Greatsword A',
    side: 'you',
    kind: 'weapon',
    alive: true,
  };
  const weaponB = {
    itemId: 'greatsword',
    placementKey: 'weapon-b',
    name: 'Greatsword B',
    side: 'you',
    kind: 'weapon',
    alive: true,
  };
  return {
    t: 2,
    player,
    dummy,
    bus,
    events,
    pieces: [mercury, weaponA, weaponB],
    itemsById: new Map([
      ['mercury_elemental', sourceItem],
      ['greatsword', targetItem],
    ]),
    graph: {
      pieces: new Map([
        ['mercury', {
          key: 'mercury',
          id: 'mercury_elemental',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'primary' },
          ],
        }],
        ['weapon-a', { key: 'weapon-a', id: 'greatsword', cells: ['1,0'], affectCells: [] }],
        ['weapon-b', { key: 'weapon-b', id: 'greatsword', cells: ['2,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'mercury'],
        ['1,0', 'weapon-a'],
        ['2,0', 'weapon-b'],
      ]),
    },
    canAffect: {
      rulesById: rules.byId,
    },
  };
}

const handler = getScriptHandler('mercury_elemental');
assert.equal(handler?.handlerId, 'mercury_elemental');

const ctx = makeContext();
bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
const mercury = ctx.pieces[0];
handler.onPrepare(mercury, ctx);
assert.equal(mercury._mercStam, 1,
  'Mercury Elemental: same-descriptor melee links count once for stamina regeneration');

ctx.bus.emit('character_damaged', {
  actor: ctx.player,
  attacker: ctx.dummy,
  t: 2,
  hit: true,
  damage: { damage: 7, damageSource: { isAttack: true, canTriggerItems: true } },
});
assert.equal(ctx.player.block, 4,
  'Mercury Elemental: incoming attack grants rounded getBlock percent of raw damage');

const blockBefore = ctx.player.block;
ctx.bus.emit('character_damaged', {
  actor: ctx.dummy,
  attacker: ctx.player,
  hit: true,
  damage: { damage: 20, damageSource: { isAttack: true, canTriggerItems: true } },
});
ctx.bus.emit('character_damaged', {
  actor: ctx.player,
  attacker: ctx.dummy,
  hit: true,
  damage: { damage: 20, damageSource: { isAttack: false, canTriggerItems: true } },
});
assert.equal(ctx.player.block, blockBefore,
  'Mercury Elemental: outgoing and non-attack damage do not trigger the attacked listener');

ctx.bus.emit('stamina_used', { actor: ctx.player, amount: 0.6, t: 3 });
assert.equal(ctx.dummy.stacks.poison || 0, 0,
  'Mercury Elemental: partial stamina use is retained below the threshold');
ctx.bus.emit('stamina_used', { actor: ctx.player, amount: 0.4, t: 3.1 });
assert.equal(ctx.dummy.stacks.poison, 2,
  'Mercury Elemental: accumulated stamina crosses the exact poison threshold');
assert.equal(ctx.player.stacks.poison, 2,
  'Mercury Elemental: the same threshold applies source self-poison');
assert.equal(ctx.events.at(-1)?.meta?.miniActivate, true,
  'Mercury Elemental: threshold poison emits a mini-activation projection');

ctx.player.stamina = 0;
const staminaBefore = ctx.player.stamina;
handler.onCooldownEffect(mercury, ctx);
assert.equal(ctx.player.stamina, staminaBefore + 1,
  'Mercury Elemental: cooldown grants its exact prepared stamina regeneration');

const zeroCtx = makeContext({
  stamina: 0,
  p1: 0,
  staminat: 0,
  p2: 0,
  poison: 0,
  p3: 0,
  poison2: 0,
  p4: 0,
}, 0);
const zero = zeroCtx.pieces[0];
handler.onPrepare(zero, zeroCtx);
zeroCtx.bus.emit('stamina_used', { actor: zeroCtx.player, amount: 2, t: 1 });
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zero._mercStam, 0, 'Mercury Elemental: explicit zero stamina regeneration is preserved');
assert.equal(zeroCtx.player.stacks.poison, 0, 'Mercury Elemental: explicit zero poison values are preserved');
assert.equal(zeroCtx.events.filter((event) => event.type === 'activate').length, 1,
  'Mercury Elemental: cooldown still activates when its stamina grant is explicitly zero');

unbindBuffCombatLog();
giveStamina(ctx.player, 0);
console.log('Mercury Elemental source/parity smoke passed.');
