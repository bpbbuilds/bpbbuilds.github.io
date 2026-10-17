import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { goobertPeerTick } from '../js/pages/sim/engine/scripts/ports-wave-d-goobert.js';

const derivedGooberts = [
  ['blood_goobert', 'Items/BloodGoobert.gd'],
  ['carrot_goobert', 'Items/CarrotGoobert.gd'],
  ['light_goobert', 'Items/LightGoobert.gd'],
  ['poison_goobert', 'Items/PoisonGoobert.gd'],
  ['rainbow_goobert', 'Items/RainbowGoobert.gd'],
  ['rainbow_goobert_ranger', 'Items/RainbowGoobertRanger.gd'],
  ['steel_goobert', 'Items/SteelGoobert.gd'],
  ['broccoli_goobert', 'Items/Exclusive/BroccoliGoobert.gd'],
  ['cheese_goobert', 'Items/Exclusive/CheeseGoobert.gd'],
  ['chili_goobert', 'Items/Exclusive/ChiliGoobert.gd'],
  ['cupcake_goobert', 'Items/Exclusive/CupcakeGoobert.gd'],
  ['king_goobert', 'Items/Exclusive/KingGoobert.gd'],
  ['rainbow_goobert_adventurer', 'Items/Exclusive/RainbowGoobertAdventurer.gd'],
  ['rainbow_goobert_berserker', 'Items/Exclusive/RainbowGoobertBerserker.gd'],
  ['rainbow_goobert_engineer', 'Items/Exclusive/RainbowGoobertEngineer.gd'],
  ['rainbow_goobert_mage', 'Items/Exclusive/RainbowGoobertMage.gd'],
  ['rainbow_goobert_pyromancer', 'Items/Exclusive/RainbowGoobertPyromancer.gd'],
  ['toast_goobert', 'Items/Exclusive/ToastGoobert.gd'],
];

const parentSource = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
assert.match(parentSource, /func prepare\(\):[\s\S]*getAffectedItems\(\)[\s\S]*"activated", "onItemActivated"/);
assert.match(parentSource, /func onItemActivated\(event\):[\s\S]*activations \+= 1[\s\S]*doCooldownEffect\(\)[\s\S]*activate\(\)/);

for (const [itemId, sourcePath] of derivedGooberts) {
  const source = fs.readFileSync(`tools/game-extract-full/${sourcePath}`, 'utf8');
  const handler = getScriptHandler(itemId);
  assert.match(source, /^extends Goobert/m, `${itemId}: inherits Goobert activation listener`);
  assert.equal(typeof handler?.onPrepare, 'function', `${itemId}: simulator prepares the inherited listener`);
  assert.equal(typeof handler?.onPeerActivated, 'function', `${itemId}: simulator observes linked activations`);
  assert.equal(handler?.onCooldownEffect?.({}, {}), false, `${itemId}: no timed cooldown bypasses Goobert.gd`);
}

const slimeTimeSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SlimeTime.gd', 'utf8');
assert.match(slimeTimeSource, /for item in inventory\.getItems\(\):[\s\S]*item\.onItemActivated\(null\)/);
let forcedTicks = 0;
goobertPeerTick(
  { params: { p1: 1 }, _goobertActs: 0, _goobertActivationTargets: new Set() },
  { _forceGoobertActivation: true },
  {},
  () => { forcedTicks += 1; },
);
assert.equal(forcedTicks, 1, 'Slime Time globally invokes Goobert.onItemActivated even without a star link');

console.log('OK every Goobert descendant uses the inherited primary activation listener, not a timed cooldown');
