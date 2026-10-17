import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/OwlSpirit.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'owl_spirit');

assert.ok(sourceItem, 'Owl Spirit: extracted catalog row');
assert.match(source, /func onPrepare\(\):[\s\S]*changeAmplificiationChancePercent_allBuffs\(getChance\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getMana\(\) >= manaNeeded[\s\S]*giveMana\(fatigueMana, event\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'owl_spirit'/);
const owlPort = port.match(/export const owlSpiritPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(owlPort, /onPrepare\(piece, ctx\)/);
assert.doesNotMatch(owlPort, /onCombatStart\(piece, ctx\)/,
  'Owl Spirit buff amplification must be prepared before combat starts');
assert.doesNotMatch(owlPort, /Math\.max\(1,\s*Math\.round\(getPName\(piece\.params, 'manat'/,
  'Owl Spirit must not force a one-Mana threshold');
assert.doesNotMatch(owlPort, /Math\.max\(\s*1,\s*Math\.round\(/,
  'Owl Spirit source integer values may be explicitly zero');

const handler = getScriptHandler('owl_spirit');
assert.equal(handler?.handlerId, 'owl_spirit');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const piece = {
    itemId: 'owl_spirit',
    placementKey: 'owl',
    name: 'Owl Spirit',
    kind: 'pet',
    chance: 17,
    params,
    baseCooldown: 3.2,
    cooldown: 3.2,
  };
  const target = {
    itemId: 'mana_orb',
    placementKey: 'target',
    name: 'Mana Orb',
    kind: 'accessory',
    buffAmpChance: 0,
  };
  return {
    t: 0,
    player,
    dummy,
    bus,
    piece,
    target,
    events: [],
    pieces: [piece, target],
    graph: {
      pieces: new Map([
        ['owl', { key: 'owl', id: 'owl_spirit', affectCells: [{ cell: 'target-cell', color: 'primary' }], cells: [] }],
        ['target', { key: 'target', id: 'mana_orb', affectCells: [], cells: ['target-cell'] }],
      ]),
      filled: new Map([['target-cell', 'target']]),
    },
    itemsById: new Map([
      ['owl_spirit', sourceItem],
      ['mana_orb', { id: 'mana_orb', type: 'Accessory', gainsBuffs: true }],
    ]),
    canAffect: {},
  };
}

{
  const ctx = makeContext();
  handler.onPrepare(ctx.piece, ctx);
  assert.equal(ctx.target.buffAmpChance, 17);
  ctx.bus.emit('fatigue_start');
  grantStacks(ctx.player, 'mana', 1, { originId: 'test' });
  handler.onCooldownEffect(ctx.piece, ctx);
  assert.equal(getStackAmount(ctx.player, 'mana'), 8, 'fatigue uses the source fatigueMana value');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'Owl Spirit activates after its mana conversion');
}

{
  const ctx = makeContext({ manat: 0, p1: 0, mana: 0, p2: 0, fatiguemana: 0, p3: 0 });
  handler.onPrepare(ctx.piece, ctx);
  handler.onCooldownEffect(ctx.piece, ctx);
  assert.equal(getStackAmount(ctx.player, 'mana'), 0);
  assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1);
}

console.log('Owl Spirit source/parity smoke passed.');
