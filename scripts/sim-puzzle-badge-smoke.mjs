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
  'tools/game-extract-full/Items/Exclusive/PuzzleBadge.gd',
  'utf8',
);

assert.equal(inventory.byId.puzzle_badge?.file, 'Exclusive/PuzzleBadge.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*reduceSpeed\(slowSpeed\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*addSpeed\(slowSpeed \+ fastSpeed\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(source, /func getReplaceDescriptor\(rarity\):[\s\S]*ItemBook\.puzzleBags/);
assert.match(source, /func getRelatedItems\(\):[\s\S]*ItemBook\.puzzleBags/);

const badgeData = byId.get('puzzle_badge');
const badge = {
  ...badgeData,
  itemId: 'puzzle_badge',
  placementKey: 'badge',
  name: 'Puzzle Badge',
  params: badgeData.params,
  kind: 'accessory',
  side: 'you',
  alive: true,
};
const sword = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'sword',
  name: 'Wooden Sword',
  kind: 'weapon',
  speedScale: 0,
  alive: true,
};
const banana = {
  ...byId.get('banana'),
  itemId: 'banana',
  placementKey: 'banana',
  name: 'Banana',
  kind: 'consumable',
  speedScale: 0,
  alive: true,
};
const potion = {
  ...byId.get('health_potion'),
  itemId: 'health_potion',
  placementKey: 'potion',
  name: 'Health Potion',
  kind: 'consumable',
  speedScale: 0,
  alive: true,
};
const graph = {
  pieces: new Map([
    ['badge', { key: 'badge', id: 'puzzle_badge', cells: [], affectCells: [
      { cell: 'sword-link', color: 'primary' },
      { cell: 'banana-link', color: 'primary' },
      { cell: 'potion-link', color: 'primary' },
    ] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: [], affectCells: [] }],
    ['banana', { key: 'banana', id: 'banana', cells: [], affectCells: [] }],
    ['potion', { key: 'potion', id: 'health_potion', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['sword-link', 'sword'],
    ['banana-link', 'banana'],
    ['potion-link', 'potion'],
  ]),
};
const events = [];
const handler = getScriptHandler('puzzle_badge');
const ctx = {
  player: createActor('player'),
  dummy: createActor('dummy'),
  pieces: [badge, sword, banana, potion],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 5,
  rng: () => 0,
};

assert.equal(handler?.handlerId, 'puzzle_badge');
assert.equal(typeof handler.onPrepare, 'function');
assert.equal(handler.onCombatStart, undefined, 'Puzzle Badge source reduction belongs to prepare');
handler.onPrepare(badge, ctx);
assert.ok(Math.abs(sword.speedScale + 0.2) < 1e-12);
assert.ok(Math.abs(banana.speedScale + 0.2) < 1e-12);
assert.equal(potion.speedScale, 0, 'non-cooldown items are excluded by source canAffect');

handler.onCooldownEffect(badge, ctx);
assert.ok(Math.abs(sword.speedScale - 0.5) < 1e-12, 'cooldown adds source speed +speed2');
assert.ok(Math.abs(banana.speedScale - 0.5) < 1e-12);
assert.equal(badge.alive, false, 'source onAfterEffectFinished consumes the badge');
assert.equal(events[0]?.type, 'activate');
assert.equal(events[0]?.itemId, 'puzzle_badge');

console.log('OK Puzzle Badge source and handler regression');
