import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import affectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/GoldCube.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*hasActivated = false[\s\S]*affectedItem = getFirstAffectedItem\(\)[\s\S]*connectForCombat\(character\(\), "character_damaged", "onDamaged"\)/);
assert.match(source, /var healthThreshold: = getP\("healtht"\) \/ 100\.0 - 0\.0001/);
assert.match(source, /if relHealth < healthThreshold:[\s\S]*advanceAffectedItem\(\)[\s\S]*heal\(getP_m\("heal"\) \+ getP_m\("heal_regen"\) \* character\(\)\.getRegeneration\(\)\)[\s\S]*consume\(\)/);
assert.equal(inventory.byId.gold_cube?.file, 'Exclusive/GoldCube.gd');
assert.equal(getScriptHandler('gold_cube')?.handlerId, 'gold_cube');

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
    kind: id === 'gold_cube' ? 'accessory' : 'weapon',
    cooldown: item?.cooldown ?? 0,
    baseCooldown: item?.cooldown ?? 0,
    triggerTime: item?.cooldown ?? 0,
    ...overrides,
  };
}

function graph(sourcePiece, target) {
  const pieces = new Map([
    [sourcePiece.placementKey, {
      key: sourcePiece.placementKey,
      id: sourcePiece.itemId,
      cells: [],
      affectCells: [{ cell: 'link', color: 'primary' }],
    }],
    [target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      cells: [],
      affectCells: [],
    }],
  ]);
  return { pieces, filled: new Map([['link', target.placementKey]]) };
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
    t: 7,
  };
}

const handler = getScriptHandler('gold_cube');

for (const side of ['you', 'them']) {
  const owner = createActor('player', { maxHp: 200 });
  const foe = createActor('dummy', { maxHp: 200 });
  const cube = piece('gold_cube', `${side}:gold-cube`, side);
  const sword = piece('wooden_sword', `${side}:sword`, side, {
    cooldown: 0,
    baseCooldown: 0,
    triggerTime: 0,
  });
  const ctx = context(owner, foe, [cube, sword], graph(cube, sword));

  handler.onPrepare(cube, ctx);
  assert.equal(cube._goldCubeTarget, sword, `Gold Cube caches its first affected cooldown item from the source descriptor on ${side}`);

  owner.hp = 99.99;
  owner._combatBus.emit('character_damaged', { actor: owner, hit: false });
  assert.equal(cube.alive, true, `Gold Cube keeps its strict threshold below healtht on ${side}`);

  sword.cooldown = 1.4;
  sword.baseCooldown = 1.4;
  sword.triggerTime = 1.4;
  owner.hp = 80;
  owner.stacks.regeneration = 3;
  cube.paramMult = { heal: 2, heal_regen: 0.5 };
  owner._combatBus.emit('character_damaged', { actor: owner, hit: false });
  assert.equal(owner.hp, 146, `Gold Cube uses modified heal and regeneration parameters on ${side}`);
  assert.ok(Math.abs(sword.triggerTime + 0.6) < 1e-9, `Gold Cube advances its cached cooldown item on ${side}`);
  assert.equal(cube.alive, false, `Gold Cube consumes after its threshold heal on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Gold Cube projects consume activation on ${side}`);
  assert.equal(ctx.events.at(-1)?.meta?.consume, true, `Gold Cube marks the source consume activation on ${side}`);

  const zero = piece('gold_cube', `${side}:gold-cube-zero`, side, {
    params: { healtht: 100, p1: 100, cdadvance: 0, p2: 0, heal: 0, p3: 0, heal_regen: 0, p4: 0, penalty: 0, p5: 0 },
  });
  const zeroSword = piece('wooden_sword', `${side}:zero-sword`, side, { cooldown: 1.4, baseCooldown: 1.4, triggerTime: 1.4 });
  const zeroCtx = context(owner, foe, [zero, zeroSword], graph(zero, zeroSword));
  owner.hp = 80;
  const hpBefore = owner.hp;
  handler.onPrepare(zero, zeroCtx);
  owner._combatBus.emit('character_damaged', { actor: owner, hit: false });
  assert.equal(owner.hp, hpBefore, `Gold Cube honors explicit zero heal parameters on ${side}`);
  assert.equal(zero.alive, false, `Gold Cube still consumes with zero heal parameters on ${side}`);
  assert.equal(zeroCtx.events.at(-1)?.type, 'activate', `Gold Cube activates with zero heal parameters on ${side}`);
}

console.log('OK Gold Cube source-backed target caching, strict threshold, modified healing, consume activation, both sides, and zero parameters');
