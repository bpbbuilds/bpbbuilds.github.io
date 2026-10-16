import assert from 'node:assert/strict';
import fs from 'node:fs';

import { canBagAffectItem } from '../js/shared/backpack-grid/can-affect.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const prosperitySource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BoxofProsperity.gd', 'utf8');
const richesSource = fs.readFileSync('tools/game-extract-full/Items/BoxofRiches.gd', 'utf8');
assert.match(prosperitySource, /func canApplyEffect\(toItem\)/);
assert.match(prosperitySource, /Rarity\.Godly/);
assert.match(richesSource, /func onShopEntered\(\)/);
assert.doesNotMatch(richesSource, /func doCooldownEffect\(\)/);

assert.equal(
  canBagAffectItem({ id: 'box_of_prosperity', type: 'Bag' }, { id: 'godly', rarity: 'Godly' }),
  true,
);
assert.equal(
  canBagAffectItem({ id: 'box_of_prosperity', type: 'Bag' }, { id: 'rare', rarity: 'Rare' }),
  false,
);

for (const id of ['box_of_prosperity', 'box_of_riches']) {
  const handler = getScriptHandler(id);
  assert.equal(handler?.deferStartActivate, true);
  assert.equal(typeof handler?.onCombatStart, 'function');
  const piece = { itemId: id, cooldown: 5, triggerTime: 5, alive: true };
  handler.onCombatStart(piece, {});
  assert.equal(piece.cooldown, 999, `${id}: shop-only item is inert in combat`);
  assert.equal(piece.triggerTime, 999, `${id}: shop-only item cannot enter the combat loop`);
}

console.log('OK Box of Prosperity / Box of Riches shop-only smoke');
