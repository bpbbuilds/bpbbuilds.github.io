import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const cases = [
  ['pumpkin', 'Pumpkin.gd', 'onPrepare'],
  ['puzzlebag_l', 'Exclusive/PuzzlebagL.gd', 'onPrepare'],
  ['ruby_chonk', 'RubyChonk.gd', 'onPrepare'],
  ['ruby_egg', 'RubyEgg.gd', 'onCooldownEffect'],
  ['ruby_whelp', 'RubyWhelp.gd', 'onPreCombatStart'],
  ['sapphire_whelp', 'Exclusive/SapphireWhelp.gd', 'onPreDealDamageEarly'],
  ['scale', 'Exclusive/Scale.gd', 'onPrepare'],
];

for (const [id, source, hook] of cases) {
  assert.equal(inventory.byId[id]?.file, source, `${id} source alias`);
  const handler = getScriptHandler(id);
  assert.equal(handler?.handlerId, id, `${id} dedicated handler`);
  assert.equal(typeof handler?.[hook], 'function', `${id} source lifecycle hook`);
}

const basic = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-basic.js', 'utf8');
assert.match(basic, /rubyChonkPort[\s\S]*onPrepare[\s\S]*_rubyChonkHeatReady/);
const start = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-start.js', 'utf8');
assert.match(start, /puzzlebagLPort[\s\S]*onPrepare[\s\S]*onCombatStart/);
const mana = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-mana.js', 'utf8');
assert.match(mana, /scalePort[\s\S]*onPrepare/);

console.log('OK Pumpkin through Scale source lifecycle wave');
