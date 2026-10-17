import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/HoloFireLizard.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('holo_fire_lizard');

assert.equal(inventory.byId.holo_fire_lizard?.file, 'HoloFireLizard.gd');
assert.equal(inventory.byId.holo_fire_lizard?.extends, 'Card');
assert.deepEqual(inventory.byId.holo_fire_lizard?.overrides, ['doRevealEffect']);
assert.match(source, /changeEffectDamageFactor\(damFactor\)[\s\S]*var dam = descriptor\.minDam \+ getP1\(\) \* chainPosition/);
assert.match(source, /dealEffectDamage\(dam\)[\s\S]*giveHeat\(heat\)[\s\S]*activate\(res\)/);
assert.equal(getScriptHandler('holo_fire_lizard')?.handlerId, 'holo_fire_lizard');

const piece = {
  ...data,
  itemId: 'holo_fire_lizard',
  placementKey: 'lizard',
  name: 'Holo Fire Lizard',
  kind: 'card',
  side: 'you',
  alive: true,
  params: { ...data.params },
  damageMin: data.damageMin,
  damageMax: data.damageMax,
  bonusDamageFactor: 1,
  _chainPos: 2,
};
const player = createActor('player', { maxHp: 200 });
const dummy = createActor('dummy', { maxHp: 200 });
const ctx = {
  player,
  dummy,
  events: [],
  t: 7,
  rng: () => 0,
  pieces: [piece],
  graph: { pieces: new Map(), filled: new Map() },
};
const handler = getScriptHandler('holo_fire_lizard');
assert.equal(typeof handler?.onRevealEffect, 'function');
handler.onRevealEffect(piece, ctx);

assert.equal(player.effectDmgFactor, 0.08, 'Holo Fire Lizard applies source effect damage factor before dealing damage');
assert.equal(dummy.hp, 178, 'Holo Fire Lizard deals min damage plus p1 per zero-based chain position');
assert.equal(player.stacks.heat, 4, 'Holo Fire Lizard gives source p2 Heat');
const damageIndex = ctx.events.findIndex((event) => event.type === 'damage' && event.itemId === piece.itemId);
const heatIndex = ctx.events.findIndex((event) => event.type === 'buff' && event.meta?.stack === 'heat');
const activationIndex = ctx.events.findIndex((event) => event.type === 'activate' && event.itemId === piece.itemId);
assert.ok(damageIndex >= 0 && heatIndex >= 0 && activationIndex > damageIndex && activationIndex > heatIndex, 'Holo Fire Lizard activates after damage and Heat');

const zero = {
  ...piece,
  params: { damfactor: 0, dampercard: 0, p1: 0, heat: 0, p2: 0, p3: 0 },
  _chainPos: 0,
};
const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroDummy = createActor('dummy', { maxHp: 200 });
const zeroCtx = { ...ctx, player: zeroPlayer, dummy: zeroDummy, events: [], pieces: [zero], t: 8 };
handler.onRevealEffect(zero, zeroCtx);
assert.equal(zeroPlayer.effectDmgFactor, 0, 'Holo Fire Lizard honors explicit zero effect factor');
assert.equal(zeroPlayer.stacks.heat, 0, 'Holo Fire Lizard honors explicit zero Heat');
assert.equal(zeroDummy.hp, 188, 'Holo Fire Lizard retains descriptor min damage when effect parameters are zero');

console.log('OK Holo Fire Lizard source-backed card chain damage, effect factor, Heat, activation order, and zero parameters');
