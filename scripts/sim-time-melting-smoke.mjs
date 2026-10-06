import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canAffectColor } from '../js/shared/backpack-grid/can-affect.js';

const rules = JSON.parse(readFileSync('assets/data/can-affect-rules.json', 'utf8')).byId;
assert.equal(canAffectColor(rules, { id: 'time_melting' }, { params: { dur: 3 } }), true);
assert.equal(canAffectColor(rules, { id: 'time_melting' }, { params: { dur_cold: 3 } }), false);
const source = readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
assert.match(source, /handlerId: 'time_melting',[\s\S]*?onPrepare[\s\S]*?other\.params\.dur =/);
console.log('Time Melting predicate and prepare smoke passed.');
