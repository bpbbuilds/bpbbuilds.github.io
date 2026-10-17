import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/LightFlower.gd', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('light_flower');

assert.equal(inventory.byId.light_flower?.file, 'Exclusive/LightFlower.gd');
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeBuffProtectionChance\(getChance\(\) \+[\s\S]*getChance2\(\) \* getNumAffectedItems\(Affected\.Secondary\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getMana\(\) >= manaNeeded[\s\S]*useMana\(manaNeeded\)[\s\S]*cleanseRandomDebuffs\(debuffs, event\)[\s\S]*getDebuffStacks\(\) == 0[\s\S]*giveRegeneration\(regen\)[\s\S]*giveLucky\(luck\)[\s\S]*activate\(\)/);
assert.equal(getScriptHandler('light_flower')?.handlerId, 'light_flower');

function makePiece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    id,
    placementKey: key,
    name: item?.displayName || item?.name || id,
    params: { ...(item?.params || {}) },
    kind: id === 'light_flower' ? 'food' : 'armor',
    side: 'you',
    alive: true,
    ...overrides,
  };
}

function makeContext(params = data.params, itemsById = byId) {
  const flower = makePiece('light_flower', 'flower', { params });
  const holy = makePiece('holy_armor', 'holy');
  const ordinary = makePiece('leather_armor', 'ordinary');
  const graph = {
    pieces: new Map([
      ['flower', { key: 'flower', id: 'light_flower', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'secondary' },
        { cell: '2,0', color: 'secondary' },
      ] }],
      ['holy', { key: 'holy', id: 'holy_armor', cells: ['1,0'], affectCells: [] }],
      ['ordinary', { key: 'ordinary', id: 'leather_armor', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', 'flower'],
      ['1,0', 'holy'],
      ['2,0', 'ordinary'],
    ]),
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  return {
    flower,
    holy,
    ordinary,
    player,
    dummy,
    bus,
    events,
    t: 3,
    rng: () => 0,
    pieces: [flower, holy, ordinary],
    graph,
    itemsById,
    canAffect: { rulesById: rules.byId },
  };
}

const ctx = makeContext();
const handler = getScriptHandler('light_flower');
handler.onPrepare(ctx.flower, ctx);
assert.equal(ctx.player.buffCleanseProtectChance, 25, 'Light Flower adds chance plus one Holy secondary bonus');
grantStacks(ctx.player, 'mana', 2);
grantStacks(ctx.player, 'poison', 2);
assert.equal(handler.onCooldownEffect(ctx.flower, ctx), true);
assert.equal(ctx.player.stacks.mana, 1, 'Light Flower spends exact Mana requirement');
assert.equal(ctx.player.stacks.poison, 0, 'Light Flower cleanses available debuffs before granting buffs');
assert.equal(ctx.player.stacks.regeneration, 1);
assert.equal(ctx.player.stacks.lucky, 1);
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'light_flower'));

const blocked = makeContext({ ...data.params, debuffs: 1, p2: 1 });
handler.onPrepare(blocked.flower, blocked);
grantStacks(blocked.player, 'mana', 1);
grantStacks(blocked.player, 'poison', 1);
grantStacks(blocked.player, 'blind', 1);
handler.onCooldownEffect(blocked.flower, blocked);
assert.equal(blocked.player.stacks.regeneration, 0, 'Light Flower does not grant buffs while a debuff remains');
assert.equal(blocked.player.stacks.lucky, 0, 'Light Flower does not grant Lucky while a debuff remains');

const zeroItems = new Map(byId);
zeroItems.set('light_flower', { ...data, chance: 0, chance2: 0 });
const zero = makeContext({ manat: 0, p1: 0, debuffs: 0, p2: 0, luck: 0, p3: 0, regen: 0, p4: 0 }, zeroItems);
handler.onPrepare(zero.flower, zero);
assert.equal(zero.player.buffCleanseProtectChance, 0, 'Light Flower honors explicit zero protection chances');
handler.onCooldownEffect(zero.flower, zero);
assert.equal(zero.player.stacks.regeneration, 0, 'Light Flower honors explicit zero Regeneration');
assert.equal(zero.player.stacks.lucky, 0, 'Light Flower honors explicit zero Lucky');

console.log('OK Light Flower source-backed Holy secondary count, protection chance, Mana spend/cleanse order, debuff gate, activation, and zero parameters');
