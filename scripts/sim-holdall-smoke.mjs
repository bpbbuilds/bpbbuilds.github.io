import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Holdall.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*return toItem\.isNeutral\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*getBlock\(\) \* getNumAffectedInside\(\)[\s\S]*giveBlock\(block\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.holdall?.file, 'Exclusive/Holdall.gd');
assert.equal(getScriptHandler('holdall')?.handlerId, 'holdall');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: 'you',
    kind: id === 'holdall' ? 'bag' : item.type?.includes('Weapon') ? 'weapon' : 'skill',
    damageMin: item.damageMin ?? 0,
    damageMax: item.damageMax ?? 0,
    cooldown: item.cooldown ?? 0,
    alive: true,
    ...overrides,
  };
}

const player = createActor('player', { maxHp: 200 });
const holdall = piece('holdall', 'you:holdall', { block: 8, cells: ['cargo-a', 'cargo-b', 'cargo-c'] });
const neutralWeapon = piece('wooden_sword', 'you:neutral', { cells: ['cargo-a'] });
const classSkill = piece('hogus_bogus', 'you:class-skill', { cells: ['cargo-b'] });
const neutralPassive = piece('healing_herbs', 'you:neutral-passive', { cells: ['cargo-c'] });
const graph = {
  pieces: new Map([
    ['you:holdall', { id: 'holdall', cells: holdall.cells }],
    ['you:neutral', { id: 'wooden_sword', cells: neutralWeapon.cells }],
    ['you:class-skill', { id: 'hogus_bogus', cells: classSkill.cells }],
    ['you:neutral-passive', { id: 'healing_herbs', cells: neutralPassive.cells }],
  ]),
  filled: new Map([
    ['cargo-a', 'you:neutral'],
    ['cargo-b', 'you:class-skill'],
    ['cargo-c', 'you:neutral-passive'],
  ]),
};
const ctx = {
  player,
  dummy: createActor('dummy', { maxHp: 200 }),
  events: [],
  t: 2.5,
  pieces: [holdall, neutralWeapon, classSkill, neutralPassive],
  graph,
  itemsById: byId,
  canAffect: null,
};

const handler = getScriptHandler('holdall');
handler.onCombatStart(holdall, ctx);
assert.equal(player.block, 16, 'Holdall grants live Block for each neutral item inside');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Holdall activates after its start Block grant');
assert.equal(ctx.events.at(-1)?.itemId, 'holdall', 'Holdall activation retains its source item identity');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroHoldall = piece('holdall', 'you:zero-holdall', { block: 0, cells: ['cargo-a'] });
const zeroCtx = { ...ctx, player: zeroPlayer, events: [], pieces: [zeroHoldall, neutralWeapon], graph: {
  pieces: new Map([
    ['you:zero-holdall', { id: 'holdall', cells: zeroHoldall.cells }],
    ['you:neutral', { id: 'wooden_sword', cells: neutralWeapon.cells }],
  ]),
  filled: new Map([['cargo-a', 'you:neutral']]),
} };
handler.onCombatStart(zeroHoldall, zeroCtx);
assert.equal(zeroPlayer.block, 0, 'Holdall honors an explicit zero Block value');
assert.equal(zeroCtx.events.length, 0, 'Holdall does not activate when its computed Block is zero');

console.log('OK Holdall source-backed neutral cargo filtering, live Block multiplication, activation ordering, and zero block');
