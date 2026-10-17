import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/HealingHerbs.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onCombatStart\(\):[\s\S]*giveRegeneration\(getP1\(\)\)[\s\S]*consume\(\)/);
assert.equal(inventory.byId.healing_herbs?.file, 'HealingHerbs.gd');
assert.equal(getScriptHandler('healing_herbs')?.handlerId, 'healing_herbs');

function piece(overrides = {}) {
  const item = byId.get('healing_herbs');
  return {
    ...item,
    itemId: 'healing_herbs',
    placementKey: 'you:healing-herbs',
    name: item.displayName,
    params: item.params,
    side: 'you',
    kind: 'accessory',
    alive: true,
    charges: 1,
    ...overrides,
  };
}

function context(player) {
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    events: [],
    t: 0,
    pieces: [],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('healing_herbs');
const player = createActor('player', { maxHp: 200 });
const ctx = context(player);
const herbs = piece();
handler.onCombatStart(herbs, ctx);
assert.equal(player.stacks.regeneration, 2, 'Healing Herbs gives the source P1 Regeneration amount');
assert.equal(herbs.alive, false, 'Healing Herbs consumes itself at combat start');
assert.equal(herbs.charges, 0);
assert.ok(ctx.events.some((event) => event.type === 'activate'));

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroCtx = context(zeroPlayer);
const zero = piece({
  placementKey: 'you:healing-herbs-zero',
  params: { p1: 0 },
});
handler.onCombatStart(zero, zeroCtx);
assert.equal(zeroPlayer.stacks.regeneration, 0, 'Healing Herbs honors an explicit zero regeneration value');
assert.equal(zero.alive, false, 'Healing Herbs still consumes with zero regeneration');
assert.ok(zeroCtx.events.some((event) => event.type === 'activate'));

console.log('OK Healing Herbs source-backed combat-start regeneration, consumption, activation, and zero parameters');
