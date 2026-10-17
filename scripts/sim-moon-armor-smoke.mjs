import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MoonArmor.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-mana.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'moon_armor');
const magicItem = catalog.find((item) => item.id === 'magic_staff');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const moonPort = port.slice(port.indexOf("handlerId: 'moon_armor'"));
const moonBody = moonPort.slice(0, moonPort.indexOf('/** Scale.gd'));

assert.ok(sourceItem, 'Moon Armor: extracted catalog row');
assert.ok(magicItem, 'Moon Armor: Magic target fixture');
assert.match(source, /onready var mana: int = getP\("mana"\)/);
assert.match(source, /onready var reflect: int = getP\("reflect"\)/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Magic\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveBlock\(getBlock\(\) \+ getP1\(\) \* getNumAffectedItems\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveMana\(mana\)[\s\S]*giveReflectStacks\(reflect\)[\s\S]*activate\(\)/);
assert.match(moonPort, /handlerId: 'moon_armor'/);
assert.match(moonPort, /grantStacks\(ctx\.player, 'block', block, origin\(piece\)\)/);
assert.match(moonPort, /const mana = Math\.trunc\(getPName\(piece\.params, 'mana'/);
assert.match(moonPort, /const reflect = Math\.trunc\(getPName\(piece\.params, 'reflect'/);
assert.doesNotMatch(moonBody, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'mana'/);

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  player._combatBus = bus;
  dummy._combatBus = bus;
  const armor = {
    itemId: 'moon_armor',
    placementKey: 'armor',
    name: 'Moon Armor',
    params: { ...params },
    side: 'you',
    kind: 'armor',
    alive: true,
    blockGrant: sourceItem.block,
    cooldown: sourceItem.cooldown,
    baseCooldown: sourceItem.cooldown,
  };
  const magic = {
    itemId: 'magic_staff',
    placementKey: 'magic',
    name: 'Magic Staff',
    side: 'you',
    kind: 'weapon',
    alive: true,
  };
  return {
    t: 1,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [armor, magic],
    itemsById: new Map([
      ['moon_armor', sourceItem],
      ['magic_staff', magicItem],
    ]),
    graph: {
      pieces: new Map([
        ['armor', {
          key: 'armor',
          id: 'moon_armor',
          cells: ['0,0'],
          affectCells: [{ cell: '1,0', color: 'primary' }],
        }],
        ['magic', { key: 'magic', id: 'magic_staff', cells: ['1,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'armor'],
        ['1,0', 'magic'],
      ]),
    },
    canAffect: { rulesById: rules.byId },
  };
}

const handler = getScriptHandler('moon_armor');
assert.equal(handler?.handlerId, 'moon_armor');

const ctx = makeContext();
bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
handler.onCombatStart(ctx.pieces[0], ctx);
assert.equal(ctx.player.block, 70,
  'Moon Armor: combat start gives base Block plus P1 per affected Magic item');
const startActivate = ctx.events.findIndex((event) => event.type === 'activate');
assert.ok(startActivate >= 0, 'Moon Armor: combat-start activation is projected');
handler.onCooldownEffect(ctx.pieces[0], ctx);
assert.equal(ctx.player.stacks.mana, 3, 'Moon Armor: cooldown gives exact Mana');
assert.equal(ctx.player.debuffReflectStacks, 2, 'Moon Armor: cooldown gives exact Reflect stacks');
const manaGrant = ctx.events.findIndex((event) => event.meta?.stack === 'mana');
const cooldownActivate = ctx.events.findIndex((event, index) => index > startActivate && event.type === 'activate');
assert.ok(cooldownActivate > manaGrant, 'Moon Armor: cooldown activation follows Mana/Reflect effects');
unbindBuffCombatLog();

const zero = makeContext({ p1: 0, mana: 0, p2: 0, reflect: 0, p3: 0 });
bindBuffCombatLog({ events: zero.events, getT: () => zero.t, dummy: zero.dummy });
handler.onCombatStart(zero.pieces[0], zero);
handler.onCooldownEffect(zero.pieces[0], zero);
assert.equal(zero.player.block, 50, 'Moon Armor: zero P1 adds no affected-item Block');
assert.equal(zero.player.stacks.mana || 0, 0, 'Moon Armor: explicit zero Mana is preserved');
assert.equal(zero.player.debuffReflectStacks || 0, 0,
  'Moon Armor: explicit zero Reflect is preserved');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 2,
  'Moon Armor: zero values do not suppress either source activation');
unbindBuffCombatLog();

console.log('Moon Armor source/parity smoke passed.');
