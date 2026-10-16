import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import affectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Hardwood.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.getRarity\(\) == Rarity\.Common/);
assert.match(source, /func onPrepare\(\):[\s\S]*numCommons = 0[\s\S]*if isMeleeWeapon\(item\):[\s\S]*item\.addBonusDamageFactor\(commonDam\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*if numCommons > 0:[\s\S]*giveBlock\(getBlock\(\) \* numCommons\)[\s\S]*activate\(\)/);
assert.match(source, /func onItemsCounted\(\):/);
assert.equal(inventory.byId.hardwood?.file, 'Exclusive/Hardwood.gd');
assert.equal(getScriptHandler('hardwood')?.handlerId, 'hardwood');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: 'you',
    alive: true,
    kind: /weapon/i.test(item.type || '') ? 'weapon' : /armor/i.test(item.type || '') ? 'armor' : 'gadget',
    damageMin: Number(item.damageMin) || 0,
    damageMax: Number(item.damageMax) || 0,
    empowerable: /weapon/i.test(item.type || ''),
    blockGrant: Number(item.block) || 0,
    ...overrides,
  };
}

function board(sourcePiece, links) {
  const pieces = new Map([[
    sourcePiece.placementKey,
    {
      key: sourcePiece.placementKey,
      id: sourcePiece.itemId,
      cells: [],
      affectCells: links.map(({ cell }) => ({ cell, color: 'primary' })),
    },
  ]]);
  const filled = new Map();
  for (const link of links) {
    pieces.set(link.target.placementKey, {
      key: link.target.placementKey,
      id: link.target.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(link.cell, link.target.placementKey);
  }
  return { pieces, filled };
}

function context(player, pieces, graph) {
  const bus = createCombatBus();
  const dummy = createActor('dummy', { maxHp: 200 });
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    pieces,
    graph,
    itemsById: byId,
    canAffect: { rulesById: affectRules.byId },
    events: [],
    t: 0,
  };
}

const handler = getScriptHandler('hardwood');
const hardwood = piece('hardwood', 'you:hardwood');
const commonMelee = piece('wooden_sword', 'you:wooden-sword');
const commonFood = piece('banana', 'you:banana');
const nonCommon = piece('holy_armor', 'you:holy-armor');
const graph = board(hardwood, [
  { cell: 'sword', target: commonMelee },
  { cell: 'food', target: commonFood },
  { cell: 'non-common', target: nonCommon },
]);
const player = createActor('player', { maxHp: 200 });
const ctx = context(player, [hardwood, commonMelee, commonFood, nonCommon], graph);

handler.onPrepare(hardwood, ctx);
assert.equal(hardwood._hardwoodCommons, 2, 'Hardwood counts only affected Common items');
assert.equal(commonMelee.bonusDamageFactor, 2.65, 'Hardwood applies source P1 damage factor during preparation');
assert.equal(commonFood.bonusDamageFactor ?? 1, 1, 'Hardwood does not damage-buff non-melee Common items');
assert.equal(nonCommon.bonusDamageFactor ?? 1, 1, 'Hardwood does not affect non-Common items');

handler.onCombatStart(hardwood, ctx);
assert.equal(player.block, 44, 'Hardwood grants catalog Block once per affected Common item');
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.meta?.handler === 'hardwood'));

const none = piece('hardwood', 'you:hardwood-none');
const noneGraph = board(none, [{ cell: 'non-common', target: nonCommon }]);
const nonePlayer = createActor('player', { maxHp: 200 });
const noneCtx = context(nonePlayer, [none, nonCommon], noneGraph);
handler.onPrepare(none, noneCtx);
handler.onCombatStart(none, noneCtx);
assert.equal(nonePlayer.block, 0, 'Hardwood gives no Block without Common targets');
assert.ok(noneCtx.events.some((event) => event.type === 'activate'), 'Hardwood still activates with no Common targets');

const zero = piece('hardwood', 'you:hardwood-zero', {
  params: { dam: 0, p1: 0 },
  blockGrant: 0,
});
const zeroTarget = piece('wooden_sword', 'you:wooden-sword-zero');
const zeroGraph = board(zero, [{ cell: 'target', target: zeroTarget }]);
const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroCtx = context(zeroPlayer, [zero, zeroTarget], zeroGraph);
handler.onPrepare(zero, zeroCtx);
handler.onCombatStart(zero, zeroCtx);
assert.equal(zeroTarget.bonusDamageFactor ?? 1, 1, 'Hardwood honors explicit zero damage factor');
assert.equal(zeroPlayer.block, 0, 'Hardwood honors explicit zero Block');
assert.ok(zeroCtx.events.some((event) => event.type === 'activate'));

console.log('OK Hardwood source-backed Common targeting, prepare-time melee factor, Block/start activation, and zero parameters');
