import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor, grantInvuln } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { cleanseRandomDebuffs, grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const crownData = catalog.find((item) => item.id === 'crown');
assert.ok(crownData, 'Crown is present in the extracted catalog');

const row = inventory.byId.crown;
assert.ok(row, 'Crown has a source inventory row');
assert.equal(row.file, 'Crown.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect']);

const source = fs.readFileSync('tools/game-extract-full/Items/Crown.gd', 'utf8');
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(CrownState\.Inactive\)/);
assert.match(source, /connectForCombat\(character\(\), "character_mana_changed", "checkTrigger"\)/);
assert.match(source, /connectForCombat\(character\(\), "character_invulnerable_end", "onInvuEnded"\)/);
assert.match(source, /character\(\)\.isVulnerable\(\)/);
assert.match(source, /character\(\)\.makeInvulnerable\(invuDur, self, triggerEvent\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*cleanseBlind\(1\)[\s\S]*heal\(\)[\s\S]*activate\(\)/);

const handler = getScriptHandler('crown');
assert.equal(handler?.handlerId, 'crown');
assert.equal(typeof handler?.onPrepare, 'function', 'Crown binds its source listeners during onPrepare');

const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
player._eventLog = events;
const piece = {
  itemId: 'crown',
  placementKey: 'crown',
  name: 'Crown',
  kind: 'armor',
  side: 'you',
  alive: true,
  params: crownData.params,
  cooldown: crownData.cooldown,
  baseCooldown: crownData.cooldown,
};
const ctx = {
  player,
  dummy,
  bus,
  events,
  t: 3,
  rng: () => 0,
  graph: buildBoardGraph([], new Map()),
  pieces: [piece],
  itemsById: new Map([['crown', crownData]]),
  canAffect: null,
};

// onPrepare only installs the source listeners; pre-existing mana does not
// invoke checkTrigger until a matching combat signal occurs.
player.stacks.mana = crownData.params.mana;
handler.onPrepare(piece, ctx);
assert.equal(piece._crownState, 'Inactive');
player.stacks.mana = 0;

// Source checkTrigger refuses to fire while invulnerable, even when the mana
// signal arrives. The next mana signal after vulnerability starts the effect.
grantInvuln(player, 5, 3, { bus, sourceId: 'other' });
grantStacks(player, 'mana', crownData.params.mana, { originId: 'test', rng: () => 0 });
assert.equal(piece._crownState, 'Inactive');
assert.equal(player.stacks.mana, crownData.params.mana);

player.invulnUntil = 0;
bus.emit('character_mana_changed', { actor: player, amount: 0 });
assert.equal(piece._crownState, 'Active');
assert.equal(player.stacks.mana, 0);
assert.equal(player.invulnUntil, 3 + crownData.params.dur_invu);
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'crown').length, 1);

// Active Crown cannot retrigger from more mana, and expiry transitions it to Used.
grantStacks(player, 'mana', crownData.params.mana, { originId: 'test', rng: () => 0 });
assert.equal(piece._crownState, 'Active');
piece._tryCrownInvuln(3 + crownData.params.dur_invu);
assert.equal(piece._crownState, 'Used');

// doCooldownEffect follows the source order: cleanse one blind, heal, activate.
player.hp = player.maxHp - 20;
grantStacks(player, 'blind', 1, { originId: 'test', rng: () => 0 });
const beforeCooldownEvents = events.length;
handler.onCooldownEffect(piece, { ...ctx, t: 8 });
assert.equal(player.stacks.blind, 0);
assert.equal(player.hp, player.maxHp - 15);
const cooldownEvents = events.slice(beforeCooldownEvents);
const healIndex = cooldownEvents.findIndex((event) => event.type === 'heal');
const activateIndex = cooldownEvents.findIndex((event) => event.type === 'activate');
assert.ok(healIndex >= 0, 'Crown cooldown logs its heal');
assert.ok(activateIndex > healIndex, 'Crown activates after cleansing and healing');

// cleanseBlind uses the normal cleanse-protection path.
player.stacks.blind = 1;
player.debuffCleanseProtectChance = 100;
const cleansed = cleanseRandomDebuffs(player, 1, () => 0, {
  availableDebuffs: ['blind'],
  cleanse: true,
  rng: () => 0,
});
assert.deepEqual(cleansed, {});
assert.equal(player.stacks.blind, 1);

console.log('OK Crown source port');
