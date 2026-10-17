import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/SteelGoobert.gd', 'utf8');
const parentSource = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-aura.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const sourceItem = catalog.find((item) => item.id === 'steel_goobert');
const triggerItem = catalog.find((item) => item.id === 'banana');
const weaponItem = catalog.find((item) => item.id === 'wooden_sword');
const unrelatedItem = catalog.find((item) => item.id === 'cat_spirit');

assert.ok(sourceItem && triggerItem && weaponItem && unrelatedItem, 'Steel Goobert: extracted catalog rows');
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItems\(Affected\.Secondary\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*addBonusDamage\(getP2\(\)\)[\s\S]*giveBlock\(\)/);
assert.match(source, /func onCombatEnd\(\):[\s\S]*affectedWeapons\.clear\(\)/);
assert.match(parentSource, /func canAffect\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(parentSource, /func onItemActivated\(event\):[\s\S]*activationsToTrigger/);

const port = portSource.match(/export const steelGoobertPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /onCooldownEffect\(\)\s*\{\s*return false;/);
assert.match(port, /onPeerActivated\(piece, _activated, ctx\)/);
assert.match(port, /goobertPeerTick\(/);
assert.match(port, /addBonusDamage\(/);
assert.match(port, /gainStacks\(player, 'block'/);
assert.ok(getScriptHandler('steel_goobert'), 'Steel Goobert handler is registered');

const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};
const graph = {
  pieces: new Map([
    ['goobert', {
      key: 'goobert',
      id: 'steel_goobert',
      affectCells: [
        { cell: 'trigger-cell', color: 'primary' },
        { cell: 'weapon-cell', color: 'secondary' },
        { cell: 'unrelated-cell', color: 'secondary' },
      ],
      cells: [],
    }],
    ['trigger', { key: 'trigger', id: 'banana', affectCells: [], cells: ['trigger-cell'] }],
    ['weapon', { key: 'weapon', id: 'wooden_sword', affectCells: [], cells: ['weapon-cell'] }],
    ['unrelated', { key: 'unrelated', id: 'cat_spirit', affectCells: [], cells: ['unrelated-cell'] }],
  ]),
  filled: new Map([
    ['trigger-cell', 'trigger'],
    ['weapon-cell', 'weapon'],
    ['unrelated-cell', 'unrelated'],
  ]),
};
const piece = {
  itemId: 'steel_goobert',
  placementKey: 'goobert',
  name: 'Steel Goobert',
  kind: 'pet',
  side: 'you',
  alive: true,
  params: { ...sourceItem.params },
  blockGrant: sourceItem.block,
};
const trigger = { itemId: 'banana', placementKey: 'trigger', name: 'Banana', kind: 'consumable' };
const weapon = {
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  name: 'Wooden Sword',
  kind: 'weapon',
  damageMin: weaponItem.damageMin,
  damageMax: weaponItem.damageMax,
  bonusDamage: 0,
};
const unrelated = { itemId: 'cat_spirit', placementKey: 'unrelated', name: 'Cat Spirit', kind: 'pet', damageMin: 0, damageMax: 0 };
const player = createActor('player');
const events = [];
const ctx = {
  t: 4,
  player,
  events,
  graph,
  pieces: [piece, trigger, weapon, unrelated],
  itemsById: new Map([
    ['steel_goobert', sourceItem],
    ['banana', triggerItem],
    ['wooden_sword', weaponItem],
    ['cat_spirit', unrelatedItem],
  ]),
  canAffect,
  rng: () => 0,
};
const handler = getScriptHandler('steel_goobert');

handler.onPrepare(piece, ctx);
assert.deepEqual([...piece._steelGoobertWeapons], ['weapon'], 'only secondary empowerable weapons are cached');
for (let i = 0; i < 5; i += 1) handler.onPeerActivated(piece, trigger, ctx);
assert.equal(weapon.bonusDamage, 0, 'Goobert does not proc before the source activation threshold');
assert.equal(player.block, 0, 'Goobert does not grant Block before the source activation threshold');

handler.onPeerActivated(piece, trigger, ctx);
assert.equal(weapon.bonusDamage, 2, 'source P2 bonus damage applies to the cached weapon');
assert.equal(player.block, 16, 'source giveBlock uses the item Block value');
assert.equal(events.at(-1)?.type, 'activate', 'Goobert activates after its effect');

console.log('OK Steel Goobert source/parity smoke');
