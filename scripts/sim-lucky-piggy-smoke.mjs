import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { effectiveChance } from '../js/pages/sim/engine/chance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/LuckyPiggy.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-consumable.js', 'utf8');
const luckyPiggyPort = portFile.slice(
  portFile.indexOf('export const luckyPiggyPort'),
  portFile.indexOf('/** ProtectivePurse.gd', portFile.indexOf('export const luckyPiggyPort')),
);

assert.equal(inventory.byId.lucky_piggy?.file, 'LuckyPiggy.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canModifyChance\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addBonusChance\(getP3\(\)\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveLucky\(getP2\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func getTriggerPriority\(\) -> int:[\s\S]*Priority\.High \+ 5/);
assert.match(luckyPiggyPort, /onPrepare\(piece, ctx\)/);
assert.match(luckyPiggyPort, /other\.bonusChanceMult =/);
assert.match(luckyPiggyPort, /recordPieceMod\(other, \{ stat: 'chance'/);
assert.match(luckyPiggyPort, /pushActivate\(piece, ctx, 'lucky_piggy'/);
assert.doesNotMatch(luckyPiggyPort, /other\.chance\s*=/);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
byId.set('test_chance_item', {
  id: 'test_chance_item',
  name: 'Test Chance Item',
  chance: 20,
  cooldown: 2,
  type: 'Accessory',
});

const piece = {
  placementKey: 'piggy',
  itemId: 'lucky_piggy',
  name: 'Lucky Piggy',
  kind: 'passive',
  side: 'you',
  params: { p1: 1, p2: 2, p3: 12 },
  baseCooldown: 0,
  cooldown: 0,
};
const target = {
  placementKey: 'target',
  itemId: 'test_chance_item',
  name: 'Test Chance Item',
  side: 'you',
  chance: 20,
  bonusChanceMult: 0,
};
const graph = {
  pieces: new Map([
    ['piggy', { key: 'piggy', id: 'lucky_piggy', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
    ['target', { key: 'target', id: 'test_chance_item', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([['1,0', 'target']]),
};
const ctx = {
  t: 1,
  player: createActor('player'),
  events: [],
  pieces: [piece, target],
  itemsById: byId,
  graph,
  canAffect: null,
};
const handler = getScriptHandler('lucky_piggy');
assert.equal(handler?.handlerId, 'lucky_piggy');
handler.onPrepare(piece, ctx);
assert.equal(target.bonusChanceMult, 12, 'addBonusChance adds the source percentage multiplier');
assert.equal(target.chance, 20, 'prepare does not overwrite the base chance');
assert.equal(effectiveChance(target), 22.4, 'the shared chance path applies the multiplier at roll time');

handler.onCombatStart(piece, ctx);
assert.equal(ctx.player.stacks.lucky, 2, 'giveLucky(getP2()) uses the second source parameter');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1, 'combat start activates once');
assert.equal(ctx.events.findIndex((event) => event.type === 'buff'), 0, 'Lucky is logged before activation');

const zeroPiece = { ...piece, placementKey: 'zero-piggy', params: { p2: 0, p3: 0 } };
const zeroTarget = { ...target, placementKey: 'zero-target', bonusChanceMult: 0 };
const zeroCtx = {
  ...ctx,
  t: 0,
  player: createActor('player'),
  events: [],
  pieces: [zeroPiece, zeroTarget],
  graph: {
    pieces: new Map([
      ['zero-piggy', { key: 'zero-piggy', id: 'lucky_piggy', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['zero-target', { key: 'zero-target', id: 'test_chance_item', cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'zero-target']]),
  },
};
handler.onPrepare(zeroPiece, zeroCtx);
handler.onCombatStart(zeroPiece, zeroCtx);
assert.equal(zeroTarget.bonusChanceMult, 0, 'explicit zero chance bonus remains zero');
assert.equal(zeroCtx.player.stacks.lucky, 0, 'explicit zero Lucky remains zero');
assert.equal(zeroCtx.events.filter((event) => event.type === 'buff').length, 0, 'zero Lucky does not emit a false buff event');
assert.equal(zeroCtx.events.filter((event) => event.type === 'activate').length, 1, 'zero-valued Piggy still activates');

console.log('OK Lucky Piggy source-backed canModifyChance filtering, multiplicative prepare bonus, Lucky grant, activation ordering, and zero parameters regression');
