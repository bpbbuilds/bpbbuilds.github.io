import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DevouringSphere.gd', 'utf8');

const row = inventory.byId.devouring_sphere;
assert.ok(row, 'Devouring Sphere has a source inventory row');
assert.equal(row.file, 'Exclusive/DevouringSphere.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func onPrepare\(\):[\s\S]*character_cold_changed[\s\S]*onOpponentColdChanged[\s\S]*character_blind_changed[\s\S]*onOpponentBlindChanged/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveVampirism\(vampirism\)[\s\S]*stealLife\(dam, getP_m\("lifesteal"\) \/ 100\.0\)[\s\S]*activate\(\)/);
assert.match(source, /func onOpponentColdChanged\(amount, event\):[\s\S]*addSpeed\(amount \* coldSpeed\)/);
assert.match(source, /func onOpponentBlindChanged\(amount, event\):[\s\S]*addSpeed\(amount \* blindSpeed\)/);

const handler = getScriptHandler('devouring_sphere');
assert.equal(handler?.handlerId, 'devouring_sphere');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');
assert.equal(handler?.onCombatStart, undefined, 'source has no combat-start effect');

function pieceWith(params) {
  return {
    itemId: 'devouring_sphere',
    placementKey: 'sphere',
    name: 'Devouring Sphere',
    kind: 'gadget',
    side: 'you',
    params,
    alive: true,
    cooldown: 1.4,
    triggerTime: 1.4,
  };
}

function context(piece, params) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 1200 });
  player.hp = 100;
  dummy.hp = 500;
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const events = [];
  return {
    t: 2.5,
    player,
    dummy,
    events,
    rng: () => 0,
    bus,
    graph: { pieces: new Map(), filled: new Map() },
    pieces: [piece],
    itemsById: new Map([['devouring_sphere', { id: 'devouring_sphere', name: 'Devouring Sphere' }]]),
    canAffect: null,
    params,
  };
}

const params = {
  vampirism: 1,
  p1: 1,
  lifesteal: 100,
  p2: 100,
  speed_cold: 1,
  p3: 1,
  speed_blind: 2,
  p4: 2,
  dam: 10,
  p5: 10,
};
const piece = pieceWith(params);
const ctx = context(piece, params);
handler.onPrepare(piece, ctx);
grantStacks(ctx.dummy, 'cold', 2, { originId: piece.itemId });
grantStacks(ctx.dummy, 'blind', 3, { originId: piece.itemId });
assert.equal(piece.speedScale || 0, 0.08);
spendStacks(ctx.dummy, 'cold', 1, { originId: piece.itemId });
assert.equal(piece.speedScale || 0, 0.07);
const speedBeforeCooldown = piece.speedScale;
handler.onCooldownEffect(piece, ctx);
assert.equal(ctx.dummy.hp, 490);
assert.equal(ctx.player.hp, 110);
assert.equal(ctx.player.stacks.vampirism, 1);
assert.equal(piece.speedScale, speedBeforeCooldown);
const damageIndex = ctx.events.findIndex((event) => event.type === 'damage' && event.itemId === piece.itemId);
const activationIndex = ctx.events.findIndex((event) => event.type === 'activate' && event.itemId === piece.itemId);
assert.ok(damageIndex >= 0 && activationIndex > damageIndex, 'activate follows the source effect chain');

const zeroParams = {
  vampirism: 0,
  p1: 0,
  lifesteal: 0,
  p2: 0,
  speed_cold: 0,
  p3: 0,
  speed_blind: 0,
  p4: 0,
  dam: 0,
  p5: 0,
};
const zeroPiece = pieceWith(zeroParams);
const zeroCtx = context(zeroPiece, zeroParams);
handler.onPrepare(zeroPiece, zeroCtx);
const beforeHp = zeroCtx.dummy.hp;
handler.onCooldownEffect(zeroPiece, zeroCtx);
assert.equal(zeroCtx.dummy.hp, beforeHp);
assert.equal(zeroCtx.player.hp, 100);
assert.equal(zeroCtx.player.stacks.vampirism, 0);
assert.equal(zeroPiece.speedScale || 0, 0);

console.log('OK Devouring Sphere source port');
