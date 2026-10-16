import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import rules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Toad.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports.js', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.toad?.file, 'Exclusive/Toad.gd');
assert.deepEqual(inventory.byId.toad?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.gainsBuffs\(\) or item\.usesBuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItems\(\)[\s\S]*connectToCharacterBuffs\("onBuffsChanged"\)/);
assert.match(source, /heal\(ticks \* getP_m\("heal"\), event\)/);
assert.match(source, /giveLucky\(luck2\)[\s\S]*giveMana\(mana2\)[\s\S]*activate\(\)/);
assert.match(portSource, /handlerId: 'toad'/);
assert.match(portSource, /onPrepare\(piece, ctx\)/);
assert.match(portSource, /modifiedParamValue\(/);
assert.match(portSource, /miniActivate: true/);

const handler = getScriptHandler('toad');
assert.equal(handler?.handlerId, 'toad');

const toad = {
  ...byId.get('toad'),
  id: 'toad',
  itemId: 'toad',
  name: 'Toad',
  kind: 'pet',
  placementKey: 'toad',
  side: 'you',
  params: {
    gained: 2.9,
    p1: 2.9,
    heal: 5,
    p2: 5,
    used: 3.9,
    p3: 3.9,
    luck: 2.9,
    p4: 2.9,
    mana: 3.9,
    p5: 3.9,
    luck2: 4.9,
    p6: 4.9,
    mana2: 5.9,
    p7: 5.9,
  },
  paramAdd: { heal: 2 },
  paramMult: { heal: 2 },
};
const target = {
  ...byId.get('blueberries'),
  id: 'blueberries',
  itemId: 'blueberries',
  name: 'Blueberries',
  kind: 'food',
  placementKey: 'target',
  side: 'you',
};
const itemsById = new Map(byId);
itemsById.set('toad', toad);
itemsById.set('blueberries', target);
const canAffect = {
  rulesById: rules.byId,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
  usesBuffsIds: new Set(rules.usesBuffsIds),
  gainedStacksById: rules.gainedStacksById,
  usedStacksById: rules.usedStacksById,
};
const graph = {
  pieces: new Map([
    ['toad', { id: 'toad', affectCells: [{ cell: 'target-cell', color: 'primary' }] }],
    ['target', { id: 'blueberries', affectCells: [] }],
  ]),
  filled: new Map([['target-cell', 'target']]),
};

function makeContext() {
  const player = createActor('player');
  const dummy = createActor('dummy');
  player.hp = 100;
  return {
    t: 2,
    player,
    dummy,
    events: [],
    rng: () => 0,
    graph,
    itemsById,
    canAffect,
    pieces: [toad, target],
    allPieces: [toad, target],
  };
}

const ctx = makeContext();
handler.onPrepare(toad, ctx);
assert.equal(toad._toadThresholds.gained, 2, 'source int() truncates gained threshold');
assert.equal(toad._toadThresholds.used, 3, 'source int() truncates used threshold');
assert.equal(toad._toadThresholds.luck, 2, 'source int() truncates threshold lucky grant');
assert.equal(toad._toadThresholds.mana, 3, 'source int() truncates threshold mana grant');

grantStacks(ctx.player, 'lucky', 2, { originKey: 'target', originId: 'blueberries' });
const heal = ctx.events.find((event) => event.type === 'heal' && event.itemId === 'toad');
assert.equal(heal?.amount, 14, 'Toad heal uses modified getP_m heal: (5 + 2) × 2');
assert.equal(
  ctx.events.filter((event) => event.meta?.handler === 'toad' && event.meta?.miniActivate).length,
  1,
  'gained threshold projects one mini activation',
);

ctx.player.stacks.mana = 3;
spendStacks(ctx.player, 'mana', 3, { originKey: 'target', originId: 'blueberries' });
assert.equal(ctx.player.stacks.lucky, 4, 'used threshold grants truncated luck');
assert.equal(ctx.player.stacks.mana, 3, 'used threshold restores truncated mana after spend');
assert.equal(
  ctx.events.filter((event) => event.meta?.handler === 'toad' && event.meta?.miniActivate).length,
  2,
  'used threshold projects one mini activation',
);

const cdCtx = makeContext();
assert.equal(handler.onCooldownEffect(toad, cdCtx), true, 'Toad cooldown remains handled');
assert.equal(cdCtx.player.stacks.lucky, 4, 'cooldown gives source luck2 value');
assert.equal(cdCtx.player.stacks.mana, 5, 'cooldown gives source mana2 value');
assert.equal(cdCtx.events.filter((event) => event.type === 'activate').length, 1, 'cooldown has one full activation');

const zero = {
  ...toad,
  params: { gained: 0, p1: 0, heal: 0, p2: 0, used: 0, p3: 0, luck: 0, p4: 0, mana: 0, p5: 0, luck2: 0, p6: 0, mana2: 0, p7: 0 },
  paramAdd: {},
  paramMult: {},
  placementKey: 'zero-toad',
};
const zeroCtx = { ...makeContext(), graph: { pieces: new Map(), filled: new Map() } };
assert.doesNotThrow(() => handler.onPrepare(zero, zeroCtx), 'zero Toad parameters stay safe');
grantStacks(zeroCtx.player, 'lucky', 1, { originKey: 'target', originId: 'blueberries' });
assert.equal(zeroCtx.player.stacks.lucky, 1, 'zero thresholds do not create reactive Lucky');
assert.equal(handler.onCooldownEffect(zero, zeroCtx), true, 'zero Toad still activates on cooldown');
assert.equal(zeroCtx.player.stacks.mana, 0, 'zero cooldown values do not grant Mana');

console.log('OK Toad source, prepare-time listener, affected-buff thresholds, modified healing, truncation, mini activations, cooldown grants, and zero-safe regression');
