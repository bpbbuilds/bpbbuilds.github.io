import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { dealDamage } from '../js/pages/sim/engine/damage.js';
import { bindBuffPowerPieces, unbindBuffPowerPieces } from '../js/pages/sim/engine/buff-power.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/MoonShield.gd', 'utf8');
const shieldSource = fs.readFileSync('tools/game-extract-full/Items/Shield.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-shields.js', 'utf8');
const damage = fs.readFileSync('js/pages/sim/engine/damage.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'moon_shield');
const blockItem = catalog.find((item) => item.id === 'leather_armor');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const moonPort = port.slice(port.indexOf("handlerId: 'moon_shield'"));

assert.ok(sourceItem, 'Moon Shield: extracted catalog row');
assert.ok(blockItem, 'Moon Shield: Block target fixture');
assert.match(source, /onready var blockForMana: int = getP4\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*giveBuffPower\(Game\.EventType\.Block, getP3\(\) \/ 100\.0\)[\s\S]*connectForCombat\(item, "gave_block", "onItemGaveBlock"\)/);
assert.match(source, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\), blockedDamageRes\.event\)[\s\S]*activate\(\)/);
assert.match(source, /func onItemGaveBlock\(amount, event\):[\s\S]*blockAcc \+= amount[\s\S]*giveMana\(mana, event\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func canBlockDamageRes\(damageRes: DamageResult\) -> bool:[\s\S]*damageRes\.triggerOnAttacked\(\)/);
assert.match(shieldSource, /func canBlockDamageRes\(damageRes: DamageResult\) -> bool:[\s\S]*damageRes\.triggerOnMeleeAttacked\(\)/);
assert.match(moonPort, /handlerId: 'moon_shield'/);
assert.match(moonPort, /onPrepare\(piece, ctx\)/);
assert.match(moonPort, /giveBuffPower\(o, 'block', fac\)/);
assert.match(moonPort, /character_block_changed/);
assert.match(moonPort, /canBlockDamageRes:/);
assert.match(damage, /canBlockDamageRes\?: \(res: DamageResult\) => boolean/);
assert.match(damage, /typeof sh\.canBlockDamageRes === 'function'/);

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  player._combatBus = bus;
  dummy._combatBus = bus;
  const shield = {
    itemId: 'moon_shield',
    placementKey: 'shield',
    name: 'Moon Shield',
    params: { ...params },
    side: 'you',
    kind: 'armor',
    alive: true,
    chance: 100,
    cooldown: 0,
    baseCooldown: 0,
  };
  const armor = {
    itemId: 'leather_armor',
    placementKey: 'armor',
    name: 'Leather Armor',
    side: 'you',
    kind: 'armor',
    alive: true,
    blockGrant: blockItem.block,
  };
  return {
    t: 1,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [shield, armor],
    itemsById: new Map([
      ['moon_shield', sourceItem],
      ['leather_armor', blockItem],
    ]),
    graph: {
      pieces: new Map([
        ['shield', {
          key: 'shield',
          id: 'moon_shield',
          cells: ['0,0'],
          affectCells: [{ cell: '1,0', color: 'primary' }],
        }],
        ['armor', { key: 'armor', id: 'leather_armor', cells: ['1,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'shield'],
        ['1,0', 'armor'],
      ]),
    },
    canAffect: { rulesById: rules.byId },
  };
}

const handler = getScriptHandler('moon_shield');
assert.equal(handler?.handlerId, 'moon_shield');

const ctx = makeContext();
bindBuffPowerPieces(ctx.pieces);
bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
handler.onPrepare(ctx.pieces[0], ctx);
assert.equal(ctx.pieces[1].buffPowers.block, 1.3,
  'Moon Shield: preparation applies source Block buff power to affected items');
assert.ok(ctx.pieces[0]._moonLinkedKeys.has('armor'),
  'Moon Shield: preparation snapshots the affected Block item');

grantStacks(ctx.player, 'block', 45, {
  originKey: 'armor',
  originId: 'leather_armor',
  piece: ctx.pieces[1],
});
assert.equal(ctx.player.block, 59, 'Moon Shield: affected Block uses the source 1.3x buff power');
assert.equal(ctx.player.stacks.mana, 4,
  'Moon Shield: affected Block accumulates into floor(Block / P4) Mana');
grantStacks(ctx.player, 'block', 12, { originKey: 'unlinked', originId: 'other' });
assert.equal(ctx.player.stacks.mana, 4,
  'Moon Shield: unrelated Block does not feed the affected-item accumulator');

const staminaBefore = ctx.player.stamina;
const hpBefore = ctx.player.hp;
const rangedAttack = dealDamage(ctx.dummy, ctx.player, {
  amount: 20,
  canMiss: false,
  canCrit: false,
  canBlock: true,
  isAttack: true,
  isMelee: false,
  canTriggerItems: true,
  canTriggerVampirism: false,
  nowT: ctx.t,
  events: ctx.events,
  bus: ctx.bus,
  rng: ctx.rng,
});
assert.equal(rangedAttack.reduced, 14,
  'Moon Shield: source triggerOnAttacked override blocks ranged attacks too');
assert.equal(ctx.player.hp, hpBefore,
  'Moon Shield: remaining ranged damage is absorbed by the player Block');
assert.equal(ctx.player.stamina, staminaBefore - 0.7,
  'Moon Shield: afterBlock drains the exact P2 stamina amount');
assert.equal(ctx.events.filter((event) => event.type === 'activate' && event.itemId === 'moon_shield').length, 1,
  'Moon Shield: blocked attack activates once');

const activationCount = ctx.events.filter((event) => event.type === 'activate' && event.itemId === 'moon_shield').length;
const effect = dealDamage(ctx.dummy, ctx.player, {
  amount: 20,
  canMiss: false,
  canCrit: false,
  canBlock: true,
  isAttack: false,
  isMelee: false,
  canTriggerItems: true,
  canTriggerVampirism: false,
  nowT: ctx.t,
  events: ctx.events,
  bus: ctx.bus,
  rng: ctx.rng,
});
assert.equal(effect.reduced, 0, 'Moon Shield: non-attack effects do not pass triggerOnAttacked');
assert.equal(ctx.events.filter((event) => event.type === 'activate' && event.itemId === 'moon_shield').length, activationCount,
  'Moon Shield: non-attack effects do not activate the shield');

unbindBuffCombatLog();
unbindBuffPowerPieces();

const zero = makeContext({ damblock: 0, p1: 0, p2: 0, p3: 0, p4: 0 });
bindBuffPowerPieces(zero.pieces);
handler.onPrepare(zero.pieces[0], zero);
assert.equal(zero.pieces[1].buffPowers?.block || 1, 1,
  'Moon Shield: explicit zero Block amplification is preserved');
assert.equal(zero.pieces[0]._blk, 0, 'Moon Shield: explicit zero Block threshold does not create progress');
unbindBuffPowerPieces();

console.log('Moon Shield source/parity smoke passed.');
