import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import affectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Halberd.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canBlock\(\) -> bool:[\s\S]*return true/);
assert.match(source, /func affectsEmpty\(color\):[\s\S]*return true/);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canBlock\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*totalBlockRemoval = blockRemoval \* \(getNumAffectedItems\(\) \+ getNumEmptyAffectedCells\(\)\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*if damageRes\.hasHit\(\):[\s\S]*addBonusDamage\(dam\)/);
assert.match(source, /func onPreDealDamage_late\(damageRes: DamageResult\):[\s\S]*removeBlock\(toRemove, damageRes\.event\)[\s\S]*giveBlock\(toGive, true, damageRes\.event\)/);
assert.equal(inventory.byId.halberd?.file, 'Exclusive/Halberd.gd');
assert.equal(getScriptHandler('halberd')?.handlerId, 'halberd');

function item(id, key, overrides = {}) {
  const value = byId.get(id);
  return {
    ...value,
    itemId: id,
    placementKey: key,
    name: value.displayName || value.name || id,
    params: value.params || {},
    side: 'you',
    alive: true,
    kind: /weapon/i.test(value.type || '') ? 'weapon' : /armor/i.test(value.type || '') ? 'armor' : 'gadget',
    blockGrant: Number(value.block) || 0,
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
    if (!link.target) continue;
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
  const dummy = createActor('dummy', { maxHp: 200, block: 5 });
  const bus = createCombatBus();
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
    t: 2,
  };
}

const handler = getScriptHandler('halberd');
const halberd = item('halberd', 'you:halberd');
const holyArmor = item('holy_armor', 'you:holy-armor');
const shinyMantle = item('shiny_mantle', 'you:shiny-mantle');
const sword = item('wooden_sword', 'you:sword');
const graph = board(halberd, [
  { cell: 'holy', target: holyArmor },
  { cell: 'empty', target: null },
  { cell: 'mantle', target: shinyMantle },
  { cell: 'sword', target: sword },
]);
const player = createActor('player', { maxHp: 200 });
const ctx = context(player, [halberd, holyArmor, shinyMantle, sword], graph);

handler.onPrepare(halberd, ctx);
assert.equal(halberd._blockStrip, 8, 'Halberd counts one canBlock target plus one empty affected cell');
assert.equal(holyArmor.buffPowers.block, 1.35, 'Halberd gives block power to canBlock targets');
assert.equal(shinyMantle.buffPowers?.block, undefined, 'Halberd does not affect armor that cannot block');
assert.equal(sword.buffPowers?.block, undefined, 'Halberd does not affect weapons that cannot block');

const hit = { hit: true, damage: 10 };
handler.onPreDealDamageEarly(halberd, ctx, hit);
assert.equal(hit.damage, 11, 'Halberd applies its exact P1 damage bonus to the current hit');
assert.equal(halberd.bonusDamage, 1);
handler.onPreDealDamageEarly(halberd, ctx, { hit: false, damage: 10 });
assert.equal(halberd.bonusDamage, 1, 'Halberd does not add damage on a miss');

handler.onPreDealDamageLate(halberd, ctx, hit);
assert.equal(ctx.dummy.block, 0, 'Halberd removes the available opponent block');
assert.equal(player.block, 3, 'Halberd gives leftover removal value as player block');
assert.ok(ctx.events.some((event) => event.meta?.kind === 'block_strip'));

const zero = item('halberd', 'you:halberd-zero', {
  params: { dam: 0, p1: 0, blockremoval: 0, p2: 0, blockfactor: 0, p3: 0 },
});
const zeroTarget = item('holy_armor', 'you:holy-armor-zero');
const zeroGraph = board(zero, [{ cell: 'target', target: zeroTarget }, { cell: 'empty', target: null }]);
const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroCtx = context(zeroPlayer, [zero, zeroTarget], zeroGraph);
handler.onPrepare(zero, zeroCtx);
assert.equal(zero._blockStrip, 0, 'Halberd honors explicit zero block removal');
assert.equal(zeroTarget.buffPowers?.block, undefined, 'Halberd honors explicit zero block factor');
const zeroHit = { hit: true, damage: 10 };
handler.onPreDealDamageEarly(zero, zeroCtx, zeroHit);
assert.equal(zeroHit.damage, 10, 'Halberd honors explicit zero damage');
handler.onPreDealDamageLate(zero, zeroCtx, zeroHit);
assert.equal(zeroPlayer.block, 0);

console.log('OK Halberd source-backed canBlock targeting, empty-cell removal, hit bonus, late block transfer, and zero parameters');
