import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { startBattleRage, tickBattleRage } from '../js/pages/sim/engine/battle-rage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DeerTotem.gd', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};

const row = inventory.byId.deer_totem;
assert.ok(row, 'Deer Totem has a source inventory row');
assert.equal(row.file, 'Exclusive/DeerTotem.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Nature\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*changeDamageResistance\(getP1\(\)\)[\s\S]*addBattleRageDuration\(getP_m\("dur_rage"\) \* numNatureItems\)[\s\S]*battle_rage_started[\s\S]*battle_rage_ended/);
assert.match(source, /func preCombatStart\(\):[\s\S]*deactivateCooldown\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*heal\(\)[\s\S]*giveMana\(getP4\(\)\)[\s\S]*activate\(\)/);

const handler = getScriptHandler('deer_totem');
assert.equal(handler?.handlerId, 'deer_totem');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreCombatStart, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const data = byId.get('deer_totem');
const natureData = byId.get('death_lotus');
assert.ok(data && natureData);
const piece = {
  itemId: 'deer_totem',
  placementKey: 'totem',
  name: 'Deer Totem',
  kind: 'gadget',
  side: 'you',
  alive: true,
  params: data.params,
  cooldown: data.cooldown,
  baseCooldown: data.cooldown,
  triggerTime: data.cooldown,
};
const nature = { itemId: 'death_lotus', placementKey: 'nature', kind: 'consumable', side: 'you' };
const graph = {
  pieces: new Map([
    ['totem', { key: 'totem', id: 'deer_totem', affectCells: [{ cell: '1,0', color: 'primary' }], cells: [] }],
    ['nature', { key: 'nature', id: 'death_lotus', affectCells: [], cells: [] }],
  ]),
  filled: new Map([['1,0', 'nature']]),
};
const player = createActor('player');
const dummy = createActor('dummy');
player.hp = 70;
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  events,
  bus,
  t: 2,
  rng: () => 0,
  graph,
  itemsById: new Map([
    ['deer_totem', data],
    ['death_lotus', natureData],
  ]),
  pieces: [piece, nature],
  canAffect,
};

handler.onPrepare(piece, ctx);
assert.equal(player.damageResistancePct, data.params.p1, 'source preparation applies the exact damage resistance');
assert.equal(player.battleRageBonusDur, data.params.dur_rage, 'one linked Nature item adds the source rage duration');
handler.onPreCombatStart(piece, ctx);
assert.equal(piece.cooldown, 999, 'source pre-combat preparation deactivates the cooldown');
assert.equal(piece.triggerTime, 999);

startBattleRage(player, 3, 2, { bus });
assert.equal(piece._deerRageActive, true);
assert.equal(piece.cooldown, data.cooldown, 'rage start activates the source cooldown');
assert.equal(piece.triggerTime, data.cooldown);

const hpBefore = player.hp;
const manaBefore = player.stacks.mana;
const staminaBefore = player.stamina;
const handled = handler.onCooldownEffect(piece, ctx);
assert.equal(handled, true);
assert.equal(player.hp, hpBefore + data.params.heal, 'rage cooldown heals the source amount');
assert.equal(player.stacks.mana, manaBefore + data.params.mana, 'rage cooldown gives the source Mana amount');
assert.equal(player.stamina, staminaBefore, 'the source effect does not change Stamina');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'deer_totem'));

tickBattleRage(player, 7.1, { bus });
assert.equal(piece._deerRageActive, false);
assert.equal(piece.cooldown, 999, 'rage end deactivates the source cooldown');

const zeroPiece = { ...piece, params: { ...data.params, heal: 0, p3: 0, mana: 0, p4: 0 } };
startBattleRage(player, 2, 6, { bus });
const hpBeforeZero = player.hp;
const manaBeforeZero = player.stacks.mana;
handler.onCooldownEffect(zeroPiece, { ...ctx, t: 6 });
assert.equal(player.hp, hpBeforeZero, 'zero source Heal does not invent healing');
assert.equal(player.stacks.mana, manaBeforeZero, 'zero source Mana does not invent a grant');

console.log('OK Deer Totem source port');
