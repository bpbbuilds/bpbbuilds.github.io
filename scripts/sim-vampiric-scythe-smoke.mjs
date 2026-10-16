import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/VampiricScythe.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-al-weapons.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const rawRules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { ...rawRules, rulesById: rawRules.byId };

assert.equal(inventory.byId.vampiric_scythe?.file, 'VampiricScythe.gd');
assert.deepEqual(inventory.byId.vampiric_scythe?.overrides, ['onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.gainsStack\(Stack\.Vampirism\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*giveBuffPower\(Game\.EventType\.Vampirism, 1\)[\s\S]*connectForCombat\(character\(\), "character_vampirism_changed", "onVampirismChanged"\)/);
assert.match(source, /func onVampirismChanged\(_amount, _event\):[\s\S]*min\(getP1\(\) \* character\(\)\.getVampirism\(\), getP2\(\)\)/);
assert.match(portSource, /handlerId: 'vampiric_scythe'/);
assert.match(portSource, /onPrepare\(piece, ctx\)/);

const handler = getScriptHandler('vampiric_scythe');
assert.equal(handler?.handlerId, 'vampiric_scythe');
assert.equal(typeof handler?.onPrepare, 'function');

const scytheCatalog = byId.get('vampiric_scythe');
const armorCatalog = byId.get('vampiric_armor');
const passiveCatalog = byId.get('lucky_clover');
assert.ok(scytheCatalog && armorCatalog && passiveCatalog);

const scythe = {
  ...scytheCatalog,
  itemId: 'vampiric_scythe', placementKey: 'scythe', name: 'Vampiric Scythe',
  kind: 'weapon', side: 'you', alive: true, speedScale: 1,
  params: { p1: 5, p2: 15 },
};
const armor = {
  ...armorCatalog,
  itemId: 'vampiric_armor', placementKey: 'armor', name: 'Vampiric Armor',
  kind: 'armor', side: 'you', alive: true,
};
const passive = {
  ...passiveCatalog,
  itemId: 'lucky_clover', placementKey: 'passive', name: 'Lucky Clover',
  kind: 'passive', side: 'you', alive: true,
};
const graph = {
  pieces: new Map([
    ['scythe', { key: 'scythe', id: 'vampiric_scythe', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['armor', { key: 'armor', id: 'vampiric_armor', affectCells: [] }],
    ['passive', { key: 'passive', id: 'lucky_clover', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'armor'],
    ['2,0', 'passive'],
  ]),
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const ctx = {
  player,
  dummy,
  events: [],
  t: 1,
  graph,
  pieces: [scythe, armor, passive],
  itemsById: new Map([
    ['vampiric_scythe', scytheCatalog],
    ['vampiric_armor', armorCatalog],
    ['lucky_clover', passiveCatalog],
  ]),
  canAffect,
};

handler.onPrepare(scythe, ctx);
assert.equal(armor.buffPowers.vampirism, 2, 'prepare adds one Vampirism buff-power layer to affected targets');
assert.equal(scythe.speedScale, 1, 'source does not apply a speed snapshot before Vampirism changes');

grantStacks(player, 'vampirism', 2);
assert.equal(scythe.speedScale, 1.1, 'first Vampirism change applies p1 speed per stack');
grantStacks(player, 'vampirism', 2);
assert.ok(Math.abs(scythe.speedScale - 1.15) < 1e-9, 'later Vampirism changes apply only the speed delta');
assert.equal(passive.buffPowers?.vampirism, undefined, 'non-Vampirism targets are excluded');

grantStacks(player, 'vampirism', 2);
assert.ok(Math.abs(scythe.speedScale - 1.15) < 1e-9, 'p2 caps the total Vampirism speed bonus');

console.log('OK Vampiric Scythe source prepare timing, Vampirism targets, dynamic speed deltas, p1/p2 cap, and excluded-target regression');
