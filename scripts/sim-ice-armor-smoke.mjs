import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/IceArmor.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onCombatStart\(\):[\s\S]*giveBlock\(\)[\s\S]*inflictCold\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*character\(\)\.getHeat\(\) >= getP2\(\)[\s\S]*useHeat\(getP2\(\)\)[\s\S]*inflictCold\(getP3\(\)\)[\s\S]*giveBlock\(getP4\(\)\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.ice_armor?.file, 'Exclusive/IceArmor.gd');
assert.equal(getScriptHandler('ice_armor')?.handlerId, 'ice_armor');

function piece(overrides = {}) {
  const item = byId.get('ice_armor');
  return {
    ...item,
    itemId: 'ice_armor',
    placementKey: 'you:ice-armor',
    name: item.displayName || item.name,
    params: item.params || {},
    side: 'you',
    kind: 'armor',
    block: item.block,
    cooldown: item.cooldown,
    alive: true,
    ...overrides,
  };
}

function context(player, dummy, pieces = []) {
  return {
    player,
    dummy,
    events: [],
    t: 3,
    rng: () => 0,
    pieces,
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const player = createActor('player', { maxHp: 200 });
const dummy = createActor('dummy', { maxHp: 200 });
const armor = piece();
const ctx = context(player, dummy, [armor]);
const handler = getScriptHandler('ice_armor');
handler.onCombatStart(armor, ctx);
assert.equal(player.block, 100, 'Ice Armor grants its live start Block');
assert.equal(dummy.stacks.cold, 4, 'Ice Armor inflicts its source start Cold amount');
assert.equal(ctx.events.at(-1)?.itemId, 'ice_armor', 'Ice Armor activates after its start effects');

grantStacks(player, 'heat', 2);
handler.onCooldownEffect(armor, ctx);
assert.equal(player.stacks.heat, 1, 'Ice Armor spends the source heat threshold');
assert.equal(dummy.stacks.cold, 6, 'Ice Armor inflicts source p3 Cold after spending heat');
assert.equal(player.block, 110, 'Ice Armor grants source p4 Block after spending heat');
assert.equal(ctx.events.at(-1)?.itemId, 'ice_armor', 'Ice Armor activates after its cooldown effects');

const noHeatPlayer = createActor('player', { maxHp: 200 });
const noHeatDummy = createActor('dummy', { maxHp: 200 });
const noHeatArmor = piece();
const noHeatCtx = context(noHeatPlayer, noHeatDummy, [noHeatArmor]);
handler.onCooldownEffect(noHeatArmor, noHeatCtx);
assert.equal(noHeatPlayer.block, 0, 'Ice Armor does not grant cooldown Block without enough heat');
assert.equal(noHeatDummy.stacks.cold, 0, 'Ice Armor does not inflict cooldown Cold without enough heat');
assert.equal(noHeatCtx.events.at(-1)?.itemId, 'ice_armor', 'Ice Armor still activates when its heat condition is false');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroDummy = createActor('dummy', { maxHp: 200 });
const zeroArmor = piece({ block: 0, params: { p1: 0, p2: 0, p3: 0, p4: 0 } });
const zeroCtx = context(zeroPlayer, zeroDummy, [zeroArmor]);
handler.onCombatStart(zeroArmor, zeroCtx);
handler.onCooldownEffect(zeroArmor, zeroCtx);
assert.equal(zeroPlayer.block, 0, 'Ice Armor honors explicit zero Block');
assert.equal(zeroDummy.stacks.cold || 0, 0, 'Ice Armor honors explicit zero Cold parameters');
assert.equal(zeroCtx.events.filter((event) => event.type === 'activate').length, 2, 'Ice Armor still activates for zero-valued effects');

console.log('OK Ice Armor source-backed start/cooldown heat gate, exact Cold/Block parameters, activation ordering, and zero parameters');
