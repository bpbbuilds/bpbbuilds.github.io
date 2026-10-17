import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/KingGoobert.gd', 'utf8');
const goobertSource = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const goobertData = byId.get('king_goobert');
const rubyData = byId.get('regular_ruby');

assert.match(source, /func prepare\(\):[\s\S]*getP\("gempower"\)[\s\S]*changeGemPower[\s\S]*getP\("charges"\)[\s\S]*\.prepare\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*changeBuffProtectStacks\(protectedBuffs\)[\s\S]*heal\(\)[\s\S]*invuCharges > 0[\s\S]*checkMana\(manaCost\)/);
assert.match(goobertSource, /func onItemActivated\(event\):[\s\S]*activations == getP1\(\)[\s\S]*doCooldownEffect\(\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.king_goobert?.file, 'Exclusive/KingGoobert.gd');
assert.equal(getScriptHandler('king_goobert')?.handlerId, 'king_goobert');

function makePiece(params = goobertData.params, gemIds = []) {
  return {
    ...goobertData,
    itemId: 'king_goobert',
    placementKey: 'king-goobert',
    name: 'King Goobert',
    kind: 'pet',
    side: 'you',
    alive: true,
    params: { ...params },
    gemIds,
    speedScale: 0,
  };
}

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
    t: 3,
    rng: () => 0,
    pieces: [piece],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: new Map([
      ['king_goobert', goobertData],
      ['regular_ruby', rubyData],
    ]),
    canAffect: null,
  };
}

const handler = getScriptHandler('king_goobert');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'King Goobert uses source prepare');

const piece = makePiece(undefined, ['regular_ruby']);
const ctx = makeContext(piece);
handler.onPrepare(piece, ctx);
assert.equal(piece._goobertActs, 0);
assert.equal(piece.invulnBudget, goobertData.params.charges, 'King Goobert uses p6 charges');
assert.equal(piece._socketGemPowerBonus, 0.5);
prepareGemSockets(piece, ctx);
assert.equal(ctx.player._healAmp, 0.3, 'King Goobert applies its source GemPower modifier to socket healing');

ctx.player.hp = 150;
grantStacks(ctx.player, 'mana', goobertData.params.mana, { originKey: 'setup', originId: 'setup' });
const beforePeer = ctx.events.length;
handler.onPeerActivated(piece, { itemId: 'wooden_sword' }, ctx);
assert.equal(piece._goobertActs, 1, 'King Goobert waits for the source p1 activations');
assert.equal(ctx.events.length, beforePeer, 'King Goobert has no effect before its p1 threshold');
for (let i = 1; i < goobertData.params.p1; i += 1) {
  handler.onPeerActivated(piece, { itemId: 'wooden_sword' }, ctx);
}
assert.equal(ctx.player.buffProtect, goobertData.params.buffs, 'King Goobert grants source Buff Protect');
assert.equal(ctx.player.hp, 196, 'King Goobert heals with source p2 and socketed Ruby efficiency');
assert.equal(ctx.player.stacks.mana, 0, 'King Goobert spends source p4 Mana');
assert.equal(ctx.player.invulnUntil, 3 + goobertData.params.dur_invu, 'King Goobert grants source p5 invulnerability');
assert.equal(piece.invulnBudget, goobertData.params.charges - 1, 'King Goobert spends a charge only after conditions pass');
assert.deepEqual(ctx.events.slice(beforePeer).map((event) => event.type), ['buff', 'heal', 'info', 'buff', 'activate']);

// The source still activates/heals/protects while existing invulnerability
// prevents a second charge from being consumed.
const heldBudget = piece.invulnBudget;
for (let i = 0; i < goobertData.params.p1; i += 1) {
  handler.onPeerActivated(piece, { itemId: 'wooden_sword' }, ctx);
}
assert.equal(piece.invulnBudget, heldBudget, 'King Goobert does not consume a charge while already invulnerable');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'King Goobert activates after every source threshold');

// A missing Mana condition must not consume a charge either.
const starved = makePiece();
const starvedCtx = makeContext(starved);
handler.onPrepare(starved, starvedCtx);
for (let i = 0; i < goobertData.params.p1; i += 1) {
  handler.onPeerActivated(starved, null, starvedCtx);
}
assert.equal(starved.invulnBudget, goobertData.params.charges, 'King Goobert preserves charges when Mana is unavailable');
assert.equal(starvedCtx.events.at(-1)?.type, 'activate');

const zero = makePiece({ activations: 0, p1: 0, heal: 0, p2: 0, buffs: 0, p3: 0, mana: 0, p4: 0, dur_invu: 0, p5: 0, charges: 0, p6: 0, gempower: 0, p7: 0 });
const zeroCtx = makeContext(zero);
handler.onPrepare(zero, zeroCtx);
handler.onPeerActivated(zero, null, zeroCtx);
assert.equal(zero._goobertActs, 1, 'King Goobert keeps zero activation thresholds deterministic');
assert.equal(zero.invulnBudget, 0);
assert.equal(zeroCtx.events.length, 0);

console.log('OK King Goobert source-backed prepare, p1 peer threshold, p2/p3/p4/p5/p6 effects, condition-safe invulnerability charges, GemPower socket modifier, activation ordering, and zero parameters');
