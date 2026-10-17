import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MushroomFarm.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-aura.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mushroom_farm');
const flyItem = catalog.find((item) => item.id === 'fly_agaric');
const doomItem = catalog.find((item) => item.id === 'doom_cap');

assert.ok(sourceItem, 'Mushroom Farm: extracted catalog row');
assert.ok(flyItem, 'Mushroom Farm: Fly Agaric fixture');
assert.ok(doomItem, 'Mushroom Farm: Doom Cap fixture');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.isA\(flyAgaricDescriptor\)[\s\S]*item\.isA\(doomCapDescriptor\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*for mushroom in getAffectedItems\(\):[\s\S]*mushroom\.addSpeed\(mushroomSpeed\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'mushroom_farm'/);
const farmPort = port.match(/export const mushroomFarmPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(farmPort, /id === 'fly_agaric'[\s\S]*id === 'doom_cap'/);
assert.match(farmPort, /pushActivate\(piece, ctx, 'mushroom_farm'/);
assert.doesNotMatch(farmPort, /itemHasType\(item, 'mushroom'\)/,
  'Mushroom Farm: source affects the two exact mushroom item descriptors');

const handler = getScriptHandler('mushroom_farm');
assert.equal(handler?.handlerId, 'mushroom_farm');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  const farm = {
    itemId: 'mushroom_farm',
    placementKey: 'farm',
    name: 'Mushroom Farm',
    params: { ...params },
    side: 'you',
    kind: 'skill',
    alive: true,
    speedScale: 0,
  };
  const fly = {
    itemId: 'fly_agaric',
    placementKey: 'fly',
    name: 'Fly Agaric',
    side: 'you',
    kind: 'potion',
    alive: true,
    speedScale: 0,
  };
  const doom = {
    itemId: 'doom_cap',
    placementKey: 'doom',
    name: 'Doom Cap',
    side: 'you',
    kind: 'skill',
    alive: true,
    speedScale: 0,
  };
  const other = {
    itemId: 'fixture_mushroom_tag',
    placementKey: 'other',
    name: 'Other Mushroom Tag',
    side: 'you',
    kind: 'accessory',
    alive: true,
    speedScale: 0,
  };
  return {
    t: 0,
    player,
    dummy,
    bus,
    events,
    pieces: [farm, fly, doom, other],
    itemsById: new Map([
      ['mushroom_farm', sourceItem],
      ['fly_agaric', flyItem],
      ['doom_cap', doomItem],
      ['fixture_mushroom_tag', { id: 'fixture_mushroom_tag', type: 'Mushroom Accessory' }],
    ]),
    graph: {
      pieces: new Map([
        ['farm', {
          key: 'farm',
          id: 'mushroom_farm',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'primary' },
            { cell: '3,0', color: 'primary' },
          ],
        }],
        ['fly', { key: 'fly', id: 'fly_agaric', cells: ['1,0'], affectCells: [] }],
        ['doom', { key: 'doom', id: 'doom_cap', cells: ['2,0'], affectCells: [] }],
        ['other', { key: 'other', id: 'fixture_mushroom_tag', cells: ['3,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'farm'],
        ['1,0', 'fly'],
        ['2,0', 'doom'],
        ['3,0', 'other'],
      ]),
    },
    canAffect: null,
  };
}

const ctx = makeContext();
handler.onCombatStart(ctx.pieces[0], ctx);
assert.equal(ctx.pieces[1].speedScale, 0.5,
  'Mushroom Farm: Fly Agaric receives the exact source speed');
assert.equal(ctx.pieces[2].speedScale, 0.5,
  'Mushroom Farm: Doom Cap receives the exact source speed');
assert.equal(ctx.pieces[3].speedScale, 0,
  'Mushroom Farm: other mushroom-tagged items are not source targets');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1,
  'Mushroom Farm: combat-start activation is projected once');

const zero = makeContext({ speed: 0, p1: 0 });
handler.onCombatStart(zero.pieces[0], zero);
assert.equal(zero.pieces[1].speedScale, 0, 'Mushroom Farm: explicit zero speed is preserved');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 1,
  'Mushroom Farm: zero speed does not suppress source activation');

console.log('Mushroom Farm source/parity smoke passed.');
