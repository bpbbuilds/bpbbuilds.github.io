import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { BUFF_KEYS } from '../js/pages/sim/engine/buff-economy.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/RainbowOrb.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-mana.js', 'utf8');
const orbPort = port.slice(
  port.indexOf('export const rainbowOrbPort'),
  port.indexOf('/** @type {ScriptHandler} */', port.indexOf('export const rainbowOrbPort') + 1),
);

assert.equal(inventory.byId.rainbow_orb?.file, 'Exclusive/RainbowOrb.gd');
assert.match(source, /extends Item/);
assert.match(
  source,
  /hasType\(Type\.Vampiric\)[\s\S]*hasType\(Type\.Magic\)[\s\S]*hasType\(Type\.Holy\)[\s\S]*hasType\(Type\.Dark\)/,
);
assert.match(
  source,
  /typesDict\[Type\.Vampiric\][\s\S]*giveVampirism[\s\S]*typesDict\[Type\.Magic\][\s\S]*giveMana[\s\S]*typesDict\[Type\.Holy\][\s\S]*addHealingEfficiency[\s\S]*typesDict\[Type\.Dark\][\s\S]*inflictRandomDebuffs[\s\S]*activate\(\)/,
);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveAllBuffs\(\)[\s\S]*activate\(\)/);
assert.match(orbPort, /let holy = 0/);
assert.match(orbPort, /itemHasType\(item, 'holy'\)/);
assert.match(orbPort, /applyHealEfficiency\(player, \(holy \* healAmpPer\) \/ 100, ctx, piece\)/);
assert.match(orbPort, /getPName\(piece\.params, 'mana', getP3\(piece\.params, 0\)\)/);
assert.match(orbPort, /getPName\(piece\.params, 'healamp', getP4\(piece\.params, 0\)\)/);
assert.match(orbPort, /pushActivate\(piece, ctx, 'rainbow_orb'/);
assert(
  orbPort.indexOf('pushBuffGrants(events, piece, player, t, \'rainbow_orb\', picked)') <
    orbPort.indexOf("pushActivate(piece, ctx, 'rainbow_orb'"),
  'cooldown buffs are applied before Rainbow Orb activation',
);

function piece(id, overrides = {}) {
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

function typedProbe(id, type, cell) {
  const item = {
    id,
    name: id,
    type: 'Accessory',
    extraTypes: [type],
    shape: [[1]],
  };
  byId.set(id, item);
  return { ...item, itemId: id, placementKey: id, cells: [cell], alive: true };
}

const orb = piece('rainbow_orb', {
  placementKey: 'orb',
  cells: ['orb-cell'],
  alive: true,
});
const vampiric = typedProbe('probe-vampiric', 'Vampiric', 'vamp-cell');
const magic = typedProbe('probe-magic', 'Magic', 'magic-cell');
const holy = typedProbe('probe-holy', 'Holy', 'holy-cell');
const dark = typedProbe('probe-dark', 'Dark', 'dark-cell');
const unrelated = typedProbe('probe-food', 'Food', 'food-cell');
const targetPieces = [orb, vampiric, magic, holy, dark, unrelated];
const graph = {
  pieces: new Map([
    ['orb', {
      key: 'orb',
      id: 'rainbow_orb',
      cells: orb.cells,
      affectCells: [
        { cell: 'vamp-cell', color: 'primary' },
        { cell: 'magic-cell', color: 'primary' },
        { cell: 'holy-cell', color: 'primary' },
        { cell: 'dark-cell', color: 'primary' },
        { cell: 'food-cell', color: 'primary' },
      ],
    }],
    [vampiric.placementKey, { key: vampiric.placementKey, id: vampiric.itemId, cells: vampiric.cells, affectCells: [] }],
    [magic.placementKey, { key: magic.placementKey, id: magic.itemId, cells: magic.cells, affectCells: [] }],
    [holy.placementKey, { key: holy.placementKey, id: holy.itemId, cells: holy.cells, affectCells: [] }],
    [dark.placementKey, { key: dark.placementKey, id: dark.itemId, cells: dark.cells, affectCells: [] }],
    [unrelated.placementKey, { key: unrelated.placementKey, id: unrelated.itemId, cells: unrelated.cells, affectCells: [] }],
  ]),
  filled: new Map([
    ['vamp-cell', vampiric.placementKey],
    ['magic-cell', magic.placementKey],
    ['holy-cell', holy.placementKey],
    ['dark-cell', dark.placementKey],
    ['food-cell', unrelated.placementKey],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const handler = getScriptHandler('rainbow_orb');
const ctx = {
  player,
  dummy,
  pieces: targetPieces,
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 9,
  rng: () => 0,
};

assert.equal(handler?.handlerId, 'rainbow_orb');
handler.onCombatStart(orb, ctx);
assert.equal(player.stacks.vampirism, 1, 'one Vampiric target grants one Vampirism');
assert.equal(player.stacks.mana, 2, 'one Magic target grants the named Mana amount');
assert.equal(player._healAmp, 0.04, 'one Holy target grants the named healing efficiency');
assert.equal(dummy.stacks.poison, 1, 'one Dark target inflicts one random debuff');
assert.equal(events.at(-1)?.type, 'activate', 'combat-start effects finish before activation');
assert.equal(events.at(-1)?.itemId, 'rainbow_orb');

const cooldownPlayer = createActor('player');
const cooldownDummy = createActor('dummy');
const cooldownEvents = [];
const cooldownCtx = { ...ctx, player: cooldownPlayer, dummy: cooldownDummy, events: cooldownEvents };
assert.equal(handler.onCooldownEffect(orb, cooldownCtx), true);
for (const key of BUFF_KEYS) {
  assert.equal(cooldownPlayer.stacks[key], 1, `cooldown gives one ${key}`);
}
assert.equal(cooldownEvents.at(-1)?.type, 'activate', 'cooldown buffs finish before activation');
assert.equal(cooldownEvents.at(-1)?.itemId, 'rainbow_orb');

const sparseOrb = { ...orb, params: {} };
const sparsePlayer = createActor('player');
const sparseDummy = createActor('dummy');
const sparseEvents = [];
const sparseCtx = {
  ...ctx,
  player: sparsePlayer,
  dummy: sparseDummy,
  pieces: [sparseOrb, vampiric, magic, holy, dark, unrelated],
  events: sparseEvents,
};
handler.onCombatStart(sparseOrb, sparseCtx);
assert.equal(Number(sparsePlayer.stacks.vampirism) || 0, 0, 'missing Vampirism parameter does not invent a grant');
assert.equal(Number(sparsePlayer.stacks.mana) || 0, 0, 'missing Mana parameter does not invent a grant');
assert.equal(Number(sparsePlayer._healAmp) || 0, 0, 'missing healing-efficiency parameter does not invent a grant');
assert.equal(Number(sparseDummy.stacks.poison) || 0, 0, 'missing debuff parameter does not invent a debuff');
assert.equal(sparseEvents.at(-1)?.type, 'activate', 'zero-effect source still activates');

console.log('OK Rainbow Orb source and handler regression');
