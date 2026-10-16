import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/RubyEgg.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-eggs.js', 'utf8');
const rubyPort = port.slice(
  port.indexOf('export const rubyEggPort'),
  port.indexOf('/** EmeraldEgg.gd */'),
);

assert.match(source, /extends DragonEgg/);
assert.match(source, /onready var reflects: = int\(getP1\(\)\)/);
assert.match(source, /onready var heat: = int\(getP3\(\)\)/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*giveReflectStacks\(reflects\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*doCooldownEffect\(false\)/);
assert.match(
  source,
  /func doCooldownEffect\(withReflectStacks: bool = true\):[\s\S]*if withReflectStacks:[\s\S]*giveReflectStacks\(reflects\)[\s\S]*giveHeat\(heat\)[\s\S]*activate\(\)/,
);
assert.match(rubyPort, /onPreCombatStart\(piece, ctx\)/);
assert.match(rubyPort, /onCombatStart\(piece, ctx\)/);
assert.match(rubyPort, /getP1\(piece\.params, 0\)/);
assert.match(rubyPort, /getP3\(piece\.params, 0\)/);
assert.match(rubyPort, /petActivate\(piece, ctx, 'ruby_egg'/);

function item(params, placementKey = 'ruby-egg') {
  const base = byId.get('ruby_egg');
  assert.ok(base, 'catalog item ruby_egg exists');
  return {
    ...base,
    itemId: 'ruby_egg',
    name: 'Ruby Egg',
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
  };
}

const handler = getScriptHandler('ruby_egg');
assert.equal(handler?.handlerId, 'ruby_egg');
assert.equal(handler?.onCooldownEffect, undefined, 'Ruby Egg does not schedule a recurring cooldown');

const ruby = item({ reflect: 3, p1: 3, hatch: 2, p2: 2, heat: 4, p3: 4 });
const ctx = context(ruby);
handler.onPreCombatStart(ruby, ctx);
assert.equal(ctx.player.debuffReflectStacks, 3, 'pre-combat adds the source Reflect amount');
assert.equal(ctx.events.some((event) => event.type === 'activate'), false, 'pre-combat Reflect does not activate Ruby Egg');

handler.onCombatStart(ruby, ctx);
assert.equal(ctx.player.stacks.heat, 4, 'combat start adds the source Heat amount');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Heat is applied before activation');
assert.equal(ctx.events.at(-1)?.itemId, 'ruby_egg');

const fractional = item({ p1: 1.9, p3: 2.9 }, 'fractional-ruby-egg');
const fractionalCtx = context(fractional);
handler.onPreCombatStart(fractional, fractionalCtx);
handler.onCombatStart(fractional, fractionalCtx);
assert.equal(fractionalCtx.player.debuffReflectStacks, 1, 'source int() truncates fractional Reflect');
assert.equal(fractionalCtx.player.stacks.heat, 2, 'source int() truncates fractional Heat');

const sparse = item({}, 'sparse-ruby-egg');
const sparseCtx = context(sparse);
handler.onPreCombatStart(sparse, sparseCtx);
handler.onCombatStart(sparse, sparseCtx);
assert.equal(sparseCtx.player.debuffReflectStacks || 0, 0, 'missing Reflect does not fabricate a stack');
assert.equal(sparseCtx.player.stacks.heat || 0, 0, 'missing Heat does not fabricate a stack');
assert.equal(sparseCtx.events.at(-1)?.type, 'activate', 'activation still follows the source start hook');

console.log('OK Ruby Egg source and handler regression');
