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
  'tools/game-extract-full/Items/Exclusive/RainbowGoobertAdventurer.gd',
  'utf8',
);
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-goobert.js', 'utf8');
const adventurerPort = port.slice(
  port.indexOf('const rainbowGoobertAdventurerPort'),
  port.indexOf('/** RainbowGoobertEngineer.gd', port.indexOf('const rainbowGoobertAdventurerPort')),
);

assert.equal(inventory.byId.rainbow_goobert_adventurer?.file, 'Exclusive/RainbowGoobertAdventurer.gd');
assert.match(source, /extends Goobert/);
assert.match(source, /giveBlock\(\)[\s\S]*heal\(\)[\s\S]*giveVampirism\(getP3\(\)\)[\s\S]*giveRegeneration\(getP4\(\)\)[\s\S]*inflictBlind\(getP5\(\)\)/);
assert.match(source, /item\.canBeEmpowered\(\)[\s\S]*item\.addBonusDamage\(getP6\(\)/);
assert.match(adventurerPort, /variantGoobert\('rainbow_goobert_adventurer'/);
assert.match(adventurerPort, /getP4\(piece\.params, 0\)/);
assert.match(adventurerPort, /getP5\(piece\.params, 0\)/);
assert.match(adventurerPort, /getP6\(piece\.params, 0\)/);
assert.match(port, /goobertHeal\(piece, ctx, handler, healAmt\(piece\), \{ activate: false \}\)/);
assert.match(port, /pushActivate\(piece, ctx, handler, `Pet: \$\{piece\.name\}`\)/);

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

const goobert = item('rainbow_goobert_adventurer', {
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
      id: 'rainbow_goobert_adventurer',
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
const handler = getScriptHandler('rainbow_goobert_adventurer');
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

assert.equal(handler?.handlerId, 'rainbow_goobert_adventurer');
assert.equal(handler.onCooldownEffect(goobert, ctx), false, 'Goobert effects are peer-triggered');
handler.onPrepare(goobert, ctx);
for (let i = 0; i < 8; i += 1) handler.onPeerActivated(goobert, sword, ctx);
assert.equal(Number(player.block) || 0, 0, 'effect waits for the source activation threshold');
handler.onPeerActivated(goobert, sword, ctx);

assert.equal(player.block, 20, 'giveBlock uses the catalog block amount');
assert.equal(player.hp, 90, 'source heal uses the named heal parameter');
assert.equal(player.stacks.vampirism, 2, 'source getP3 vampirism is preserved');
assert.equal(player.stacks.regeneration, 2, 'source getP4 regeneration is preserved');
assert.equal(dummy.stacks.blind, 3, 'source getP5 blind is preserved');
assert.equal(Number(dummy.stacks.poison) || 0, 0, 'Adventurer does not inflict poison');
assert.equal(sword.bonusDamage, 4, 'source getP6 empowers affected activatable weapons');
assert.equal(potion.bonusDamage, undefined, 'non-weapons are not empowered');
assert.equal(events.at(-1)?.type, 'activate', 'Goobert activates after its effects');
assert.equal(events.at(-1)?.itemId, 'rainbow_goobert_adventurer');

console.log('OK Rainbow Goobert Adventurer source and handler regression');
