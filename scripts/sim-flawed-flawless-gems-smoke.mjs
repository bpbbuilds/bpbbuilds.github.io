import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const CASES = [
  ['flawed_amethyst', 'Gems/FlawedAmethyst.tscn', 'Gems/Amethyst.gd'],
  ['flawed_emerald', 'Gems/FlawedEmerald.tscn', 'Gems/Emerald.gd'],
  ['flawed_ruby', 'Gems/FlawedRuby.tscn', 'Gems/Ruby.gd'],
  ['flawed_sapphire', 'Gems/FlawedSapphire.tscn', 'Gems/Sapphire.gd'],
  ['flawless_amethyst', 'Gems/FlawlessAmethyst.tscn', 'Gems/Amethyst.gd'],
  ['flawless_emerald', 'Gems/FlawlessEmerald.tscn', 'Gems/Emerald.gd'],
  ['flawless_ruby', 'Gems/FlawlessRuby.tscn', 'Gems/Ruby.gd'],
  ['flawless_sapphire', 'Gems/FlawlessSapphire.tscn', 'Gems/Sapphire.gd'],
  ['flawless_topaz', 'Gems/FlawlessTopaz.tscn', 'Gems/Topaz.gd'],
  ['perfect_amethyst', 'Gems/PerfectAmethyst.tscn', 'Gems/Amethyst.gd'],
  ['perfect_emerald', 'Gems/PerfectEmerald.tscn', 'Gems/Emerald.gd'],
  ['perfect_ruby', 'Gems/PerfectRuby.tscn', 'Gems/Ruby.gd'],
  ['perfect_sapphire', 'Gems/PerfectSapphire.tscn', 'Gems/Sapphire.gd'],
  ['perfect_topaz', 'Gems/PerfectTopaz.tscn', 'Gems/Topaz.gd'],
  ['regular_amethyst', 'Gems/RegularAmethyst.tscn', 'Gems/Amethyst.gd'],
];

function piece(id, key, side = 'you') {
  const item = byId.get(id);
  return { itemId: id, placementKey: key, name: item.name, params: item.params, side, alive: true };
}
function run(fn, dummy) {
  const events = [];
  bindBuffCombatLog({ events, getT: () => 5, dummy });
  try { fn(events); } finally { unbindBuffCombatLog(); }
  return events;
}

for (const [id, sceneFile, file] of CASES) {
  const row = inventory.byId[id];
  assert.equal(row?.sceneFile, sceneFile, `${id} scene alias`);
  assert.equal(row?.file, file, `${id} exact source script`);
  assert.equal(row?.extends, 'Gem', `${id} inherits Gem`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} explicit runtime handler`);
}

for (const id of ['flawed_amethyst', 'flawless_amethyst']) {
  const player = createActor('player'); const dummy = createActor('dummy'); player.stacks.poison = 1;
  const events = run((events) => getScriptHandler(id).onCooldownEffect(piece(id, id), { player, dummy, events, rng: () => 0, t: 5 }), dummy);
  assert.equal(player.stacks.poison, 0, `${id} cleanses before activation`);
  assert.equal(events.at(-1)?.type, 'activate');
}
for (const [id, regen] of [['flawed_emerald', 2], ['flawless_emerald', 4]]) {
  for (const side of ['you', 'them']) {
    const player = createActor(side === 'you' ? 'player' : 'dummy'); const dummy = createActor(side === 'you' ? 'dummy' : 'player');
    const events = run((events) => getScriptHandler(id).onCooldownEffect(piece(id, `${side}:${id}`, side), { player, dummy, events, rng: () => 0, t: 5 }), player.id === 'dummy' ? player : dummy);
    assert.equal(player.stacks.regeneration, regen, `${id} regen on ${side}`);
    assert.equal(events.at(-1)?.type, 'activate');
  }
}
for (const [id, damage, heal] of [['flawed_ruby', 6, 9], ['flawless_ruby', 15, 23]]) {
  const player = createActor('player'); const dummy = createActor('dummy'); player.hp = 100;
  const events = run((events) => getScriptHandler(id).onCooldownEffect(piece(id, id), { player, dummy, events, rng: () => 0, t: 5 }), dummy);
  const hit = events.find((event) => event.type === 'damage' && event.itemId === id);
  const life = events.find((event) => event.type === 'heal' && event.itemId === id);
  assert.equal(hit?.amount, damage); assert.equal(life?.amount, heal); assert.ok(events.indexOf(hit) < events.indexOf(life));
}
for (const [id, cold] of [['flawed_sapphire', 3], ['flawless_sapphire', 5]]) {
  const player = createActor('player'); const dummy = createActor('dummy');
  const events = run((events) => getScriptHandler(id).onCooldownEffect(piece(id, id), { player, dummy, events, rng: () => 0, t: 5 }), dummy);
  assert.equal(dummy.stacks.cold, cold, `${id} inventory cold`); assert.equal(events.at(-1)?.type, 'activate');
}
for (const [id, expected] of [['flawless_topaz', 1.3]]) {
  const player = createActor('player'); const events = [];
  getScriptHandler(id).onPrepare(piece(id, id), { player, dummy: createActor('dummy'), events, t: 0 });
  assert.equal(player.staminaRegen, expected); assert.equal(events[0]?.meta?.stat, 'stamina_regen');
}

// Weapon/armor modes run from Gem.prepare before the host cooldown arms. These
// checks cover source-proven effects that the shared socket engine can express.
for (const [id, poison, resist] of [['flawed_emerald', 1, 15], ['flawless_emerald', 2, 25]]) {
  const [weapon] = buildCombatPieces([{ id: 'wooden_sword', key: id, x: 0, y: 0, r: 0, gems: [id] }], byId);
  const player = createActor('player'); const dummy = createActor('dummy'); const bus = createCombatBus();
  prepareGemSockets(weapon, { player, dummy, bus, itemsById: byId, rng: () => 0, t: 0 });
  bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true }, t: 1 }); assert.equal(dummy.stacks.poison, poison);
  const [armor] = buildCombatPieces([{ id: 'leather_armor', key: `${id}:armor`, x: 0, y: 0, r: 0, gems: [id] }], byId);
  const armored = createActor('player'); prepareGemSockets(armor, { player: armored, dummy: createActor('dummy'), bus: createCombatBus(), itemsById: byId, rng: () => 0, t: 0 });
  assert.equal(armored.stackResist.poison, resist);
}

console.log('OK flawed/flawless gem source aliases and supported inventory/socket paths');
