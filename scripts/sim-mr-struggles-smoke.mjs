import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks, grantTemporaryStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/MrStruggles.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-hard.js', 'utf8');
const economy = fs.readFileSync('js/pages/sim/engine/buff-economy.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mr_struggles');
const weaponItem = catalog.find((item) => item.id === 'hero_sword');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));

assert.ok(sourceItem, 'Mr Struggles: extracted catalog row');
assert.ok(weaponItem, 'Mr Struggles: linked cooldown fixture');
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_damaged", "onDamaged"\)/);
assert.match(source, /func onDebuffed\(amount, event\):[\s\S]*checkTriggerCount\(10\)[\s\S]*event\.getParam\("duration", -\s*1\)[\s\S]*giveStacksTemporary\(opponent\(\), debuffType, amount, dur, event\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictFatigueDamage\(fatigueDam\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'mr_struggles'/);
const mrPort = port.match(/export const mrStrugglesPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(mrPort, /pieceHasCombatCooldown/);
assert.match(mrPort, /ch\.duration/);
assert.match(mrPort, /takeDamage\(/);
assert.doesNotMatch(mrPort, /Math\.max\(1,\s*\n?\s*Math\.round\(getPName\(piece\.params, 'fatigue'/,
  'Mr Struggles: explicit zero fatigue must not become one');
assert.match(economy, /duration: durationSec/,
  'Temporary debuff changes retain the source event duration for reactive items');

const handler = getScriptHandler('mr_struggles');
assert.equal(handler?.handlerId, 'mr_struggles');

function makeContext(params = sourceItem.params, dummyOptions = {}) {
  const player = createActor('player');
  const dummy = createActor('dummy', dummyOptions);
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  const struggles = {
    itemId: 'mr_struggles',
    placementKey: 'struggles',
    name: 'Mr Struggles',
    params: { ...params },
    side: 'you',
    kind: 'accessory',
    alive: true,
    chance: sourceItem.chance,
    cooldown: sourceItem.cooldown,
    baseCooldown: sourceItem.cooldown,
  };
  const weapon = {
    itemId: 'hero_sword',
    placementKey: 'weapon',
    name: 'Hero Sword',
    side: 'you',
    kind: 'weapon',
    alive: true,
    cooldown: 0,
    baseCooldown: weaponItem.cooldown,
    speedScale: 0,
  };
  const passive = {
    itemId: 'fixture_passive',
    placementKey: 'passive',
    name: 'Passive',
    side: 'you',
    kind: 'accessory',
    alive: true,
    cooldown: 0,
    baseCooldown: 0,
    speedScale: 0,
  };
  return {
    t: 2,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    fatigue: { counter: 3 },
    pieces: [struggles, weapon, passive],
    itemsById: new Map([
      ['mr_struggles', sourceItem],
      ['hero_sword', weaponItem],
      ['fixture_passive', { id: 'fixture_passive', type: 'Accessory' }],
    ]),
    graph: {
      pieces: new Map([
        ['struggles', {
          key: 'struggles',
          id: 'mr_struggles',
          cells: ['0,0'],
          affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }],
        }],
        ['weapon', { key: 'weapon', id: 'hero_sword', cells: ['1,0'], affectCells: [] }],
        ['passive', { key: 'passive', id: 'fixture_passive', cells: ['2,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'struggles'],
        ['1,0', 'weapon'],
        ['2,0', 'passive'],
      ]),
    },
    canAffect: { rulesById: rules.byId },
  };
}

const ctx = makeContext();
handler.onPrepare(ctx.pieces[0], ctx);
ctx.player.hp = 90;
ctx.bus.emit('character_damaged', { actor: ctx.player, t: ctx.t, hit: true, healthDamage: 10 });
assert.equal(ctx.pieces[1].speedScale, 1,
  'Mr Struggles: low-health trigger speeds linked cooldown items even while their current timer is zero');
assert.equal(ctx.pieces[2].speedScale, 0,
  'Mr Struggles: low-health trigger ignores linked items without a cooldown');
assert.equal(ctx.pieces[1]._timedSpeeds?.[0]?.untilT, 10,
  'Mr Struggles: linked speed expires after the exact source duration');
const activationBeforeSecondDamage = ctx.events.length;
ctx.bus.emit('character_damaged', { actor: ctx.player, t: ctx.t + 1, hit: true, healthDamage: 10 });
assert.equal(ctx.events.length, activationBeforeSecondDamage,
  'Mr Struggles: low-health haste activates only once');

bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
grantTemporaryStacks(ctx.player, 'blind', 2, 4, ctx.t, {
  originKey: 'source',
  originId: 'fixture',
});
assert.equal(getStackAmount(ctx.dummy, 'blind'), 2,
  'Mr Struggles: debuff echo copies the incoming amount');
assert.equal(ctx.dummy._tempStacks?.[0]?.expiresAt, 6,
  'Mr Struggles: debuff echo retains the incoming duration');
unbindBuffCombatLog();

const burst = makeContext();
handler.onPrepare(burst.pieces[0], burst);
for (let i = 0; i < 11; i += 1) {
  grantStacks(burst.player, 'blind', 1, { originId: `burst-${i}` });
}
assert.equal(getStackAmount(burst.dummy, 'blind'), 10,
  'Mr Struggles: source trigger-count cap allows at most ten echoes per timestamp');

const fatigueBefore = ctx.dummy.hp;
ctx.dummy.bonusFatigueDamage = 0;
ctx.dummy.block = 1;
handler.onCooldownEffect(ctx.pieces[0], ctx);
assert.equal(ctx.dummy.bonusFatigueDamage, 1,
  'Mr Struggles: fatigue effect adds the source fatigue bonus');
assert.equal(ctx.dummy.hp, fatigueBefore - 3,
  'Mr Struggles: fatigue damage uses the current fatigue counter and respects Block');
assert.equal(ctx.dummy.block, 0, 'Mr Struggles: fatigue damage consumes available Block');
assert.ok(ctx.events.some((event) => event.meta?.fatigue && event.amount === 3),
  'Mr Struggles: fatigue damage is logged with fatigue metadata');

const zero = makeContext({ fatigue: 0, p1: 0, healtht: 0, p2: 0, speedbonus: 0, p3: 0, dur_speed: 0, p4: 0 });
handler.onPrepare(zero.pieces[0], zero);
zero.fatigue.counter = 0;
zero.dummy.hp = zero.dummy.maxHp;
const zeroHp = zero.dummy.hp;
handler.onCooldownEffect(zero.pieces[0], zero);
assert.equal(zero.dummy.hp, zeroHp, 'Mr Struggles: explicit zero fatigue adds no damage');
assert.equal(zero.dummy.bonusFatigueDamage, 0, 'Mr Struggles: explicit zero fatigue bonus is preserved');

console.log('Mr Struggles source/parity smoke passed.');
