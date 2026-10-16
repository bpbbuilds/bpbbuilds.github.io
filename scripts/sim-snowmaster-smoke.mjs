import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Snowmaster.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-pets.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const snowmasterPort'),
  handlerSource.indexOf('/** Rat.gd', handlerSource.indexOf('export const snowmasterPort') + 1),
);

assert.equal(inventory.byId.snowmaster?.file, 'Exclusive/Snowmaster.gd');
assert.deepEqual(inventory.byId.snowmaster?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Ice\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* iceSpeed\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getCold\(\) >= coldNeeded[\s\S]*giveEmpower\(empower\)[\s\S]*inflictCold\(cold\)[\s\S]*cleanseRandomDebuffs\(1\)[\s\S]*activate\(\)/);
assert.match(portBlock, /onPrepare/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /Math\.trunc/);
assert.match(portBlock, /cleanseRandomDebuffs/);
assert.match(portBlock, /petActivate/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'coldt'/);

const snowmasterItem = byId.get('snowmaster');
const snowmaster = {
  ...snowmasterItem,
  itemId: 'snowmaster',
  placementKey: 'snowmaster',
  name: 'Snowmaster',
  params: { cold: 1.9, p1: 1.9, coldt: 2.9, p2: 2.9, empower: 1.9, p3: 1.9, speed: 10, p4: 10 },
  kind: 'pet',
  baseCooldown: snowmasterItem.cooldown,
  cooldown: snowmasterItem.cooldown,
};
const iceFlower = { ...byId.get('ice_flower'), itemId: 'ice_flower', placementKey: 'ice-flower', kind: 'accessory' };
const frozenFlame = { ...byId.get('frozen_flame'), itemId: 'frozen_flame', placementKey: 'frozen-flame', kind: 'accessory' };
const weapon = { ...byId.get('wooden_sword'), itemId: 'wooden_sword', placementKey: 'weapon', kind: 'weapon' };
const graph = {
  pieces: new Map([
    ['snowmaster', { key: 'snowmaster', id: 'snowmaster', cells: [], affectCells: [
      { cell: 'ice-flower-link', color: 'primary' },
      { cell: 'frozen-flame-link', color: 'primary' },
      { cell: 'weapon-link', color: 'primary' },
    ] }],
    ['ice-flower', { key: 'ice-flower', id: 'ice_flower', cells: [], affectCells: [] }],
    ['frozen-flame', { key: 'frozen-flame', id: 'frozen_flame', cells: [], affectCells: [] }],
    ['weapon', { key: 'weapon', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['ice-flower-link', 'ice-flower'],
    ['frozen-flame-link', 'frozen-flame'],
    ['weapon-link', 'weapon'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [snowmaster, iceFlower, frozenFlame, weapon],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('snowmaster');

assert.equal(handler?.handlerId, 'snowmaster');
handler.onPrepare(snowmaster, ctx);
assert.equal(snowmaster.speedScale, 0.2, 'only linked Ice items contribute source preparation speed');
player.stacks.blind = 1;
dummy.stacks.cold = 0;
handler.onCooldownEffect(snowmaster, ctx);
assert.equal(dummy.stacks.cold, 1, 'below threshold applies truncated Cold');
assert.equal(player.stacks.empower, 0, 'below threshold does not grant Empower');
assert.equal(player.stacks.blind, 0, 'cooldown cleanses one player debuff');
assert.equal(events.at(-1)?.type, 'activate', 'activation follows Cold and cleanse');

const thresholdEvents = [];
dummy.stacks.cold = 2;
handler.onCooldownEffect(snowmaster, { ...ctx, events: thresholdEvents });
assert.equal(player.stacks.empower, 1, 'threshold branch grants truncated Empower');
assert.equal(dummy.stacks.cold, 2, 'threshold branch does not add Cold');
assert.equal(thresholdEvents.at(-1)?.type, 'activate', 'threshold activation remains last');

console.log('OK Snowmaster source, Ice-only preparation speed, threshold branch, integer parameters, cleanse, Cold fallback, and activation ordering regression');
