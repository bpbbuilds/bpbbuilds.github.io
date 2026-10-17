import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Jynxtorquilla.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*numActivations = 0/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*numActivations < maxActivations[\s\S]*item\.addSpeed\(speedBonus\)[\s\S]*removeLucky\(getP3\(\)\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.jynx_torquilla?.file, 'Jynxtorquilla.gd');
assert.equal(getScriptHandler('jynx_torquilla')?.handlerId, 'jynx_torquilla');

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

function makeContext(pet, target, noCooldown, opponent) {
  return {
    t: 2.5,
    player: createActor('player', { maxHp: 200 }),
    dummy: createActor('dummy', { maxHp: 200 }),
    events: [],
    rng: () => 0,
    pieces: [pet, target, noCooldown, opponent],
    graph: {
      pieces: new Map([
        ['pet', { key: 'pet', id: 'jynx_torquilla', cells: ['0,0'], affectCells: [
          { cell: '1,0', color: 'primary' },
          { cell: '2,0', color: 'primary' },
          { cell: '3,0', color: 'primary' },
        ] }],
        ['target', { key: 'target', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
        ['no-cooldown', { key: 'no-cooldown', id: 'healing_herbs', cells: ['2,0'], affectCells: [] }],
        ['opponent', { key: 'opponent', id: 'wooden_sword', cells: ['3,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'pet'],
        ['1,0', 'target'],
        ['2,0', 'no-cooldown'],
        ['3,0', 'opponent'],
      ]),
    },
    itemsById: byId,
    canAffect: null,
  };
}

const pet = makePiece('jynx_torquilla', 'pet', 'you', {
  kind: 'pet',
  cooldown: 3,
  baseCooldown: 3,
  params: { speed: 5, p1: 5, max: 2, p2: 2, luck: 1, p3: 1 },
});
const target = makePiece('wooden_sword', 'target', 'you', { kind: 'weapon', cooldown: 999, baseCooldown: 999 });
const noCooldown = makePiece('healing_herbs', 'no-cooldown', 'you', { kind: 'passive', cooldown: 0 });
const opponent = makePiece('wooden_sword', 'opponent', 'them', { kind: 'weapon', cooldown: 1.4, baseCooldown: 1.4 });
const ctx = makeContext(pet, target, noCooldown, opponent);
grantStacks(ctx.dummy, 'lucky', 1, { originKey: 'setup', originId: 'setup' });
const handler = getScriptHandler('jynx_torquilla');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(pet, ctx);
handler.onCooldownEffect(pet, ctx);

assert.equal(target.speedScale, 0.05, 'Jynx Torquilla applies source speed to linked cooldown items');
assert.equal(noCooldown.speedScale, 0, 'Jynx Torquilla excludes linked items without cooldowns');
assert.equal(opponent.speedScale, 0, 'Jynx Torquilla does not affect the opponent inventory');
assert.equal(ctx.dummy.stacks.lucky, 0, 'Jynx Torquilla removes source p3 Lucky');
assert.equal(pet._jynxActs, 1, 'Jynx Torquilla records the first capped activation');
assert.equal(ctx.events.at(-1)?.meta?.handler, 'jynx_torquilla', 'Jynx Torquilla activates after speed and Lucky removal');

handler.onCooldownEffect(pet, ctx);
assert.equal(target.speedScale, 0.1, 'Jynx Torquilla can apply speed through the second capped activation');
assert.equal(pet._jynxActs, 2, 'Jynx Torquilla reaches the exact max activation count');
handler.onCooldownEffect(pet, ctx);
assert.equal(target.speedScale, 0.1, 'Jynx Torquilla stops speed gains at max activations');

const zeroPet = makePiece('jynx_torquilla', 'zero-pet', 'you', {
  kind: 'pet',
  cooldown: 3,
  baseCooldown: 3,
  params: { speed: 0, p1: 0, max: 0, p2: 0, luck: 0, p3: 0 },
});
const zeroTarget = makePiece('wooden_sword', 'target', 'you', { kind: 'weapon', cooldown: 1.4, baseCooldown: 1.4 });
const zeroNoCooldown = makePiece('healing_herbs', 'no-cooldown', 'you', { kind: 'passive', cooldown: 0 });
const zeroOpponent = makePiece('wooden_sword', 'opponent', 'them', { kind: 'weapon', cooldown: 1.4, baseCooldown: 1.4 });
const zeroCtx = makeContext(zeroPet, zeroTarget, zeroNoCooldown, zeroOpponent);
grantStacks(zeroCtx.dummy, 'lucky', 1, { originKey: 'setup', originId: 'setup' });
handler.onPrepare(zeroPet, zeroCtx);
handler.onCooldownEffect(zeroPet, zeroCtx);
assert.equal(zeroTarget.speedScale, 0, 'Jynx Torquilla honors explicit zero speed/max activations');
assert.equal(zeroCtx.dummy.stacks.lucky, 1, 'Jynx Torquilla honors explicit zero Lucky removal');
assert.equal(zeroPet._jynxActs, 0, 'Jynx Torquilla honors explicit zero max activations');

console.log('OK Jynx Torquilla source-backed prepare reset, hasCooldown target filtering, capped speed, p3 Lucky removal, activation ordering, and zero parameters');
