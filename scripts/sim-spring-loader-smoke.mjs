import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/SpringLoader.gd',
  'utf8',
);
const portSource = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-outliers-board.js',
  'utf8',
);
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const sourceItem = catalog.find((item) => item.id === 'spring_loader');
const targetItem = catalog.find((item) => item.id === 'wooden_sword');
const unrelatedItem = catalog.find((item) => item.id === 'stone');

assert.ok(sourceItem && targetItem && unrelatedItem, 'Spring Loader: extracted catalog rows');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*getAffectedItems\(\)[\s\S]*item\.reduceSpeed\(speed1\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*deactivateCooldown\(\)[\s\S]*addSpeed\(speed1 \+ speed2\)[\s\S]*advanceCooldownSeconds\(cdAdvance\)[\s\S]*onAfterEffectFinished\(\)/);

const port = portSource.match(/export const springLoaderPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /onCombatStart\(piece, ctx\)/);
assert.match(port, /addSpeed\(other, -slow\)/);
assert.match(port, /cdadvance/);
assert.ok(
  port.indexOf('advanceCooldownSeconds(') < port.lastIndexOf('afterEffectFinished('),
  'Spring Loader completes linked effects before its source activation',
);

const handler = getScriptHandler('spring_loader');
assert.equal(handler?.handlerId, 'spring_loader');

const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};

function makeContext(params = sourceItem.params) {
  const piece = {
    itemId: 'spring_loader',
    placementKey: 'loader',
    name: 'Spring Loader',
    kind: 'armor',
    side: 'you',
    alive: true,
    params: { ...params },
    speedScale: 0,
    cooldown: sourceItem.cooldown,
    baseCooldown: sourceItem.cooldown,
    triggerTime: 7,
  };
  const target = {
    itemId: 'wooden_sword',
    placementKey: 'target',
    name: 'Wooden Sword',
    kind: 'weapon',
    side: 'you',
    alive: true,
    params: targetItem.params || {},
    speedScale: 0,
    cooldown: targetItem.cooldown,
    baseCooldown: targetItem.cooldown,
    triggerTime: 5,
  };
  const unrelated = {
    itemId: 'stone',
    placementKey: 'unrelated',
    name: 'Stone',
    kind: 'passive',
    side: 'you',
    alive: true,
    params: unrelatedItem.params || {},
    speedScale: 0,
    cooldown: 0,
    baseCooldown: 0,
    triggerTime: 0,
  };
  const graph = {
    pieces: new Map([
      ['loader', {
        key: 'loader',
        id: 'spring_loader',
        affectCells: [
          { cell: 'target-cell', color: 'primary' },
          { cell: 'unrelated-cell', color: 'primary' },
        ],
        cells: [],
      }],
      ['target', { key: 'target', id: 'wooden_sword', affectCells: [], cells: ['target-cell'] }],
      ['unrelated', { key: 'unrelated', id: 'stone', affectCells: [], cells: ['unrelated-cell'] }],
    ]),
    filled: new Map([
      ['target-cell', 'target'],
      ['unrelated-cell', 'unrelated'],
    ]),
  };
  const events = [];
  return {
    piece,
    target,
    unrelated,
    events,
    graph,
    pieces: [piece, target, unrelated],
    player: createActor('player'),
    dummy: createActor('dummy'),
    itemsById: new Map([
      ['spring_loader', sourceItem],
      ['wooden_sword', targetItem],
      ['stone', unrelatedItem],
    ]),
    canAffect,
    t: 2,
    rng: () => 0,
  };
}

const ctx = makeContext();
handler.onCombatStart(ctx.piece, ctx);
assert.equal(ctx.piece.speedScale, 0, 'start-of-battle Spring Loader does not change its own speed');
assert.equal(ctx.target.speedScale, -0.1, 'start-of-battle speed reduces each linked cooldown item');

handler.onCooldownEffect(ctx.piece, ctx);
assert.equal(ctx.target.speedScale, 0.35, 'cooldown grants speed1 plus speed2 to the affected item');
assert.equal(ctx.target.triggerTime, 3, 'cooldown advances the affected item by named cdadvance seconds');
assert.equal(ctx.piece.alive, false, 'source onAfterEffectFinished consumes Spring Loader');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'source activates after linked speed and cooldown effects');

const zero = makeContext({ ...sourceItem.params, speed: 0, p1: 0, speed2: 0, p3: 0, cdadvance: 0, p2: 0 });
handler.onCombatStart(zero.piece, zero);
handler.onCooldownEffect(zero.piece, zero);
assert.equal(zero.piece.speedScale, 0, 'explicit zero source speed stays zero');
assert.equal(zero.target.speedScale, 0, 'explicit zero target speed stays zero');
assert.equal(zero.target.triggerTime, 5, 'explicit zero cooldown advance stays zero');

console.log('OK Spring Loader source/parity smoke');
