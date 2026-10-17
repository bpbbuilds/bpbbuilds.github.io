import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/HolyCollar.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canActivate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(item, "activated", "onItemActivated"\)[\s\S]*character_lucky_changed[\s\S]*character_regeneration_changed/);
assert.match(source, /func onLuckyOrRegenChanged\(amount, _event\):[\s\S]*changeCritChancePercent\(amount \* getChance2\(\)/);
assert.match(source, /func onItemActivated\(event\):[\s\S]*rollChance\(\)[\s\S]*giveLucky\(luck, event\)[\s\S]*giveRegeneration\(regen, event\)[\s\S]*miniActivate\(\)/);
assert.equal(inventory.byId.holy_collar?.file, 'Exclusive/HolyCollar.gd');
assert.equal(getScriptHandler('holy_collar')?.handlerId, 'holy_collar');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: 'you',
    kind: id === 'holy_collar' ? 'accessory' : item.type?.includes('Weapon') ? 'weapon' : 'passive',
    cooldown: item.cooldown ?? 0,
    critChance: 0,
    alive: true,
    ...overrides,
  };
}

function context(player, pieces) {
  return {
    player,
    dummy: createActor('dummy', { maxHp: 200 }),
    events: [],
    t: 2.5,
    rng: () => 0,
    pieces,
    graph: {
      pieces: new Map([
        ['you:collar', { id: 'holy_collar', affectCells: [{ cell: 'weapon-star', color: 'primary' }], cells: [] }],
        ['you:weapon', { id: 'wooden_sword', affectCells: [], cells: ['weapon-star'] }],
        ['you:passive', { id: 'healing_herbs', affectCells: [], cells: ['weapon-star'] }],
      ]),
      filled: new Map([['weapon-star', 'you:weapon']]),
    },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('holy_collar');
const player = createActor('player', { maxHp: 200 });
const collar = piece('holy_collar', 'you:collar');
const weapon = piece('wooden_sword', 'you:weapon');
const passive = piece('healing_herbs', 'you:passive');
const ctx = context(player, [collar, weapon, passive]);
handler.onPrepare(collar, ctx);
grantStacks(player, 'lucky', 2);
grantStacks(player, 'regeneration', 1);
assert.equal(weapon.critChance, 3, 'Holy Collar applies chance2 crit percentage to linked activatable items');
assert.equal(passive.critChance || 0, 0, 'Holy Collar does not modify a linked non-activatable item');

handler.onPeerActivated(collar, weapon, ctx);
assert.equal(player.stacks.lucky, 3, 'Holy Collar grants source luck on a linked activation');
assert.equal(player.stacks.regeneration, 2, 'Holy Collar grants source regeneration on a linked activation');
assert.equal(ctx.events.at(-1)?.meta?.miniActivate, true, 'Holy Collar records source miniActivate after its grants');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroCollar = piece('holy_collar', 'you:zero-collar', { params: { luck: 0, p1: 0, regen: 0, p2: 0 } });
const zeroWeapon = piece('wooden_sword', 'you:weapon');
const zeroCtx = context(zeroPlayer, [zeroCollar, zeroWeapon]);
handler.onPrepare(zeroCollar, zeroCtx);
handler.onPeerActivated(zeroCollar, zeroWeapon, zeroCtx);
assert.equal(zeroPlayer.stacks.lucky || 0, 0, 'Holy Collar honors an explicit zero Lucky grant');
assert.equal(zeroPlayer.stacks.regeneration || 0, 0, 'Holy Collar honors an explicit zero Regeneration grant');

console.log('OK Holy Collar source-backed prepare listeners, activatable-target crit changes, chance grants, mini activation, and zero parameters');
