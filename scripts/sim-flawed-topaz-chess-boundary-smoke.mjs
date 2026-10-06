import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inventory = JSON.parse(readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const noops = JSON.parse(readFileSync('assets/data/sim-intentional-noops.json', 'utf8'));

const topaz = inventory.byId.flawed_topaz;
assert.equal(topaz.file, 'Gems/Topaz.gd');
assert.equal(topaz.sceneFile, 'Gems/FlawedTopaz.tscn');
assert.deepEqual(topaz.sourceMethods, ['prepareInventory', 'prepareWeapon', 'prepareArmor']);
assert.equal(noops.chessBoard.sim, 'unsupported_mode');
assert.match(noops.chessBoard.why, /movement\/capture AI/);
console.log('Flawed Topaz inheritance and Chess Board supported-mode smoke passed.');
