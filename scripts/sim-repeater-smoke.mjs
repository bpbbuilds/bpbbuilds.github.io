import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/Repeater.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-wave-d-board.js',
  'utf8',
);
const repeaterPort = port.slice(
  port.indexOf('export const repeaterPort'),
  port.indexOf('/** SlimeTime.gd', port.indexOf('export const repeaterPort')),
);

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasStartofBattle\(\)/);
assert.match(
  source,
  /func doCooldownEffect\(\):[\s\S]*getAffectedItems\(\)[\s\S]*item\.repeatCombatStart\(\)[\s\S]*onAfterEffectFinished\(\)/,
);
assert.match(repeaterPort, /runCardInheritedHook/);
assert.match(repeaterPort, /runWeaponInheritedHook/);
assert.match(repeaterPort, /h\.onPreCombatStart/);
assert.match(repeaterPort, /h\.onPostCombatStart/);
assert.match(repeaterPort, /afterEffectFinished\(piece, ctx, 'repeater'/);
assert(
  repeaterPort.indexOf("afterEffectFinished(piece, ctx, 'repeater'") >
    repeaterPort.indexOf('for (const other of ctx.pieces || [])'),
  'Repeater finishes after all repeated combat-start effects',
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
    alive: true,
  };
}

const repeater = item('repeater', {
  placementKey: 'repeater-piece',
  cells: ['amulet-cell', 'sword-cell'],
});
const amulet = item('amulet_of_agility', {
  placementKey: 'amulet',
  cells: ['amulet-cell'],
  kind: 'gadget',
  cooldown: 4,
});
const sword = item('wooden_sword', {
  placementKey: 'sword',
  cells: ['sword-cell'],
  kind: 'weapon',
});
const graph = {
  pieces: new Map([
    ['repeater-piece', {
      key: 'repeater-piece',
      id: 'repeater',
      cells: repeater.cells,
      affectCells: [
        { cell: 'amulet-cell', color: 'primary' },
        { cell: 'sword-cell', color: 'primary' },
      ],
    }],
    ['amulet', { key: 'amulet', id: 'amulet_of_agility', cells: amulet.cells, affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: sword.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['amulet-cell', 'amulet'],
    ['sword-cell', 'sword'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [repeater, amulet, sword],
  graph,
  itemsById: byId,
  canAffect: {},
  events,
  t: 7,
};
const handler = getScriptHandler('repeater');
assert.equal(handler?.handlerId, 'repeater');

handler.onCooldownEffect(repeater, ctx);
assert.equal(Object.keys(amulet._usedStacks || {}).length > 0, true, 'repeatCombatStart runs the target pre-combat hook');
assert.equal(repeater.alive, false, 'source onAfterEffectFinished consumes Repeater');
assert.equal(repeater.cooldown, 999, 'source onAfterEffectFinished deactivates Repeater');
assert.equal(events.filter((event) => event.itemId === 'repeater' && event.type === 'activate').length, 1);
assert.equal(events.at(-1)?.itemId, 'repeater', 'Repeater activates after repeated start effects');
assert.equal(events.at(-1)?.label, 'Accessory: Repeater');
assert.equal(
  events.find((event) => event.meta?.handler === 'repeater' && event.type === 'info')?.label,
  'Repeater: repeated start ×1',
  'only the start-of-battle target is repeated',
);

console.log('OK Repeater source and handler regression');
