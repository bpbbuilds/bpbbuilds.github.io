import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
};

const row = inventory.byId.courage_puppy;
assert.ok(row);
assert.equal(row.file, 'Exclusive/CouragePuppy.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect', 'onPreCombatStart']);
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/CouragePuppy.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*Type\.Pet/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*addBonusDamage\(getP1\(\) \* getNumAffectedItems\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*var res: DamageResult = dealDamage\(\)[\s\S]*activate\(res\)/);
const handler = getScriptHandler('courage_puppy');
assert.equal(handler?.handlerId, 'courage_puppy');
assert.equal(typeof handler?.onPreCombatStart, 'function');

const puppy = byId.get('courage_puppy');
const linkedPet = byId.get('power_puppy');
const items = new Map([[puppy.id, puppy], [linkedPet.id, linkedPet]]);
const placements = [
  { id: puppy.id, key: 'courage', x: 0, y: 0, r: 0 },
  { id: linkedPet.id, key: 'pet', x: 1, y: 0, r: 0 },
];
const pieces = buildCombatPieces(placements, items);
const piece = pieces.find((p) => p.itemId === puppy.id);
const petPiece = pieces.find((p) => p.itemId === linkedPet.id);
assert.ok(piece && petPiece);
const graph = buildBoardGraph(placements, items);
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 3,
  graph,
  itemsById: items,
  canAffect,
  pieces,
  bus: createCombatBus(),
  rng: () => 0,
};

handler.onPreCombatStart(piece, ctx);
assert.equal(piece.bonusDamage, 2);

// Courage Puppy has zero stamina cost and its source DamageSource strikes even
// when the owner has no stamina available.
player.stamina = 0;
const before = dummy.hp;
handler.onCooldownEffect(piece, ctx);
assert.ok(dummy.hp < before);
assert.ok(events.some((event) => event.itemId === 'courage_puppy' && event.type === 'damage'));

console.log('OK Courage Puppy source port');
