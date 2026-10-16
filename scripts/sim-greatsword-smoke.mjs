import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Greatsword.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /onready var empowerNeeded: = int\(getP1\(\)\)/);
assert.match(source, /onready var buffedStamina: = getP2\(\)/);
assert.match(source, /onready var buffedCooldown: = getP3\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*character_empower_changed/);
assert.match(source, /if not buffed and character\(\)\.getEmpower\(\) >= empowerNeeded/);
assert.match(source, /elif buffed and character\(\)\.getEmpower\(\) < empowerNeeded/);
assert.equal(inventory.byId.greatsword?.file, 'Greatsword.gd');
assert.equal(getScriptHandler('greatsword')?.handlerId, 'greatsword');

function piece(overrides = {}) {
  const item = byId.get('greatsword');
  return {
    ...item,
    itemId: 'greatsword',
    placementKey: 'you:greatsword',
    name: item.displayName,
    params: item.params,
    kind: 'weapon',
    side: 'you',
    alive: true,
    staminaCost: item.staminaCost,
    baseStaminaCost: item.staminaCost,
    staminaFactor: 1,
    cooldown: item.cooldown,
    baseCooldown: item.cooldown,
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

const handler = getScriptHandler('greatsword');
const player = createActor('player', { maxHp: 200 });
const ctx = context(player);
const sword = piece();

handler.onPrepare(sword, ctx);
assert.equal(sword._gsBuffed, false, 'Greatsword starts unbuffed during preparation');
assert.equal(sword.staminaCost, 5, 'Greatsword starts at its catalog stamina cost');
assert.equal(sword.baseCooldown, 5, 'Greatsword starts at its catalog cooldown');

grantStacks(player, 'empower', 4);
assert.equal(sword._gsBuffed, false, 'Greatsword stays unbuffed below the threshold');
assert.equal(sword.staminaCost, 5);
assert.equal(sword.baseCooldown, 5);

grantStacks(player, 'empower', 1);
assert.equal(sword._gsBuffed, true, 'Greatsword buffs when Empower reaches the threshold');
assert.equal(sword.staminaCost, 2, 'Greatsword uses the source P2 stamina value while buffed');
assert.equal(sword.baseCooldown, 2, 'Greatsword uses the source P3 cooldown while buffed');

spendStacks(player, 'empower', 1);
assert.equal(sword._gsBuffed, false, 'Greatsword resets when Empower falls below the threshold');
assert.equal(sword.staminaCost, 5);
assert.equal(sword.baseCooldown, 5);

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroCtx = context(zeroPlayer);
const zeroSword = piece({
  params: { empowert: 0, p1: 0, stamina: 0, p2: 0, cd: 0, p3: 0 },
});
handler.onPrepare(zeroSword, zeroCtx);
assert.equal(zeroSword._gsBuffed, false, 'Greatsword does not invent a prepare-time state change');
grantStacks(zeroPlayer, 'empower', 1);
assert.equal(zeroSword._gsBuffed, true, 'Explicit zero threshold remains source-valid');
assert.equal(zeroSword.staminaCost, 0, 'Explicit zero buffed stamina is retained');
assert.equal(zeroSword.baseCooldown, 0, 'Explicit zero buffed cooldown is retained');

console.log('OK Greatsword source-backed prepare lifecycle, empower transitions, exact P1/P2/P3, and zero parameters');
