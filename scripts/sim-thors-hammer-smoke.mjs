import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ThorsHammer.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-onhit.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('export const thorsHammerPort'),
  handlerSource.indexOf('export const amethystWhelpPort'),
);

assert.equal(inventory.byId.thors_hammer?.file, 'Exclusive/ThorsHammer.gd');
assert.deepEqual(inventory.byId.thors_hammer?.overrides, ['onDealtDamage']);
assert.match(source, /onready var manaNeeded: = int\(getP\("manat"\)\)/);
assert.match(source, /onready var effectDmg: = int\(getP\("dam"\)\)/);
assert.match(source, /onready var blind: = int\(getP\("blind"\)\)/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollChance\(\)[\s\S]*stun\(getP_m\("dur_stun"\),[\s\S]*getMana\(\) >= manaNeeded[\s\S]*useMana\(manaNeeded[\s\S]*dealEffectDamage\(effectDmg,[\s\S]*getP_m\("dur_blind"\)[\s\S]*giveStacksTemporary/);
assert.match(port, /onDealtDamage\(piece, ctx, hit\)/);
assert.match(port, /modifiedParamValue\([\s\S]*'dur_stun'/);
assert.match(port, /modifiedParamValue\([\s\S]*'dur_blind'/);
assert.match(port, /scaleEffectDuration\(\s*piece/);
assert.match(port, /useMana\(player, need/);
assert.match(port, /dealEffectDamage\(piece, ctx, effectDmg\)/);
assert.doesNotMatch(port, /Math\.max\(1/);

function makeContext({ params, chance = 100, mana = 3, paramMult = {} } = {}) {
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const events = [];
  player.stacks.mana = mana;
  const piece = {
    itemId: 'thors_hammer',
    name: 'Thor’s Hammer',
    placementKey: 'thors-hammer',
    side: 'you',
    kind: 'weapon',
    params: params || {
      dur_stun: 0.5,
      p1: 0.5,
      manat: 2,
      p2: 2,
      dam: 12,
      p3: 12,
      blind: 5,
      p4: 5,
      dur_blind: 2,
      p5: 2,
    },
    paramMult,
    chance,
    damageMin: 10,
    damageMax: 13,
    damageKind: 'melee',
    bonusDamageFactor: 1,
    alive: true,
  };
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  return {
    piece,
    ctx: {
      t: 1,
      player,
      dummy,
      bus,
      events,
      rng: () => 0,
    },
  };
}

const runtime = getScriptHandler('thors_hammer');
assert.equal(runtime?.handlerId, 'thors_hammer');
assert.equal(typeof runtime?.onCooldownEffect, 'function', 'Thor’s Hammer keeps inherited weapon cooldown');
assert.equal(typeof runtime?.onDealtDamage, 'function');

{
  const { piece, ctx } = makeContext({ paramMult: { dur_stun: 2, dur_blind: 1.5 } });
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onDealtDamage(piece, ctx, { hit: true });
  assert.equal(ctx.player.stacks.mana, 1, 'the source Mana requirement is spent');
  assert.equal(ctx.dummy.hp, 88, 'the cached source effect damage is dealt after Mana');
  assert.equal(ctx.dummy.stunnedUntil, 2, 'stun uses placement-modified getP_m duration');
  assert.equal(ctx.dummy.stacks.blind, 5, 'the cached source Blind amount is granted');
  assert.equal(ctx.dummy._tempStacks?.[0]?.expiresAt, 4, 'Blind uses placement-modified getP_m duration');
  assert.equal(
    ctx.events.filter((event) => event.meta?.handler === 'thors_hammer' && event.meta?.stack === 'blind').length,
    1,
    'temporary Blind is projected once after the effect damage',
  );
}

{
  const { piece, ctx } = makeContext({ mana: 0 });
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onDealtDamage(piece, ctx, { hit: true });
  assert.equal(ctx.dummy.stunnedUntil, 1.5, 'the chance stun still happens before the Mana gate');
  assert.equal(ctx.dummy.hp, 100, 'insufficient Mana prevents effect damage');
  assert.equal(ctx.dummy.stacks.blind, 0, 'insufficient Mana prevents temporary Blind');
}

{
  const { piece, ctx } = makeContext({ chance: 0 });
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onDealtDamage(piece, ctx, { hit: false });
  assert.equal(ctx.player.stacks.mana, 3, 'misses do not spend Mana');
  assert.equal(ctx.dummy.hp, 100, 'misses do not deal effect damage');
  assert.equal(ctx.dummy.stunnedUntil, 0, 'misses do not stun');
  runtime.onDealtDamage(piece, ctx, { hit: true });
  assert.equal(ctx.dummy.stunnedUntil, 0, 'zero chance suppresses the stun');
  assert.equal(ctx.player.stacks.mana, 1, 'a hit still spends Mana when the stun chance fails');
  assert.equal(ctx.dummy.hp, 88, 'a hit still deals effect damage when the stun chance fails');
}

{
  const { piece, ctx } = makeContext({
    params: {
      dur_stun: 0,
      p1: 0,
      manat: 0,
      p2: 0,
      dam: 0,
      p3: 0,
      blind: 0,
      p4: 0,
      dur_blind: 0,
      p5: 0,
    },
    mana: 0,
  });
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onDealtDamage(piece, ctx, { hit: true });
  assert.equal(ctx.player.stacks.mana, 0, 'zero source Mana remains zero');
  assert.equal(ctx.dummy.hp, 100, 'zero source effect damage remains zero');
  assert.equal(ctx.dummy.stunnedUntil, 0, 'zero source stun duration remains zero');
  assert.equal(ctx.dummy.stacks.blind, 0, 'zero source Blind remains zero');
  assert.equal(
    ctx.events.some((event) => event.meta?.handler === 'thors_hammer' && event.meta?.stack === 'blind'),
    false,
    'zero source Blind does not create a phantom log',
  );
}

unbindBuffCombatLog();

console.log(
  'OK Thor’s Hammer source parameter slots, hit/stun/Mana/effect/Blind ordering, placement-modified durations, miss and Mana gates, and zero-safe values regression',
);
