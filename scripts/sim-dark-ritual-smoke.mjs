import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { collapseDuplicateBuffLogs, bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DarkRitual.gd', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
};

const row = inventory.byId.dark_ritual;
assert.ok(row, 'Dark Ritual has a source inventory row');
assert.equal(row.file, 'Exclusive/DarkRitual.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Dark\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictRandomDebuffs\(debuffs\)[\s\S]*giveVampirism\(vampirism\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(darkSpeed \* numDark\)/);
assert.match(source, /func onBought\(\):[\s\S]*boosted = 1/);
assert.match(source, /func onItemRoll\(descr\):[\s\S]*crystalDescriptor[\s\S]*ItemBook\.multiplyWeight\(1\.5\)/);
assert.match(source, /func onItemRolled\(descr\):[\s\S]*crystalDescriptor[\s\S]*boosted -= 1/);

const handler = getScriptHandler('dark_ritual');
assert.equal(handler?.handlerId, 'dark_ritual');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const darkData = byId.get('dark_ritual');
assert.ok(darkData);
const piece = {
  itemId: 'dark_ritual',
  placementKey: 'ritual',
  name: 'Dark Ritual',
  kind: 'gadget',
  side: 'you',
  alive: true,
  params: darkData.params,
  cooldown: darkData.cooldown,
  baseCooldown: darkData.cooldown,
  speedScale: 0,
};

const graph = {
  pieces: new Map([
    ['ritual', { key: 'ritual', id: 'dark_ritual', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
    ] }],
    ['crystal', { key: 'crystal', id: 'corrupted_crystal', affectCells: [] }],
    ['lantern', { key: 'lantern', id: 'dark_lantern', affectCells: [] }],
    ['banana', { key: 'banana', id: 'banana', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'crystal'],
    ['2,0', 'lantern'],
    ['3,0', 'banana'],
  ]),
};
const itemsById = new Map([
  ['dark_ritual', darkData],
  ['corrupted_crystal', byId.get('corrupted_crystal')],
  ['dark_lantern', byId.get('dark_lantern')],
  ['banana', byId.get('banana')],
]);
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 4,
  rng: () => 0,
  graph,
  itemsById,
  pieces: [piece],
  canAffect,
};

handler.onCombatStart(piece, ctx);
assert.equal(piece.speedScale, darkData.params.speed / 100 * 2, 'only Dark items receive the source speed bonus');

bindBuffCombatLog({ events, getT: () => ctx.t, dummy });
try {
  const handled = handler.onCooldownEffect(piece, ctx);
  assert.equal(handled, true);
  assert.equal(dummy.stacks.poison, darkData.params.debuffs, 'source debuffs reach the opponent');
  assert.equal(player.stacks.vampirism, darkData.params.vampirism, 'named vampirism parameter is preserved');
  assert.equal(piece.alive, false, 'onAfterEffectFinished consumes the one-shot skill');
  assert.equal(piece.cooldown, 999, 'onAfterEffectFinished locks the consumed cooldown');

  collapseDuplicateBuffLogs(events);
  const debuffs = events.filter((event) => event.type === 'debuff' && event.target === 'dummy');
  const vampirism = events.filter((event) => event.type === 'buff' && event.target === 'player' && event.meta?.stack === 'vampirism');
  assert.equal(debuffs.length, 1);
  assert.equal(debuffs[0].amount, darkData.params.debuffs);
  assert.equal(vampirism.length, 1, 'the source vampirism grant is logged once');
  assert.equal(vampirism[0].amount, darkData.params.vampirism);
  assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'dark_ritual'));
} finally {
  unbindBuffCombatLog();
}

console.log('OK Dark Ritual source port');
