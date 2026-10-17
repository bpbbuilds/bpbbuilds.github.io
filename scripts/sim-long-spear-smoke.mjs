import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/LongSpear.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-spear.js', 'utf8');
const longSpearPort = portFile.slice(
  portFile.indexOf('export const longSpearPort'),
  portFile.indexOf('/** PoisonSpear.gd', portFile.indexOf('export const longSpearPort')),
);

assert.match(source, /func affectsEmpty\(color\):[\s\S]*return true/);
assert.match(source, /func canAffect\(item\):[\s\S]*return false/);
assert.match(source, /func onPrepare\(\):[\s\S]*blockRemoval = getP\("block"\) \* getNumEmptyAffectedCells\(\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*removeBlock\(blockRemoval\)[\s\S]*changeDamageResistance\( - damResistance\)/);
assert.match(longSpearPort, /onPrepare\(piece, ctx\)/);
assert.match(longSpearPort, /onPreDealDamageEarly\(piece, ctx, hit\)/);
assert.doesNotMatch(longSpearPort, /onCombatStart\(piece, ctx\)/);
assert.doesNotMatch(longSpearPort, /onDealtDamage\(piece, ctx, hit\)/);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
assert.equal(inventory.byId.long_spear?.file, 'Exclusive/LongSpear.gd');

const piece = {
  placementKey: 'spear',
  itemId: 'long_spear',
  name: 'Long Spear',
  kind: 'weapon',
  side: 'you',
  params: { block: 12, p1: 12, dam: 5, p2: 5 },
  baseCooldown: 1.5,
  cooldown: 1.5,
};
const graph = {
  pieces: new Map([
    ['spear', {
      key: 'spear',
      id: 'long_spear',
      cells: ['0,0'],
      affectCells: [
        { cell: '1,0', color: 'primary' },
        { cell: '2,0', color: 'primary' },
        { cell: '3,0', color: 'primary' },
      ],
    }],
  ]),
  filled: new Map([['1,0', 'occupied']]),
};
const handler = getScriptHandler('long_spear');
assert.equal(handler?.handlerId, 'long_spear');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');
const player = createActor('player');
const dummy = createActor('dummy');
dummy.block = 50;
dummy.damageResistancePct = 2;
const events = [];
const ctx = { t: 1, player, dummy, events, graph };
handler.onPrepare(piece, ctx);
assert.equal(piece._blockStrip, 24, 'onPrepare multiplies block by the two empty affected cells');
assert.equal(piece._damResist, 5, 'damage resistance uses the source percentage units');

handler.onPreDealDamageEarly(piece, ctx, { hit: true });
assert.equal(dummy.block, 26, 'a hit removes the prepared block amount before damage resolves');
assert.equal(dummy.damageResistancePct, -3, 'source signed resistance reduction can pass below zero');

dummy.block = 50;
dummy.damageResistancePct = 2;
handler.onPreDealDamageEarly(piece, ctx, { hit: false });
assert.equal(dummy.block, 50, 'a miss does not remove block');
assert.equal(dummy.damageResistancePct, 2, 'a miss does not reduce resistance');

const zeroPiece = { ...piece, placementKey: 'zero-spear', params: { block: 0, p1: 0, dam: 0, p2: 0 } };
handler.onPrepare(zeroPiece, ctx);
dummy.block = 50;
dummy.damageResistancePct = 2;
handler.onPreDealDamageEarly(zeroPiece, ctx, { hit: true });
assert.equal(zeroPiece._blockStrip, 0, 'explicit zero block removal remains zero');
assert.equal(dummy.block, 50, 'zero block removal leaves block unchanged');
assert.equal(dummy.damageResistancePct, 2, 'explicit zero resistance remains zero');

console.log('OK Long Spear source-backed empty-cell prepare, early-hit block strip, signed resistance reduction, miss guard, and zero parameters regression');
