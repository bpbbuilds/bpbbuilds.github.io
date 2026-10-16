import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/WalrusTusk.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-start.js', 'utf8');

assert.match(source, /^extends Item/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveSpikes\(getP1\(\)\)[\s\S]*consume\(\)/);
assert.match(portSource, /handlerId: 'walrus_tusk'/);
assert.match(portSource, /onCombatStart\(piece, ctx\)[\s\S]*grantStacks\(ctx\.player, 'spikes'/);
assert.match(portSource, /consumeStart\(piece, ctx, 'walrus_tusk'\)/);

const handler = getScriptHandler('walrus_tusk');
assert.equal(handler?.handlerId, 'walrus_tusk');
assert.equal(typeof handler?.onCombatStart, 'function');

const piece = {
  ...byId.get('walrus_tusk'),
  itemId: 'walrus_tusk',
  placementKey: 'tusk',
  name: 'Walrus Tusk',
  alive: true,
  charges: 1,
  params: { p1: 1 },
};
const player = createActor('player');
const ctx = { player, dummy: createActor('dummy'), events: [], t: 0 };
handler.onCombatStart(piece, ctx);
assert.equal(getStackAmount(player, 'spikes'), 1, 'combat start grants the source P1 Spikes');
assert.equal(piece.alive, false, 'Walrus Tusk consumes itself after granting Spikes');
assert.equal(piece.charges, 0, 'consumption clears the item charges');
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'walrus_tusk'));

const run = simulateEngine({
  placements: [{ id: 'walrus_tusk', key: 'tusk', x: 0, y: 0, r: 0 }],
  itemsById: new Map([['walrus_tusk', byId.get('walrus_tusk')]]),
  durationSec: 3,
  dummyAttacks: false,
});
assert.ok(run.events.some((event) => event.type === 'activate' && event.itemId === 'walrus_tusk'), 'engine runs the start activation');
assert.ok(run.events.some((event) => event.type === 'buff' && event.meta?.stack === 'spikes' && event.amount === 1), 'engine exposes the granted Spikes event');

console.log('OK Walrus Tusk source combat-start Spikes grant, consume lifecycle, and engine regression');
