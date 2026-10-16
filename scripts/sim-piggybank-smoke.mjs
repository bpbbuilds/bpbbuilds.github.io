import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/Piggybank.gd', 'utf8');

assert.equal(inventory.byId.piggybank?.file, 'Piggybank.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasStartofBattle\(\)/);
assert.match(source, /giveMaxHealth\(getP_m\("maxhealth"\) \* getNumAffectedItems\(\)\)/);
assert.match(source, /giveMaxHealth\([\s\S]*\n\s*consume\(\)/);

const piece = (id, placementKey, overrides = {}) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  params: byId.get(id)?.params || {},
  alive: true,
  charges: 1,
  kind: 'passive',
  ...overrides,
});

const bank = piece('piggybank', 'bank');
const starter = piece('just_stats', 'starter');
const nonStarter = piece('wooden_sword', 'sword', { kind: 'weapon' });
const graph = {
  pieces: new Map([
    ['bank', { key: 'bank', id: 'piggybank', cells: [], affectCells: [
      { cell: 'starter-link', color: 'primary' },
      { cell: 'sword-link', color: 'primary' },
    ] }],
    ['starter', { key: 'starter', id: 'just_stats', cells: [], affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['starter-link', 'starter'],
    ['sword-link', 'sword'],
  ]),
};

const player = createActor('player', { maxHp: 100 });
player.hp = 73;
const events = [];
const ctx = {
  player,
  graph,
  itemsById: byId,
  canAffect: {
    rulesById: canAffectRules.byId,
    startOfBattleIds: new Set(['just_stats']),
  },
  events,
  t: 5,
  activatePiece: () => true,
};

assert.equal(getScriptHandler('piggybank')?.handlerId, 'piggybank');
assert.equal(getScriptHandler('just_stats')?.onCombatStart != null, true);
assert.equal(getScriptHandler('wooden_sword')?.onCombatStart != null, false);

getScriptHandler('piggybank').onCombatStart(bank, ctx);

assert.equal(player.maxHp, 102, 'Piggybank uses maxhealth 2 for one valid start item');
assert.equal(player.hp, 75, 'Piggybank applies the temporary max-health gain to current HP');
assert.equal(bank.alive, false, 'Piggybank consumes after applying its effect');
assert.equal(events.map((event) => event.type).join(','), 'heal,activate');
assert.equal(events[0].amount, 2);
assert.equal(events[1].meta.consume, true);
assert.equal(events[1].meta.affected, 1);

console.log('OK Piggybank source and start-lifecycle regression');
