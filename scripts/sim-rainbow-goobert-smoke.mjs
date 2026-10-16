import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/RainbowGoobert.gd', 'utf8');
const goobertSource = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-goobert.js', 'utf8');
const rainbowPort = port.slice(
  port.indexOf('const rainbowGoobertPort'),
  port.indexOf('/** RainbowGoobertPyromancer.gd', port.indexOf('const rainbowGoobertPort')),
);

assert.equal(inventory.byId.rainbow_goobert?.file, 'RainbowGoobert.gd');
assert.match(source, /extends Goobert/);
assert.match(source, /giveBlock\(\)[\s\S]*heal\(\)[\s\S]*giveVampirism\(getP3\(\)\)[\s\S]*inflictBlind\(getP4\(\)\)[\s\S]*inflictPoison\(getP4\(\)\)/);
assert.match(source, /item\.canBeEmpowered\(\)[\s\S]*item\.addBonusDamage\(getP5\(\)/);
assert.match(goobertSource, /activationsToTrigger = getP1\(\)/);
assert.match(goobertSource, /func canAffect\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(rainbowPort, /variantGoobert\('rainbow_goobert'/);
assert.match(rainbowPort, /healActor\(player, heal\)/);
assert.doesNotMatch(rainbowPort, /onCombatStart\(/);
assert.match(port, /function variantGoobert[\s\S]*onPeerActivated\(/);
assert.match(rainbowPort, /getP5\(piece\.params, 0\)/);
assert.match(rainbowPort, /pushActivate\(piece, ctx, 'rainbow_goobert'/);

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

const goobert = item('rainbow_goobert', {
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
      id: 'rainbow_goobert',
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
const handler = getScriptHandler('rainbow_goobert');
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

assert.equal(handler?.handlerId, 'rainbow_goobert');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler.onCooldownEffect(goobert, ctx), false, 'Goobert effects are peer-triggered');
handler.onPrepare(goobert, ctx);
for (let i = 0; i < 8; i += 1) handler.onPeerActivated(goobert, sword, ctx);
assert.equal(Number(player.stacks.block) || 0, 0, 'effect waits for the source activation threshold');
handler.onPeerActivated(goobert, sword, ctx);

assert.equal(player.block, 20, 'giveBlock uses the catalog block amount');
assert.equal(player.hp, 90, 'source heal uses the named heal parameter');
assert.equal(player.stacks.vampirism, 2, 'source getP3 vampirism is preserved');
assert.equal(dummy.stacks.blind, 3, 'source getP4 blind is preserved');
assert.equal(dummy.stacks.poison, 3, 'Rainbow Goobert also inflicts poison');
assert.equal(sword.bonusDamage, 4, 'source getP5 empowers affected activatable weapons');
assert.equal(potion.bonusDamage, undefined, 'non-weapons are not empowered');
assert.equal(events.at(-1)?.type, 'activate', 'Goobert activates after its effects');
assert.equal(events.at(-1)?.itemId, 'rainbow_goobert');

console.log('OK Rainbow Goobert source and handler regression');
