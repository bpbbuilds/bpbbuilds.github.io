import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/YggdrasilLeaf.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-mech.js', 'utf8');
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
const portStart = portSource.indexOf('export const yggdrasilLeafPort');
const portEnd = portSource.indexOf('/**\n * Cog.gd', portStart);
const portBlock = portSource.slice(portStart, portEnd);

const sourceItem = byId.get('yggdrasil_leaf');
assert.ok(sourceItem, 'Yggdrasil Leaf: extracted catalog row');
assert.equal(inventory.byId.yggdrasil_leaf?.file, 'YggdrasilLeaf.gd');
assert.equal(inventory.byId.yggdrasil_leaf?.extends, 'Item');
assert.deepEqual(inventory.byId.yggdrasil_leaf?.overrides, ['onCombatStart', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Nature\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*manaUsed = 0[\s\S]*character_mana_changed/);
assert.match(source, /func onManaChanged\(amount, event(?:\s*:\s*CombatEvent)?\):[\s\S]*amount < 0[\s\S]*event\.getParam\("used", false\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMana\(getP1\(\) \* getAffectedItems\(\)\.size\(\)\)[\s\S]*giveRegeneration\(getP2\(\) \* getAffectedItems\(\)\.size\(\)[\s\S]*activate\(\)/);
assert.match(source, /heal\(getP_m\("heal"\) \* activations, event\)/);
assert.match(source, /cleanseRandomDebuffs\(getP5\(\) \* activations, event\)/);
assert.match(portBlock, /Math\.trunc\(getPName\(piece\.params, 'manat'/);
assert.match(portBlock, /modifiedParamValue\(piece, healBase, 'heal'\)/);
assert.match(portBlock, /grantStacks\(ctx\.player, 'mana'/);
assert.match(portBlock, /grantStacks\(ctx\.player, 'regeneration'/);
assert.match(portBlock, /change\.amount >= 0 \|\| !change\.used/);
assert.doesNotMatch(portBlock, /amount: regen \|\| mana/);
assert.equal(getScriptHandler('yggdrasil_leaf')?.handlerId, 'yggdrasil_leaf');

function graphFor(leaf, nature, nonNature) {
  return {
    pieces: new Map([
      [leaf.placementKey, {
        key: leaf.placementKey,
        id: leaf.itemId,
        cells: ['0,0'],
        affectCells: [
          { cell: '1,0', color: 'primary' },
          { cell: '0,1', color: 'primary' },
        ],
      }],
      [nature.placementKey, {
        key: nature.placementKey,
        id: nature.itemId,
        cells: ['1,0'],
        affectCells: [],
      }],
      [nonNature.placementKey, {
        key: nonNature.placementKey,
        id: nonNature.itemId,
        cells: ['0,1'],
        affectCells: [],
      }],
    ]),
    filled: new Map([
      ['0,0', leaf.placementKey],
      ['1,0', nature.placementKey],
      ['0,1', nonNature.placementKey],
    ]),
  };
}

function context(params = {}) {
  const player = createActor('player', { maxHp: 100, maxStamina: 10 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player.hp = 50;
  player.stacks.poison = 1;
  player.stacks.cold = 1;
  const events = [];
  const leaf = {
    ...sourceItem,
    itemId: 'yggdrasil_leaf',
    placementKey: 'you:yggdrasil',
    name: 'Yggdrasil Leaf',
    kind: 'accessory',
    side: 'you',
    alive: true,
    params: { ...sourceItem.params, ...params },
    buffPowers: { mana: 1.5, regeneration: 2 },
  };
  const nature = {
    ...byId.get('poison_ivy'),
    itemId: 'poison_ivy',
    placementKey: 'you:nature',
    kind: 'accessory',
    side: 'you',
    alive: true,
  };
  const nonNature = {
    ...byId.get('wooden_sword'),
    itemId: 'wooden_sword',
    placementKey: 'you:non-nature',
    kind: 'weapon',
    side: 'you',
    alive: true,
  };
  player._eventLog = events;
  dummy._eventLog = events;
  player._simT = 4;
  dummy._simT = 4;
  return {
    t: 4,
    player,
    dummy,
    events,
    rng: () => 0,
    pieces: [leaf, nature, nonNature],
    graph: graphFor(leaf, nature, nonNature),
    itemsById: byId,
    canAffect,
    leaf,
  };
}

const handler = getScriptHandler('yggdrasil_leaf');
const combat = context({ manat: 2.9 });
handler.onPrepare(combat.leaf, combat);
handler.onCombatStart(combat.leaf, combat);
assert.equal(combat.player.stacks.mana, 3, 'Yggdrasil applies one Nature link through source Mana and buff power');
assert.equal(combat.player.stacks.regeneration, 2, 'Yggdrasil applies one Nature link through source Regeneration and buff power');
assert.equal(combat.player.stacks.poison, 1, 'Yggdrasil does not affect non-Nature linked items or unrelated debuffs');
assert.equal(combat.events.filter((event) => event.type === 'activate' && event.meta?.handler === 'yggdrasil_leaf').length, 1, 'Yggdrasil activates at combat start');

combat.leaf.paramAdd = { heal: 2 };
combat.leaf.paramMult = { heal: 0.5 };
combat.t = 5;
combat.player._simT = 5;
spendStacks(combat.player, 'mana', 1, { originKey: 'test', originId: 'test' });
assert.equal(combat.player.hp, 50, 'Yggdrasil waits for its truncated integer Mana threshold');
spendStacks(combat.player, 'mana', 1, { originKey: 'test', originId: 'test' });
assert.equal(combat.player.hp, 61, 'Yggdrasil uses modified getP_m heal amount');
assert.equal(combat.player.stacks.poison, 0, 'Yggdrasil cleanses the first available debuff');
assert.equal(combat.player.stacks.cold, 0, 'Yggdrasil cleanses the requested number of debuffs');
assert.equal(combat.leaf._manaUsed, 0, 'Yggdrasil retains no Mana remainder after an exact threshold');
const healIndex = combat.events.findIndex((event) => event.type === 'heal' && event.meta?.handler === 'yggdrasil_leaf');
const triggerActivationIndex = combat.events.findIndex((event, index) => index > healIndex && event.type === 'activate' && event.meta?.handler === 'yggdrasil_leaf');
assert.ok(healIndex >= 0, 'Yggdrasil emits a triggered heal projection');
assert.ok(triggerActivationIndex > healIndex, 'Yggdrasil logs heal and cleanse effects before activation');

grantStacks(combat.player, 'mana', 2, { originKey: 'test', originId: 'test' });
const hpBeforeUnusedSpend = combat.player.hp;
spendStacks(combat.player, 'mana', 1, { originKey: 'test', originId: 'test', cleanse: true });
assert.equal(combat.player.hp, hpBeforeUnusedSpend, 'Yggdrasil ignores Mana changes that are not marked used');

const zero = context({ p1: 0, p2: 0, manat: 2, heal: 0, cleanse: 0 });
handler.onPrepare(zero.leaf, zero);
handler.onCombatStart(zero.leaf, zero);
assert.equal(zero.player.stacks.mana, 0, 'Yggdrasil preserves an explicit zero Mana grant');
assert.equal(zero.player.stacks.regeneration, 0, 'Yggdrasil preserves an explicit zero Regeneration grant');
grantStacks(zero.player, 'mana', 2, { originKey: 'test', originId: 'test' });
spendStacks(zero.player, 'mana', 2, { originKey: 'test', originId: 'test' });
assert.equal(zero.player.hp, 50, 'Yggdrasil preserves an explicit zero heal');
assert.equal(zero.player.stacks.poison, 1, 'Yggdrasil preserves an explicit zero cleanse');
assert.equal(zero.player.stacks.cold, 1, 'Yggdrasil does not cleanse when the source value is zero');
assert.equal(zero.events.filter((event) => event.type === 'activate' && event.meta?.handler === 'yggdrasil_leaf').length, 2, 'Yggdrasil still activates after a zero-valued trigger');

console.log('OK Yggdrasil Leaf source/parity smoke');
