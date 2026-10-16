import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Thornburst.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-e.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('export const thornburstPort'),
  handlerSource.indexOf('export const AI_E_PORTS'),
);
const outlierSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-outliers.js', 'utf8');

assert.equal(inventory.byId.thornburst?.file, 'Exclusive/Thornburst.gd');
assert.deepEqual(inventory.byId.thornburst?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func onPrepare\(\):[\s\S]*activationsLeft = uses[\s\S]*connectForCombat\(character\(\), "character_spikes_changed", "onSpikesChanged"\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*stun\(getP_m\("dur_stun"\)\)[\s\S]*giveSpikes\(spikes\)[\s\S]*activationsLeft -= 1[\s\S]*onAfterEffectFinished\(\)[\s\S]*activate\(\)/);
assert.match(source, /func onSpikesChanged\(amount, event\):[\s\S]*addSpeed\(spikeSpeed \* amount\)/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /scaleEffectDuration\(piece, stunBase\)/);
assert.match(port, /modifiedParamValue\([\s\S]*'dur_stun'/);
assert.match(port, /grantStun\(ctx\.dummy, stunDur, ctx\.t/);
assert.match(port, /grantStacks\(ctx\.player, 'spikes', spikes/);
assert.match(port, /afterEffectFinished\(piece, ctx, 'thornburst'/);
assert.match(port, /pushActivate\(piece, ctx, 'thornburst'/);
assert.doesNotMatch(port, /onCombatStart\(piece/);
assert.doesNotMatch(outlierSource, /thornburstPort|thornburst:/);

function makeContext({ params, paramMult = {}, maxUses = null } = {}) {
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const events = [];
  const piece = {
    itemId: 'thornburst',
    name: 'Thornburst',
    placementKey: 'thornburst',
    side: 'you',
    kind: 'consumable',
    params: params || {
      dur_stun: 0.3,
      p1: 0.3,
      spikes: 2,
      p2: 2,
      max: maxUses ?? 5,
      p3: maxUses ?? 5,
      speed: 5,
      p4: 5,
    },
    paramMult,
    speedScale: 0,
    alive: true,
    cooldown: 6.5,
    triggerTime: 6.5,
  };
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  const ctx = {
    t: 1,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [piece],
  };
  return { piece, ctx };
}

const runtime = getScriptHandler('thornburst');
assert.equal(runtime?.handlerId, 'thornburst');
assert.equal(typeof runtime?.onPrepare, 'function');
assert.equal(typeof runtime?.onCooldownEffect, 'function');

{
  const { piece, ctx } = makeContext({ paramMult: { dur_stun: 2 } });
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onPrepare(piece, ctx);
  assert.equal(piece._thornUses, 5, 'onPrepare caches source max uses');
  grantStacks(ctx.player, 'spikes', 2, { originKey: 'source', originId: 'source' });
  assert.equal(piece.speedScale, 0.1, 'preparation listener converts Spike gains to speed');
  spendStacks(ctx.player, 'spikes', 1, { originKey: 'source', originId: 'source' });
  assert.equal(piece.speedScale, 0.05, 'preparation listener converts Spike losses to speed loss');

  piece._activationLogged = false;
  const before = ctx.events.length;
  const handled = runtime.onCooldownEffect(piece, ctx);
  assert.equal(handled, true, 'Thornburst cooldown is handled by the dedicated port');
  assert.equal(piece._thornUses, 4, 'a non-final use decrements the cached activation count');
  assert.equal(piece.alive, true, 'a non-final use keeps Thornburst alive');
  assert.equal(ctx.dummy.stunnedUntil, 1.6, 'stun uses placement-modified source duration');
  assert.equal(ctx.player.stacks.spikes, 3, 'the cooldown grants source Spike amount');
  assert.ok(Math.abs(piece.speedScale - 0.15) < 1e-9, 'the Spike grant updates speed through the listener');
  const effectEvents = ctx.events.slice(before);
  const stunIndex = effectEvents.findIndex((event) => event.meta?.stack === 'stun');
  const spikeIndex = effectEvents.findIndex((event) => event.meta?.stack === 'spikes');
  const activateIndex = effectEvents.findIndex((event) => event.type === 'activate');
  assert.ok(stunIndex >= 0 && spikeIndex >= 0 && activateIndex >= 0, 'all Thornburst effects are projected');
  assert.ok(stunIndex < activateIndex, 'stun is applied before activation projection');
  assert.ok(spikeIndex < activateIndex, 'Spikes are granted before activation projection');
  assert.equal(
    effectEvents.filter((event) => event.meta?.stack === 'spikes').length,
    1,
    'the buff grant is logged once without a manual duplicate',
  );
}

{
  const { piece, ctx } = makeContext({ maxUses: 1 });
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onPrepare(piece, ctx);
  piece._activationLogged = false;
  runtime.onCooldownEffect(piece, ctx);
  assert.equal(piece._thornUses, 0, 'the final use reaches zero activations');
  assert.equal(piece.alive, false, 'onAfterEffectFinished consumes the final Thornburst use');
  assert.equal(piece.cooldown, 999, 'onAfterEffectFinished stops the cooldown');
  assert.equal(piece.triggerTime, 999, 'onAfterEffectFinished stops future triggers');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'the final consume activation remains projected');
  assert.equal(ctx.events.at(-1)?.meta?.consume, true, 'the final activation carries consume semantics');
}

{
  const { piece, ctx } = makeContext({
    params: {
      dur_stun: 0,
      p1: 0,
      spikes: 0,
      p2: 0,
      max: 1,
      p3: 1,
      speed: 0,
      p4: 0,
    },
  });
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onPrepare(piece, ctx);
  runtime.onCooldownEffect(piece, ctx);
  assert.equal(ctx.dummy.stunnedUntil, 0, 'zero source stun duration remains zero');
  assert.equal(ctx.player.stacks.spikes, 0, 'zero source Spikes remain zero');
  assert.equal(piece.speedScale, 0, 'zero source speed remains unchanged');
  assert.equal(piece.alive, false, 'zero-valued effects still consume the final configured use');
}

unbindBuffCombatLog();

console.log(
  'OK Thornburst source preparation lifecycle, Spike-to-speed listener, placement-modified stun, effect ordering, final consume path, duplicate removal, and zero-safe values regression',
);
