import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/PrismaticSword.gd',
  'utf8',
);

assert.equal(inventory.byId.prismatic_sword?.file, 'Exclusive/PrismaticSword.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*countTypes\(getAffectedItems\(\)\)[\s\S]*addSpeed/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*hasHit\(\)[\s\S]*addBonusDamage[\s\S]*getBaseChance2\(\)/);
assert.match(source, /func onPreDealDamage_late\(damageRes: DamageResult\):[\s\S]*heal\(ceil\(damageRes\.damage \* getP_m\("lifesteal"\)/);
assert.match(source, /func canAffect\(item\):[\s\S]*Type\.Vampiric[\s\S]*Type\.Magic[\s\S]*Type\.Holy[\s\S]*Type\.Dark/);

const swordData = byId.get('prismatic_sword');
const sword = {
  ...swordData,
  itemId: 'prismatic_sword',
  placementKey: 'sword',
  name: 'Prismatic Sword',
  params: swordData.params,
  kind: 'weapon',
  side: 'you',
  bonusDamage: 0,
};
const linked = ['magic_staff', 'holy_armor', 'dark_lantern', 'vampiric_armor'].map((id, index) => ({
  ...byId.get(id),
  itemId: id,
  placementKey: `linked-${index}`,
  name: byId.get(id).name,
  kind: 'gadget',
  side: 'you',
}));
const unrelated = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'unrelated',
  name: 'Wooden Sword',
  kind: 'weapon',
  side: 'you',
};
const graph = {
  pieces: new Map([
    ['sword', { key: 'sword', id: 'prismatic_sword', cells: [], affectCells: [
      { cell: 'magic-link', color: 'primary' },
      { cell: 'holy-link', color: 'primary' },
      { cell: 'dark-link', color: 'primary' },
      { cell: 'vamp-link', color: 'primary' },
      { cell: 'unrelated-link', color: 'primary' },
    ] }],
    ...linked.map((piece, index) => [piece.placementKey, {
      key: piece.placementKey,
      id: piece.itemId,
      cells: [],
      affectCells: [],
    }]),
    ['unrelated', { key: 'unrelated', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['magic-link', 'linked-0'],
    ['holy-link', 'linked-1'],
    ['dark-link', 'linked-2'],
    ['vamp-link', 'linked-3'],
    ['unrelated-link', 'unrelated'],
  ]),
};
const player = createActor('player', { maxHp: 200 });
player.hp = 50;
const dummy = createActor('dummy');
const ctx = {
  player,
  dummy,
  pieces: [sword, ...linked, unrelated],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events: [],
  t: 4,
  rng: () => 0,
};
const handler = getScriptHandler('prismatic_sword');

assert.equal(handler?.handlerId, 'prismatic_sword');
assert.equal(typeof handler.onPrepare, 'function');
assert.equal(handler.onCombatStart, undefined, 'Prismatic Sword source counts links during prepare');
handler.onPrepare(sword, ctx);
assert.ok(Math.abs(sword.speedScale - 0.08) < 1e-12, 'one linked Magic item gives exact source speed');
assert.equal(sword._prismHoly, 1);
assert.equal(sword._prismDark, 1);
assert.equal(sword._prismVamp, 1);

const early = { hit: true, damage: 20 };
handler.onPreDealDamageEarly(sword, ctx, early);
assert.ok(Math.abs(sword.bonusDamage - 0.3) < 1e-12, 'Holy bonus preserves source fractional dam');
const totalDebuffs = () => dummy.stacks.poison + dummy.stacks.blind + dummy.stacks.cold;
assert.equal(totalDebuffs(), 4, 'Dark chance uses configured chance2 and source debuff count');

handler.onPreDealDamageLate(sword, ctx, { hit: true, damage: 40, healthDamage: 1 });
assert.equal(player.hp, 56, 'late lifesteal uses source damage, configured lifesteal, and Vampiric count');

const beforeMissBonus = sword.bonusDamage;
const beforeMissDebuffs = totalDebuffs();
handler.onPreDealDamageEarly(sword, ctx, { hit: false, damage: 40 });
handler.onPreDealDamageLate(sword, ctx, { hit: false, damage: 40, healthDamage: 0 });
assert.equal(sword.bonusDamage, beforeMissBonus, 'misses do not add Holy damage');
assert.equal(totalDebuffs(), beforeMissDebuffs, 'misses do not trigger Dark debuffs');

const noVamp = { ...sword, placementKey: 'no-vamp', itemId: 'prismatic_sword', bonusDamage: 0 };
const noVampCtx = { ...ctx, player: createActor('player', { maxHp: 200 }), pieces: [noVamp, ...linked.slice(0, 3)] };
noVampCtx.player.hp = 40;
const noVampGraph = {
  pieces: new Map([
    ['no-vamp', { key: 'no-vamp', id: 'prismatic_sword', cells: [], affectCells: [
      { cell: 'magic-link', color: 'primary' },
      { cell: 'holy-link', color: 'primary' },
      { cell: 'dark-link', color: 'primary' },
    ] }],
    ...linked.slice(0, 3).map((piece) => [piece.placementKey, { key: piece.placementKey, id: piece.itemId, cells: [], affectCells: [] }]),
  ]),
  filled: new Map([
    ['magic-link', 'linked-0'],
    ['holy-link', 'linked-1'],
    ['dark-link', 'linked-2'],
  ]),
};
noVampCtx.graph = noVampGraph;
handler.onPrepare(noVamp, noVampCtx);
handler.onPreDealDamageLate(noVamp, noVampCtx, { hit: true, damage: 40 });
assert.equal(noVampCtx.player.hp, 40, 'no linked Vampiric item means no lifesteal');

console.log('OK Prismatic Sword source and handler regression');
