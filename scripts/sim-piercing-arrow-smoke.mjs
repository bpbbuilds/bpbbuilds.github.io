/**
 * Piercing Arrow fidelity — prepare-time empowered targets, source integer
 * Block removal, and secondary activation Lucky listener.
 *   node scripts/sim-piercing-arrow-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
assert.equal(inventory.byId.piercing_arrow?.file, 'PiercingArrow.gd');
assert.equal(inventory.byId.piercing_arrow?.extends, 'Item');

const source = fs.readFileSync('tools/game-extract-full/Items/PiercingArrow.gd', 'utf8');
assert.match(source, /onready var critDam: = getP1\(\) \/ 100\.0/);
assert.match(source, /onready var blockRemoval: = int\(getP2\(\)/);
assert.match(source, /func canAffect\(item\):[\s\S]*canBeEmpowered/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*canActivate/);
assert.match(source, /func onPrepare\(\):[\s\S]*addCritSeverity\(critDam\)[\s\S]*pre_deal_damage_late/);
assert.match(source, /func onItemAttacks\(damageRes(?::[^)]*)?\):[\s\S]*wasCriticalHit\(\)[\s\S]*removeBlock\(blockRemoval\)/);
assert.match(source, /func onItemActivated\(event\):[\s\S]*rollChance\(\)[\s\S]*giveLucky\(1\)/);

const arrowItem = byId.get('piercing_arrow');
const swordItem = byId.get('wooden_sword');
const potionItem = byId.get('health_potion');
const arrow = {
  ...arrowItem,
  itemId: 'piercing_arrow',
  placementKey: 'arrow',
  name: 'Piercing Arrow',
  params: arrowItem.params,
  side: 'you',
  alive: true,
  chance: arrowItem.chance,
};
const sword = {
  ...swordItem,
  itemId: 'wooden_sword',
  placementKey: 'sword',
  name: 'Wooden Sword',
  kind: 'weapon',
  damageMin: swordItem.damageMin,
  damageMax: swordItem.damageMax,
  alive: true,
  critSeverity: 0,
};
const potion = {
  ...potionItem,
  itemId: 'health_potion',
  placementKey: 'potion',
  name: 'Health Potion',
  alive: true,
};
const itemsById = new Map([
  ['piercing_arrow', arrowItem],
  ['wooden_sword', swordItem],
  ['health_potion', potionItem],
]);
const ctx = {
  t: 1,
  player: createActor('player'),
  dummy: createActor('dummy'),
  rng: () => 0,
  events: [],
  pieces: [arrow, sword, potion],
  itemsById,
  canAffect: { rulesById: JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8')).byId },
  graph: {
    pieces: new Map([
      ['arrow', { key: 'arrow', id: 'piercing_arrow', affectCells: [
        { cell: '0,0', color: 'primary' },
        { cell: '1,0', color: 'secondary' },
      ] }],
      ['sword', { key: 'sword', id: 'wooden_sword', affectCells: [] }],
      ['potion', { key: 'potion', id: 'health_potion', affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', 'sword'],
      ['1,0', 'potion'],
    ]),
  },
};

const handler = getScriptHandler('piercing_arrow');
assert.equal(handler?.handlerId, 'piercing_arrow');
handler.onPrepare(arrow, ctx);
assert.equal(sword.critSeverity, 0.5, 'Piercing Arrow applies source crit severity to empowered weapon');
assert.equal(sword._preDealLate.length, 1, 'Piercing Arrow binds critical late-hit listener');
ctx.dummy.block = 20;
sword._preDealLate[0]({ critical: true });
assert.equal(ctx.dummy.block, 5, 'Piercing Arrow removes source p2 Block on critical hit');
handler.onPeerActivated(arrow, potion, ctx);
assert.equal(ctx.player.stacks.lucky, 1, 'Piercing Arrow grants Lucky on activated secondary target');

console.log('OK Piercing Arrow source and lifecycle regression');
