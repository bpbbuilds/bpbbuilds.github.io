import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { notifyPeerActivations } from '../js/pages/sim/engine/combat-activate.js';
import { pushActivate } from '../js/pages/sim/engine/scripts/ports-util.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = {
  goobert: fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8'),
  smelly: fs.readFileSync('tools/game-extract-full/Items/Exclusive/SmellyBarrier.gd', 'utf8'),
  twine: fs.readFileSync('tools/game-extract-full/Items/Exclusive/Twine.gd', 'utf8'),
};
assert.match(source.goobert, /for item in getAffectedItems\(\):[\s\S]*"activated", "onItemActivated"/);
assert.match(source.smelly, /inflictPoison\([\s\S]*activate\(\)/);
assert.match(source.twine, /giveMaxHealth\(maxHealth, event\)[\s\S]*activate\(\)/);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = raw.items || raw;
const byId = new Map(catalog.map((item) => [item.id, item]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};

const makePiece = (itemId, placementKey, overrides = {}) => {
  const item = byId.get(itemId);
  assert.ok(item, `catalog has ${itemId}`);
  return {
    ...item,
    itemId,
    placementKey,
    name: item.name,
    side: 'you',
    alive: true,
    params: { ...item.params },
    ...overrides,
  };
};

const steel = makePiece('steel_goobert', 'steel');
const smelly = makePiece('smelly_barrier', 'smelly');
const twine = makePiece('twine', 'twine', { chance: 100, chance2: 0 });
const weapon = makePiece('wooden_sword', 'weapon');
const pieces = [steel, smelly, twine, weapon];
const graph = {
  pieces: new Map([
    ['steel', { key: 'steel', id: steel.itemId, cells: [], affectCells: [
      { cell: 'smelly-for-steel', color: 'primary' },
      { cell: 'twine-for-steel', color: 'primary' },
      { cell: 'weapon-for-steel', color: 'secondary' },
    ] }],
    ['smelly', { key: 'smelly', id: smelly.itemId, cells: [], affectCells: [
      { cell: 'steel-for-smelly', color: 'primary' },
    ] }],
    ['twine', { key: 'twine', id: twine.itemId, cells: [], affectCells: [
      { cell: 'smelly-for-twine', color: 'primary' },
    ] }],
    ['weapon', { key: 'weapon', id: weapon.itemId, cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['smelly-for-steel', 'smelly'],
    ['twine-for-steel', 'twine'],
    ['weapon-for-steel', 'weapon'],
    ['steel-for-smelly', 'steel'],
    ['smelly-for-twine', 'smelly'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  t: 4,
  player,
  dummy,
  pieces,
  graph,
  itemsById: byId,
  canAffect,
  events,
  rng: () => 0,
  notifyPeerActivations(piece, activationCtx) {
    notifyPeerActivations(piece, activationCtx);
  },
};

for (const piece of [steel, smelly, twine]) getScriptHandler(piece.itemId).onPrepare(piece, ctx);
assert.deepEqual([...steel._goobertActivationTargets].sort(), ['smelly', 'twine']);
assert.deepEqual([...steel._steelGoobertWeapons], ['weapon']);
assert.deepEqual([...twine._twineTriggers], ['smelly']);

grantStacks(player, 'block', 13, { originKey: steel.placementKey, originId: steel.itemId });
assert.equal(dummy.stacks.poison, 1, 'Smelly Wall inflicts Poison after its 13 Block threshold');
assert.equal(steel._goobertActs, 2, 'Smelly Wall activation and the successful Twine activation each count once');
assert.equal(events.filter((event) => event.itemId === 'smelly_barrier' && event.type === 'activate').length, 1);
assert.equal(events.filter((event) => event.itemId === 'twine' && event.type === 'activate').length, 1);

pushActivate(weapon, ctx, 'test_weapon', 'test weapon');
assert.equal(steel._goobertActs, 2, 'a secondary Steel Goobert weapon activation does not count toward six');

console.log('OK Smelly Wall → Twine → Steel Goobert activation chain and secondary exclusion');
