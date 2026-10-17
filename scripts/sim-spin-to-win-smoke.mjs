import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/SpintoWin.gd',
  'utf8',
);
const portSource = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ap-mana.js',
  'utf8',
);
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'spin_to_win');

assert.ok(sourceItem, 'Spin to Win: extracted catalog row');
assert.match(source, /onready var heat: = int\(getP\("heat"\)\)/);
assert.match(source, /onready var luck: = int\(getP\("luck"\)\)/);
assert.match(source, /onready var regen: = int\(getP\("regen"\)\)/);
assert.match(source, /onready var mana: = int\(getP\("mana"\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*match faceDirection[\s\S]*giveHeat\(heat\)[\s\S]*giveLucky\(luck\)[\s\S]*giveRegeneration\(regen\)[\s\S]*giveMana\(mana\)[\s\S]*activate\(\)/);
assert.match(source, /func gainsStack\(stackType\) -> bool:[\s\S]*stackType == Stack\.Heat[\s\S]*stackType == Stack\.Lucky[\s\S]*stackType == Stack\.Regeneration[\s\S]*stackType == Stack\.Mana/);

const port = portSource.match(/const spinToWinPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /onCooldownEffect\(piece, ctx\)/);
assert.match(port, /Math\.trunc/);
assert.ok(
  port.indexOf('grantStacks(') < port.indexOf('pushActivate('),
  'Spin to Win activates after the source stack grant',
);
assert.doesNotMatch(port, /Math\.max\(1, Math\.round\(amounts\[face\]\)\)/);

const handler = getScriptHandler('spin_to_win');
assert.equal(handler?.handlerId, 'spin_to_win');

function runFace(face, params = sourceItem.params) {
  const piece = {
    itemId: 'spin_to_win',
    placementKey: 'spin',
    name: 'Spin to Win',
    kind: 'gadget',
    r: 2,
    params: { ...params },
  };
  const player = createActor('player');
  const events = [];
  const graph = {
    pieces: new Map([['spin', { key: 'spin', id: 'spin_to_win', r: face }]]),
  };
  const ctx = {
    t: 1.25,
    player,
    dummy: createActor('dummy'),
    events,
    graph,
    itemsById: new Map([['spin_to_win', sourceItem]]),
  };
  assert.equal(handler.onCooldownEffect(piece, ctx), true);
  return { piece, player, events };
}

const expectedStacks = ['heat', 'lucky', 'regeneration', 'mana'];
const expectedAmounts = [2, 3, 3, 4];
for (let face = 0; face < expectedStacks.length; face += 1) {
  const { player, events } = runFace(face);
  assert.equal(
    player.stacks[expectedStacks[face]],
    expectedAmounts[face],
    `face ${face} grants the source stack and amount`,
  );
  assert.equal(events.at(-1)?.type, 'activate', `face ${face} activates after granting`);
}

const fractional = runFace(0, {
  ...sourceItem.params,
  heat: 1.9,
  p1: 1.9,
  luck: 0,
  p2: 0,
});
assert.equal(fractional.player.stacks.heat, 1, 'source int() truncates fractional Heat');
assert.equal(fractional.player.stacks.lucky, 0, 'source zero Lucky stays zero');

console.log('OK Spin to Win source/parity smoke');
