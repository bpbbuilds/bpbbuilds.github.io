import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/InnerPower.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)[\s\S]*item\.canHealOrLifesteal\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveLucky\(luck\)[\s\S]*giveEmpower\(empower\)[\s\S]*activate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*healAmpAcc = 0[\s\S]*speedAcc = 0[\s\S]*connectForCombat\(character\(\), "character_lucky_changed", "onLuckChanged"\)[\s\S]*connectForCombat\(character\(\), "character_empower_changed", "onEmpowerChanged"\)/);
assert.match(source, /func onLuckChanged\(amount, event\):[\s\S]*min\(healAmpAcc, healAmpMax\)[\s\S]*item\.changeHealAmp\(healAmpToGive\)/);
assert.match(source, /func onEmpowerChanged\(amount, event\):[\s\S]*min\(speedAcc, speedMax\)[\s\S]*item\.addSpeed\(speedToGive\)/);
assert.equal(inventory.byId.inner_power?.file, 'Exclusive/InnerPower.gd');
assert.equal(getScriptHandler('inner_power')?.handlerId, 'inner_power');

function makePiece(itemId, placementKey, overrides = {}) {
  const item = byId.get(itemId) || { id: itemId, name: itemId };
  return {
    ...item,
    itemId,
    placementKey,
    name: item.displayName || item.name || itemId,
    params: { ...(item.params || {}) },
    alive: true,
    side: 'you',
    ...overrides,
  };
}

function makeContext(inner, weapon, healer, unrelated) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 200 });
  return {
    t: 2,
    player,
    dummy,
    events: [],
    rng: () => 0,
    pieces: [inner, weapon, healer, unrelated],
    graph: {
      pieces: new Map([
        ['inner', { key: 'inner', id: 'inner_power', cells: ['0,0'], affectCells: [
          { cell: '1,0', color: 'primary' },
          { cell: '2,0', color: 'primary' },
          { cell: '3,0', color: 'primary' },
        ] }],
        ['weapon', { key: 'weapon', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
        ['healer', { key: 'healer', id: 'health_potion', cells: ['2,0'], affectCells: [] }],
        ['unrelated', { key: 'unrelated', id: 'healing_herbs', cells: ['3,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'inner'],
        ['1,0', 'weapon'],
        ['2,0', 'healer'],
        ['3,0', 'unrelated'],
      ]),
    },
    itemsById: byId,
    canAffect: null,
  };
}

const inner = makePiece('inner_power', 'inner', {
  kind: 'passive',
  params: { luck: 2, p1: 2, empower: 1, p2: 1, healamp: 2, p3: 2, max1: 100, p4: 100, speed: 2, p5: 2, max2: 100, p6: 100 },
});
const weapon = makePiece('wooden_sword', 'weapon', { kind: 'weapon', cooldown: 1.4, speedScale: 0 });
const healer = makePiece('health_potion', 'healer', { kind: 'consumable', cooldown: 999, paramMult: {} });
const unrelated = makePiece('healing_herbs', 'unrelated', { kind: 'passive', cooldown: 0, paramMult: {} });
const ctx = makeContext(inner, weapon, healer, unrelated);
const handler = getScriptHandler('inner_power');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');
handler.onPrepare(inner, ctx);
handler.onCombatStart(inner, ctx);

assert.equal(ctx.player.stacks.lucky, 2, 'Inner Power gives source Lucky at combat start');
assert.equal(ctx.player.stacks.empower, 1, 'Inner Power gives source Empower at combat start');
assert.equal(weapon.speedScale, 0.02, 'Inner Power adds source Empower speed to linked cooldown items');
assert.equal(healer.paramMult.heal, 1.04, 'Inner Power modifies linked healing parameters from source Lucky');
assert.equal(healer.paramMult.lifesteal, 1.04, 'Inner Power modifies linked lifesteal parameters from source Lucky');
assert.equal(unrelated.speedScale || 0, 0, 'Inner Power does not alter non-cooldown/non-heal targets');
assert.equal(ctx.events.at(-1)?.itemId, 'inner_power', 'Inner Power activates after its combat-start grants');

grantStacks(ctx.player, 'lucky', 100, { originKey: 'other', originId: 'other' });
grantStacks(ctx.player, 'empower', 100, { originKey: 'other', originId: 'other' });
assert.equal(healer.paramMult.heal, 2, 'Inner Power caps cumulative healing amplification at max1');
assert.equal(weapon.speedScale, 1, 'Inner Power caps cumulative speed at max2');

const zeroInner = makePiece('inner_power', 'zero-inner', {
  kind: 'passive',
  params: { luck: 0, p1: 0, empower: 0, p2: 0, healamp: 0, p3: 0, max1: 0, p4: 0, speed: 0, p5: 0, max2: 0, p6: 0 },
});
const zeroWeapon = makePiece('wooden_sword', 'zero-weapon', { kind: 'weapon', cooldown: 1.4, speedScale: 0 });
const zeroHealer = makePiece('health_potion', 'zero-healer', { kind: 'consumable', cooldown: 999, paramMult: {} });
const zeroUnrelated = makePiece('healing_herbs', 'zero-unrelated', { kind: 'passive', cooldown: 0, paramMult: {} });
const zeroCtx = makeContext(zeroInner, zeroWeapon, zeroHealer, zeroUnrelated);
handler.onPrepare(zeroInner, zeroCtx);
handler.onCombatStart(zeroInner, zeroCtx);
assert.equal(zeroCtx.player.stacks.lucky || 0, 0, 'Inner Power honors explicit zero Lucky');
assert.equal(zeroCtx.player.stacks.empower || 0, 0, 'Inner Power honors explicit zero Empower');
assert.equal(zeroWeapon.speedScale || 0, 0, 'Inner Power honors explicit zero speed');
assert.equal(Object.keys(zeroHealer.paramMult).length, 0, 'Inner Power honors explicit zero healing amplification');

console.log('OK Inner Power source-backed prepare-before-start listeners, target filtering, Lucky/Empower grants, capped per-item heal/speed modifiers, activation ordering, and zero parameters');
