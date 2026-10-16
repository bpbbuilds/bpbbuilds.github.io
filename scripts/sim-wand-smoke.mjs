import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Wand.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((row) => row.id === 'wand');

assert.equal(inventory.byId.wand?.file, 'Exclusive/Wand.gd');
assert.match(
  source,
  /func doCooldownEffect\(\):[\s\S]*giveLeastBuffs\(1, character\(\), null, buffs\)[\s\S]*removeMostBuffs\(buffsToUse, null, true, buffs\)[\s\S]*giveEmpower\(empower, event\)[\s\S]*activate\(\)/,
);
for (const param of ['manat', 'luckt', 'regent', 'empower', 'use']) {
  assert.match(source, new RegExp(`getP\\("${param}"\\)`));
}

const handler = getScriptHandler('wand');
assert.equal(handler?.handlerId, 'wand');

const piece = {
  ...item,
  itemId: 'wand',
  placementKey: 'wand',
  name: 'Wand of Equilibrium',
  params: item.params,
  kind: 'accessory',
  side: 'you',
};
const player = createActor('player');
player.stacks.mana = 10;
const events = [];
handler.onCooldownEffect(piece, { player, events, t: 4, rng: () => 0 });
assert.equal(player.stacks.mana, 9, 'threshold branch spends one stack from the largest buff pool');
assert.equal(player.stacks.lucky, 1, 'least-buff grant happens before the threshold check');
assert.equal(player.stacks.empower, 1, 'threshold branch grants source Empower amount');
assert.equal(events.at(-1)?.type, 'activate', 'source activation follows every cooldown effect');

const idlePlayer = createActor('player');
const idleEvents = [];
handler.onCooldownEffect({ ...piece, placementKey: 'idle-wand' }, {
  player: idlePlayer,
  events: idleEvents,
  t: 4,
  rng: () => 0,
});
assert.equal(idlePlayer.stacks.mana, 1);
assert.equal(idlePlayer.stacks.empower, 0);
assert.equal(idleEvents.at(-1)?.type, 'activate');

const run = simulateEngine({
  placements: [{ id: 'wand', key: 'wand', x: 0, y: 0, r: 0 }],
  itemsById: new Map([['wand', item]]),
  durationSec: 8,
  seed: 2,
  dummyAttacks: false,
});
const firstActivation = run.events.find((event) => event.itemId === 'wand' && event.type === 'activate');
assert.ok(firstActivation, 'engine run must project Wand activation');
const firstEffectEvents = run.events.filter((event) => event.t === firstActivation.t);
assert.equal(firstEffectEvents.at(-1)?.type, 'activate', 'engine effect ordering keeps activation last');

console.log('OK Wand source threshold/effect ordering and engine regression');
