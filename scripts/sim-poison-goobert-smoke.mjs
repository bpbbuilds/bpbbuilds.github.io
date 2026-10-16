import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const poisonGoobert = catalog.find((item) => item.id === 'poison_goobert');
const source = fs.readFileSync('tools/game-extract-full/Items/PoisonGoobert.gd', 'utf8');
const parent = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');

assert.equal(inventory.byId.poison_goobert?.file, 'PoisonGoobert.gd');
assert.equal(inventory.byId.poison_goobert?.extends, 'Goobert');
assert.match(source, /^extends Goobert/m);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*heal\(\)[\s\S]*inflictPoison\(getP3\(\)\)/);
assert.match(parent, /func prepare\(\):[\s\S]*activations = 0[\s\S]*connectForCombat\(item, "activated", "onItemActivated"\)/);
assert.match(parent, /if activations == getP1\(\):[\s\S]*doCooldownEffect\(\)[\s\S]*activate\(\)/);
assert.equal(poisonGoobert.params.p1, 5);
assert.equal(poisonGoobert.params.p2, 10);
assert.equal(poisonGoobert.params.p3, 4);

const piece = {
  ...poisonGoobert,
  itemId: 'poison_goobert',
  placementKey: 'goobert',
  name: 'Poison Goobert',
  params: poisonGoobert.params,
  kind: 'pet',
  alive: true,
};
const player = createActor('player', { maxHp: 100 });
player.hp = 40;
const dummy = createActor('dummy', { maxHp: 100 });
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 7,
  rng: () => 0,
};
const handler = getScriptHandler('poison_goobert');

assert.equal(handler?.handlerId, 'poison_goobert');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined);
handler.onPrepare(piece, ctx);
assert.equal(piece._goobertActs, 0);

for (let i = 0; i < 4; i += 1) {
  handler.onPeerActivated(piece, { itemId: `peer_${i}` }, ctx);
  assert.equal(player.hp, 40, `activation ${i + 1} is below the source threshold`);
  assert.equal(dummy.stacks.poison, 0);
}

handler.onPeerActivated(piece, { itemId: 'peer_4' }, ctx);
assert.equal(player.hp, 50, 'source heal amount is applied on the fifth peer activation');
assert.equal(dummy.stacks.poison, 4, 'source p3 poison amount is applied once');
assert.deepEqual(events.map((event) => event.type), ['heal', 'activate']);
assert.equal(events[0].amount, 10);
assert.equal(events[1].meta.handler, 'poison_goobert');
assert.equal(piece._goobertActs, 0, 'peer counter resets after the source threshold');

console.log('OK Poison Goobert source and peer-activation regression');
