import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/White-EyesBlueDragon.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-cards.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'white_eyes_blue_dragon');

assert.ok(sourceItem, 'White-Eyes Blue Dragon: extracted catalog row');
assert.match(source, /func doRevealEffect\(\):[\s\S]*giveBlock\(getBlock\(\) \+ getP1\(\) \* chainPosition\)/);
assert.match(source, /inflictCold\(getP2\(\)\)/);
assert.match(source, /changeEffectDamageFactor\( - damReduction\)/);
assert.match(portSource, /blockpercard/);
assert.doesNotMatch(portSource, /Math\.max\(1, Math\.round\(getP2/);
assert.equal(getScriptHandler('white_eyes_blue_dragon')?.handlerId, 'white_eyes_blue_dragon');

function run(params, chainPos, blockGrant = 12) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const card = {
    itemId: 'white_eyes_blue_dragon',
    placementKey: 'white-eyes',
    name: 'White-Eyes Blue Dragon',
    params,
    blockGrant,
    _chainPos: chainPos,
  };
  getScriptHandler('white_eyes_blue_dragon').onRevealEffect(card, {
    player,
    dummy,
    events,
    t: 0,
    rng: () => 0,
    itemsById: new Map([['white_eyes_blue_dragon', sourceItem]]),
  });
  return { player, dummy, events };
}

const normal = run({ blockpercard: 6, p1: 6, cold: 4, p2: 4, damfactor: 10, p3: 10 }, 2);
assert.equal(normal.player.block, 24, 'White-Eyes Blue Dragon uses zero-based chain block scaling');
assert.equal(normal.dummy.stacks.cold, 4, 'White-Eyes Blue Dragon inflicts the named Cold amount');
assert.equal(normal.dummy.effectDmgFactor, -0.1, 'White-Eyes Blue Dragon applies opponent effect damage reduction');
assert.equal(normal.events.at(-1)?.type, 'activate', 'White-Eyes Blue Dragon activates after reveal effects');

const unassigned = run({ blockpercard: 6, p1: 6, cold: 4, p2: 4, damfactor: 10, p3: 10 }, undefined);
assert.equal(unassigned.player.block, 6, 'Unassigned cards preserve the source -1 chain position');

const zero = run({ blockpercard: 0, p1: 0, cold: 0, p2: 0, damfactor: 0, p3: 0 }, 2, 0);
assert.equal(zero.player.block, 0, 'Explicit zero White-Eyes block remains zero');
assert.equal(zero.dummy.stacks.cold, 0, 'Explicit zero White-Eyes Cold remains zero');
assert.equal(zero.dummy.effectDmgFactor, 0, 'Explicit zero White-Eyes effect factor remains zero');
assert.equal(zero.events.at(-1)?.type, 'activate', 'White-Eyes still activates when all values are zero');

console.log('OK White-Eyes Blue Dragon source/parity smoke');
