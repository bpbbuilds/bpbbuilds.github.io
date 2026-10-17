import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/LightningPotion.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const itemsById = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = itemsById.get('lightning_potion');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));

assert.equal(inventory.byId.lightning_potion?.file, 'Exclusive/LightningPotion.gd');
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(source, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*descriptor\.minDam[\s\S]*dealEffectDamage\(dam\)[\s\S]*blind[\s\S]*getP_m\("dur_blind"\)[\s\S]*getP_m\("heal"\) \* getNumAffectedItems\(Affected\.Secondary\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*baseCooldownOverride = Util\.rng\.randf_range\([\s\S]*getBaseCooldownIndex\(0\)[\s\S]*getBaseCooldownIndex\(1\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*consumePotion\(null, false\)[\s\S]*onAfterEffectFinished\(\)/);
assert.equal(getScriptHandler('lightning_potion')?.handlerId, 'lightning_potion');

function makeContext(params = data.params) {
  const piece = {
    ...data,
    itemId: 'lightning_potion',
    placementKey: 'lightning-potion',
    name: 'Lightning in a Bottle',
    kind: 'consumable',
    side: 'you',
    alive: true,
    charges: null,
    cooldown: data.cooldown,
    baseCooldown: data.cooldown,
    triggerTime: data.cooldown,
    damageMin: data.damageMin,
    damageMax: data.damageMax,
    params: { ...params },
    paramMult: {},
    bonusDamageFactor: 1,
  };
  const target = {
    ...itemsById.get('health_potion'),
    id: 'health_potion',
    itemId: 'health_potion',
    placementKey: 'target-potion',
    name: 'Health Potion',
    kind: 'consumable',
    side: 'you',
    params: { ...itemsById.get('health_potion').params },
    alive: true,
    charges: 1,
  };
  let linkedTriggers = 0;
  target._potionTrigger = () => { linkedTriggers += 1; };
  const holy = { ...itemsById.get('holy_armor'), itemId: 'holy_armor', placementKey: 'holy-armor', name: 'Holy Armor', kind: 'armor', side: 'you' };
  const graph = {
    pieces: new Map([
      ['lightning-potion', { key: 'lightning-potion', id: 'lightning_potion', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
        { cell: '2,0', color: 'secondary' },
      ] }],
      ['target-potion', { key: 'target-potion', id: 'health_potion', cells: ['1,0'], affectCells: [] }],
      ['holy-armor', { key: 'holy-armor', id: 'holy_armor', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', 'lightning-potion'],
      ['1,0', 'target-potion'],
      ['2,0', 'holy-armor'],
    ]),
  };
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  return {
    piece,
    target,
    holy,
    player,
    dummy,
    bus,
    events,
    linkedTriggers: () => linkedTriggers,
    t: 3,
    rng: () => 0.5,
    pieces: [piece, target, holy],
    graph,
    itemsById,
    canAffect: { rulesById: rules.byId },
  };
}

const handler = getScriptHandler('lightning_potion');
const ctx = makeContext();
ctx.player.hp = 100;
handler.onPrepare(ctx.piece, ctx);
assert.equal(ctx.piece.baseCooldown, 4.5, 'Lightning Potion samples its source 2–7 second cooldown range during prepare');
ctx.piece.paramMult.heal = 2;
assert.equal(handler.onCooldownEffect(ctx.piece, ctx), true);
assert.equal(ctx.piece.alive, false, 'Lightning Potion consumes itself after its cooldown effect');
assert.equal(ctx.dummy.hp, 190, 'Lightning Potion deals its descriptor damage');
assert.equal(ctx.dummy.stacks.blind, data.params.blind, 'Lightning Potion uses the source Blind parameter p1');
assert.equal(ctx.dummy._tempStacks[0]?.expiresAt, 3 + data.params.dur_blind, 'Lightning Potion uses modified Blind duration');
assert.equal(ctx.player.hp, 110, 'Lightning Potion heals once per Holy secondary using modified heal');
assert.equal(ctx.linkedTriggers(), 1, 'Lightning Potion consumes with the source primary potion trigger chain');
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'lightning_potion'));
assert.ok(ctx.events.some((event) => event.meta?.miniActivate && event.itemId === 'health_potion'));

const zero = makeContext({ blind: 0, p1: 0, dur_blind: 0, p2: 0, heal: 0, p3: 0 });
zero.player.hp = 100;
handler.onPrepare(zero.piece, zero);
handler.onCooldownEffect(zero.piece, zero);
assert.equal(zero.dummy.stacks.blind, 0, 'Lightning Potion honors explicit zero Blind');
assert.equal(zero.player.hp, 100, 'Lightning Potion honors explicit zero heal');

console.log('OK Lightning Potion source-backed cooldown range, descriptor damage, Blind p1/duration, Holy secondary heal, primary potion chaining, consumption, activation, and zero parameters');
