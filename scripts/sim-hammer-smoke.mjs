import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Hammer.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*if damageRes\.hasHit\(\) and rollChance\(\):[\s\S]*stun\(getP_m\("dur_stun"\), damageRes\.event\)/);
assert.equal(inventory.byId.hammer?.file, 'Hammer.gd');
assert.equal(getScriptHandler('hammer')?.handlerId, 'hammer');

function piece(overrides = {}) {
  const item = byId.get('hammer');
  return {
    ...item,
    itemId: 'hammer',
    placementKey: 'you:hammer',
    name: item.displayName,
    params: item.params,
    kind: 'weapon',
    side: 'you',
    alive: true,
    chance: 100,
    ...overrides,
  };
}

function context(pieceValue, dummy = createActor('dummy', { maxHp: 200 })) {
  const player = createActor('player', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    rng: () => 0,
    t: 3,
    events: [],
    pieces: [pieceValue],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('hammer');
const hammer = piece();
const ctx = context(hammer);
handler.onDealtDamage(hammer, ctx, { hit: true });
assert.equal(ctx.dummy.stunnedUntil, 3.5, 'Hammer uses its source stun duration on a successful hit');

const missHammer = piece({ placementKey: 'you:hammer-miss' });
const missCtx = context(missHammer);
handler.onDealtDamage(missHammer, missCtx, { hit: false });
assert.equal(missCtx.dummy.stunnedUntil, 0, 'Hammer does not stun on a miss');

const modified = piece({
  placementKey: 'you:hammer-modified',
  params: { dur_stun: 0.5, p1: 0.5 },
  paramMult: { dur_stun: 2 },
});
const modifiedCtx = context(modified);
handler.onDealtDamage(modified, modifiedCtx, { hit: true });
assert.equal(modifiedCtx.dummy.stunnedUntil, 4, 'Hammer applies placement getP_m duration modifiers');

const zero = piece({
  placementKey: 'you:hammer-zero',
  params: { dur_stun: 0, p1: 0 },
});
const zeroCtx = context(zero);
handler.onDealtDamage(zero, zeroCtx, { hit: true });
assert.equal(zeroCtx.dummy.stunnedUntil, 0, 'Hammer honors an explicit zero stun duration');

console.log('OK Hammer source-backed hit gating, chance stun, modified getP_m duration, and zero parameters');
