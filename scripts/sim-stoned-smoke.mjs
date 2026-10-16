import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { loseStacks } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Stoned.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-skills.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const bindStoned'),
  handlerSource.indexOf('const uniquelyUniquePort'),
);

assert.equal(inventory.byId.stoned?.file, 'Exclusive/Stoned.gd');
assert.equal(inventory.byId.stoned?.extends, 'Item');
assert.deepEqual(inventory.byId.stoned?.overrides, ['onPrepare']);
assert.match(source, /func canAffect_global\(item\):[\s\S]*item\.hasTag\(Tag\.Stone\)[\s\S]*item\.isA\(stoneGolemDescriptor\)/);
assert.match(source, /connectForCombat\(character\(\), "character_block_changed", "onBlockChanged"\)/);
assert.match(source, /connectForCombat\(character\(\), "character_damaged", "onDamaged"\)/);
assert.match(source, /connectForCombat\(item, "attacked", "onStoneAttacked"\)/);
assert.match(source, /giveBlock\(ceil\(damageRes\.damage \* blockFactor\)/);
assert.match(source, /character\(\)\.changeDamageResistance\(damReduction\)/);
assert.match(source, /character\(\)\.changeDamageResistance\( - damReduction\)/);
assert.match(portBlock, /item_attacked/);
assert.match(portBlock, /character_block_changed/);
assert.match(portBlock, /character_damaged/);
assert.match(portBlock, /payload\.hit\.damage/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.ceil\(\(payload\.hit\.healthDamage/);

const stoned = {
  ...byId.get('stoned'),
  itemId: 'stoned',
  placementKey: 'stoned',
  name: 'Stoned',
  params: { blockfordam: 65, p1: 65, damreduction: 22, p2: 22 },
};
const stone = {
  ...byId.get('stone'),
  itemId: 'stone',
  placementKey: 'stone',
  name: 'Stone',
};
const golem = {
  ...byId.get('stone_golem'),
  itemId: 'stone_golem',
  placementKey: 'golem',
  name: 'Stone Golem',
};
const foreignStone = {
  ...byId.get('stone'),
  itemId: 'stone',
  placementKey: 'opp:stone',
  name: 'Opponent Stone',
};
const sword = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'sword',
  name: 'Wooden Sword',
};

const player = createActor('player');
player.damageResistancePct = 5;
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [stoned, stone, golem, sword],
  itemsById: byId,
  events,
  bus,
  t: 2,
};
const handler = getScriptHandler('stoned');
assert.equal(handler?.handlerId, 'stoned');
handler.onPrepare(stoned, ctx);
handler.onCombatStart(stoned, ctx);

bus.emit('item_attacked', { piece: sword, hit: { hit: true, damage: 20, healthDamage: 20 }, t: 3 });
assert.equal(player.block, 0, 'non-Stone inventory attacks do not grant Stoned Block');

bus.emit('item_attacked', { piece: foreignStone, hit: { hit: true, damage: 20, healthDamage: 0 }, t: 3.1 });
assert.equal(player.block, 0, 'the opponent side cannot trigger this Stoned item');

bus.emit('item_attacked', { piece: stone, hit: { hit: true, damage: 20, healthDamage: 0 }, t: 3.2 });
assert.equal(player.block, 13, 'Stoned uses full hit damage and the exact 65% factor');
assert.equal(player.damageResistancePct, 27, 'Block becoming nonzero adds the source resistance');
assert.ok(events.some((event) => event.meta?.handler === 'stoned' && event.meta?.miniActivate));

bus.emit('item_attacked', { piece: stone, hit: { hit: true, damage: 0, healthDamage: 0 }, t: 3.3 });
assert.equal(player.block, 13, 'zero-damage hits do not fabricate a minimum Block grant');

loseStacks(player, 'block', 13);
assert.equal(player.damageResistancePct, 5, 'Block reaching zero removes only Stoned resistance');

bus.emit('item_attacked', { piece: golem, hit: { hit: true, damage: 10, healthDamage: 0 }, t: 3.4 });
assert.equal(player.block, 7, 'Stone Golem is accepted by the source isA predicate');
assert.equal(player.damageResistancePct, 27, 'Stone Golem Block reactivates protection');
bus.emit('character_damaged', { actor: dummy, healthDamage: 1, t: 3.5 });
assert.equal(player.damageResistancePct, 27, 'foreign damage events do not change the owner protection state');
loseStacks(player, 'block', 7);
assert.equal(player.damageResistancePct, 5);

console.log('OK Stoned source predicates, prepare listeners, full-damage Block conversion, owner scoping, and Block protection lifecycle regression');
