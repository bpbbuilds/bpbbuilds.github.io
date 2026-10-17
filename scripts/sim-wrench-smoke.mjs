import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Wrench.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-scale.js', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  craftedIds: new Set(rules.craftedIds),
  gainedStacksById: rules.gainedStacksById,
  usedStacksById: rules.usedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
  usesBuffsIds: new Set(rules.usesBuffsIds),
  hasAttackEffectIds: new Set(rules.hasAttackEffectIds),
  reactsToChargesIds: new Set(rules.reactsToChargesIds),
  scriptFamilies: rules.scriptFamilies,
  parentById: rules.parentById,
  rarityRank: rules.rarityRank,
};
const portBlock = portSource.slice(
  portSource.indexOf('export const wrenchPort'),
  portSource.indexOf('/** @type {Record<string, ScriptHandler>} */', portSource.indexOf('export const wrenchPort')),
);

const sourceItem = byId.get('wrench');
assert.ok(sourceItem, 'Wrench: extracted catalog row');
assert.equal(inventory.byId.wrench?.file, 'Exclusive/Wrench.gd');
assert.equal(inventory.byId.wrench?.extends, 'Weapon');
assert.deepEqual(inventory.byId.wrench?.overrides, ['onDealtDamage']);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.gainsBuffs\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*return item\.canDamage\(\)/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*if damageRes\.hasHit\(\)/);
assert.match(source, /getFirstAffectedItem\(Affected\.Primary\)[\s\S]*changeAmplificiationChancePercent_allBuffs\(getChance\(\)/);
assert.match(source, /getFirstAffectedItem\(Affected\.Secondary\)[\s\S]*changeCritChancePercent\(getChance2\(\)/);
assert.match(portBlock, /onDealtDamage\(piece, ctx, hit\)/);
assert.match(portBlock, /candidate\.color === color/);
assert.match(portBlock, /applyBonusChance/);
assert.doesNotMatch(portBlock, /amp\/crit neighbors/);
assert.equal(getScriptHandler('wrench')?.handlerId, 'wrench');

const wrench = {
  ...sourceItem,
  itemId: 'wrench',
  placementKey: 'you:wrench',
  name: 'Wrench',
  kind: 'weapon',
  side: 'you',
  alive: true,
  chance: 10,
  chance2: 10,
  bonusChanceAdd1: 5,
  bonusChanceAdd2: 2,
  bonusChanceMult: 50,
  critChance: 0,
  damageMin: 3,
  damageMax: 3,
  accuracy: 100,
  staminaCost: 1,
  params: { ...sourceItem.params },
};
const invalidPrimary = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'you:invalid-primary',
  name: 'Wooden Sword',
  kind: 'weapon',
  side: 'you',
  alive: true,
  damageMin: 1,
  damageMax: 1,
  buffAmpChance: 0,
  critChance: 0,
};
const buffTarget = {
  ...byId.get('mana_orb'),
  itemId: 'mana_orb',
  placementKey: 'you:buff-target',
  name: 'Mana Orb',
  kind: 'gadget',
  side: 'you',
  alive: true,
  buffAmpChance: 0,
  critChance: 0,
};
const invalidSecondary = {
  ...byId.get('mana_orb'),
  itemId: 'mana_orb',
  placementKey: 'you:invalid-secondary',
  name: 'Mana Orb',
  kind: 'gadget',
  side: 'you',
  alive: true,
  buffAmpChance: 0,
  critChance: 0,
};
const critTarget = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'you:crit-target',
  name: 'Wooden Sword',
  kind: 'weapon',
  side: 'you',
  alive: true,
  damageMin: 1,
  damageMax: 1,
  buffAmpChance: 0,
  critChance: 0,
};
const pieces = [wrench, invalidPrimary, buffTarget, invalidSecondary, critTarget];
const graph = {
  pieces: new Map([
    [wrench.placementKey, { key: wrench.placementKey, id: wrench.itemId, cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '0,1', color: 'primary' },
      { cell: '2,0', color: 'secondary' },
      { cell: '1,1', color: 'secondary' },
    ] }],
    [invalidPrimary.placementKey, { key: invalidPrimary.placementKey, id: invalidPrimary.itemId, cells: ['1,0'], affectCells: [] }],
    [buffTarget.placementKey, { key: buffTarget.placementKey, id: buffTarget.itemId, cells: ['0,1'], affectCells: [] }],
    [invalidSecondary.placementKey, { key: invalidSecondary.placementKey, id: invalidSecondary.itemId, cells: ['2,0'], affectCells: [] }],
    [critTarget.placementKey, { key: critTarget.placementKey, id: critTarget.itemId, cells: ['1,1'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', wrench.placementKey],
    ['1,0', invalidPrimary.placementKey],
    ['0,1', buffTarget.placementKey],
    ['2,0', invalidSecondary.placementKey],
    ['1,1', critTarget.placementKey],
  ]),
};
const player = createActor('player', { maxHp: 100, maxStamina: 10 });
const dummy = createActor('dummy', { maxHp: 100 });
const ctx = {
  t: 4,
  player,
  dummy,
  events: [],
  rng: () => 0,
  pieces,
  graph,
  itemsById: byId,
  canAffect,
};
const handler = getScriptHandler('wrench');

handler.onDealtDamage(wrench, ctx, { hit: true });
assert.equal(buffTarget.buffAmpChance, 22.5, 'Wrench uses the first valid Primary buff-gaining item and modified Chance');
assert.equal(critTarget.critChance, 18, 'Wrench uses the first valid Secondary damage item and modified Chance2');
assert.equal(invalidPrimary.buffAmpChance, 0, 'Wrench does not amplify an invalid Primary target');
assert.equal(invalidSecondary.critChance, 0, 'Wrench does not add crit to an invalid Secondary target');
assert.equal(ctx.events.length, 0, 'Wrench source callback does not add an extra simulator-only info event');

const miss = { ...ctx, events: [] };
handler.onDealtDamage(wrench, miss, { hit: false });
assert.equal(buffTarget.buffAmpChance, 22.5, 'Wrench ignores a missed hit');
assert.equal(critTarget.critChance, 18, 'Wrench ignores a missed hit for the Secondary target');

const zero = {
  ...wrench,
  placementKey: 'you:wrench-zero',
  chance: 0,
  chance2: 0,
  bonusChanceAdd1: 0,
  bonusChanceAdd2: 0,
  bonusChanceMult: 0,
};
const zeroBuff = { ...buffTarget, buffAmpChance: 0 };
const zeroCrit = { ...critTarget, critChance: 0 };
const zeroCtx = { ...ctx, events: [], pieces: [zero, invalidPrimary, zeroBuff, invalidSecondary, zeroCrit] };
handler.onDealtDamage(zero, zeroCtx, { hit: true });
assert.equal(zeroBuff.buffAmpChance, 0, 'Wrench preserves an explicit zero Chance');
assert.equal(zeroCrit.critChance, 0, 'Wrench preserves an explicit zero Chance2');

console.log('OK Wrench source/parity smoke');
