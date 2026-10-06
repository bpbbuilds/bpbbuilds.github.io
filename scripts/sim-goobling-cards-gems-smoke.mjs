import assert from 'node:assert/strict';
import fs from 'node:fs';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
function piece(id, key) { const item = byId.get(id); return { itemId: id, placementKey: key, name: item.name, params: item.params, alive: true, _revealed: false, _revealing: true }; }

assert.equal(inventory.byId.goobling.file, 'Goobert.gd');
assert.equal(inventory.byId.goobling.sceneFile, 'Exclusive/Goobling.tscn');
assert.equal(getScriptHandler('goobling')?.handlerId, 'goobling');
assert.equal(inventory.byId.holo_fire_lizard.file, 'HoloFireLizard.gd');
assert.equal(inventory.byId.joker.file, 'Exclusive/Joker.gd');

// HoloFireLizard.gd: factor, effect damage, then Heat, then activation.
{
  const card = piece('holo_fire_lizard', 'holo'); card._chainPos = 2; card._deckKey = 'deck';
  const player = createActor('player'); const dummy = createActor('dummy'); const events = [];
  const deck = { placementKey: 'deck', _cards: [piece('ace_of_spades', 'a'), piece('darkest_lotus', 'd'), card] };
  getScriptHandler('holo_fire_lizard').onCooldownEffect(card, { player, dummy, events, rng: () => 0, t: 5, pieces: [deck] });
  const stat = events.find((event) => event.meta?.stat === 'effect_dmg_factor');
  const damage = events.find((event) => event.type === 'damage');
  const heat = events.find((event) => event.type === 'buff' && event.meta?.stack === 'heat');
  assert.ok(stat && damage && heat && events.indexOf(stat) < events.indexOf(damage) && events.indexOf(damage) < events.indexOf(heat));
}

// Joker.gd counts prior descriptor duplicates. Pair grants crit resistance;
// triplet reduces every inventory item's stamina factor before activation.
{
  const joker = piece('joker', 'joker'); joker._chainPos = 5; joker._deckKey = 'deck';
  const same = [0, 1, 2].map((n) => piece('ace_of_spades', `ace:${n}`));
  const pair = [0, 1].map((n) => piece('darkest_lotus', `lotus:${n}`));
  const target = { ...piece('wooden_sword', 'sword'), staminaCost: 10 };
  const deck = { placementKey: 'deck', _cards: [...same, ...pair, joker] };
  const player = createActor('player'); const events = [];
  getScriptHandler('joker').onCooldownEffect(joker, { player, dummy: createActor('dummy'), events, rng: () => 0, t: 5, pieces: [deck, ...same, ...pair, joker, target] });
  assert.equal(player.critResistStacks, 1); assert.equal(target.staminaCost, 7.5); assert.equal(events.at(-1)?.type, 'activate');
}

console.log('OK Goobling source alias, Holo Fire Lizard order, and Joker pair/triplet source paths');
