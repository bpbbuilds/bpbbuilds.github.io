import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { modifiedParamValue } from '../js/pages/sim/engine/placement-instance.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/ParadiseBirb.gd',
  'utf8',
);
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-c.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'paradise_birb');

assert.ok(sourceItem, 'Paradise Birb: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*hasCooldown\(\) or item\.gainsBuffs\(\) or item\.canHealOrLifesteal\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*numActivations = 0/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*addSpeed\(speedBonus\)[\s\S]*changeAmplificiationChancePercent_allBuffs\(getChance\(\)\)[\s\S]*changeHealAmp\(bonusHeal\)/);
assert.match(port, /handlerId: 'paradise_birb'/);
const birbPort = port.match(/export const paradiseBirbPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(birbPort, /onPrepare\(piece(?:, ctx)?\)/);
assert.match(birbPort, /onCooldownEffect\(piece, ctx\)/);
assert.doesNotMatch(birbPort, /applyHealEfficiency\(ctx\.player/);

const handler = getScriptHandler('paradise_birb');
assert.equal(handler?.handlerId, 'paradise_birb');

function makeContext(params = sourceItem.params, max = 2) {
  const piece = {
    itemId: 'paradise_birb',
    placementKey: 'birb',
    name: 'Paradise Birb',
    kind: 'pet',
    chance: sourceItem.chance,
    params: { ...params, max, p2: max },
    baseCooldown: sourceItem.cooldown,
    cooldown: sourceItem.cooldown,
    alive: true,
    charges: null,
  };
  const weapon = {
    itemId: 'wooden_sword',
    placementKey: 'weapon',
    name: 'Wooden Sword',
    kind: 'weapon',
    cooldown: 1.4,
    baseCooldown: 1.4,
    params: {},
  };
  const healer = {
    itemId: 'health_potion',
    placementKey: 'healer',
    name: 'Health Potion',
    kind: 'consumable',
    cooldown: 999,
    baseCooldown: 999,
    params: { heal: 12 },
  };
  const buffTarget = {
    itemId: 'buff_target',
    placementKey: 'buff-target',
    name: 'Buff Target',
    kind: 'passive',
    cooldown: 0,
    baseCooldown: 0,
    params: {},
  };
  const unrelated = {
    itemId: 'stone',
    placementKey: 'unrelated',
    name: 'Stone',
    kind: 'passive',
    cooldown: 0,
    baseCooldown: 0,
    params: {},
  };
  const graph = {
    pieces: new Map([
      ['birb', { key: 'birb', id: 'paradise_birb', affectCells: [
        { cell: 'weapon', color: 'primary' },
        { cell: 'healer', color: 'primary' },
        { cell: 'buff-target', color: 'primary' },
        { cell: 'unrelated', color: 'primary' },
      ], cells: [] }],
      ['weapon', { key: 'weapon', id: 'wooden_sword', affectCells: [], cells: ['weapon'] }],
      ['healer', { key: 'healer', id: 'health_potion', affectCells: [], cells: ['healer'] }],
      ['buff-target', { key: 'buff-target', id: 'buff_target', affectCells: [], cells: ['buff-target'] }],
      ['unrelated', { key: 'unrelated', id: 'stone', affectCells: [], cells: ['unrelated'] }],
    ]),
    filled: new Map([
      ['weapon', 'weapon'],
      ['healer', 'healer'],
      ['buff-target', 'buff-target'],
      ['unrelated', 'unrelated'],
    ]),
  };
  return {
    t: 0,
    events: [],
    piece,
    pieces: [piece, weapon, healer, buffTarget, unrelated],
    graph,
    itemsById: new Map([
      ['paradise_birb', sourceItem],
      ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon', cooldown: 1.4, params: {} }],
      ['health_potion', { id: 'health_potion', type: 'Potion', params: { heal: 12 } }],
      ['buff_target', { id: 'buff_target', type: 'Skill', params: {} }],
      ['stone', { id: 'stone', type: 'Material', params: {} }],
    ]),
    canAffect: {
      rulesById: rules.byId,
      gainsBuffsIds: new Set(['buff_target']),
    },
  };
}

{
  const ctx = makeContext();
  handler.onPrepare(ctx.piece, ctx);
  handler.onCooldownEffect(ctx.piece, ctx);
  assert.equal(ctx.piece._birbActs, 1);
  assert.equal(ctx.pieces.find((p) => p.itemId === 'wooden_sword').speedScale, 0.07);
  assert.equal(ctx.pieces.find((p) => p.itemId === 'wooden_sword').buffAmpChance, 7);
  assert.equal(ctx.pieces.find((p) => p.itemId === 'buff_target').buffAmpChance, 7);
  const healer = ctx.pieces.find((p) => p.itemId === 'health_potion');
  assert.equal(healer.paramMult.heal, 1.07);
  assert.equal(modifiedParamValue(healer, 12, 'heal'), 12.84);
  assert.equal(ctx.pieces.find((p) => p.itemId === 'stone').buffAmpChance || 0, 0);

  handler.onCooldownEffect(ctx.piece, ctx);
  assert.equal(ctx.piece._birbActs, 2);
  assert.equal(ctx.piece.alive, false, 'Birb retires after max activations');
  assert.equal(ctx.pieces.find((p) => p.itemId === 'wooden_sword').speedScale, 0.14);
  assert.equal(Number(ctx.pieces.find((p) => p.itemId === 'health_potion').paramMult.heal.toFixed(2)), 1.14);
}

{
  const ctx = makeContext({}, 0);
  handler.onPrepare(ctx.piece, ctx);
  handler.onCooldownEffect(ctx.piece, ctx);
  assert.equal(ctx.piece._birbActs, 0, 'Explicit zero max activations stays zero');
  assert.equal(ctx.piece.alive, true);
  assert.equal(ctx.pieces.find((p) => p.itemId === 'wooden_sword').speedScale || 0, 0);
}

console.log('Paradise Birb source/parity smoke passed.');
