import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import affectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/GlovesofHaste.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasCooldown\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*for item in getAffectedItems\(\):[\s\S]*item\.addSpeed\(bonusSpeed\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.gloves_of_haste?.file, 'GlovesofHaste.gd');
assert.equal(getScriptHandler('gloves_of_haste')?.handlerId, 'gloves_of_haste');

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    side,
    alive: true,
    kind: id === 'gloves_of_haste' ? 'accessory' : 'weapon',
    cooldown: item?.cooldown ?? 0,
    baseCooldown: item?.cooldown ?? 0,
    ...overrides,
  };
}

function graph(sourcePiece, targets) {
  const pieces = new Map([[
    sourcePiece.placementKey,
    {
      key: sourcePiece.placementKey,
      id: sourcePiece.itemId,
      cells: [],
      affectCells: targets.map((target, index) => ({ cell: `link-${index}`, color: 'primary' })),
    },
  ]]);
  const filled = new Map();
  for (const [index, target] of targets.entries()) {
    pieces.set(target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(`link-${index}`, target.placementKey);
  }
  return { pieces, filled };
}

function context(owner, foe, pieces, board) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph: board,
    itemsById: byId,
    canAffect: { rulesById: affectRules.byId },
    events: [],
    bus,
    rng: () => 0,
    t: 5,
  };
}

const handler = getScriptHandler('gloves_of_haste');

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const gloves = piece('gloves_of_haste', `${side}:gloves`, side);
  const sword = piece('wooden_sword', `${side}:sword`, side, { cooldown: 0, baseCooldown: 0 });
  const passive = piece('healing_herbs', `${side}:passive`, side);
  const ctx = context(owner, foe, [gloves, sword, passive], graph(gloves, [sword, passive]));

  handler.onCombatStart(gloves, ctx);
  assert.ok(Math.abs(sword.speedScale - 0.2) < 1e-9, `Gloves of Haste affects a catalog cooldown target even if its armed piece cooldown is zero on ${side}`);
  assert.equal(passive.speedScale || 0, 0, `Gloves of Haste excludes a target without a source cooldown on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Gloves of Haste activates after its speed grants on ${side}`);

  const zero = piece('gloves_of_haste', `${side}:gloves-zero`, side, { params: { p1: 0 } });
  const zeroSword = piece('wooden_sword', `${side}:zero-sword`, side, { cooldown: 1.4 });
  const zeroCtx = context(owner, foe, [zero, zeroSword], graph(zero, [zeroSword]));
  handler.onCombatStart(zero, zeroCtx);
  assert.equal(zeroSword.speedScale || 0, 0, `Gloves of Haste honors explicit zero speed on ${side}`);
  assert.equal(zeroCtx.events.at(-1)?.type, 'activate', `Gloves of Haste still activates at zero speed on ${side}`);
}

console.log('OK Gloves of Haste source-backed cooldown targeting, catalog descriptor fallback, activation order, both sides, and zero parameters');
