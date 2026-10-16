import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const cubertData = byId.get('cubert');
const weaponData = byId.get('wooden_sword');
const foodData = byId.get('banana');
assert.ok(cubertData && weaponData && foodData);

const row = inventory.byId.cubert;
assert.ok(row);
assert.equal(row.file, 'Exclusive/Cubert.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect', 'onPrepare']);

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Cubert.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItems\(\)[\s\S]*onItemActivated1/);
assert.match(source, /getAffectedItems\(Affected\.Secondary\)[\s\S]*onItemActivated2/);
assert.match(source, /func onItemActivated1\(event\):[\s\S]*giveRegeneration\(regen, event\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func onItemActivated2\(event\):[\s\S]*getRegeneration\(\) >= regenNeeded[\s\S]*useRegeneration\(regenNeeded, event\)[\s\S]*giveEmpower\(empower, event2\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveRegeneration\(regen\)[\s\S]*useRegeneration\(regenNeeded\)[\s\S]*giveEmpower\(empower, event2\)[\s\S]*activate\(\)/);

const handler = getScriptHandler('cubert');
assert.equal(handler?.handlerId, 'cubert');
assert.equal(typeof handler?.onPrepare, 'function');

const cubert = {
  itemId: 'cubert',
  placementKey: 'cubert',
  name: 'Cubert',
  kind: 'pet',
  side: 'you',
  alive: true,
  params: cubertData.params,
  chance: cubertData.chance,
  chance2: cubertData.chance2,
  speedScale: 0,
};
const primary = {
  itemId: 'wooden_sword',
  placementKey: 'primary',
  name: 'Wooden Sword',
  kind: 'weapon',
  side: 'you',
  alive: true,
};
const secondary = {
  itemId: 'banana',
  placementKey: 'secondary',
  name: 'Banana',
  kind: 'consumable',
  side: 'you',
  alive: true,
};
const graph = {
  pieces: new Map([
    ['cubert', { key: 'cubert', id: 'cubert', affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'secondary' }] }],
    ['primary', { key: 'primary', id: 'wooden_sword', affectCells: [] }],
    ['secondary', { key: 'secondary', id: 'banana', affectCells: [] }],
  ]),
  filled: new Map([['1,0', 'primary'], ['2,0', 'secondary']]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
player._eventLog = events;
const ctx = {
  player,
  dummy,
  bus,
  events,
  t: 3,
  rng: () => 0,
  graph,
  pieces: [cubert, primary, secondary],
  itemsById: byId,
  canAffect: null,
};
bindBuffCombatLog({ events, getT: () => ctx.t, dummy });

// Primary and secondary listeners are source-distinct. Primary grants Regen;
// secondary consumes the threshold and grants Empower.
handler.onPrepare(cubert, ctx);
bus.emit('piece_activated', { piece: primary, t: 3 });
assert.equal(getStackAmount(player, 'regeneration'), cubertData.params.regen);
assert.equal(getStackAmount(player, 'empower'), 0);
assert.ok(events.some((event) => event.meta?.handler === 'cubert' && event.meta?.miniActivate));

bus.emit('piece_activated', { piece: secondary, t: 3.1 });
assert.equal(getStackAmount(player, 'regeneration'), 0);
assert.equal(getStackAmount(player, 'empower'), cubertData.params.empower);
assert.equal(
  events.filter((event) => event.meta?.handler === 'cubert' && event.meta?.miniActivate).length,
  2,
);

// The cooldown effect grants Regen before consuming the threshold, then
// activates after both state changes.
const before = events.length;
handler.onCooldownEffect(cubert, { ...ctx, t: 4 });
assert.equal(getStackAmount(player, 'regeneration'), 0);
assert.equal(getStackAmount(player, 'empower'), cubertData.params.empower * 2);
const cooldownEvents = events.slice(before);
const buffIndex = cooldownEvents.findIndex((event) => event.type === 'buff' && event.meta?.stack === 'regeneration');
const activateIndex = cooldownEvents.findIndex((event) => event.type === 'activate' && event.itemId === 'cubert');
assert.ok(buffIndex >= 0 && activateIndex > buffIndex, 'Cubert activates after its cooldown grants');

unbindBuffCombatLog();
console.log('OK Cubert source port');
