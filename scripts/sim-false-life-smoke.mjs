import assert from 'node:assert/strict';
import fs from 'node:fs';

import rules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FalseLife.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Dark\)/);
assert.match(source, /func canAffect_global\(item\):[\s\S]*item\.descriptor\.hasParam\("maxhealth"\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeMaxHealthGain\(maxHealthAmp\)/);
assert.match(source, /onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_overhealed", "onOverheal"\)/);
assert.match(source, /getP_m\("heal"\) \+ getP_m\("heal_dark"\) \* getNumAffectedItems\(\)/);
assert.match(source, /heal\(healAmount\)[\s\S]*activate\(\)/);
assert.match(source, /func onOverheal\(overheal, healEvent\):[\s\S]*giveMaxHealth\(overheal, healEvent\)/);

const handler = getScriptHandler('false_life');
assert.equal(handler?.handlerId, 'false_life');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');
assert.equal(handler?.onCombatStart, undefined, 'False Life is preparation-time, not combat-start');

const sourcePiece = {
  itemId: 'false_life',
  placementKey: 'false',
  name: 'False Life',
  side: 'you',
  params: { healthamp: 20, heal: 5, heal_dark: 4, p1: 5, p2: 4 },
  paramAdd: { heal: 1, heal_dark: 1 },
  paramMult: { heal: 2, heal_dark: 0.5 },
};
const darkTarget = {
  itemId: 'dark_target',
  placementKey: 'dark',
  name: 'Dark Target',
};
const lightTarget = {
  itemId: 'light_target',
  placementKey: 'light',
  name: 'Light Target',
};
const directItems = new Map([
  ['false_life', { id: 'false_life', type: 'Skill', extraTypes: [] }],
  ['dark_target', { id: 'dark_target', type: 'Skill', extraTypes: ['Dark'] }],
  ['light_target', { id: 'light_target', type: 'Skill', extraTypes: ['Holy'] }],
]);
const directGraph = {
  pieces: new Map([
    ['false', { key: 'false', id: 'false_life', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['dark', { key: 'dark', id: 'dark_target', cells: ['1,0'], affectCells: [] }],
    ['light', { key: 'light', id: 'light_target', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'false'],
    ['1,0', 'dark'],
    ['2,0', 'light'],
  ]),
};
const directPlayer = createActor('player', { maxHp: 100 });
directPlayer._simT = 2.5;
const directCtx = {
  t: 2.5,
  player: directPlayer,
  events: [],
  pieces: [sourcePiece, darkTarget, lightTarget],
  graph: directGraph,
  itemsById: directItems,
  canAffect: { rulesById: rules.byId },
};
handler.onPrepare(sourcePiece, directCtx);
assert.equal(directPlayer._maxHealthGain, 0.2, 'preparation applies the source max-health gain');
assert.equal(directPlayer._overhealToMaxHp, true, 'preparation connects the overheal-to-max-health listener');

handler.onCooldownEffect(sourcePiece, directCtx);
const directHeal = directCtx.events.find((event) => event.type === 'heal');
const directActivateIndex = directCtx.events.findIndex((event) => event.type === 'activate');
const directHealIndex = directCtx.events.findIndex((event) => event.type === 'heal');
assert.ok(directHeal, 'False Life emits its heal event');
assert.equal(directHeal.meta?.requestedHealAmount, 14.5, 'modified heal params keep fractional source math before Character.heal rounds');
assert.equal(directHeal.amount, 15, 'Character.heal rounds the final heal amount');
assert.ok(directHealIndex < directActivateIndex, 'source heals before activate()');
assert.equal(directPlayer.maxHp, 118, 'overheal uses the accumulated 20% max-health gain');

const zeroPiece = {
  ...sourcePiece,
  params: { healthamp: 0, heal: 0, heal_dark: 0, p1: 0, p2: 0 },
  paramAdd: undefined,
  paramMult: undefined,
};
const zeroPlayer = createActor('player', { maxHp: 100 });
zeroPlayer._simT = 2.5;
const zeroCtx = {
  ...directCtx,
  player: zeroPlayer,
  pieces: [zeroPiece, darkTarget],
  events: [],
};
handler.onPrepare(zeroPiece, zeroCtx);
handler.onCooldownEffect(zeroPiece, zeroCtx);
const zeroHeal = zeroCtx.events.find((event) => event.type === 'heal');
assert.ok(zeroHeal, 'zero-valued source heal still produces its source heal event');
assert.equal(zeroHeal.amount, 0, 'zero source heal is not forced to one');
assert.equal(zeroHeal.meta?.requestedHealAmount, 0, 'zero source heal remains zero');

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const falseLife = catalog.find((item) => item.id === 'false_life');
assert.ok(falseLife, 'False Life remains in the simulator catalog');
const run = simulateEngine({
  placements: [{ id: 'false_life', key: 'false', x: 4, y: 4, r: 0 }],
  itemsById: new Map([['false_life', falseLife]]),
  canAffect: { rulesById: rules.byId },
  durationSec: 10,
  playerMaxHp: 100,
  dummyAttacks: false,
});
const itemEvents = run.events.filter((event) => event.itemId === 'false_life');
const engineHealIndex = run.events.findIndex((event) => event.itemId === 'false_life' && event.type === 'heal');
const engineActivateIndex = run.events.findIndex((event) => event.itemId === 'false_life' && event.type === 'activate');
assert.equal(itemEvents.filter((event) => event.type === 'heal').length, 1, 'engine executes one False Life heal');
assert.equal(run.playerMaxHp, 112, 'engine applies 10 overheal × 1.2 as temporary max health');
assert.ok(engineHealIndex < engineActivateIndex, 'engine preserves heal-before-activation order');

console.log('OK False Life source and overheal regression');
