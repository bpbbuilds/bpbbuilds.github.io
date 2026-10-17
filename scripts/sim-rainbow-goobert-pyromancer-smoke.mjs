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
  'tools/game-extract-full/Items/Exclusive/RainbowGoobertPyromancer.gd',
  'utf8',
);
const goobertSource = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-goobert.js', 'utf8');
const pyromancerPort = port.slice(
  port.indexOf('const rainbowGoobertPyromancerPort'),
  port.indexOf('/** RainbowGoobertAdventurer.gd', port.indexOf('const rainbowGoobertPyromancerPort')),
);

assert.equal(inventory.byId.rainbow_goobert_pyromancer?.file, 'Exclusive/RainbowGoobertPyromancer.gd');
assert.match(source, /extends Goobert/);
assert.match(source, /giveBlock\(\)[\s\S]*heal\(\)[\s\S]*giveVampirism\(getP3\(\)\)[\s\S]*giveHeat\(getP4\(\)\)[\s\S]*inflictBlind\(getP\("blind"\)\)/);
assert.match(source, /item\.canBeEmpowered\(\)[\s\S]*item\.addBonusDamage\(getP5\(\)/);
assert.match(goobertSource, /activationsToTrigger = getP1\(\)/);
assert.match(pyromancerPort, /variantGoobert\('rainbow_goobert_pyromancer'/);
assert.match(pyromancerPort, /getP4\(piece\.params, 0\)/);
assert.match(pyromancerPort, /getPName\(piece\.params, 'blind', getP6\(piece\.params, 0\)\)/);
assert.doesNotMatch(pyromancerPort, /Math\.max\(1,\s*Math\.round\(getP4/);
assert.doesNotMatch(pyromancerPort, /Math\.max\(1,\s*Math\.round\(getPName\(piece\.params, 'blind'/);

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

function makeContext(params = byId.get('rainbow_goobert_pyromancer').params) {
  const goobert = item('rainbow_goobert_pyromancer', {
    placementKey: 'goobert',
    cells: ['goobert-cell'],
    kind: 'pet',
    alive: true,
    params: { ...params },
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
        id: 'rainbow_goobert_pyromancer',
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
  return {
    player,
    dummy,
    pieces: [goobert, sword, potion],
    goobert,
    sword,
    potion,
    graph,
    itemsById: byId,
    canAffect: { rulesById: canAffectRules.byId },
    events: [],
    t: 9,
    rng: () => 0,
  };
}

const handler = getScriptHandler('rainbow_goobert_pyromancer');
assert.equal(handler?.handlerId, 'rainbow_goobert_pyromancer');

{
  const ctx = makeContext();
  assert.equal(handler.onCooldownEffect(ctx.goobert, ctx), false, 'Goobert effects are peer-triggered');
  handler.onPrepare(ctx.goobert, ctx);
  for (let i = 0; i < 8; i += 1) handler.onPeerActivated(ctx.goobert, ctx.sword, ctx);
  assert.equal(ctx.player.block, 0, 'effect waits for the source activation threshold');
  handler.onPeerActivated(ctx.goobert, ctx.sword, ctx);
  assert.equal(ctx.player.block, 20, 'source giveBlock uses the catalog block amount');
  assert.equal(ctx.player.hp, 90, 'source heal uses the named heal parameter');
  assert.equal(ctx.player.stacks.vampirism, 2, 'source getP3 vampirism is preserved');
  assert.equal(ctx.player.stacks.heat, 4, 'source getP4 Heat is preserved');
  assert.equal(ctx.dummy.stacks.blind, 3, 'source named Blind is preserved');
  assert.equal(ctx.sword.bonusDamage, 4, 'source getP5 empowers affected weapons');
  assert.equal(Number(ctx.dummy.stacks.poison) || 0, 0, 'Pyromancer does not inflict Poison');
  assert.equal(ctx.events.at(-1)?.type, 'activate');
}

{
  const ctx = makeContext({ p1: 1, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, heal: 0 });
  handler.onPrepare(ctx.goobert, ctx);
  handler.onPeerActivated(ctx.goobert, ctx.sword, ctx);
  assert.equal(ctx.player.block, 20, 'zero-effect source still gives its base Block');
  assert.equal(ctx.player.hp, 50, 'explicit zero heal remains zero');
  assert.equal(Number(ctx.player.stacks.vampirism) || 0, 0);
  assert.equal(Number(ctx.player.stacks.heat) || 0, 0, 'explicit zero Heat remains zero');
  assert.equal(Number(ctx.dummy.stacks.blind) || 0, 0, 'explicit zero Blind remains zero');
  assert.equal(ctx.sword.bonusDamage || 0, 0, 'explicit zero weapon bonus remains zero');
  assert.equal(ctx.events.at(-1)?.type, 'activate');
}

console.log('Rainbow Goobert Pyromancer source/parity smoke passed.');
