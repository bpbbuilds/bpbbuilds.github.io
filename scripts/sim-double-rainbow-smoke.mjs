import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DoubleRainbow.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
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

assert.equal(inventory.byId.double_rainbow?.file, 'Exclusive/DoubleRainbow.gd');
assert.equal(getScriptHandler('double_rainbow')?.handlerId, 'double_rainbow');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.gainsBuffs\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveRandomBuffs\(1\)[\s\S]*activate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeAmplificiationChancePercent_allBuffs\(getChance\(\)\)[\s\S]*addSpeed/);

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: { ...(item?.params || {}) },
    side: 'you',
    alive: true,
    cooldown: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    triggerTime: item?.cooldown ?? 4,
    kind: 'passive',
    ...overrides,
  };
}

function graphFor(rainbow, primaryBuff, primaryPlain, secondaryHoly) {
  const links = [
    [primaryBuff, 'primary-cell', 'primary'],
    [primaryPlain, 'plain-cell', 'primary'],
    [secondaryHoly, 'holy-cell', 'secondary'],
  ];
  return {
    pieces: new Map([
      [rainbow.placementKey, {
        key: rainbow.placementKey,
        id: rainbow.itemId,
        cells: [],
        affectCells: links.map(([, cell, color]) => ({ cell, color })),
      }],
      ...links.map(([target]) => [target.placementKey, {
        key: target.placementKey,
        id: target.itemId,
        cells: [],
        affectCells: [],
      }]),
    ]),
    filled: new Map(links.map(([target, cell]) => [cell, target.placementKey])),
  };
}

function context(rainbow, targets) {
  const events = [];
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player._eventLog = events;
  dummy._eventLog = events;
  return {
    player,
    dummy,
    pieces: [rainbow, ...targets],
    graph: graphFor(rainbow, ...targets),
    itemsById: byId,
    canAffect,
    events,
    rng: () => 0,
    t: 5,
  };
}

{
  const rainbow = piece('double_rainbow', 'you:rainbow');
  const buffSource = piece('present', 'you:buff-source');
  const plain = piece('wooden_sword', 'you:plain');
  const holy = piece('holy_armor', 'you:holy');
  const ctx = context(rainbow, [buffSource, plain, holy]);
  const handler = getScriptHandler('double_rainbow');
  assert.equal(typeof handler?.onPrepare, 'function', 'source preparation hook is registered');
  assert.equal(handler?.onCombatStart, undefined, 'source has no combat-start hook');

  handler.onPrepare(rainbow, ctx);
  assert.equal(buffSource.buffAmpChance, 20, 'only gainsBuffs primary link gets amplification');
  assert.equal(plain.buffAmpChance || 0, 0, 'plain primary link is excluded');
  assert.equal(rainbow.speedScale, 0.35, 'one Holy secondary link adds source speed');

  handler.onCooldownEffect(rainbow, ctx);
  const activateIndex = ctx.events.findIndex((event) => event.type === 'activate');
  const buffIndex = ctx.events.findIndex((event) => event.type === 'buff' && event.itemId === 'double_rainbow');
  assert.ok(buffIndex >= 0, 'random buff is projected');
  assert.ok(buffIndex < activateIndex, 'random buff precedes activation');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'activation follows source effect');
}

{
  const rainbow = piece('double_rainbow', 'you:zero-rainbow', {
    chance: 0,
    params: { speed: 0, p1: 0 },
  });
  const buffSource = piece('present', 'you:zero-buff-source', { buffAmpChance: 9 });
  const plain = piece('wooden_sword', 'you:zero-plain');
  const holy = piece('holy_armor', 'you:zero-holy');
  const ctx = context(rainbow, [buffSource, plain, holy]);
  getScriptHandler('double_rainbow').onPrepare(rainbow, ctx);
  assert.equal(buffSource.buffAmpChance, 9, 'zero source chance remains zero');
  assert.equal(rainbow.speedScale || 0, 0, 'zero source speed remains zero');
}

console.log('OK Double Rainbow source port');
