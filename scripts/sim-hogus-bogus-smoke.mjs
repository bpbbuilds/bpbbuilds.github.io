import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/HogusBogus.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*phase = 0/);
assert.match(source, /func trigger\(\):[\s\S]*setState\(phase \+ 1\)[\s\S]*\.trigger\(\)/);
assert.match(source, /if phase == 1:[\s\S]*var step = 1\.0 \/ buffsPerStamina[\s\S]*floor\(curStamina \/ step\)[\s\S]*min\(curStamina, min\(numProccs \* step, maxStaminaUsed\)\)[\s\S]*useStamina\(staminaToUse\)[\s\S]*giveRandomBuffs\(round\(staminaToUse \* buffsPerStamina\)\)[\s\S]*activate\(\)/);
assert.match(source, /elif phase == 2:[\s\S]*stun\(getP_m\("dur_stun"\)\)[\s\S]*character\(\)\.stun\(getP_m\("dur_self_stun"\), self\)[\s\S]*activate\(\)/);
assert.match(source, /else:[\s\S]*heal\(curHealth \* getP_m\("heal"\) \/ 100\.0\)[\s\S]*onAfterEffectFinished\(\)/);
assert.equal(inventory.byId.hogus_bogus?.file, 'Exclusive/HogusBogus.gd');
assert.equal(getScriptHandler('hogus_bogus')?.handlerId, 'hogus_bogus');

function piece(overrides = {}) {
  const item = byId.get('hogus_bogus');
  return {
    ...item,
    itemId: 'hogus_bogus',
    placementKey: 'you:hogus',
    name: item.displayName || item.name,
    params: item.params || {},
    side: 'you',
    kind: 'skill',
    alive: true,
    cooldown: item.cooldown,
    ...overrides,
  };
}

function context(player, dummy) {
  return {
    player,
    dummy,
    events: [],
    t: 4,
    rng: () => 0,
    pieces: [],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('hogus_bogus');
const player = createActor('player', { maxHp: 200, maxStamina: 5 });
const dummy = createActor('dummy', { maxHp: 100 });
dummy.hp = 50;
const hogus = piece();
const ctx = context(player, dummy);
handler.onCombatStart(hogus, ctx);

handler.onCooldownEffect(hogus, ctx);
assert.equal(player.stamina, 0, 'Hogus Bogus spends all available stamina up to its configured cap');
assert.equal(
  Object.values(player.stacks).reduce((sum, amount) => sum + amount, 0),
  15,
  'Hogus Bogus converts spent stamina into buffsPerStamina random buffs',
);
const firstBuff = ctx.events.findIndex((event) => event.type === 'buff');
const firstActivation = ctx.events.findIndex((event) => event.type === 'activate');
assert.ok(firstBuff >= 0 && firstActivation > firstBuff, 'Hogus Bogus activates after its first-phase buff grants');

handler.onCooldownEffect(hogus, ctx);
assert.equal(dummy.stunnedUntil, 5, 'Hogus Bogus stuns the opponent for the source duration');
assert.equal(player.stunnedUntil, 4.8, 'Hogus Bogus self-stuns for the source duration');

player.hp = 100;
handler.onCooldownEffect(hogus, ctx);
assert.equal(player.hp, 120, 'Hogus Bogus heals from the opponent current health percentage');
assert.equal(hogus.alive, false, 'Hogus Bogus consumes after its third phase');
assert.equal(hogus._cdLocked, true, 'Hogus Bogus locks its cooldown after onAfterEffectFinished');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 3, 'Hogus Bogus activates once per phase');

const zeroPlayer = createActor('player', { maxHp: 200, maxStamina: 5 });
const zeroDummy = createActor('dummy', { maxHp: 100 });
const zeroHogus = piece({ params: { stamina: 0, p1: 0, buffs: 0, p2: 0, dur_stun: 0, p3: 0, dur_self_stun: 0, p4: 0, heal: 0, p5: 0 } });
const zeroCtx = context(zeroPlayer, zeroDummy);
handler.onCombatStart(zeroHogus, zeroCtx);
handler.onCooldownEffect(zeroHogus, zeroCtx);
assert.equal(zeroPlayer.stamina, 5, 'Hogus Bogus honors an explicit zero stamina cap');
assert.equal(zeroPlayer.stacks.regeneration || 0, 0, 'Hogus Bogus honors an explicit zero buff count');

console.log('OK Hogus Bogus source-backed fractional stamina conversion, three-phase effects, activation ordering, consumption, and zero parameters');
