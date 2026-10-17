import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Scale.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-mana.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'scale');
const targetA = catalog.find((item) => item.id === 'wooden_sword');
const targetB = catalog.find((item) => item.id === 'leather_armor');
const scalePort = port.slice(port.indexOf("handlerId: 'scale'"));
const scaleBody = scalePort.slice(0, scalePort.indexOf('/** SpintoWin.gd'));

assert.ok(sourceItem, 'Scale: extracted catalog row');
assert.ok(targetA && targetB, 'Scale: target catalog fixtures');
assert.equal(inventory.byId.scale?.file, 'Exclusive/Scale.gd');
assert.deepEqual(inventory.byId.scale?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.equal(sourceItem.cost, 10, 'Scale: catalog cost');
assert.equal(sourceItem.cooldown, 2.8, 'Scale: catalog cooldown');
assert.deepEqual(sourceItem.params, {
  mana: 4,
  p1: 4,
  regen: 3,
  p2: 3,
  speed: 2,
  p3: 2,
  gold: 5,
  p4: 5,
  speed2: 30,
  p5: 30,
});
assert.match(source, /onready var regen: = int\(getP\("regen"\)\)/);
assert.match(source, /onready var mana: = int\(getP\("mana"\)\)/);
assert.match(source, /onready var maxGoldDif: = int\(getP\("gold"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(speedPerGold \* min\(c1, c2\)\)[\s\S]*abs\(c1 - c2\) <= maxGoldDif/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveMana\(mana\)[\s\S]*giveRegeneration\(regen\)[\s\S]*activate\(\)/);
assert.match(scaleBody, /Math\.trunc/);
assert.doesNotMatch(scaleBody, /Math\.max\(1, Math\.round\(getPName\(piece\.params, '(?:mana|regen|gold)'/);

function makeContext({ params = sourceItem.params, costs = [6, 4] } = {}) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const scale = {
    itemId: 'scale',
    placementKey: 'scale',
    name: 'Scale',
    params: { ...params },
    side: 'you',
    kind: 'accessory',
    alive: true,
    cooldown: sourceItem.cooldown,
    baseCooldown: sourceItem.cooldown,
  };
  const primary = {
    itemId: 'primary-target',
    placementKey: 'primary',
    name: 'Primary Target',
    side: 'you',
    kind: 'weapon',
    alive: true,
  };
  const secondary = {
    itemId: 'secondary-target',
    placementKey: 'secondary',
    name: 'Secondary Target',
    side: 'you',
    kind: 'armor',
    alive: true,
  };
  const itemsById = new Map([
    ['scale', sourceItem],
    ['primary-target', { ...targetA, id: 'primary-target', cost: costs[0] }],
    ['secondary-target', { ...targetB, id: 'secondary-target', cost: costs[1] }],
  ]);
  return {
    t: 1,
    player,
    dummy,
    events,
    rng: () => 0,
    pieces: [scale, primary, secondary],
    itemsById,
    graph: {
      pieces: new Map([
        ['scale', {
          key: 'scale',
          id: 'scale',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'secondary' },
          ],
        }],
        ['primary', { key: 'primary', id: 'primary-target', cells: ['1,0'], affectCells: [] }],
        ['secondary', { key: 'secondary', id: 'secondary-target', cells: ['2,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'scale'],
        ['1,0', 'primary'],
        ['2,0', 'secondary'],
      ]),
    },
    canAffect: {},
  };
}

const handler = getScriptHandler('scale');
assert.equal(handler?.handlerId, 'scale');

const balanced = makeContext({ params: { speed: 2.5, p3: 2.5, gold: 5, p4: 5, speed2: 30, p5: 30 } });
handler.onPrepare(balanced.pieces[0], balanced);
assert.equal(balanced.pieces[0].speedScale, 0.1,
  'Scale: source speed-per-gold applies to the lower linked gold total');
assert.equal(balanced.pieces[1].speedScale, 0.3,
  'Scale: balanced primary target receives equilibrium speed');
assert.equal(balanced.pieces[2].speedScale, 0.3,
  'Scale: balanced secondary target receives equilibrium speed');
assert.equal(balanced.pieces[0]._scaleState, 'base', 'Scale: balanced visual state');

const fractionalThreshold = makeContext({
  params: { speed: 0, p3: 0, gold: 0.9, p4: 0.9, speed2: 30, p5: 30 },
  costs: [6, 5],
});
handler.onPrepare(fractionalThreshold.pieces[0], fractionalThreshold);
assert.equal(fractionalThreshold.pieces[0]._scaleState, 'left',
  'Scale: source int(gold) truncates a fractional threshold to zero');
assert.equal(fractionalThreshold.pieces[1].speedScale || 0, 0,
  'Scale: no equilibrium speed when the truncated threshold is exceeded');

const negativeThreshold = makeContext({
  params: { speed: 0, p3: 0, gold: -1, p4: -1, speed2: 30, p5: 30 },
  costs: [6, 6],
});
handler.onPrepare(negativeThreshold.pieces[0], negativeThreshold);
assert.equal(negativeThreshold.pieces[0]._scaleState, 'right',
  'Scale: explicit negative int(gold) is not clamped to zero');

const cooldown = makeContext();
cooldown.player.stacks.mana = 2;
cooldown.player.stacks.regeneration = 5;
bindBuffCombatLog({ events: cooldown.events, getT: () => cooldown.t, dummy: cooldown.dummy });
handler.onCooldownEffect(cooldown.pieces[0], cooldown);
unbindBuffCombatLog();
assert.equal(cooldown.player.stacks.mana, 6, 'Scale: lower Mana resource receives source Mana amount');
assert.equal(cooldown.player.stacks.regeneration, 5, 'Scale: higher Regeneration resource is unchanged');
const manaGrant = cooldown.events.findIndex((event) => event.type === 'buff' && event.meta?.stack === 'mana');
const activation = cooldown.events.findIndex((event) => event.type === 'activate');
assert.ok(manaGrant >= 0 && activation > manaGrant,
  'Scale: activation follows the selected resource grant');

const tie = makeContext();
tie.player.stacks.mana = 4;
tie.player.stacks.regeneration = 4;
tie.rng = () => 0.9;
handler.onCooldownEffect(tie.pieces[0], tie);
assert.equal(tie.player.stacks.regeneration, 7, 'Scale: tied resources use the source random branch');
assert.equal(tie.player.stacks.mana, 4, 'Scale: tied branch does not also grant Mana');

const zero = makeContext({ params: { mana: 0, p1: 0, regen: 0, p2: 0, speed: 0, p3: 0, gold: 0, p4: 0, speed2: 0, p5: 0 } });
zero.player.stacks.mana = 3;
zero.player.stacks.regeneration = 5;
handler.onCooldownEffect(zero.pieces[0], zero);
assert.equal(zero.player.stacks.mana, 3, 'Scale: explicit zero Mana is preserved');
assert.equal(zero.player.stacks.regeneration, 5, 'Scale: explicit zero Regeneration is preserved');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 1,
  'Scale: explicit zero grants still activate');

console.log('Scale source/parity smoke passed.');
