import assert from 'node:assert/strict';
import fs from 'node:fs';

import rules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Fanfare.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*return true/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getP5\(\) \/ 100\.0 \* getNumAffectedItems\(\)\)/);
assert.match(source, /onPrepare\(\):[\s\S]*options = \[0, 1, 2\]/);
assert.match(source, /var rng = Util\.pickRandomElement\(options\)/);
assert.match(source, /rng == 0:[\s\S]*giveEmpower\(getP1\(\)/);
assert.match(source, /rng == 1:[\s\S]*giveMana\(getP2\(\)[\s\S]*removeMana\(getP3\(\)/);
assert.match(source, /else:[\s\S]*drainStamina\(getP4\(\)/);
assert.match(source, /activate\(\)[\s\S]*options = \[0, 1, 2\][\s\S]*options\.erase\(rng\)/);

const handler = getScriptHandler('fanfare');
assert.equal(handler?.handlerId, 'fanfare');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Fanfare preparation is not combat-start logic');

const fanfare = {
  itemId: 'fanfare',
  placementKey: 'fanfare',
  name: 'Fanfare',
  side: 'you',
  params: { p1: 0, p2: 0, p3: 3, p4: 0, p5: 10 },
  speedScale: 0,
  _fanfareOpts: [0, 1, 2],
};
const linkedA = { itemId: 'linked_a', placementKey: 'a' };
const linkedB = { itemId: 'linked_b', placementKey: 'b' };
const itemsById = new Map([
  ['fanfare', { id: 'fanfare', type: 'Accessory' }],
  ['linked_a', { id: 'linked_a', type: 'Skill' }],
  ['linked_b', { id: 'linked_b', type: 'Skill' }],
]);
const graph = {
  pieces: new Map([
    ['fanfare', { key: 'fanfare', id: 'fanfare', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['a', { key: 'a', id: 'linked_a', cells: ['1,0'], affectCells: [] }],
    ['b', { key: 'b', id: 'linked_b', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'fanfare'],
    ['1,0', 'a'],
    ['2,0', 'b'],
  ]),
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
player._simT = 2.5;
dummy._simT = 2.5;
dummy.stacks.mana = 1;
const ctx = {
  t: 2.5,
  player,
  dummy,
  events: [],
  rng: () => 0,
  graph,
  pieces: [fanfare, linkedA, linkedB],
  itemsById,
  canAffect: { rulesById: rules.byId },
};
handler.onPrepare(fanfare, ctx);
assert.equal(fanfare.speedScale, 0.2, 'source speed scales by all affected items');

handler.onCooldownEffect(fanfare, ctx);
assert.equal(player.stacks.empower, 0, 'zero Empower remains zero');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1, 'choice 0 activates once');
assert.deepEqual(fanfare._fanfareOpts, [1, 2], 'selected choice is excluded from the next roll');

fanfare._fanfareOpts = [1];
handler.onCooldownEffect(fanfare, ctx);
assert.equal(player.stacks.mana, 0, 'zero Mana grant remains zero');
assert.equal(dummy.stacks.mana, 0, 'removeMana removes available Mana even below the requested amount');

fanfare._fanfareOpts = [2];
const beforeStamina = dummy.stamina;
handler.onCooldownEffect(fanfare, ctx);
assert.equal(dummy.stamina, beforeStamina, 'zero drain leaves opponent stamina unchanged');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 3, 'all choices activate once each');

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const catalogFanfare = catalog.find((item) => item.id === 'fanfare');
assert.ok(catalogFanfare, 'Fanfare remains in the simulator catalog');
const run = simulateEngine({
  placements: [{ id: 'fanfare', key: 'fanfare', x: 4, y: 4, r: 0 }],
  itemsById: new Map([['fanfare', catalogFanfare]]),
  canAffect: { rulesById: rules.byId },
  durationSec: 13,
  dummyAttacks: false,
  seed: 1,
});
const engineActions = run.events.filter(
  (event) => event.itemId === 'fanfare' && ['activate', 'buff', 'stamina'].includes(event.type),
);
const activations = engineActions.filter((event) => event.type === 'activate');
assert.equal(activations.length, 3, 'engine preserves three Fanfare activations');
assert.ok(
  activations.every((activation) =>
    engineActions.some(
      (event) => event !== activation && event.t <= activation.t && (event.type === 'buff' || event.type === 'stamina'),
    ),
  ),
  'engine keeps each selected effect before activation',
);

console.log('OK Fanfare source and choice regression');
