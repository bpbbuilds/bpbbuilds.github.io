import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Ultima.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-lucky.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.ultima?.file, 'Exclusive/Ultima.gd');
assert.deepEqual(inventory.byId.ultima?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*Type\.Nature[\s\S]*Type\.Ice[\s\S]*Type\.Holy[\s\S]*Type\.Dark[\s\S]*Type\.Spell/);
assert.match(source, /onready var speedPerSpell: = getP\("speed"\) \/ 100\.0/);
assert.match(source, /func onPrepare\(\):[\s\S]*countTypes\(getAffectedItems\(\)\)[\s\S]*typesDict\[Type\.Spell\]/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getP\("luck"\)[\s\S]*getP\("spikes"\)[\s\S]*getP\("cold"\)[\s\S]*getP\("regen"\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(portSource, /handlerId: 'ultima'/);
assert.match(portSource, /getP5\(piece\.params/);
assert.match(portSource, /getP1\(piece\.params/);
assert.match(portSource, /getP2\(piece\.params/);
assert.match(portSource, /getP3\(piece\.params/);
assert.match(portSource, /getP4\(piece\.params/);

const handler = getScriptHandler('ultima');
assert.equal(handler?.handlerId, 'ultima');

const ultimaCatalog = byId.get('ultima');
assert.ok(ultimaCatalog);
const targetIds = ['stone', 'snow_stick', 'holy_armor', 'amulet_of_darkness', 'spell_scroll_nature', 'wooden_sword'];
for (const id of targetIds) assert.ok(byId.get(id), `catalog target ${id}`);

const player = createActor('player');
const dummy = createActor('dummy');
dummy.stacks.empower = 1;
const ultima = {
  ...ultimaCatalog,
  itemId: 'ultima',
  placementKey: 'ultima',
  name: 'Ultima',
  kind: 'skill',
  side: 'you',
  alive: true,
  blockGrant: 17,
  params: {
    luck: 1, p1: 2,
    spikes: 1, p2: 2,
    cold: 1, p3: 2,
    regen: 1, p4: 3,
    speed: 1, p5: 75,
  },
};

const cells = targetIds.map((id, index) => ({ cell: `${index + 1},0`, color: 'primary' }));
const graph = {
  pieces: new Map([
    ['ultima', { key: 'ultima', id: 'ultima', cells: ['0,0'], affectCells: cells }],
    ...targetIds.map((id, index) => [id, { key: id, id, cells: [`${index + 1},0`], affectCells: [] }]),
  ]),
  filled: new Map([
    ['0,0', 'ultima'],
    ...targetIds.map((id, index) => [`${index + 1},0`, id]),
  ]),
};
const targetPieces = targetIds.map((id) => ({
  ...byId.get(id),
  itemId: id,
  placementKey: id,
  name: id,
  kind: 'item',
  side: 'you',
  alive: true,
}));
const itemsById = new Map([
  ['ultima', ultimaCatalog],
  ...targetIds.map((id) => [id, byId.get(id)]),
]);
const ctx = {
  t: 0,
  player,
  dummy,
  pieces: [ultima, ...targetPieces],
  graph,
  itemsById,
  canAffect: { rulesById: rules.byId },
  events: [],
  rng: () => 0,
};

handler.onPrepare(ultima, ctx);
assert.equal(ultima._ultimaTypes.nature, 2, 'Ultima counts Nature items independently of Spell');
assert.equal(ultima._ultimaTypes.ice, 1);
assert.equal(ultima._ultimaTypes.holy, 1);
assert.equal(ultima._ultimaTypes.dark, 1);
assert.equal(ultima._ultimaTypes.spell, 1);
assert.equal(ultima.speedScale, 0.75, 'Ultima uses source p5 speed per affected Spell');

assert.equal(handler.onCooldownEffect(ultima, ctx), true);
assert.equal(player.stacks.lucky, 4, 'Nature grants p1 Lucky per affected Nature item');
assert.equal(player.stacks.spikes, 4, 'Nature grants p2 Spikes per affected Nature item');
assert.equal(player.block, 17, 'Ice grants source getBlock from the live piece');
assert.equal(dummy.stacks.cold, 2, 'Ice grants p3 Cold to the opponent');
assert.equal(player.stacks.regeneration, 3, 'Holy grants p4 Regeneration');
assert.equal(player.stacks.empower, 1, 'Dark steals one random opponent buff after the other effects');
assert.equal(ultima.alive, false, 'Ultima follows the source onAfterEffectFinished consume path');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Ultima logs its activation after effects finish');

const zeroPlayer = createActor('player');
const zeroDummy = createActor('dummy');
const zero = { ...ultima, alive: true, placementKey: 'zero', speedScale: 0, params: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 } };
const zeroCtx = { ...ctx, player: zeroPlayer, dummy: zeroDummy, pieces: [zero], events: [] };
handler.onPrepare(zero, zeroCtx);
assert.equal(zero.speedScale, 0, 'zero p5 does not add speed');
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroPlayer.stacks.lucky, 0);
assert.equal(zeroPlayer.stacks.spikes, 0);
assert.equal(zeroPlayer.block, 0);
assert.equal(zeroDummy.stacks.cold, 0);
assert.equal(zeroPlayer.stacks.regeneration, 0);

console.log('OK Ultima source, five-type targeting, p1-p5 parameters, live Block, effect order, consume activation, and zero-safe regression');
