import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/ThornWhip.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-scale.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('export const thornWhipPort'),
  handlerSource.indexOf('export const clawsOfAttackPort'),
);

assert.equal(inventory.byId.thorn_whip?.file, 'ThornWhip.gd');
assert.deepEqual(inventory.byId.thorn_whip?.overrides, ['onPreDealDamage_early', 'onPrepare']);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_spikes_changed", "onSpikesChanged"\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*giveSpikes\(1\)/);
assert.match(source, /func onSpikesChanged\(amount, _event\):[\s\S]*changeVaryingDamage\(getP1\(\) \* amount\)/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /changeVaryingDamageFromBuffChange\(piece, ch, per\)/);
assert.match(port, /onPreDealDamageEarly\(piece, ctx, hit\)/);
assert.doesNotMatch(port, /onDealtDamage\(piece, ctx, hit\)/);

function makeContext(params = { p1: 1 }) {
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const piece = {
    itemId: 'thorn_whip',
    name: 'Thorn Whip',
    placementKey: 'thorn-whip',
    params,
    damageMin: 4,
    damageMax: 4,
    staminaCost: 1,
    accuracy: 100,
    alive: true,
    bonusDamage: 0,
  };
  const ctx = {
    t: 1,
    player,
    dummy,
    bus,
    events: [],
    rng: () => 0,
    pieces: [piece],
    notifyPreDealDamageEarly: (attackedPiece, hitCtx, hit) => runtime.onPreDealDamageEarly(attackedPiece, hitCtx, hit),
  };
  player._combatBus = bus;
  dummy._combatBus = bus;
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy });
  return { piece, ctx };
}

const runtime = getScriptHandler('thorn_whip');
assert.equal(runtime?.handlerId, 'thorn_whip');
assert.equal(typeof runtime?.onPrepare, 'function');
assert.equal(typeof runtime?.onCooldownEffect, 'function', 'Thorn Whip keeps inherited weapon cooldown');

{
  const { piece, ctx } = makeContext();
  runtime.onPrepare(piece, ctx);
  grantStacks(ctx.player, 'spikes', 2, { originKey: 'source', originId: 'source' });
  assert.equal(piece.bonusDamage, 2, 'positive Spike delta adds source P1 varying damage');
  assert.equal(piece.removableBonusDamage || 0, 0, 'varying damage is not a removable bonus pool');
  spendStacks(ctx.player, 'spikes', 1, { originKey: 'source', originId: 'source' });
  assert.equal(piece.bonusDamage, 1, 'negative Spike delta removes the same varying damage');
  assert.equal(ctx.player.stacks.spikes, 1, 'Spike spend remains synchronized');
}

{
  const { piece, ctx } = makeContext();
  runtime.onPrepare(piece, ctx);
  const result = dealHit(piece, ctx, () => 4);
  assert.equal(result.hit, true, 'Thorn Whip test attack hits');
  assert.equal(ctx.dummy.hp, 96, 'the pre-damage Spike grant does not retroactively alter the rolled hit');
  assert.equal(ctx.player.stacks.spikes, 1, 'a successful early hit grants one Spike');
  assert.equal(piece.bonusDamage, 1, 'the early Spike grant updates future varying damage');
  assert.equal(
    ctx.events.filter((event) => event.type === 'buff' && event.meta?.stack === 'spikes').length,
    1,
    'the early Spike grant is logged once',
  );
  runtime.onPreDealDamageEarly(piece, ctx, { hit: false });
  assert.equal(ctx.player.stacks.spikes, 1, 'misses do not grant another Spike');
}

{
  const { piece, ctx } = makeContext({ p1: 0 });
  runtime.onPrepare(piece, ctx);
  grantStacks(ctx.player, 'spikes', 1);
  assert.equal(piece.bonusDamage, 0, 'zero source P1 leaves varying damage unchanged');
}

unbindBuffCombatLog();

console.log('OK Thorn Whip source prepare hook, early Spike grant, positive/negative varying damage, single log, and zero-safe P1 regression');
