import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/ShinyShell.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-wave-b-heal.js',
  'utf8',
);
const shellPort = port.slice(
  port.indexOf('export const shinyShellPort'),
  port.indexOf('/** SpellScrollLight.gd', port.indexOf('export const shinyShellPort')),
);

assert.match(source, /extends Item/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(
  source,
  /func doCooldownEffect\(\):[\s\S]*getP_m\("heal"\)[\s\S]*getNumAffectedItems\(\) \* getP_m\("heal_bonus"\)[\s\S]*heal\(healAmount\)[\s\S]*onAfterEffectFinished\(\)/,
);
assert.match(shellPort, /handlerId: 'shiny_shell'/);
assert.match(shellPort, /countLinkedType\(ctx, piece, 'holy'\)/);
assert.match(shellPort, /afterEffectFinished\(piece, ctx, 'shiny_shell'/);
assert.doesNotMatch(shellPort, /markFoodConsumed/);
assert.ok(
  shellPort.indexOf('events.push({') < shellPort.indexOf("afterEffectFinished(piece, ctx, 'shiny_shell'"),
  'Shiny Shell records the heal before source effect finalization',
);

const shell = {
  ...byId.get('shiny_shell'),
  itemId: 'shiny_shell',
  placementKey: 'shell',
  name: 'Shiny Shell',
  kind: 'accessory',
  params: { heal: 5, p1: 8, heal_bonus: 3, p2: 2 },
  paramAdd: { heal: 1 },
  paramMult: { heal_bonus: 2 },
  alive: true,
};
const holy = {
  itemId: 'holy_target',
  placementKey: 'holy',
  name: 'Holy Target',
  type: 'Armor',
  extraTypes: ['Holy'],
};
const nature = {
  itemId: 'nature_target',
  placementKey: 'nature',
  name: 'Nature Target',
  type: 'Accessory',
  extraTypes: ['Nature'],
};
const itemsById = new Map([
  ['shiny_shell', shell],
  ['holy_target', holy],
  ['nature_target', nature],
]);
const graph = {
  pieces: new Map([
    ['shell', { key: 'shell', id: 'shiny_shell', cells: ['0,0'], affectCells: [] }],
    ['holy', { key: 'holy', id: 'holy_target', cells: ['1,0'], affectCells: [] }],
    ['nature', { key: 'nature', id: 'nature_target', cells: ['0,1'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'shell'],
    ['1,0', 'holy'],
    ['0,1', 'nature'],
  ]),
};
const player = createActor('player');
player.hp = 100;
const events = [];
const handler = getScriptHandler('shiny_shell');
const ctx = {
  player,
  events,
  t: 7,
  graph,
  itemsById,
  canAffect: null,
  pieces: [shell, holy, nature],
};

assert.equal(handler?.handlerId, 'shiny_shell');
handler.onCooldownEffect(shell, ctx);

assert.equal(player.hp, 112, 'modified named heal + one affected Holy item uses source formula');
assert.equal(events.find((event) => event.type === 'heal')?.amount, 12);
assert.equal(events.at(-1)?.type, 'activate', 'source activation occurs after the heal');
assert.equal(events.at(-1)?.itemId, 'shiny_shell');
assert.equal(shell.alive, false, 'source onAfterEffectFinished consumes the shell');
assert.equal(shell.cooldown, 999, 'source effect finalization locks the shell cooldown');

console.log('OK Shiny Shell source and handler regression');
