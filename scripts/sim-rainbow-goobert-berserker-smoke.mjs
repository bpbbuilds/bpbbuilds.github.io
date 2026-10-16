import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/RainbowGoobertBerserker.gd',
  'utf8',
);
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-aura.js', 'utf8');
const berserkerPort = port.slice(
  port.indexOf('export const rainbowGoobertBerserkerPort'),
  port.indexOf('/** @type {ScriptHandler} */', port.indexOf('export const rainbowGoobertBerserkerPort') + 1),
);

assert.equal(
  inventory.byId.rainbow_goobert_berserker?.file,
  'Exclusive/RainbowGoobertBerserker.gd',
);
assert.match(source, /extends Goobert/);
assert.match(
  source,
  /giveBlock\(\)[\s\S]*giveMaxHealth\(\)[\s\S]*giveVampirism\(getP3\(\)\)[\s\S]*giveRandomBuffs\(getP4\(\)\)[\s\S]*inflictBlind\(getP\("blind"\)\)/,
);
assert.match(source, /item\.canBeEmpowered\(\)[\s\S]*item\.addBonusDamage\(getP5\(\)/);
assert.match(berserkerPort, /onPrepare\(piece\)/);
assert.match(berserkerPort, /goobertPeerTick\(listener, ctx/);
assert.match(berserkerPort, /onCooldownEffect\(\)\s*\{\s*return false;/);
assert.match(berserkerPort, /getP4\(listener\.params, 0\)/);
assert.match(berserkerPort, /getP5\(listener\.params, 0\)/);
assert.match(berserkerPort, /getPName\(listener\.params, 'blind', getP6\(listener\.params, 0\)\)/);
assert.match(berserkerPort, /giveTempMaxHp\([\s\S]*getPName\(listener\.params, 'maxhealth', getP2\(listener\.params, 0\)\)/);
assert.match(berserkerPort, /pushActivate\(listener, ctx, 'rainbow_goobert_berserker'/);

function item(id, overrides = {}) {
  const base = byId.get(id);
  assert.ok(base, `catalog item ${id} exists`);
  return {
    ...base,
    ...overrides,
    itemId: id,
    placementKey: overrides.placementKey || id,
    cells: overrides.cells || [id],
  };
}

const goobert = item('rainbow_goobert_berserker', {
  placementKey: 'goobert',
  cells: ['goobert-cell'],
  kind: 'pet',
  alive: true,
});
const sword = item('wooden_sword', {
  placementKey: 'sword',
  cells: ['sword-cell'],
  kind: 'weapon',
  bonusDamage: 0,
  alive: true,
});
const potion = item('health_potion', {
  placementKey: 'potion',
  cells: ['potion-cell'],
  kind: 'consumable',
  alive: true,
});
const graph = {
  pieces: new Map([
    ['goobert', {
      key: 'goobert',
      id: 'rainbow_goobert_berserker',
      cells: goobert.cells,
      affectCells: [
        { cell: 'sword-cell', color: 'primary' },
        { cell: 'potion-cell', color: 'primary' },
      ],
    }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: sword.cells, affectCells: [] }],
    ['potion', { key: 'potion', id: 'health_potion', cells: potion.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['sword-cell', 'sword'],
    ['potion-cell', 'potion'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
player.hp = 50;
const events = [];
const handler = getScriptHandler('rainbow_goobert_berserker');
const ctx = {
  player,
  dummy,
  pieces: [goobert, sword, potion],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 9,
  rng: () => 0,
};

assert.equal(handler?.handlerId, 'rainbow_goobert_berserker');
assert.equal(handler.onCooldownEffect(goobert, ctx), false, 'Goobert effects are peer-triggered');
handler.onPrepare(goobert, ctx);
for (let i = 0; i < 8; i += 1) handler.onPeerActivated(goobert, sword, ctx);
assert.equal(Number(player.block) || 0, 0, 'effect waits for the source activation threshold');
assert.equal(player.maxHp, 200, 'max health waits for the source activation threshold');
handler.onPeerActivated(goobert, sword, ctx);

assert.equal(player.block, 20, 'giveBlock uses the catalog block amount');
assert.equal(player.maxHp, 240, 'giveMaxHealth raises max health by the named parameter');
assert.equal(player.hp, 90, 'giveMaxHealth raises current health by the same amount');
assert.equal(player.stacks.vampirism, 2, 'source getP3 vampirism is preserved');
assert.equal(dummy.stacks.blind, 3, 'source named blind parameter is preserved');
assert.equal(Number(dummy.stacks.poison) || 0, 0, 'Berserker does not inflict poison');
assert.equal(sword.bonusDamage, 4, 'source getP5 empowers affected activatable weapons');
assert.equal(potion.bonusDamage, undefined, 'non-weapons are not empowered');
assert.equal(
  events
    .filter((event) => event.type === 'buff' && event.itemId === 'rainbow_goobert_berserker')
    .reduce((sum, event) => sum + event.amount, 0),
  2,
  'source getP4 grants exactly two random buff stacks',
);
assert.equal(events.at(-1)?.type, 'activate', 'Goobert activates after its effects');
assert.equal(events.at(-1)?.itemId, 'rainbow_goobert_berserker');

const sparse = { ...goobert, params: { p1: 1 } };
const sparsePlayer = createActor('player');
const sparseDummy = createActor('dummy');
const sparseEvents = [];
const sparseCtx = {
  ...ctx,
  player: sparsePlayer,
  dummy: sparseDummy,
  pieces: [sparse, sword, potion],
  events: sparseEvents,
};
handler.onPrepare(sparse, sparseCtx);
handler.onPeerActivated(sparse, sword, sparseCtx);
assert.equal(sparsePlayer.block, 20, 'catalog block remains source-defined when optional params are absent');
assert.equal(sparsePlayer.maxHp, 200, 'missing max-health parameter does not invent a grant');
assert.equal(Number(sparsePlayer.stacks.vampirism) || 0, 0, 'missing P3 does not invent vampirism');
assert.equal(Number(sparseDummy.stacks.blind) || 0, 0, 'missing named blind does not invent blind');
assert.equal(sword.bonusDamage, 4, 'sparse fixture does not mutate the prior weapon result');
assert.equal(sparseEvents.at(-1)?.type, 'activate', 'zero-effect source still activates');

console.log('OK Rainbow Goobert Berserker source and handler regression');
