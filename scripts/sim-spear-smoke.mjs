import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Spear.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-spear.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'spear');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const spearPort = port.slice(port.indexOf("handlerId: 'spear'"));
const spearBody = spearPort.slice(0, spearPort.indexOf('/** LongSpear.gd'));

assert.ok(sourceItem, 'Spear: extracted catalog row');
assert.equal(inventory.byId.spear?.file, 'Spear.gd');
assert.deepEqual(inventory.byId.spear?.overrides, ['onPreDealDamage_late', 'onPrepare']);
assert.equal(sourceItem.cost, 6, 'Spear: catalog cost');
assert.equal(sourceItem.staminaCost, 1, 'Spear: catalog stamina');
assert.equal(sourceItem.cooldown, 1.5, 'Spear: catalog cooldown');
assert.equal(sourceItem.accuracy, 85, 'Spear: catalog accuracy');
assert.deepEqual(sourceItem.params, { blockremoval: 4, p1: 4 });
assert.match(source, /extends Weapon/);
assert.match(source, /func affectsEmpty\(color\):[\s\S]*return true/);
assert.match(source, /func canAffect\(item\):[\s\S]*return false/);
assert.match(source, /func onPrepare\(\):[\s\S]*totalBlockRemoval = blockRemoval \* getNumEmptyAffectedCells\(\)/);
assert.match(source, /func onPreDealDamage_late\(damageRes: DamageResult\):[\s\S]*removeBlock\(totalBlockRemoval\)/);
assert.match(spearBody, /onPrepare\(piece, ctx\)/);
assert.match(spearBody, /onPreDealDamageLate\(piece, ctx\)/);
assert.doesNotMatch(spearBody, /onCombatStart/);
assert.doesNotMatch(spearBody, /onDealtDamage/);
assert.doesNotMatch(spearBody, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'blockremoval'/);

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy', { block: 20 });
  const events = [];
  const spear = {
    itemId: 'spear',
    placementKey: 'spear',
    name: 'Spear',
    params: { ...params },
    side: 'you',
    kind: 'weapon',
    alive: true,
    staminaCost: sourceItem.staminaCost,
    damageMin: 5,
    damageMax: 5,
    accuracy: 100,
  };
  const filler = {
    itemId: 'wooden_sword',
    placementKey: 'filler',
    name: 'Wooden Sword',
    side: 'you',
    kind: 'weapon',
    alive: true,
  };
  return {
    t: 1,
    player,
    dummy,
    events,
    rng: () => 0,
    notifyPreDealDamageLate(_piece, hitCtx) {
      getScriptHandler('spear').onPreDealDamageLate(hitCtx.pieces[0], hitCtx);
    },
    pieces: [spear, filler],
    itemsById: new Map([
      ['spear', sourceItem],
      ['wooden_sword', catalog.find((item) => item.id === 'wooden_sword')],
    ]),
    graph: {
      pieces: new Map([
        ['spear', {
          key: 'spear',
          id: 'spear',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'primary' },
            { cell: '3,0', color: 'primary' },
          ],
        }],
        ['filler', { key: 'filler', id: 'wooden_sword', cells: ['2,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'spear'],
        ['2,0', 'filler'],
      ]),
    },
    canAffect: { rulesById: rules.byId },
  };
}

const handler = getScriptHandler('spear');
assert.equal(handler?.handlerId, 'spear');

const ctx = makeContext();
handler.onPrepare(ctx.pieces[0], ctx);
assert.equal(ctx.pieces[0]._blockStrip, 8,
  'Spear: prepare caches source block removal per empty affected cell');
assert.equal(ctx.dummy.block, 20, 'Spear: prepare does not remove Block early');
dealHit(ctx.pieces[0], ctx, 5, 'Spear hit');
const stripEvent = ctx.events.findIndex((event) => event.meta?.kind === 'block_strip');
const hitEvent = ctx.events.findIndex((event) =>
  event.type === 'damage' && event.itemId === 'spear' && event.label?.startsWith('Spear hit'));
assert.equal(ctx.dummy.block, 7, 'Spear: late strip happens before the five-damage hit consumes Block');
assert.ok(stripEvent >= 0 && hitEvent > stripEvent,
  'Spear: late pre-deal strip is logged before the attack damage');

const zero = makeContext({ blockremoval: 0, p1: 0 });
handler.onPrepare(zero.pieces[0], zero);
assert.equal(zero.pieces[0]._blockStrip, 0, 'Spear: explicit zero block removal is preserved');
handler.onPreDealDamageLate(zero.pieces[0], zero);
assert.equal(zero.dummy.block, 20, 'Spear: zero block removal does not strip');

const fractional = makeContext({ blockremoval: 2.5, p1: 2.5 });
handler.onPrepare(fractional.pieces[0], fractional);
assert.equal(fractional.pieces[0]._blockStrip, 5,
  'Spear: source raw block-removal parameter is retained before block rounding');

console.log('Spear source/parity smoke passed.');
