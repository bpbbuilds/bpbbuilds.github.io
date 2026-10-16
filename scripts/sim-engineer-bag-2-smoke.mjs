import assert from 'node:assert/strict';
import fs from 'node:fs';
import noops from '../assets/data/sim-intentional-noops.json' with { type: 'json' };
import { AK_NOOP_IDS } from '../js/pages/sim/engine/scripts/ports-ak-noop.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/EngineerBag2.gd', 'utf8');
assert.match(source, /extends Bag/);
assert.match(source, /func onShopEntered\(\):/);
assert.match(source, /func onItemRoll\(descr\):/);
assert.match(source, /func getRelatedItems\(\):/);
assert.doesNotMatch(source, /^func (doCooldownEffect|onCombatStart)\s*\(/m);

const row = [...noops.shopNoCombat, ...noops.wearablesShopOnly].find((item) => item.id === 'engineer_bag_2');
assert.deepEqual(row, {
  id: 'engineer_bag_2',
  gd: 'Items/Exclusive/EngineerBag2.gd',
  why: 'onShopEntered/onItemRoll/getRelatedItems only; no independent combat hook',
});
assert.ok(AK_NOOP_IDS.includes('engineer_bag_2'));
assert.equal(getScriptHandler('engineer_bag_2')?.handlerId, 'engineer_bag_2');

console.log('OK Engineer Bag 2 shop-only/no-combat source smoke');
