import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SapphireEgg.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-eggs.js', 'utf8');
const sapphirePort = port.slice(
  port.indexOf('export const sapphireEggPort'),
  port.indexOf('export const AM_EGG_PORTS'),
);

assert.match(source, /extends DragonEgg/);
assert.match(source, /func onCombatStart\(\):[\s\S]*doCooldownEffect\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveMana\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(sapphirePort, /onCombatStart\(piece, ctx\)/);
assert.match(sapphirePort, /getP1\(piece\.params, 0\)/);
assert.match(sapphirePort, /grantStacks\(ctx\.player, 'mana'/);
assert.match(sapphirePort, /petActivate\(piece, ctx, 'sapphire_egg'/);
assert.doesNotMatch(sapphirePort, /Math\.max\(1/);
assert.doesNotMatch(sapphirePort, /Math\.round\(getP1/);
assert.doesNotMatch(sapphirePort, /onCooldownEffect\(/);

function item(params, placementKey = 'sapphire-egg') {
  const base = byId.get('sapphire_egg');
  assert.ok(base, 'catalog item sapphire_egg exists');
  return {
    ...base,
    itemId: 'sapphire_egg',
    name: 'Sapphire Egg',
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

const handler = getScriptHandler('sapphire_egg');
assert.equal(handler?.handlerId, 'sapphire_egg');
assert.equal(handler?.onCooldownEffect, undefined, 'Sapphire Egg has no recurring source cooldown hook');

const sapphire = item({ mana: 6, p1: 6, hatch: 2, p2: 2 });
const ctx = context(sapphire);
handler.onCombatStart(sapphire, ctx);
assert.equal(ctx.player.stacks.mana, 6, 'combat start adds the source Mana amount');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Mana is applied before activation');
assert.equal(ctx.events.at(-1)?.itemId, 'sapphire_egg');

const fractional = item({ p1: 1.75 }, 'fractional-sapphire-egg');
const fractionalCtx = context(fractional);
handler.onCombatStart(fractional, fractionalCtx);
assert.equal(fractionalCtx.player.stacks.mana, 2, 'source integer Mana stack rounds getP1() through giveStacks');

const sparse = item({}, 'sparse-sapphire-egg');
const sparseCtx = context(sparse);
handler.onCombatStart(sparse, sparseCtx);
assert.equal(sparseCtx.player.stacks.mana || 0, 0, 'missing Mana does not fabricate a stack');
assert.equal(sparseCtx.events.at(-1)?.type, 'activate', 'activation still follows the source start hook');

console.log('OK Sapphire Egg source and handler regression');
