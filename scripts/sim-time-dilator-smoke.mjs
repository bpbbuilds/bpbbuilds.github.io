import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/TimeDilator.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-outliers-board.js', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.time_dilator?.file, 'Exclusive/TimeDilator.gd');
assert.deepEqual(inventory.byId.time_dilator?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func onPrepare\(\):[\s\S]*tickI = 0[\s\S]*PLAYER\.INVENTORY\.getItems\(\) \+ Game\.OPPONENT\.INVENTORY\.getItems\(\)[\s\S]*item\.isWeapon\(\)[\s\S]*item\.reduceSpeed\(slow\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getModifiedCooldown\(\)[\s\S]*slowestItem\.addSpeed\(speedUp\)[\s\S]*activate\(\)[\s\S]*tickI \+= 1/);
assert.match(source, /func playActivationSound\(\):[\s\S]*tickI % 2 == 0[\s\S]*Sound\.playSound/);
assert.match(portSource, /const timeDilatorPort/);
assert.match(portSource, /onPrepare\(piece, ctx\)/);
assert.match(portSource, /allPieces \|\| ctx\.pieces/);
assert.match(portSource, /modifiedCooldown\(other, player\?\.stacks\)/);

const handler = getScriptHandler('time_dilator');
assert.equal(handler?.handlerId, 'time_dilator');
assert.equal(typeof handler?.onPrepare, 'function');

const player = createActor('player');
const dummy = createActor('dummy');
const dilator = {
  ...itemsById.get('time_dilator'),
  itemId: 'time_dilator',
  placementKey: 'time-dilator',
  name: 'Time Dilator',
  kind: 'accessory',
  params: { p1: 30, p2: 6 },
  alive: true,
};
const playerWeapon = {
  ...itemsById.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'player-sword',
  name: 'Player Sword',
  kind: 'weapon',
  speedScale: 0,
  alive: true,
  cooldown: 3,
  baseCooldown: 3,
  triggerTime: 3,
};
const opponentWeapon = {
  ...itemsById.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'opponent-sword',
  name: 'Opponent Sword',
  kind: 'weapon',
  side: 'them',
  speedScale: 0.1,
  alive: true,
  cooldown: 5,
  baseCooldown: 5,
  triggerTime: 5,
};
const armor = {
  ...itemsById.get('leather_armor'),
  itemId: 'leather_armor',
  placementKey: 'armor',
  kind: 'armor',
  speedScale: 0.2,
  alive: true,
  cooldown: 4,
  baseCooldown: 4,
  triggerTime: 4,
};
const events = [];
const ctx = {
  t: 2,
  player,
  dummy,
  pieces: [dilator, playerWeapon, armor],
  allPieces: [dilator, playerWeapon, opponentWeapon, armor],
  itemsById,
  events,
};

handler.onPrepare(dilator, ctx);
assert.ok(Math.abs(playerWeapon.speedScale - -0.3) < 1e-9, 'prepare applies the source slow to player weapons');
assert.ok(Math.abs(opponentWeapon.speedScale - -0.2) < 1e-9, 'prepare applies the source slow to opponent weapons');
assert.equal(armor.speedScale, 0.2, 'prepare leaves non-weapons unchanged');
assert.equal(dilator._timeDilatorTickI, 0, 'prepare resets the source activation tick counter');

assert.equal(handler.onCooldownEffect(dilator, ctx), true, 'Time Dilator handles its cooldown effect');
assert.ok(Math.abs(playerWeapon.speedScale - -0.24) < 1e-9, 'cooldown effect speeds the slowest active item on its side');
assert.ok(Math.abs(opponentWeapon.speedScale - -0.2) < 1e-9, 'cooldown effect does not choose another side');
assert.equal(dilator._timeDilatorTickI, 1, 'first cooldown effect increments the source tick counter');
assert.equal(events.at(-1)?.meta?.targetKey, 'player-sword', 'target selection uses the owner inventory');
assert.equal(events.at(-1)?.meta?.soundPitch, 0.7, 'first activation uses the source alternating sound pitch');

const noSpeedCtx = {
  ...ctx,
  events: [],
  t: 5,
};
const zeroSpeedDilator = { ...dilator, params: { slow: 0, p1: 0, speed: 0, p2: 0 }, _timeDilatorTickI: 99 };
handler.onPrepare(zeroSpeedDilator, noSpeedCtx);
assert.equal(zeroSpeedDilator._timeDilatorTickI, 0, 'zero-safe prepare still resets tick state');
assert.equal(handler.onCooldownEffect(zeroSpeedDilator, noSpeedCtx), true, 'zero speed still performs the source activation');
assert.equal(zeroSpeedDilator._timeDilatorTickI, 1, 'zero speed still increments source activation ticks');
assert.equal(noSpeedCtx.events.length, 0, 'zero speed does not emit a phantom haste info event');

console.log('OK Time Dilator source, prepare timing, both-side weapon slow, owner-side highest-CD targeting, tick counter, pitch alternation, and zero-safe regression');
