import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/JynxStaff.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*numActivations = 0/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*tryUseMana\(manaCost\)[\s\S]*addBonusDamage\(permDamBonus\)[\s\S]*numActivations < maxActivations[\s\S]*item\.addSpeed\(speedBonus\)[\s\S]*removeLucky\(luckRemoval\)/);
assert.equal(inventory.byId.jynx_staff?.file, 'Exclusive/JynxStaff.gd');
assert.equal(getScriptHandler('jynx_staff')?.handlerId, 'jynx_staff');

function makePiece(itemId, placementKey, side = 'you', overrides = {}) {
  const item = byId.get(itemId) || { id: itemId, name: itemId };
  return {
    ...item,
    itemId,
    placementKey,
    name: item.displayName || item.name || itemId,
    side,
    alive: true,
    params: { ...(item.params || {}) },
    speedScale: 0,
    ...overrides,
  };
}

function makeContext(staff, locked, noCooldown, opponent) {
  return {
    t: 2.5,
    player: createActor('player', { maxHp: 200 }),
    dummy: createActor('dummy', { maxHp: 200 }),
    events: [],
    rng: () => 0,
    pieces: [staff, locked, noCooldown, opponent],
    graph: {
      pieces: new Map([
        ['staff', { key: 'staff', id: 'jynx_staff', cells: ['0,0'], affectCells: [
          { cell: '1,0', color: 'primary' },
          { cell: '2,0', color: 'primary' },
          { cell: '3,0', color: 'primary' },
        ] }],
        ['locked', { key: 'locked', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
        ['no-cooldown', { key: 'no-cooldown', id: 'healing_herbs', cells: ['2,0'], affectCells: [] }],
        ['opponent', { key: 'opponent', id: 'wooden_sword', cells: ['3,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'staff'],
        ['1,0', 'locked'],
        ['2,0', 'no-cooldown'],
        ['3,0', 'opponent'],
      ]),
    },
    itemsById: byId,
    canAffect: null,
  };
}

const staff = makePiece('jynx_staff', 'staff', 'you', {
  kind: 'weapon',
  cooldown: 1.8,
  baseCooldown: 1.8,
  staminaCost: 1,
  damageMin: 12,
  damageMax: 14,
  params: { manat: 3, p1: 3, dam: 2, p2: 2, speed: 10, p3: 10, max: 1, p4: 1, luck: 2, p5: 2 },
});
const locked = makePiece('wooden_sword', 'locked', 'you', { kind: 'weapon', cooldown: 999, baseCooldown: 999 });
const noCooldown = makePiece('healing_herbs', 'no-cooldown', 'you', { kind: 'passive', cooldown: 0 });
const opponent = makePiece('wooden_sword', 'opponent', 'them', { kind: 'weapon', cooldown: 1.4, baseCooldown: 1.4 });
const ctx = makeContext(staff, locked, noCooldown, opponent);
grantStacks(ctx.player, 'mana', 3, { originKey: 'setup', originId: 'setup' });
grantStacks(ctx.dummy, 'lucky', 2, { originKey: 'setup', originId: 'setup' });
const handler = getScriptHandler('jynx_staff');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');
handler.onPrepare(staff, ctx);
const damageRes = { hit: false, damage: 12 };
handler.onPreDealDamageEarly(staff, ctx, damageRes);

assert.equal(ctx.player.stacks.mana, 0, 'Jynx Staff spends the exact Mana threshold before damage');
assert.equal(damageRes.damage, 14, 'Jynx Staff adds permanent damage to the current damage result');
assert.equal(staff.bonusDamage, 2, 'Jynx Staff keeps the permanent damage bonus');
assert.equal(locked.speedScale, 0.1, 'Jynx Staff speeds a linked cooldown item using p3');
assert.equal(noCooldown.speedScale, 0, 'Jynx Staff excludes linked items without cooldowns');
assert.equal(opponent.speedScale, 0, 'Jynx Staff does not affect the opponent inventory');
assert.equal(ctx.dummy.stacks.lucky, 0, 'Jynx Staff removes the source p5 Lucky amount');
assert.equal(staff._jynxActs, 1, 'Jynx Staff records one capped activation');

const zeroStaff = makePiece('jynx_staff', 'zero-staff', 'you', {
  kind: 'weapon',
  cooldown: 1.8,
  baseCooldown: 1.8,
  params: { manat: 0, p1: 0, dam: 0, p2: 0, speed: 0, p3: 0, max: 0, p4: 0, luck: 0, p5: 0 },
});
const zeroLocked = makePiece('wooden_sword', 'locked', 'you', { kind: 'weapon', cooldown: 1.4, baseCooldown: 1.4 });
const zeroNoCooldown = makePiece('healing_herbs', 'no-cooldown', 'you', { kind: 'passive', cooldown: 0 });
const zeroOpponent = makePiece('wooden_sword', 'opponent', 'them', { kind: 'weapon', cooldown: 1.4, baseCooldown: 1.4 });
const zeroCtx = makeContext(zeroStaff, zeroLocked, zeroNoCooldown, zeroOpponent);
grantStacks(zeroCtx.player, 'mana', 1, { originKey: 'setup', originId: 'setup' });
grantStacks(zeroCtx.dummy, 'lucky', 1, { originKey: 'setup', originId: 'setup' });
handler.onPrepare(zeroStaff, zeroCtx);
const zeroDamage = { hit: true, damage: 4 };
handler.onPreDealDamageEarly(zeroStaff, zeroCtx, zeroDamage);
assert.equal(zeroDamage.damage, 4, 'Jynx Staff honors explicit zero Mana cost without side effects');
assert.equal(zeroLocked.speedScale, 0, 'Jynx Staff honors explicit zero speed/max activations');
assert.equal(zeroStaff._jynxActs, 0, 'Jynx Staff honors explicit zero max activations');

console.log('OK Jynx Staff source-backed early mana spend, current-hit damage, hasCooldown target filtering, capped speed, Lucky removal, and zero parameters');
