import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/RubyWhelp.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-start.js', 'utf8');
const whelpPort = port.slice(
  port.indexOf('const rubyWhelpPort'),
  port.indexOf('const darkLanternPort'),
);

assert.match(source, /extends Weapon/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*giveReflectStacks\(getP2\(\)\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveHeat\(getP1\(\)\)[\s\S]*activate\(null, false\)/);
assert.match(whelpPort, /onPreCombatStart\(piece, ctx\)/);
assert.match(whelpPort, /onCombatStart\(piece, ctx\)/);
assert.match(whelpPort, /getP1\(piece\.params, 0\)/);
assert.match(whelpPort, /getP2\(piece\.params, 0\)/);
assert.match(whelpPort, /return weaponStrike\(piece, ctx, 'ruby_whelp'\)/);

function item(params, placementKey = 'ruby-whelp') {
  const base = byId.get('ruby_whelp');
  assert.ok(base, 'catalog item ruby_whelp exists');
  return {
    ...base,
    itemId: 'ruby_whelp',
    name: 'Ruby Whelp',
    placementKey,
    params,
    alive: true,
  };
}

function context(piece) {
  return {
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    itemsById: byId,
    pieces: [piece],
    t: 4,
    rng: () => 0,
  };
}

const handler = getScriptHandler('ruby_whelp');
assert.equal(handler?.handlerId, 'ruby_whelp');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const indexed = item({ heat: 9, p1: 5, reflect: 8, p2: 3 });
const indexedCtx = context(indexed);
handler.onPreCombatStart(indexed, indexedCtx);
assert.equal(indexedCtx.player.debuffReflectStacks, 3, 'source getP2 uses the indexed Reflect value');
assert.equal(indexedCtx.events.some((event) => event.type === 'activate'), false, 'pre-combat Reflect does not activate');
handler.onCombatStart(indexed, indexedCtx);
assert.equal(indexedCtx.player.stacks.heat, 5, 'source getP1 uses the indexed Heat value');
assert.equal(indexedCtx.events.at(-1)?.type, 'activate', 'Heat is applied before start activation');
assert.equal(indexedCtx.events.at(-1)?.itemId, 'ruby_whelp');

const sparse = item({}, 'sparse-ruby-whelp');
const sparseCtx = context(sparse);
handler.onPreCombatStart(sparse, sparseCtx);
handler.onCombatStart(sparse, sparseCtx);
assert.equal(sparseCtx.player.debuffReflectStacks || 0, 0, 'missing Reflect does not fabricate a stack');
assert.equal(sparseCtx.player.stacks.heat || 0, 0, 'missing Heat does not fabricate Heat');
assert.equal(sparseCtx.events.at(-1)?.type, 'activate', 'start activation still follows source order');

console.log('OK Ruby Whelp source and handler regression');
