import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'pop');
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Pop.gd', 'utf8');

assert.equal(inventory.byId.pop?.file, 'Exclusive/Pop.gd');
assert.equal(inventory.byId.pop?.extends, 'Weapon');
assert.match(source, /func onPrepare\(\):[\s\S]*previousSpeedBonus = 0[\s\S]*character_mana_changed/);
assert.match(source, /func onManaChanged\(_amount, _event\):[\s\S]*min\(maxSpeedBonus, speedPerMana \* character\(\)\.getMana\(\)\)[\s\S]*addSpeed\(speed - previousSpeedBonus\)/);
assert.equal(item.params.p1, 4);
assert.equal(item.params.p2, 60);

const pop = {
  ...item,
  itemId: 'pop',
  placementKey: 'pop',
  name: 'Pop',
  params: item.params,
  kind: 'weapon',
  alive: true,
  speedScale: 0,
};
const player = createActor('player', { maxHp: 100 });
player.stacks.mana = 3;
const ctx = { player, dummy: createActor('dummy'), events: [], t: 2, rng: () => 0 };
const handler = getScriptHandler('pop');

assert.equal(handler?.handlerId, 'pop');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined);
handler.onPrepare(pop, ctx);
assert.equal(pop.speedScale, 0, 'prepare resets without applying pre-existing Mana');

grantStacks(player, 'mana', 5, { originKey: pop.placementKey, originId: pop.itemId });
assert.ok(Math.abs(pop.speedScale - 0.32) < 1e-9, 'Mana change adds speed per source p1');
grantStacks(player, 'mana', 20, { originKey: pop.placementKey, originId: pop.itemId });
assert.ok(Math.abs(pop.speedScale - 0.6) < 1e-9, 'speed is capped at source p2');
spendStacks(player, 'mana', 28, { originKey: pop.placementKey, originId: pop.itemId });
assert.ok(Math.abs(pop.speedScale) < 1e-9, 'spending Mana removes the prepared speed delta');

console.log('OK Pop source and Mana-speed regression');
