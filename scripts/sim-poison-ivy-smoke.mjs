import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/PoisonIvy.gd', 'utf8');

assert.equal(inventory.byId.poison_ivy?.file, 'PoisonIvy.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Nature\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*character_spikes_changed[\s\S]*character_poison_changed/);
assert.match(source, /if amount > 0:[\s\S]*inflictPoison\(amount \* poisonPerSpike, event\)[\s\S]*miniActivate\(\)/);
assert.match(source, /curPoison >= getP1\(\)[\s\S]*changeDamageResistance\( - getP2\(\)/);
assert.equal(byId.get('poison_ivy')?.params.p1, 18);
assert.equal(byId.get('poison_ivy')?.params.p2, 25);
assert.equal(byId.get('poison_ivy')?.params.p4, 2);
assert.equal(byId.get('poison_ivy')?.chance, 5);

const ivy = {
  ...byId.get('poison_ivy'),
  itemId: 'poison_ivy',
  placementKey: 'ivy',
  name: 'Poison Ivy',
  params: byId.get('poison_ivy').params,
  kind: 'passive',
  alive: true,
};
const nature = { ...byId.get('banana'), itemId: 'banana', placementKey: 'nature', name: 'Banana', kind: 'consumable', alive: true };
const sword = { ...byId.get('wooden_sword'), itemId: 'wooden_sword', placementKey: 'sword', name: 'Wooden Sword', kind: 'weapon', alive: true };
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const events = [];
const graph = {
  pieces: new Map([
    ['ivy', { key: 'ivy', id: 'poison_ivy', cells: [], affectCells: [
      { cell: 'nature-link', color: 'primary' },
      { cell: 'sword-link', color: 'primary' },
    ] }],
    ['nature', { key: 'nature', id: 'banana', cells: [], affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['nature-link', 'nature'], ['sword-link', 'sword']]),
};
const ctx = {
  player,
  dummy,
  pieces: [ivy, nature, sword],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 3,
  rng: () => 0,
};
const handler = getScriptHandler('poison_ivy');

assert.equal(handler?.handlerId, 'poison_ivy');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined);
handler.onPrepare(ivy, ctx);
assert.equal(player.stackResist.poison, 5, 'Poison resistance counts only linked Nature items');

grantStacks(player, 'spikes', 3, { originKey: 'spike-source', originId: 'spike-source' });
assert.equal(dummy.stacks.poison, 6, 'Spikes apply source p4 Poison per Spike');
assert.equal(events.at(-1)?.type, 'activate');
assert.equal(events.at(-1)?.meta.miniActivate, true, 'Spikes response is visual-only miniActivate');

grantStacks(dummy, 'poison', 12, { originKey: 'poison-source', originId: 'poison-source' });
assert.equal(dummy.damageResistancePct, -25, 'source p2 damage resistance change activates at p1 Poison');
assert.equal(ivy._ivyAmp, true);

console.log('OK Poison Ivy source and Nature/Spikes regression');
