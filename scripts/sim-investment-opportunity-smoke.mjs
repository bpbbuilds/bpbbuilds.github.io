import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/InvestmentOpportunity.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*item\.usesBuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*healthAcc = 0[\s\S]*affectedItemsDict\.clear\(\)[\s\S]*connectToCharacterBuffs\("onBuffChanged"\)/);
assert.match(source, /func onBuffChanged\(amount, event\):[\s\S]*event\.getOrigin\(\) in affectedItemsDict[\s\S]*amount < 0[\s\S]*event\.getParam\("used", false\)[\s\S]*round\(healthAcc\)[\s\S]*giveMaxHealth\(health, event\)[\s\S]*miniActivate\(\)/);
assert.equal(inventory.byId.investment_opportunity?.file, 'Exclusive/InvestmentOpportunity.gd');
assert.equal(getScriptHandler('investment_opportunity')?.handlerId, 'investment_opportunity');

function makePiece(itemId, placementKey, overrides = {}) {
  const item = byId.get(itemId) || { id: itemId, name: itemId };
  return {
    ...item,
    itemId,
    placementKey,
    name: item.displayName || item.name || itemId,
    params: { ...(item.params || {}) },
    alive: true,
    side: 'you',
    ...overrides,
  };
}

const investment = makePiece('investment_opportunity', 'investment', {
  kind: 'passive',
  params: { gold: 1, p1: 1, maxhealth: 2.5, p2: 2.5 },
});
const usesBuffs = makePiece('mana_orb', 'uses-buffs', { kind: 'passive', usesBuffs: true });
const noBuffUse = makePiece('wooden_sword', 'no-buff-use', { kind: 'weapon', usesBuffs: false });
const unrelated = makePiece('healing_herbs', 'unrelated', { kind: 'passive', usesBuffs: true });
const graph = {
  pieces: new Map([
    ['investment', { key: 'investment', id: 'investment_opportunity', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['uses-buffs', { key: 'uses-buffs', id: 'mana_orb', cells: ['1,0'], affectCells: [] }],
    ['no-buff-use', { key: 'no-buff-use', id: 'wooden_sword', cells: ['2,0'], affectCells: [] }],
    ['unrelated', { key: 'unrelated', id: 'healing_herbs', cells: ['3,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'investment'],
    ['1,0', 'uses-buffs'],
    ['2,0', 'no-buff-use'],
    ['3,0', 'unrelated'],
  ]),
};
const player = createActor('player', { maxHp: 200 });
player.hp = 180;
const ctx = {
  t: 3,
  player,
  dummy: createActor('dummy', { maxHp: 200 }),
  events: [],
  rng: () => 0,
  pieces: [investment, usesBuffs, noBuffUse, unrelated],
  graph,
  itemsById: byId,
  canAffect: null,
};
const handler = getScriptHandler('investment_opportunity');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(investment, ctx);
assert.deepEqual([...investment._investmentAffectedKeys], ['uses-buffs'], 'Investment Opportunity keeps only usesBuffs targets');

grantStacks(player, 'mana', 3, { originKey: 'setup', originId: 'setup' });
spendStacks(player, 'mana', 1, { originKey: 'uses-buffs', originId: 'mana_orb' });
assert.equal(player.maxHp, 203, 'Investment Opportunity applies source rounded max-health gain');
assert.equal(player.hp, 183, 'Investment Opportunity fills the matching current-health gain');
assert.equal(ctx.events.at(-1)?.meta?.miniActivate, true, 'Investment Opportunity records mini activation after max health');

spendStacks(player, 'mana', 1, { originKey: 'uses-buffs', originId: 'mana_orb' });
assert.equal(player.maxHp, 205, 'Investment Opportunity preserves fractional health accumulation between spends');

spendStacks(player, 'mana', 1, { originKey: 'no-buff-use', originId: 'wooden_sword' });
assert.equal(player.maxHp, 205, 'Investment Opportunity ignores non-usesBuffs targets');
grantStacks(player, 'mana', 1, { originKey: 'setup-2', originId: 'setup-2' });
spendStacks(player, 'mana', 1, { originKey: 'uses-buffs', originId: 'mana_orb', hostileStrip: true });
assert.equal(player.maxHp, 205, 'Investment Opportunity ignores buff removals without the used flag');

const zero = makePiece('investment_opportunity', 'zero-investment', {
  kind: 'passive',
  params: { gold: 0, p1: 0, maxhealth: 0, p2: 0 },
});
const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroCtx = {
  ...ctx,
  player: zeroPlayer,
  pieces: [zero, usesBuffs],
  events: [],
  graph: {
    pieces: new Map([
      ['zero-investment', { key: 'zero-investment', id: 'investment_opportunity', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['uses-buffs', { key: 'uses-buffs', id: 'mana_orb', cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'zero-investment'], ['1,0', 'uses-buffs']]),
  },
};
handler.onPrepare(zero, zeroCtx);
grantStacks(zeroPlayer, 'mana', 1, { originKey: 'setup', originId: 'setup' });
spendStacks(zeroPlayer, 'mana', 1, { originKey: 'uses-buffs', originId: 'mana_orb' });
assert.equal(zeroPlayer.maxHp, 200, 'Investment Opportunity honors explicit zero max-health gain');

console.log('OK Investment Opportunity source-backed prepare target filtering, used-spend origin matching, fractional accumulation, max-health/current-health ordering, mini activation, and zero parameters');
