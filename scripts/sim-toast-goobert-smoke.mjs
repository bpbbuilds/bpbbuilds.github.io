import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor, giveStamina } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ToastGoobert.gd', 'utf8');
const goobertSource = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-goobert.js', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.toast_goobert?.file, 'Exclusive/ToastGoobert.gd');
assert.deepEqual(inventory.byId.toast_goobert?.overrides, ['doCooldownEffect']);
assert.match(goobertSource, /activationsToTrigger = getP1\(\)/);
assert.match(goobertSource, /if activations == getP1\(\):[\s\S]*doCooldownEffect\(\)[\s\S]*activate\(\)/);
assert.match(source, /extends Goobert/);
assert.match(source, /staminaThreshold: = getP\("staminat"\)/);
assert.match(source, /stamina: = getP\("stamina"\)/);
assert.match(source, /regen: = int\(getP\("regen"\)\)/);
assert.match(source, /if character\(\)\.getCurrentStamina\(\) < staminaThreshold:[\s\S]*giveStamina\(stamina\)[\s\S]*giveRegeneration\(regen\)/);
assert.match(portSource, /toastGoobertPort/);
assert.match(portSource, /giveStamina\(/);
assert.match(portSource, /pushActivate\(/);

const handler = getScriptHandler('toast_goobert');
assert.equal(handler?.handlerId, 'toast_goobert');

const base = {
  ...byId.get('toast_goobert'),
  id: 'toast_goobert',
  itemId: 'toast_goobert',
  name: 'Toast Goobert',
  kind: 'pet',
  placementKey: 'toast',
  side: 'you',
  // Exercise p2/p3/p4 fallbacks instead of relying on named catalog keys.
  params: { p1: 3, p2: 2.5, p3: 1.7, p4: 3.9 },
};

function makeContext(piece) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  return {
    t: 4,
    player,
    dummy,
    events: [],
    rng: () => 0,
    pieces: [piece],
    allPieces: [piece],
    itemsById: new Map([['toast_goobert', piece]]),
  };
}

function peerTicks(piece, ctx, count) {
  for (let i = 0; i < count; i += 1) {
    handler.onPeerActivated(piece, { itemId: 'wooden_sword' }, ctx);
  }
}

const low = { ...base, placementKey: 'toast-low' };
const lowCtx = makeContext(low);
lowCtx.player.stamina = 1;
handler.onPrepare(low, lowCtx);
peerTicks(low, lowCtx, 2);
assert.equal(low._goobertActs, 2, 'Goobert peer counter waits for p1 activations');
assert.equal(lowCtx.events.length, 0, 'Toast does not trigger before the source activation threshold');
peerTicks(low, lowCtx, 1);
assert.equal(lowCtx.player.stamina, 2.7, 'low stamina branch uses giveStamina and preserves fractional p3');
assert.equal(lowCtx.player.stacks.regeneration, 0, 'low stamina branch does not grant Regeneration');
assert.equal(lowCtx.events.filter((event) => event.type === 'activate').length, 1, 'parent Goobert activation is logged after the effect');
assert.equal(lowCtx.events.find((event) => event.type === 'stamina')?.amount, 1.7, 'stamina projection records the source amount');

const high = { ...base, placementKey: 'toast-high' };
const highCtx = makeContext(high);
highCtx.player.stamina = 3;
handler.onPrepare(high, highCtx);
peerTicks(high, highCtx, 3);
assert.equal(highCtx.player.stacks.regeneration, 3, 'high stamina branch truncates source int regen');
assert.equal(highCtx.player.stamina, 3, 'high stamina branch does not give stamina');
assert.equal(highCtx.events.filter((event) => event.type === 'activate').length, 1, 'high branch still activates once');
assert.equal(highCtx.events.some((event) => event.type === 'stamina'), false, 'high branch has no phantom stamina event');

const zero = {
  ...base,
  placementKey: 'toast-zero',
  params: { p1: 1, p2: 0, p3: 0, p4: 0 },
};
const zeroCtx = makeContext(zero);
zeroCtx.player.stamina = 0;
handler.onPrepare(zero, zeroCtx);
assert.doesNotThrow(() => handler.onPeerActivated(zero, { itemId: 'wooden_sword' }, zeroCtx), 'zero Toast values stay safe');
assert.equal(zeroCtx.player.stamina, 0, 'zero stamina grant remains zero');
assert.equal(zeroCtx.player.stacks.regeneration, 0, 'zero regen remains zero');
assert.equal(zeroCtx.events.filter((event) => event.type === 'activate').length, 1, 'zero values still preserve parent activation');

const clampActor = createActor('player');
clampActor.stamina = clampActor.maxStamina - 0.25;
giveStamina(clampActor, 2);
assert.equal(clampActor.stamina, clampActor.maxStamina, 'giveStamina clamps to effective max stamina');

console.log('OK Toast Goobert source inheritance, peer threshold, p-slot fallback, low/high stamina branches, int regen, activation ordering, and zero-safe regression');
