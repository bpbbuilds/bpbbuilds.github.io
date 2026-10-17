import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/HungryBlade.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('hungry_blade');

assert.equal(inventory.byId.hungry_blade?.file, 'HungryBlade.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*character_vampirism_changed[\s\S]*onVampirismChanged/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveVampirism\(vampirism\)[\s\S]*activate\(null, false, false/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*getRegeneration\(\)[\s\S]*useRegeneration\(regenNeeded\)[\s\S]*giveVampirism\(vampirismForRegen[^)]*\)/);
assert.equal(getScriptHandler('hungry_blade')?.handlerId, 'hungry_blade');

function makeContext(piece) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  return {
    player,
    dummy,
    bus,
    events,
    t: 2,
    rng: () => 0,
    pieces: [piece],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

function makePiece(params = data.params) {
  return {
    ...data,
    itemId: 'hungry_blade',
    placementKey: 'hungry-blade',
    name: 'Hungry Blade',
    kind: 'weapon',
    side: 'you',
    alive: true,
    damageMin: data.damageMin,
    damageMax: data.damageMax,
    params: { ...params },
  };
}

const piece = makePiece();
const ctx = makeContext(piece);
const handler = getScriptHandler('hungry_blade');
handler.onPrepare(piece, ctx);
grantStacks(ctx.player, 'vampirism', 2, { originKey: 'setup', originId: 'setup' });
assert.equal(piece.damageMax, data.damageMax + 2, 'Hungry Blade reacts to Vampirism before combat start');

handler.onCombatStart(piece, ctx);
assert.equal(ctx.player.stacks.vampirism, 3, 'Hungry Blade grants exact source start Vampirism');
assert.equal(piece.damageMax, data.damageMax + 3, 'Hungry Blade max damage follows every Vampirism gain');
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'hungry_blade'));

grantStacks(ctx.player, 'regeneration', 2, { originKey: 'setup', originId: 'setup' });
handler.onPreDealDamageEarly(piece, ctx, { hit: true });
assert.equal(ctx.player.stacks.regeneration, 1, 'Hungry Blade spends exact source Regeneration');
assert.equal(ctx.player.stacks.vampirism, 4, 'Hungry Blade converts Regeneration to exact source Vampirism');
assert.equal(piece.damageMax, data.damageMax + 4);

grantStacks(ctx.player, 'regeneration', 1, { originKey: 'setup', originId: 'setup' });
handler.onPreDealDamageEarly(piece, ctx, { hit: false });
assert.equal(ctx.player.stacks.regeneration, 2, 'Hungry Blade does not convert a miss');

const zero = makePiece({ p1: 0, p2: 0, p3: 0 });
const zeroCtx = makeContext(zero);
handler.onPrepare(zero, zeroCtx);
handler.onCombatStart(zero, zeroCtx);
handler.onPreDealDamageEarly(zero, zeroCtx, { hit: true });
assert.equal(zeroCtx.player.stacks.vampirism, 0, 'Hungry Blade honors explicit zero Vampirism');
assert.equal(zeroCtx.player.stacks.regeneration, 0, 'Hungry Blade honors explicit zero Regeneration cost');
assert.equal(zeroCtx.events.filter((event) => event.type === 'buff').length, 0, 'Zero conversion emits no phantom buff events');

console.log('OK Hungry Blade source-backed prepare listener, start Vampirism/activation, max-damage reaction, successful-hit conversion, miss handling, and zero parameters');
