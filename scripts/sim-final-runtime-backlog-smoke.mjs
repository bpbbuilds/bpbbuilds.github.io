import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const expect = (path, text) => assert.match(read(path), new RegExp(text, 's'), path);

for (const [id, file] of Object.entries({
  axe: 'ports-ap-perm.js', blood_amulet: 'ports-ap-start.js', bloody_dagger: 'ports-ap-onhit.js',
  broccoli: 'ports-ap-lucky.js', broccotree: 'ports-ap-lucky.js', rib_saw_blade: 'ports-ap-perm.js',
  serpent_staff: 'ports-ap-onhit.js', shepherds_crook: 'ports-ap-aura.js', shovel: 'ports-ap-onhit.js',
  slice_of_toast: 'ports-ap-regen.js', snowcake: 'ports-ap-cold.js', spin_to_win: 'ports-ap-mana.js',
  squirrel_archer: 'ports-ap-basic.js', stone: 'ports-al-stones.js', thorn_bow: 'ports-ap-basic.js',
  time_pendant: 'ports-an-accessories.js', torch: 'ports-ap-perm.js', ukulele: 'ports-ap-cold.js',
  ultima: 'ports-ap-lucky.js', walrus_tusk: 'ports-ap-start.js', wisp: 'ports-ap-lucky.js',
})) expect(`js/pages/sim/engine/scripts/${file}`, `handlerId: '${id}'`);

expect('js/pages/sim/engine/scripts/ports-ap-onhit.js', "handlerId: 'serpent_staff'.*?onPrepare");
expect('js/pages/sim/engine/scripts/ports-ap-aura.js', "handlerId: 'shepherds_crook'.*?onPrepare");
expect('js/pages/sim/engine/scripts/ports-al-stones.js', "handlerId: 'stone'.*?onPreDealDamageLate");
expect('js/pages/sim/engine/scripts/ports-ap-basic.js', "handlerId: 'thorn_bow'.*?onPrepare");
expect('js/pages/sim/engine/scripts/ports-ap-cold.js', "handlerId: 'ukulele'.*?onPrepare");
expect('js/pages/sim/engine/scripts/ports-ap-lucky.js', "handlerId: 'ultima'.*?onPrepare.*?_ultimaTypes");
expect('js/pages/sim/engine/scripts/ports-ap-lucky.js', "handlerId: 'wisp'.*?onPrepare");
console.log('Final runtime backlog smoke passed.');
