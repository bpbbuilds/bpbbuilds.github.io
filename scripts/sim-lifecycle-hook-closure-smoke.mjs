import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const cases = [
  ['twine', 'Exclusive/Twine.gd'],
  ['steel_goobert', 'SteelGoobert.gd'],
  ['vampiric_gloves', 'VampiricGloves.gd'],
];
for (const [id, source] of cases) {
  assert.equal(inventory.byId[id]?.file, source, `${id} source alias`);
  const handler = getScriptHandler(id);
  assert.equal(handler?.handlerId, id, `${id} handler`);
  assert.equal(typeof handler?.onPrepare, 'function', `${id} source onPrepare`);
}

const twine = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
assert.match(twine, /twinePort[\s\S]*_twineTriggers[\s\S]*_twineSecondaryCount/);
const steel = fs.readFileSync('js/pages/sim/engine/scripts/ports-aura.js', 'utf8');
assert.match(steel, /steelGoobertPort[\s\S]*_steelGoobertWeapons/);
const gloves = fs.readFileSync('js/pages/sim/engine/scripts/ports-outliers.js', 'utf8');
assert.match(gloves, /vampiricGlovesPort[\s\S]*_vampiricGlovesActive = false[\s\S]*_vampiricGlovesActive = true/);

console.log('OK Twine, Steel Goobert, and Vampiric Gloves prepare lifecycle');
