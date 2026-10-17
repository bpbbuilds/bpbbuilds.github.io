import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/OilLamp.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'oil_lamp');

assert.ok(sourceItem, 'Oil Lamp: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canBeEmpowered\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveHeat\(getP\("heat"\)\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*addBonusDamage\(bonusDam\)[\s\S]*addAccuracy\(bonusAcc\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'oil_lamp'/);
const lampPort = port.match(/export const oilLampPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(lampPort, /pushActivate\(piece, ctx, 'oil_lamp'/);
const lampCooldown = lampPort.match(/onCooldownEffect\(piece, ctx\)[\s\S]*?\n  \},/u)?.[0] || '';
assert.doesNotMatch(lampCooldown, /pushActivate\(piece, ctx, 'oil_lamp'[\s\S]*?\n    for \(const other/,
  'Oil Lamp cooldown activation must follow its empowerments');

const handler = getScriptHandler('oil_lamp');
assert.equal(handler?.handlerId, 'oil_lamp');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const target = {
    itemId: 'wooden_sword',
    placementKey: 'sword',
    name: 'Wooden Sword',
    kind: 'weapon',
    damageMin: 8,
    damageMax: 10,
    empowerable: true,
    bonusDamage: 0,
    bonusAccuracy: 0,
  };
  const piece = {
    itemId: 'oil_lamp',
    placementKey: 'lamp',
    name: 'Oil Lamp',
    kind: 'accessory',
    params,
    baseCooldown: 3.4,
    cooldown: 3.4,
  };
  return {
    t: 0,
    player,
    dummy,
    piece,
    target,
    pieces: [piece, target],
    events: [],
    graph: {
      pieces: new Map([
        ['lamp', { key: 'lamp', id: 'oil_lamp', affectCells: [{ cell: 'target', color: 'primary' }], cells: [] }],
        ['sword', { key: 'sword', id: 'wooden_sword', affectCells: [], cells: ['target'] }],
      ]),
      filled: new Map([['target', 'sword']]),
    },
    itemsById: new Map([
      ['oil_lamp', sourceItem],
      ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon', damageMin: 8, damageMax: 10 }],
    ]),
    canAffect: {},
  };
}

{
  const ctx = makeContext();
  handler.onCombatStart(ctx.piece, ctx);
  assert.equal(getStackAmount(ctx.player, 'heat'), 2);
  assert.equal(ctx.events.at(-1)?.type, 'activate');
  assert.equal(ctx.events.at(-1)?.itemId, 'oil_lamp');

  handler.onCooldownEffect(ctx.piece, ctx);
  assert.equal(ctx.target.bonusDamage, 1);
  assert.equal(ctx.target.bonusAccuracy, 5);
  const infoIndex = ctx.events.findIndex((event) => event.type === 'info');
  const activationIndex = ctx.events.map((event) => event.type).lastIndexOf('activate');
  assert.ok(infoIndex >= 0);
  assert.ok(activationIndex > infoIndex, 'Oil Lamp activation follows its cooldown effects');
}

{
  const ctx = makeContext({ heat: 0, p1: 0, dam: 0, p2: 0, accuracy: 0, p3: 0 });
  handler.onCombatStart(ctx.piece, ctx);
  handler.onCooldownEffect(ctx.piece, ctx);
  assert.equal(getStackAmount(ctx.player, 'heat'), 0);
  assert.equal(ctx.target.bonusDamage || 0, 0);
  assert.equal(ctx.target.bonusAccuracy || 0, 0);
  assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 2);
}

console.log('Oil Lamp source/parity smoke passed.');
