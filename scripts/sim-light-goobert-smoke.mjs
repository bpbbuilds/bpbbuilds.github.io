import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/LightGoobert.gd', 'utf8');
const goobertSource = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('light_goobert');

assert.equal(inventory.byId.light_goobert?.file, 'LightGoobert.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*setState\(true, true\)[\s\S]*heal\(\)[\s\S]*getP_m\("dur_blind"\)[\s\S]*blindAmount/);
assert.match(goobertSource, /func onItemActivated\(event\):[\s\S]*activations == getP1\(\)[\s\S]*doCooldownEffect\(\)[\s\S]*activate\(\)/);
assert.equal(getScriptHandler('light_goobert')?.handlerId, 'light_goobert');

function makeContext(params = data.params) {
  const piece = {
    ...data,
    itemId: 'light_goobert',
    placementKey: 'light-goobert',
    name: 'Light Goobert',
    kind: 'pet',
    side: 'you',
    alive: true,
    params: { ...params },
    paramMult: {},
  };
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  return {
    piece,
    player,
    dummy,
    bus,
    events,
    t: 3,
    rng: () => 0,
    pieces: [piece],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
  };
}

const handler = getScriptHandler('light_goobert');
const ctx = makeContext();
ctx.player.hp = 100;
handler.onPrepare(ctx.piece, ctx);
assert.equal(ctx.piece._goobertActs, 0, 'Light Goobert resets its inherited activation counter during prepare');
ctx.piece.paramMult.heal = 2;
for (let i = 0; i < data.params.activations; i += 1) {
  handler.onPeerActivated(ctx.piece, { itemId: 'wooden_sword' }, ctx);
}
assert.equal(ctx.player.hp, 150, 'Light Goobert applies modified inherited heal amount after its activation threshold');
assert.equal(ctx.dummy.stacks.blind, data.params.blind, 'Light Goobert grants the source blind amount, not the duration parameter');
assert.equal(ctx.dummy._tempStacks[0]?.expiresAt, 3 + data.params.dur_blind, 'Light Goobert uses modified blind duration');
assert.ok(ctx.events.some((event) => event.type === 'heal' && event.itemId === 'light_goobert'));
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'light_goobert'));

const zero = makeContext({ activations: 0, p1: 0, heal: 0, p2: 0, blind: 0, p3: 0, dur_blind: 0, p4: 0 });
handler.onPrepare(zero.piece, zero);
handler.onPeerActivated(zero.piece, null, zero);
assert.equal(zero.piece._goobertActs, 1, 'Light Goobert keeps zero activation thresholds deterministic');
assert.equal(zero.player.hp, 200);
assert.equal(zero.dummy.stacks.blind, 0);

console.log('OK Light Goobert source-backed prepare reset, inherited activation threshold, modified heal, exact Blind amount/duration, activation, and zero parameters');
