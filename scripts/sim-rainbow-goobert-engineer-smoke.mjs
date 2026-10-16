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
  'tools/game-extract-full/Items/Exclusive/RainbowGoobertEngineer.gd',
  'utf8',
);
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-goobert.js', 'utf8');
const engineerPort = port.slice(
  port.indexOf('const rainbowGoobertEngineerPort'),
  port.indexOf('export const AM_GOOBERT_PORTS', port.indexOf('const rainbowGoobertEngineerPort')),
);

assert.equal(
  inventory.byId.rainbow_goobert_engineer?.file,
  'Exclusive/RainbowGoobertEngineer.gd',
);
assert.match(source, /extends Goobert/);
assert.match(
  source,
  /giveBlock\(\)[\s\S]*heal\(\)[\s\S]*giveStamina\(stamina\)[\s\S]*giveVampirism\(vampirism\)[\s\S]*giveRegeneration\(regen\)[\s\S]*inflictBlind\(blind\)/,
);
assert.match(source, /item\.canBeEmpowered\(\)[\s\S]*item\.addBonusDamage\(dambonus\)/);
assert.match(engineerPort, /variantGoobert\('rainbow_goobert_engineer'/);
assert.match(engineerPort, /goobertHeal\(piece, ctx, 'rainbow_goobert_engineer', healAmt\(piece\), \{ activate: false \}\)/);
assert.match(engineerPort, /getPName\(piece\.params, 'stamina', getP6\(piece\.params, 0\)\)/);
assert.match(engineerPort, /getPName\(piece\.params, 'dambonus', getP\(piece\.params, 6, 0\)\)/);
assert.match(engineerPort, /pushActivate\(piece, ctx, 'rainbow_goobert_engineer'/);
assert(
  engineerPort.indexOf('giveStamina(player, stamina)') <
    engineerPort.indexOf("grantStacks(player, 'vampirism'"),
  'Engineer preserves source Stamina-before-Vampirism ordering',
);

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

const goobert = item('rainbow_goobert_engineer', {
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
      id: 'rainbow_goobert_engineer',
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
player.stamina = 0;
const events = [];
const handler = getScriptHandler('rainbow_goobert_engineer');
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

assert.equal(handler?.handlerId, 'rainbow_goobert_engineer');
assert.equal(handler.onCooldownEffect(goobert, ctx), false, 'Goobert effects are peer-triggered');
handler.onPrepare(goobert, ctx);
for (let i = 0; i < 8; i += 1) handler.onPeerActivated(goobert, sword, ctx);
assert.equal(Number(player.stacks.vampirism) || 0, 0, 'effect waits for the source activation threshold');
handler.onPeerActivated(goobert, sword, ctx);

assert.equal(player.block, 20, 'giveBlock uses the catalog block amount');
assert.equal(player.hp, 90, 'source heal uses the named heal parameter');
assert.equal(player.stamina, 2, 'source named stamina parameter is preserved');
assert.equal(player.stacks.vampirism, 2, 'source named vampirism parameter is preserved');
assert.equal(player.stacks.regeneration, 1, 'source named regeneration parameter is preserved');
assert.equal(dummy.stacks.blind, 3, 'source named blind parameter is preserved');
assert.equal(Number(dummy.stacks.poison) || 0, 0, 'Engineer does not inflict poison');
assert.equal(sword.bonusDamage, 4, 'source named dambonus empowers affected activatable weapons');
assert.equal(potion.bonusDamage, undefined, 'non-weapons are not empowered');
assert.equal(events.at(-1)?.type, 'activate', 'Goobert activates after its effects');
assert.equal(events.at(-1)?.itemId, 'rainbow_goobert_engineer');

const sparse = { ...goobert, params: { p1: 1 } };
const sparsePlayer = createActor('player');
const sparseDummy = createActor('dummy');
sparsePlayer.stamina = 0;
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
assert.equal(sparsePlayer.hp, 200, 'missing heal parameter does not invent a heal');
assert.equal(sparsePlayer.stamina, 0, 'missing stamina parameter does not invent a grant');
assert.equal(Number(sparsePlayer.stacks.vampirism) || 0, 0, 'missing vampirism does not invent a grant');
assert.equal(Number(sparsePlayer.stacks.regeneration) || 0, 0, 'missing regeneration does not invent a grant');
assert.equal(Number(sparseDummy.stacks.blind) || 0, 0, 'missing blind does not invent a grant');
assert.equal(sword.bonusDamage, 4, 'sparse fixture does not mutate the prior weapon result');
assert.equal(sparseEvents.at(-1)?.type, 'activate', 'zero-effect source still activates');

console.log('OK Rainbow Goobert Engineer source and handler regression');
