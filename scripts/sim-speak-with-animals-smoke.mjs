import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpeakwithAnimals.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-aura.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'speak_with_animals');
const petItem = catalog.find((item) => item.id === 'squirrel');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const speakPort = port.slice(port.indexOf("handlerId: 'speak_with_animals'"));
const speakBody = speakPort.slice(0, speakPort.indexOf('/** @type {ScriptHandler} */', 1));

assert.ok(sourceItem && petItem, 'Speak with Animals: extracted catalog fixtures');
assert.equal(inventory.byId.speak_with_animals?.file, 'Exclusive/SpeakwithAnimals.gd');
assert.deepEqual(inventory.byId.speak_with_animals?.overrides, ['doCooldownEffect']);
assert.equal(sourceItem.cost, 5, 'Speak with Animals: catalog cost');
assert.equal(sourceItem.cooldown, 3, 'Speak with Animals: catalog cooldown');
assert.equal(sourceItem.chance, 10, 'Speak with Animals: source trigger chance');
assert.deepEqual(sourceItem.params, { sale: 25, p1: 25 });
assert.match(source, /onready var salesChance: = getP\("sale"\) \/ 100\.0/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Pet\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveDoubleActivationChance\(getChance\(\)\)[\s\S]*activate\(\)/);
assert.match(speakBody, /doubleActivationChance/);
assert.doesNotMatch(speakBody, /doubleAttackEffectChance/);

function makeContext({ chance = sourceItem.chance } = {}) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const speakItem = { ...sourceItem, chance };
  const speak = {
    itemId: 'speak_with_animals',
    placementKey: 'speak',
    name: 'Speak with Animals',
    params: { ...sourceItem.params },
    side: 'you',
    kind: 'skill',
    alive: true,
  };
  const pet = {
    itemId: 'squirrel',
    placementKey: 'pet',
    name: 'Squirrel',
    side: 'you',
    kind: 'pet',
    alive: true,
  };
  const sword = {
    itemId: 'wooden_sword',
    placementKey: 'sword',
    name: 'Wooden Sword',
    side: 'you',
    kind: 'weapon',
    alive: true,
  };
  return {
    t: 1,
    player,
    dummy,
    events,
    rng: () => 0,
    pieces: [speak, pet, sword],
    itemsById: new Map([
      ['speak_with_animals', speakItem],
      ['squirrel', petItem],
      ['wooden_sword', catalog.find((item) => item.id === 'wooden_sword')],
    ]),
    graph: {
      pieces: new Map([
        ['speak', {
          key: 'speak',
          id: 'speak_with_animals',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'primary' },
          ],
        }],
        ['pet', { key: 'pet', id: 'squirrel', cells: ['1,0'], affectCells: [] }],
        ['sword', { key: 'sword', id: 'wooden_sword', cells: ['2,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'speak'],
        ['1,0', 'pet'],
        ['2,0', 'sword'],
      ]),
    },
    canAffect: { rulesById: rules.byId },
  };
}

const handler = getScriptHandler('speak_with_animals');
assert.equal(handler?.handlerId, 'speak_with_animals');

const ctx = makeContext();
handler.onCooldownEffect(ctx.pieces[0], ctx);
assert.equal(ctx.pieces[1].doubleActivationChance, 0.1,
  'Speak with Animals: linked Pet receives source double-activation chance');
assert.equal(ctx.pieces[2].doubleActivationChance || 0, 0,
  'Speak with Animals: non-Pet target is rejected by source canAffect');
const activation = ctx.events.findIndex((event) => event.type === 'activate');
const info = ctx.events.findIndex((event) => event.type === 'info');
assert.ok(activation >= 0 && info > activation,
  'Speak with Animals: aura mutation is complete before activation projection');

const zero = makeContext({ chance: 0 });
handler.onCooldownEffect(zero.pieces[0], zero);
assert.equal(zero.pieces[1].doubleActivationChance || 0, 0,
  'Speak with Animals: explicit zero chance is preserved');

console.log('Speak with Animals source/parity smoke passed.');
