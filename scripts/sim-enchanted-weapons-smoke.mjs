import assert from 'node:assert/strict';
import fs from 'node:fs';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import classMasks from '../assets/data/item-class-masks.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/EnchantedWeapons.gd', 'utf8');
assert.match(source, /extends Item/);
assert.match(source, /func canAffect\(item\):\s*return item\.hasAttackEffect\(\)/);
assert.match(source, /func onPrepare\(\):\s*for item in getAffectedItems\(\):\s*item\.giveDoubleAttackEffectChance\(getChance\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):\s*giveLeastBuffs\(buffs\)\s*activate\(\)/);

const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports.js', 'utf8');
const enchantedBlock = handlerSource.match(/export const enchantedWeaponsPort = \{[\s\S]*?\n\};/u)?.[0];
assert.ok(enchantedBlock, 'Enchanted Weapons handler block exists');
assert.match(enchantedBlock, /onPrepare\(piece, ctx\)/);
assert.doesNotMatch(enchantedBlock, /onCombatStart\(piece, ctx\)/);
assert.match(enchantedBlock, /hasAttackEffectIds/);
assert.doesNotMatch(enchantedBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'buffs'/);
const cooldownBlock = enchantedBlock.match(/onCooldownEffect\(piece, ctx\) \{[\s\S]*?\n  \},/u)?.[0];
assert.ok(cooldownBlock, 'Enchanted Weapons cooldown block exists');
assert.ok(cooldownBlock.indexOf('giveLeastBuffs') < cooldownBlock.indexOf("type: 'activate'"), 'buff grant precedes activation');

const sourceItem = inventory.byId.enchanted_weapons;
assert.equal(sourceItem.file, 'Exclusive/EnchantedWeapons.gd');
assert.deepEqual(sourceItem.overrides.sort(), ['doCooldownEffect', 'onPrepare']);
const handler = getScriptHandler('enchanted_weapons');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const sourcePiece = {
  itemId: 'enchanted_weapons',
  placementKey: 'you:enchanted',
  name: 'Enchanted Weapons',
  params: { buffs: 1, p1: 1 },
  chance: 25,
};
const whelp = { itemId: 'emerald_whelp', placementKey: 'you:whelp', name: 'Emerald Whelp', doubleAttackEffectChance: 0 };
const plainWeapon = { itemId: 'wooden_sword', placementKey: 'you:wooden', name: 'Wooden Sword', kind: 'weapon', doubleAttackEffectChance: 0 };
const chanceOnly = { itemId: 'spiked_shield', placementKey: 'you:shield', name: 'Spiked Shield', chance: 30, doubleAttackEffectChance: 0 };
const graph = {
  pieces: new Map([
    ['you:enchanted', { id: 'enchanted_weapons', affectCells: [
      { cell: 'whelp-cell', color: 'primary' },
      { cell: 'wooden-cell', color: 'primary' },
      { cell: 'shield-cell', color: 'primary' },
    ] }],
    ['you:whelp', { id: 'emerald_whelp', affectCells: [] }],
    ['you:wooden', { id: 'wooden_sword', affectCells: [] }],
    ['you:shield', { id: 'spiked_shield', affectCells: [] }],
  ]),
  filled: new Map([
    ['whelp-cell', 'you:whelp'],
    ['wooden-cell', 'you:wooden'],
    ['shield-cell', 'you:shield'],
  ]),
};
const canAffect = {
  rulesById: canRules.byId,
  classMasks: classMasks.byId,
  classBits: classMasks.classBits,
  hasAttackEffectIds: new Set(canRules.hasAttackEffectIds),
};
const prepareEvents = [];
handler.onPrepare(sourcePiece, {
  t: 0,
  events: prepareEvents,
  graph,
  itemsById,
  canAffect,
  pieces: [sourcePiece, whelp, plainWeapon, chanceOnly],
});
assert.equal(whelp.doubleAttackEffectChance, 0.25, 'hasAttackEffect target receives exact chance');
assert.equal(plainWeapon.doubleAttackEffectChance, 0, 'plain weapon without attack effect is excluded');
assert.equal(chanceOnly.doubleAttackEffectChance, 0, 'chance-only non-attack-effect item is excluded');
assert.ok(prepareEvents.some((event) => event.itemId === 'enchanted_weapons' && event.meta?.buffed === 1));

const player = createActor('player');
const events = [];
const cooldownPiece = { ...sourcePiece, params: { buffs: 1.9, p1: 1.9 } };
handler.onCooldownEffect(cooldownPiece, { player, dummy: createActor('dummy'), events, t: 5, rng: () => 0 });
assert.equal(Object.values(player.stacks).reduce((sum, value) => sum + value, 0), 1, 'source int() truncates fractional buffs');
const buffIndex = events.findIndex((event) => event.type === 'buff');
const activationIndex = events.findIndex((event) => event.type === 'activate');
assert.ok(buffIndex >= 0 && buffIndex < activationIndex, 'buff projection precedes activation');

const zeroPlayer = createActor('player');
const zeroEvents = [];
handler.onCooldownEffect({ ...sourcePiece, params: { buffs: 0, p1: 0 } }, {
  player: zeroPlayer,
  dummy: createActor('dummy'),
  events: zeroEvents,
  t: 5,
  rng: () => 0,
});
assert.equal(Object.values(zeroPlayer.stacks).reduce((sum, value) => sum + value, 0), 0, 'typed zero buffs stays zero');
assert.equal(zeroEvents.filter((event) => event.type === 'activate').length, 1, 'zero buff count still activates');

console.log('OK Enchanted Weapons source/target/order smoke');
