import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { initStoneAmmo, BAG_STONE_AMMO } from '../js/pages/sim/engine/scripts/stone-ammo.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Stone.gd', 'utf8');
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceItem = catalog.find((item) => item.id === 'stone');
const handler = getScriptHandler('stone');

assert.ok(sourceItem, 'Stone: extracted catalog row');
assert.equal(inventory.byId.stone?.file, 'Stone.gd');
assert.equal(inventory.byId.stone?.extends, 'Item');
assert.deepEqual(inventory.byId.stone?.overrides, [
  'doCooldownEffect',
  'onDealtDamage',
  'onPreDealDamage_late',
]);
assert.match(source, /ammunition = 1/);
assert.match(source, /if ammunition >= 1 and useStamina\(\) == Character\.StaminaResult\.Sufficient/);
assert.match(source, /ammunition -= 1[\s\S]*dealDamage\(\)[\s\S]*consume\(res\)/);
assert.match(source, /func preHit\(\):[\s\S]*removeBlock\(getP1\(\)/);
assert.equal(handler?.handlerId, 'stone');
assert.equal(BAG_STONE_AMMO, 9000);

function context({ stamina = 10, staminaCost = 1, block = 0, params = { blockremoval: 4, p1: 4 } } = {}) {
  const player = createActor('player', { maxHp: 100, maxStamina: 10 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player.stamina = stamina;
  dummy.block = block;
  const piece = {
    ...sourceItem,
    itemId: 'stone',
    placementKey: 'you:stone',
    side: 'you',
    kind: 'weapon',
    name: 'Stone',
    alive: true,
    charges: 1,
    ammunition: null,
    accuracy: 100,
    damageMin: 3,
    damageMax: 3,
    staminaCost,
    params,
  };
  return {
    t: 3,
    player,
    dummy,
    events: [],
    rng: () => 0,
    pieces: [piece],
    itemsById: new Map([['stone', sourceItem]]),
    notifyPreDealDamageLate(piece, hitCtx, hit) {
      handler.onPreDealDamageLate(piece, hitCtx, hit);
    },
    piece,
  };
}

const combat = context({ block: 5 });
handler.onCombatStart(combat.piece, combat);
assert.equal(combat.piece.ammunition, 1, 'Stone starts with one source ammunition');
assert.equal(handler.onCooldownEffect(combat.piece, combat), true, 'Stone handles a sufficient-stamina throw');
assert.equal(combat.player.stamina, 9, 'Stone spends stamina before its throw');
assert.equal(combat.dummy.block, 0, 'Stone removes its source P1 Block before damage');
assert.equal(combat.dummy.hp, 98, 'Stone deals damage after its late Block removal');
assert.equal(
  combat.events.find((event) => event.type === 'debuff')?.amount,
  -4,
  'Stone records the source Block removal before the hit resolves',
);
assert.equal(
  combat.events.find((event) => event.label === 'Stone hit for 3')?.meta?.blocked,
  1,
  'Stone damage sees only the remaining Block after pre-hit removal',
);
assert.equal(combat.piece.ammunition, 0, 'Stone consumes its final ammunition');
assert.equal(combat.piece.alive, false, 'Stone consume() deactivates the item');
assert.equal(combat.piece.charges, 0, 'Stone consume() clears the item charges');
assert.equal(
  combat.events.find((event) => event.type === 'activate')?.meta?.consume,
  true,
  'Stone marks the final throw as a consume activation',
);

const starved = context({ stamina: 0.5, block: 5 });
handler.onCombatStart(starved.piece, starved);
assert.equal(handler.onCooldownEffect(starved.piece, starved), false, 'Stone does not throw while starved');
assert.equal(starved.piece.ammunition, 1, 'Stone preserves ammunition after starvation');
assert.equal(starved.piece.alive, true, 'Stone remains present after starvation');
assert.equal(starved.dummy.block, 5, 'Stone does not strip Block after starvation');
assert.equal(starved.dummy.hp, 100, 'Stone does not deal damage after starvation');
assert.equal(starved.events.filter((event) => event.meta?.starved).length, 1);

const zero = context({ stamina: 10, staminaCost: 0, block: 5, params: { blockremoval: 0, p1: 0 } });
handler.onCombatStart(zero.piece, zero);
assert.equal(handler.onCooldownEffect(zero.piece, zero), true, 'Stone preserves an explicit zero stamina cost');
assert.equal(zero.player.stamina, 10, 'Stone does not spend stamina for an explicit zero cost');
assert.equal(zero.dummy.block, 2, 'Stone preserves an explicit zero Block-removal value');
assert.equal(zero.piece.ammunition, 0, 'Stone still consumes zero-cost final ammunition');

const initialized = { ammunition: null };
initStoneAmmo(initialized);
assert.equal(initialized.ammunition, 1, 'Stone ammo helper preserves the source default');

console.log('OK Stone source/parity smoke');
