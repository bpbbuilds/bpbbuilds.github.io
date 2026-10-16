import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SewingCase.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ak-bags.js', 'utf8');
const sewingPort = port.slice(
  port.indexOf('export const sewingCasePort'),
  port.indexOf('/** StorageCoffin', port.indexOf('export const sewingCasePort')),
);

assert.match(source, /extends Bag/);
assert.match(source, /onready var bonusSpeed: = getP\("speed"\) \/ 100\.0/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.isCrafted\(\)[\s\S]*toItem\.hasCooldown\(\)[\s\S]*toItem\.gainsBuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*addSpeed\(bonusSpeed\)[\s\S]*changeAmplificiationChancePercent_allBuffs\(getChance\(\)\)/);
assert.match(sewingPort, /onPrepare\(piece, ctx\)/);
assert.match(sewingPort, /canBagAffectItem/);
assert.match(sewingPort, /buffAmplificationChances/);
assert.match(sewingPort, /BUFF_KEYS/);
assert.doesNotMatch(sewingPort, /onCombatStart\(piece, ctx\)/);
assert.doesNotMatch(sewingPort, /Number\(o\.cooldown\) > 0/);

byId.set('sewing_crafted_cooldown', {
  id: 'sewing_crafted_cooldown',
  type: 'Weapon',
  name: 'Crafted Cooldown Target',
  cooldown: 2,
});
byId.set('sewing_crafted_buff', {
  id: 'sewing_crafted_buff',
  type: 'Accessory',
  name: 'Crafted Buff Target',
  cooldown: null,
});
byId.set('sewing_uncrafted', {
  id: 'sewing_uncrafted',
  type: 'Weapon',
  name: 'Uncrafted Target',
  cooldown: 2,
});

const bag = {
  ...byId.get('sewing_case'),
  itemId: 'sewing_case',
  name: 'Sewing Case',
  placementKey: 'sewing-bag',
  chance: 33,
  params: { speed: 22, p1: 4 },
  kind: 'bag',
  alive: true,
};
const craftedCooldown = {
  itemId: 'sewing_crafted_cooldown',
  name: 'Crafted Cooldown Target',
  placementKey: 'crafted-cooldown',
  cooldown: 2,
  speedScale: 0,
};
const craftedBuff = {
  itemId: 'sewing_crafted_buff',
  name: 'Crafted Buff Target',
  placementKey: 'crafted-buff',
  cooldown: 0,
  speedScale: 0,
};
const uncrafted = {
  itemId: 'sewing_uncrafted',
  name: 'Uncrafted Target',
  placementKey: 'uncrafted',
  cooldown: 2,
  speedScale: 0,
};
const graph = {
  pieces: new Map([
    ['sewing-bag', { key: 'sewing-bag', cells: ['0,0', '1,0'] }],
    ['crafted-cooldown', { key: 'crafted-cooldown', cells: ['0,0'] }],
    ['crafted-buff', { key: 'crafted-buff', cells: ['1,0'] }],
    ['uncrafted', { key: 'uncrafted', cells: ['3,0'] }],
  ]),
  filled: new Map([
    ['0,0', 'crafted-cooldown'],
    ['1,0', 'crafted-buff'],
    ['3,0', 'uncrafted'],
  ]),
};
const ctx = {
  graph,
  pieces: [bag, craftedCooldown, craftedBuff, uncrafted],
  itemsById: byId,
  canAffect: {
    craftedIds: new Set(['sewing_crafted_cooldown', 'sewing_crafted_buff']),
    gainsBuffsIds: new Set(['sewing_crafted_buff']),
  },
};

const handler = getScriptHandler('sewing_case');
assert.equal(handler?.handlerId, 'sewing_case');
assert.equal(typeof handler?.onPrepare, 'function');

handler.onPrepare(bag, ctx);
assert.equal(craftedCooldown.speedScale, 0.22, 'named speed parameter wins and applies to crafted cooldown cargo');
assert.equal(craftedBuff.speedScale, 0.22, 'crafted buff-generating cargo qualifies without a cooldown');
assert.equal(uncrafted.speedScale, 0, 'uncrafted cargo is excluded');
for (const target of [craftedCooldown, craftedBuff]) {
  assert.equal(target.buffAmplificationChances?.lucky, 33);
  assert.equal(target.buffAmplificationChances?.regeneration, 33);
  assert.equal(target.buffAmplificationChances?.vampirism, 33);
  assert.equal(target.buffAmplificationChances?.spikes, 33);
  assert.equal(target.buffAmplificationChances?.mana, 33);
  assert.equal(target.buffAmplificationChances?.empower, 33);
  assert.equal(target.buffAmplificationChances?.heat, 33);
}

const explicitZero = { ...bag, placementKey: 'sewing-bag-zero', chance: 0 };
const zeroCtx = {
  ...ctx,
  pieces: [explicitZero, craftedCooldown],
  graph: {
    pieces: new Map([
      ['sewing-bag-zero', { key: 'sewing-bag-zero', cells: ['0,0'] }],
      ['crafted-cooldown', { key: 'crafted-cooldown', cells: ['0,0'] }],
    ]),
    filled: new Map([['0,0', 'crafted-cooldown']]),
  },
};
craftedCooldown.buffAmplificationChances = {};
handler.onPrepare(explicitZero, zeroCtx);
assert.equal(craftedCooldown.buffAmplificationChances.lucky || 0, 0, 'explicit zero chance is not replaced by catalog chance');

console.log('OK Sewing Case source and handler regression');
