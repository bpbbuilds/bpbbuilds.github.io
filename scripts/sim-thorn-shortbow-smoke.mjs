import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ThornShortbow.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-onhit.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('export const thornShortbowPort'),
  handlerSource.indexOf('export const snowStickPort'),
);

assert.equal(inventory.byId.thorn_shortbow?.file, 'Exclusive/ThornShortbow.gd');
assert.deepEqual(inventory.byId.thorn_shortbow?.overrides, ['onDealtDamage']);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollChance\(\)[\s\S]*giveSpikes\(1, damageRes\.event\)/);
assert.match(port, /onDealtDamage\(piece, ctx, hit\)/);
assert.match(port, /if \(!hit\?\.hit \|\| !rollItemChance\(piece, ctx\.rng\)\) return/);
assert.match(port, /grantStacks\(ctx\.player, 'spikes', 1/);

function makeContext(chance = 100) {
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const piece = {
    itemId: 'thorn_shortbow',
    name: 'Thorn Shortbow',
    placementKey: 'thorn-shortbow',
    chance,
    damageMin: 2,
    damageMax: 2,
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
    notifyDealtDamage: (attackedPiece, hitCtx, hit) => runtime.onDealtDamage(attackedPiece, hitCtx, hit),
  };
  player._combatBus = bus;
  dummy._combatBus = bus;
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy });
  return { piece, ctx };
}

const runtime = getScriptHandler('thorn_shortbow');
assert.equal(runtime?.handlerId, 'thorn_shortbow');
assert.equal(typeof runtime?.onCooldownEffect, 'function', 'Thorn Shortbow keeps inherited weapon cooldown');

{
  const { piece, ctx } = makeContext(100);
  runtime.onDealtDamage(piece, ctx, { hit: false });
  assert.equal(ctx.player.stacks.spikes, 0, 'misses do not grant Spikes');
  dealHit(piece, ctx, () => 2);
  assert.equal(ctx.player.stacks.spikes, 1, 'a guaranteed hit grants one Spike');
  assert.equal(
    ctx.events.filter((event) => event.type === 'buff' && event.meta?.stack === 'spikes').length,
    1,
    'the Spike grant is logged once',
  );
}

{
  const { piece, ctx } = makeContext(0);
  runtime.onDealtDamage(piece, ctx, { hit: true });
  assert.equal(ctx.player.stacks.spikes, 0, 'zero chance does not grant Spikes');
}

{
  const { piece, ctx } = makeContext(100);
  const handled = runtime.onCooldownEffect(piece, ctx);
  assert.equal(handled, true, 'inherited weapon cooldown remains handled');
  assert.equal(ctx.dummy.hp, 98, 'inherited weapon cooldown deals its catalog damage');
}

unbindBuffCombatLog();

console.log('OK Thorn Shortbow source on-hit, hit/miss/chance behavior, single Spike log, and inherited weapon cooldown regression');
