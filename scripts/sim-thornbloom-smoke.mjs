import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Thornbloom.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-scale.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('export const thornbloomPort'),
  handlerSource.indexOf('export const fancyFencingRapierPort'),
);

assert.equal(inventory.byId.thornbloom?.file, 'Exclusive/Thornbloom.gd');
assert.deepEqual(inventory.byId.thornbloom?.overrides, ['onPreDealDamage_early', 'onPrepare']);
assert.match(
  source,
  /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_empower_changed", "onEmpowerChanged"\)[\s\S]*connectForCombat\(character\(\), "character_spikes_changed", "onSpikesChanged"\)/,
);
assert.match(source, /func onSpikesChanged\(amount, _event\):[\s\S]*changeVaryingDamage\(damPerSpike \* amount\)/);
assert.match(source, /func onEmpowerChanged\(amount, event\):[\s\S]*getP_m\("maxhealth"\) \* amount/);
assert.match(
  source,
  /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*giveSpikes\(spikes\)[\s\S]*rollChance\(\)[\s\S]*giveEmpower\(empower\)/,
);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /changeVaryingDamageFromBuffChange\(piece, ch, per\)/);
assert.match(port, /modifiedParamValue\([\s\S]*'maxhealth'/);
assert.match(port, /onPreDealDamageEarly\(piece, ctx, hit\)/);
assert.doesNotMatch(port, /onCombatStart\(piece, ctx\)/);
assert.doesNotMatch(port, /onDealtDamage\(piece, ctx, hit\)/);

function makeContext({ params, chance = 100, rng = () => 0 } = {}) {
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player.hp = 50;
  const piece = {
    itemId: 'thornbloom',
    name: 'Thornbloom',
    placementKey: 'thornbloom',
    side: 'you',
    kind: 'weapon',
    params: params || {
      spikes: 1,
      p1: 1,
      empower: 1,
      p2: 1,
      damperspike: 1,
      p3: 1,
      maxhealth: 11,
      p4: 11,
    },
    paramMult: { maxhealth: 2 },
    damageMin: 7,
    damageMax: 7,
    staminaCost: 1,
    accuracy: 100,
    chance,
    alive: true,
    bonusDamage: 0,
  };
  const ctx = {
    t: 1,
    player,
    dummy,
    bus,
    events: [],
    rng,
    pieces: [piece],
    notifyPreDealDamageEarly: (attackedPiece, hitCtx, hit) =>
      runtime.onPreDealDamageEarly(attackedPiece, hitCtx, hit),
  };
  player._combatBus = bus;
  dummy._combatBus = bus;
  return { piece, ctx };
}

const runtime = getScriptHandler('thornbloom');
assert.equal(runtime?.handlerId, 'thornbloom');
assert.equal(typeof runtime?.onPrepare, 'function');
assert.equal(typeof runtime?.onCooldownEffect, 'function', 'Thornbloom keeps inherited weapon cooldown');
assert.equal(typeof runtime?.onPreDealDamageEarly, 'function');

bindBuffCombatLog({ events: [], getT: () => 1, dummy: createActor('dummy') });
{
  const { piece, ctx } = makeContext();
  ctx.events.length = 0;
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onPrepare(piece, ctx);
  grantStacks(ctx.player, 'spikes', 2, { originKey: 'source', originId: 'source' });
  assert.equal(piece.bonusDamage, 2, 'Spike listener adds source damperspike varying damage');
  assert.equal(piece.removableBonusDamage || 0, 0, 'varying damage is not a removable bonus pool');
  spendStacks(ctx.player, 'spikes', 1, { originKey: 'source', originId: 'source' });
  assert.equal(piece.bonusDamage, 1, 'negative Spike delta removes the same varying damage');
  assert.equal(ctx.player.stacks.spikes, 1, 'Spike spend remains synchronized');
}

{
  const { piece, ctx } = makeContext();
  ctx.events.length = 0;
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onPrepare(piece, ctx);
  const result = dealHit(piece, ctx, () => 7);
  assert.equal(result.hit, true, 'Thornbloom test attack hits');
  assert.equal(ctx.dummy.hp, 93, 'early grants do not retroactively alter the rolled hit');
  assert.equal(ctx.player.stacks.spikes, 1, 'a successful early hit grants source Spikes');
  assert.equal(ctx.player.stacks.empower, 1, 'the chance-gated early hit grants source Empower');
  assert.equal(piece.bonusDamage, 1, 'the early Spike grant updates future varying damage');
  assert.equal(piece.removableBonusDamage || 0, 0, 'early varying damage remains non-removable');
  assert.equal(ctx.player.maxHp, 122, 'Empower uses placement-modified max health');
  assert.equal(ctx.player.hp, 72, 'max-health gain fills current health by the same amount');
  assert.equal(
    ctx.events.filter((event) => event.type === 'buff' && event.meta?.stack === 'spikes').length,
    1,
    'the early Spike grant is logged once',
  );
  assert.equal(
    ctx.events.filter((event) => event.type === 'buff' && event.meta?.stack === 'empower').length,
    1,
    'the early Empower grant is logged once',
  );
}

{
  const { piece, ctx } = makeContext({ chance: 0 });
  ctx.events.length = 0;
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  runtime.onPrepare(piece, ctx);
  const result = dealHit(piece, ctx, () => 7);
  assert.equal(result.hit, true, 'chance-zero test attack hits');
  assert.equal(ctx.player.stacks.spikes, 1, 'chance failure still grants Spikes');
  assert.equal(ctx.player.stacks.empower, 0, 'chance failure does not grant Empower');
  assert.equal(ctx.player.maxHp, 100, 'chance failure does not grant max health');
}

{
  const { piece, ctx } = makeContext({
    params: {
      spikes: 0,
      p1: 0,
      empower: 0,
      p2: 0,
      damperspike: 0,
      p3: 0,
      maxhealth: 0,
      p4: 0,
    },
  });
  runtime.onPrepare(piece, ctx);
  const result = dealHit(piece, ctx, () => 7);
  assert.equal(result.hit, true, 'zero-parameter test attack hits');
  assert.equal(ctx.player.stacks.spikes, 0, 'zero source Spikes remain zero');
  assert.equal(ctx.player.stacks.empower, 0, 'zero source Empower remains zero');
  assert.equal(piece.bonusDamage, 0, 'zero source varying damage remains unchanged');
  assert.equal(ctx.player.maxHp, 100, 'zero source max health remains unchanged');
}

unbindBuffCombatLog();

console.log(
  'OK Thornbloom source preparation listeners, early Spike/Empower grants, placement-modified max health, non-removable varying damage, chance ordering, and zero-safe values regression',
);
