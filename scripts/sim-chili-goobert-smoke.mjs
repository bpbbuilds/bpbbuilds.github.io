import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { onBuffChanged } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ChiliGoobert.gd', 'utf8');
const base = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');

assert.match(source, /extends Goobert/);
assert.match(source, /func\s+doCooldownEffect\(\):[\s\S]*?heal\(\)[\s\S]*?giveHeat\(getP3\(\)\)/);
assert.match(base, /if activations == getP1\(\):[\s\S]*?doCooldownEffect\(\)[\s\S]*?activate\(\)/);

const handler = getScriptHandler('chili_goobert');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPeerActivated, 'function');

const pieces = buildCombatPieces([{ id: 'chili_goobert', key: 'chili_goobert', x: 0, y: 0, r: 0 }], itemsById);
const chili = pieces.find((piece) => piece.itemId === 'chili_goobert');
assert.ok(chili, 'Chili Goobert fixture piece should build');
const player = createActor('player');
player.hp = 80;
const events = [];
const ctx = {
  t: 3,
  player,
  dummy: createActor('dummy'),
  events,
  pieces,
  itemsById,
  rng: () => 0,
};

// Observe the source Heat grant in the same event timeline as the helper's
// heal and activation projection.
onBuffChanged(player, (change) => {
  if (change.stack === 'heat') events.push({ type: 'buff', itemId: 'chili_goobert', meta: { stack: 'heat' } });
});

handler.onPrepare(chili, ctx);
for (let i = 0; i < 6; i += 1) handler.onPeerActivated(chili, null, ctx);

const itemEvents = events.filter((event) => event.itemId === 'chili_goobert');
const healIndex = itemEvents.findIndex((event) => event.type === 'heal');
const heatIndex = itemEvents.findIndex((event) => event.meta?.stack === 'heat');
const activationIndexes = itemEvents
  .map((event, index) => (event.type === 'activate' ? index : -1))
  .filter((index) => index >= 0);
assert.equal(player.hp, 96, 'Chili Goobert should heal the source amount');
assert.equal(player.stacks.heat, 2, 'Chili Goobert should grant source Heat');
assert.equal(activationIndexes.length, 1, 'Chili Goobert should activate once at the peer threshold');
assert.ok(healIndex >= 0 && heatIndex > healIndex, 'Chili Goobert should grant Heat after healing');
assert.ok(activationIndexes[0] > heatIndex, 'Chili Goobert should activate after its Heat grant');

console.log('Chili Goobert simulator parity smoke passed.');
