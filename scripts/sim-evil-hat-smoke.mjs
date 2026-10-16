import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/EvilHat.gd',
  'utf8',
);
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):\s+return item\.canDamage\(\)/);
assert.match(source, /func canAffect_secondary\(item\):\s+return item\.hasType\(Type\.Dark\)/);
assert.match(source, /func onPrepare\(\):/);
assert.match(source, /character\(\)\.giveUnhealing\(unhealing\)/);
assert.match(source, /connectToCharacterDebuffs\("onDebuffsChanged"\)/);
assert.match(source, /connectToOpponentBuffs\("onOpponentBuffsChanged"\)/);
assert.match(source, /giveRegeneration\(regenToGive, event\)/);
assert.match(source, /item\.addCritChancePercent\(getChance2\(\) \* - amount\)/);
assert.match(source, /giveRandomBuffs\(selfBuffs\)/);
assert.match(source, /giveRandomBuffs\(opponentBuffs, null, Game\.getBuffs\(\), opponent\(\)\)/);
assert.match(source, /activate\(\)/);

const item = byId.get('evil_hat');
assert.equal(item?.chance, 75, 'catalog debuff-to-regen chance');
assert.equal(item?.chance2, 4, 'catalog debuff-strip crit chance');
assert.equal(getScriptHandler('evil_hat')?.handlerId, 'evil_hat');

const hat = {
  ...item,
  itemId: 'evil_hat',
  placementKey: 'hat',
  name: item.name,
  kind: 'passive',
  side: 'you',
  alive: true,
  params: { ...item.params },
  chance: 100,
  chance2: 4,
};
const sword = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'sword',
  kind: 'weapon',
  side: 'you',
  damageMin: 2,
  damageMax: 3,
  critChance: 0,
};
const lifesteal = {
  ...byId.get('vampiric_collar'),
  itemId: 'vampiric_collar',
  placementKey: 'life',
  kind: 'passive',
  side: 'you',
  damageMin: 0,
  damageMax: 0,
  critChance: 0,
};
const dark = {
  ...byId.get('dark_ritual'),
  itemId: 'dark_ritual',
  placementKey: 'dark',
  kind: 'passive',
  side: 'you',
};
const enemy = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'enemy',
  kind: 'weapon',
  side: 'them',
  damageMin: 2,
  damageMax: 3,
};
const pieces = [hat, sword, lifesteal, dark, enemy];
const placements = pieces.map((piece, i) => ({
  id: piece.itemId,
  key: piece.placementKey,
  x: i,
  y: 0,
  r: 0,
}));
const graph = buildBoardGraph(placements, byId);
const hatGraph = graph.pieces.get('hat');
hatGraph.affectCells = [
  { cell: '1,0', color: 'primary' },
  { cell: '2,0', color: 'primary' },
  { cell: '3,0', color: 'secondary' },
];

const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const ctx = {
  t: 0,
  player,
  dummy,
  events: [],
  bus: createCombatBus(),
  rng: () => 0,
  graph,
  pieces,
  itemsById: byId,
  canAffect: null,
};
const handler = getScriptHandler('evil_hat');

assert.equal(typeof handler?.onPrepare, 'function', 'source onPrepare is ported');

handler.onPrepare(hat, ctx);
assert.equal(player.unhealing, 0.19, 'unhealing includes base plus Dark secondary links');
assert.equal(dummy.unhealing, 0, 'opponent unhealing is unchanged');

grantStacks(player, 'poison', 1, { originKey: 'sword', originId: 'wooden_sword' });
assert.equal(player.stacks.regeneration, 1, 'owner debuff grants source regeneration');
grantStacks(dummy, 'poison', 1, { originKey: 'enemy', originId: 'wooden_sword' });
assert.equal(player.stacks.regeneration, 1, 'opponent-origin debuff is ignored');

grantStacks(dummy, 'lucky', 1, { originKey: 'enemy', originId: 'wooden_sword' });
spendStacks(dummy, 'lucky', 1, { originKey: 'sword', originId: 'wooden_sword' });
assert.equal(sword.critChance, 4, 'owner-origin opponent buff removal adds linked crit chance');
assert.equal(lifesteal.critChance, 0, 'non-damaging primary links are ignored');

handler.onCooldownEffect(hat, ctx);
assert.equal(player.stacks.lucky, 5, 'self random buffs use the exact source count');
assert.equal(dummy.stacks.lucky, 5, 'opponent random buffs use the exact source count');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'activation follows both random-buff grants');
assert.equal(ctx.events.at(-1)?.label, 'Pet: Evil Hat', 'activation projects Pet label');

{
  const zeroHat = {
    ...hat,
    params: { buffs: 0, p1: 0, buffs2: 0, p2: 0, regen: 0, p3: 0, unhealing: 0, p4: 0, unhealing2: 0, p5: 0 },
    chance: 0,
    chance2: 0,
  };
  const zeroPlayer = createActor('player', { maxHp: 100 });
  const zeroDummy = createActor('dummy', { maxHp: 100 });
  const zeroCtx = {
    ...ctx,
    t: 0,
    player: zeroPlayer,
    dummy: zeroDummy,
    events: [],
  };
  handler.onPrepare(zeroHat, zeroCtx);
  grantStacks(zeroPlayer, 'poison', 1, { originKey: 'sword', originId: 'wooden_sword' });
  assert.equal(zeroPlayer.stacks.regeneration, 0, 'typed zero regen chance remains zero');
  handler.onCooldownEffect(zeroHat, zeroCtx);
  assert.equal(zeroPlayer.stacks.lucky, 0, 'typed zero self buff count remains zero');
  assert.equal(zeroDummy.stacks.lucky, 0, 'typed zero opponent buff count remains zero');
  assert.equal(zeroCtx.events.at(-1)?.type, 'activate', 'zero-count hat still activates');
}

console.log('OK Evil Hat source and regression smoke');
