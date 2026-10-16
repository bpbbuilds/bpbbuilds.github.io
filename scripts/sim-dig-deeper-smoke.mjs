import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DigDeeper.gd', 'utf8');
const row = inventory.byId.dig_deeper;
assert.ok(row, 'Dig Deeper has a source inventory row');
assert.equal(row.file, 'Exclusive/DigDeeper.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['onCombatStart']);
assert.match(source, /func onCombatStart\(\):[\s\S]*inflictBlind\(blind\)/);
assert.match(source, /func canAffect_global\(item\):[\s\S]*item\.isA\(shovelDescriptor\)[\s\S]*item\.isA\(shovelDogDescriptor\)/);

const handler = getScriptHandler('dig_deeper');
assert.equal(handler?.handlerId, 'dig_deeper');
assert.equal(typeof handler?.onCombatStart, 'function');

function run(params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const piece = {
    itemId: 'dig_deeper',
    placementKey: 'dig',
    name: 'Dig Deeper',
    kind: 'skill',
    params,
  };
  handler.onCombatStart(piece, {
    t: 2.5,
    player,
    dummy,
    events,
    rng: () => 0,
  });
  return { dummy, events };
}

const normal = run({ blind: 2, p1: 2 });
assert.equal(normal.dummy.stacks.blind, 2);
assert.equal(normal.events.find((event) => event.type === 'debuff')?.amount, 2);

const zero = run({ blind: 0, p1: 0 });
assert.equal(zero.dummy.stacks.blind, 0);
assert.equal(zero.events.length, 0);

console.log('OK Dig Deeper source port');
