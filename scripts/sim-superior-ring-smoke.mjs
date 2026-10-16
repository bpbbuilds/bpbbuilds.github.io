import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MagicRing.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ring.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('export function makeRingPort'),
  handlerSource.indexOf('export const magicRingPort'),
);

assert.equal(inventory.byId.superior_ring?.file, 'Exclusive/MagicRing.gd');
assert.deepEqual(inventory.byId.superior_ring?.overrides, ['doCooldownEffect', 'onCombatStart', 'onPrepare']);
assert.match(source, /func onPrepare\(\):[\s\S]*character_damaged[\s\S]*onDamaged[\s\S]*onOppoDamaged/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveStacksFromEffect/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveStacksFromEffect/);
assert.match(source, /func onDamaged\(_healthChange, event\):[\s\S]*relHealth < healthThreshold/);
assert.match(source, /func onOppoDamaged\(_healthChange, event\):[\s\S]*relHealth < opponentHealthThreshold/);
assert.match(source, /func giveStacksFromEffect\(effect, triggerEvent = null\):[\s\S]*giveStacks\([\s\S]*activate\(\)/);
assert.match(handlerSource, /ringEffectsFromPersistent/);
assert.match(port, /character_damaged/);
assert.match(handlerSource, /pushActivate\(piece, ctx, piece\.itemId/);

const baseParams = {
  poison: 3,
  p1: 3,
  cold: 4,
  blind: 5,
  lucky: 2,
  p2: 2,
  regeneration: 3,
  spikes: 3,
  mana: 4,
  p3: 4,
  heat: 6,
  vampirism: 3,
  p4: 3,
  empower: 2,
  healtht: 50,
  p5: 50,
  healtht_opp: 70,
  p6: 70,
  scale1: 1,
  scale2: 1,
  scale3: 1,
  scale4: 1,
  effects: 3,
  p8: 3,
};
const ring = {
  ...(catalog.find((item) => item.id === 'superior_ring') || {}),
  itemId: 'superior_ring',
  placementKey: 'superior-ring',
  name: 'Superior Ring',
  params: baseParams,
  persistent: {
    effects: [
      { trigger: 0, stack: 'lucky' },
      { trigger: 0, stack: 'poison' },
      { trigger: 1, stack: 'heat' },
    ],
  },
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [ring],
  events,
  bus,
  t: 1,
  rng: () => 0,
};
const runtime = getScriptHandler('superior_ring');
assert.equal(runtime?.handlerId, 'superior_ring');
runtime.onPrepare(ring, ctx);
runtime.onCombatStart(ring, ctx);
assert.equal(player.stacks.lucky, 2, 'Superior Ring applies a Start-of-Battle buff');
assert.equal(dummy.stacks.poison, 3, 'Superior Ring applies a Start-of-Battle debuff to the opponent');
assert.equal(events.filter((event) => event.type === 'activate').length, 2,
  'Superior Ring activates once for each Start-of-Battle effect');

runtime.onCooldownEffect(ring, ctx);
assert.equal(player.stacks.heat, 6, 'Superior Ring applies Every cooldown effects');
assert.equal(events.filter((event) => event.type === 'activate').length, 3,
  'Superior Ring activates once for the cooldown effect');

const lowRing = {
  ...ring,
  placementKey: 'low-superior-ring',
  _ringEffects: undefined,
  _ringBoundBus: undefined,
  persistent: {
    effects: [
      { trigger: 2, stack: 'mana' },
      { trigger: 3, stack: 'cold' },
      { trigger: 1, stack: 'blind' },
    ],
  },
};
const lowPlayer = createActor('player');
const lowDummy = createActor('dummy');
const lowBus = createCombatBus();
const lowEvents = [];
const lowCtx = {
  player: lowPlayer,
  dummy: lowDummy,
  pieces: [lowRing],
  events: lowEvents,
  bus: lowBus,
  t: 2,
  rng: () => 0,
};
runtime.onPrepare(lowRing, lowCtx);
lowPlayer.hp = 40;
lowBus.emit('character_damaged', { actor: lowPlayer, t: 2 });
assert.equal(lowPlayer.stacks.mana, 4, 'Superior Ring triggers its one-shot player-low effect');
lowBus.emit('character_damaged', { actor: lowPlayer, t: 3 });
assert.equal(lowPlayer.stacks.mana, 4, 'Superior Ring does not repeat player-low effects');

lowDummy.hp = 60;
lowBus.emit('character_damaged', { actor: lowDummy, t: 4 });
assert.equal(lowDummy.stacks.cold, 4, 'Superior Ring triggers its one-shot opponent-low effect');
assert.equal(lowEvents.filter((event) => event.type === 'activate').length, 2,
  'Superior Ring activates once for each low-health effect');

console.log('OK Superior Ring source, persistent effects, per-effect activation, cooldown, player-low, and opponent-low regression');
