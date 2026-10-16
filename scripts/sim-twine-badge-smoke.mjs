import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/TwineBadge.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));

assert.equal(inventory.byId.twine_badge?.file, 'Exclusive/TwineBadge.gd');
assert.match(source, /onready var bonusSpeed:[\s\S]*getP\("speed"\)[\s\S]*100\.0/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.isCrafted\(\)[\s\S]*item\.hasCooldown\(\)[\s\S]*item\.gainsBuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*item\.addSpeed\(bonusSpeed\)[\s\S]*changeAmplificiationChancePercent_allBuffs\(getChance\(\)\)/);
assert.match(portSource, /twineBadgePort[\s\S]*onPrepare\(piece, ctx\)/);
assert.match(portSource, /twineBadgePort[\s\S]*buffAmpChance/);
assert.match(portSource, /getP1\(piece\.params/);

const badge = {
  id: 'twine_badge',
  itemId: 'twine_badge',
  placementKey: 'badge',
  name: 'Twine Badge',
  params: { speed: 99, p1: 20 },
  chance: 20,
  alive: true,
  side: 'you',
};
const craftedCooldown = {
  id: 'crafted_cooldown',
  itemId: 'crafted_cooldown',
  placementKey: 'crafted-cd',
  name: 'Crafted Cooldown',
  isCrafted: true,
  cooldown: 9,
  gainsBuffs: false,
  speedScale: 0,
  buffAmpChance: 0,
  alive: true,
};
const craftedBuff = {
  id: 'crafted_buff',
  itemId: 'crafted_buff',
  placementKey: 'crafted-buff',
  name: 'Crafted Buff',
  isCrafted: true,
  cooldown: null,
  gainsBuffs: true,
  speedScale: 0,
  buffAmpChance: 0,
  alive: true,
};
const uncraftedCooldown = {
  id: 'uncrafted_cooldown',
  itemId: 'uncrafted_cooldown',
  placementKey: 'uncrafted-cd',
  name: 'Uncrafted Cooldown',
  isCrafted: false,
  cooldown: 9,
  gainsBuffs: false,
  speedScale: 0,
  buffAmpChance: 0,
  alive: true,
};
const graph = {
  pieces: new Map([
    ['badge', { key: 'badge', id: 'twine_badge', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
    ] }],
    ['crafted-cd', { key: 'crafted-cd', id: 'crafted_cooldown', cells: ['1,0'], affectCells: [] }],
    ['crafted-buff', { key: 'crafted-buff', id: 'crafted_buff', cells: ['2,0'], affectCells: [] }],
    ['uncrafted-cd', { key: 'uncrafted-cd', id: 'uncrafted_cooldown', cells: ['3,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'badge'],
    ['1,0', 'crafted-cd'],
    ['2,0', 'crafted-buff'],
    ['3,0', 'uncrafted-cd'],
  ]),
};
const ctx = {
  graph,
  pieces: [badge, craftedCooldown, craftedBuff, uncraftedCooldown],
  itemsById: new Map([
    ['twine_badge', { ...badge }],
    ['crafted_cooldown', craftedCooldown],
    ['crafted_buff', craftedBuff],
    ['uncrafted_cooldown', uncraftedCooldown],
  ]),
  canAffect: { rulesById: rules.byId },
};

const handler = getScriptHandler('twine_badge');
assert.equal(handler?.handlerId, 'twine_badge');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(badge, ctx);

assert.equal(craftedCooldown.speedScale, 0.2, 'Twine Badge uses source p1 speed');
assert.equal(craftedBuff.speedScale, 0.2, 'Twine Badge affects crafted buff-capable items');
assert.equal(uncraftedCooldown.speedScale, 0, 'Twine Badge excludes uncrafted targets');
assert.equal(craftedCooldown.buffAmpChance, 20, 'Twine Badge amplifies every buff chance');
assert.equal(craftedBuff.buffAmpChance, 20, 'Twine Badge amplifies every buff-capable target');
assert.equal(uncraftedCooldown.buffAmpChance, 0, 'Twine Badge does not amplify excluded targets');

console.log('OK Twine Badge source preparation, crafted target filtering, p1 speed, all-buff amplification, and exclusion regression');
