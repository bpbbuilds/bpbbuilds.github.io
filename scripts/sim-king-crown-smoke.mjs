import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/KingCrown.gd', 'utf8');
const crownSource = fs.readFileSync('tools/game-extract-full/Items/Crown.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const crownData = byId.get('king_crown');
const rubyData = byId.get('regular_ruby');

assert.match(source, /func prepare\(\):[\s\S]*getP\("gempower"\)[\s\S]*changeGemPower[\s\S]*\.prepare\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*changeBuffProtectStacks\(1\)[\s\S]*heal\(\)[\s\S]*activate\(\)/);
assert.match(crownSource, /connectForCombat\(character\(\), "character_mana_changed", "checkTrigger"\)/);
assert.match(crownSource, /character\(\)\.makeInvulnerable\(invuDur, self, triggerEvent\)/);
assert.equal(inventory.byId.king_crown?.file, 'Exclusive/KingCrown.gd');
assert.equal(getScriptHandler('king_crown')?.handlerId, 'king_crown');

function makePiece(params = crownData.params, gemIds = []) {
  return {
    ...crownData,
    itemId: 'king_crown',
    placementKey: 'king-crown',
    name: 'King Crown',
    kind: 'armor',
    side: 'you',
    alive: true,
    params: { ...params },
    gemIds,
    cooldown: crownData.cooldown,
    baseCooldown: crownData.cooldown,
  };
}

function makeContext(piece) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  return {
    player,
    dummy,
    bus,
    events,
    t: 3,
    rng: () => 0,
    pieces: [piece],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: new Map([
      ['king_crown', crownData],
      ['regular_ruby', rubyData],
    ]),
    canAffect: null,
  };
}

const handler = getScriptHandler('king_crown');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'King Crown uses source prepare, not combat-start');

const piece = makePiece(undefined, ['regular_ruby']);
const ctx = makeContext(piece);
handler.onPrepare(piece, ctx);
assert.equal(piece._socketGemPowerBonus, 0.5, 'King Crown raises socketed GemPower by source gempower');
prepareGemSockets(piece, ctx);
assert.equal(ctx.player._healAmp, 0.3, 'King Crown applies the 1.5x Regular Ruby GemPower to socket healing');

const manaBefore = ctx.player.stacks.mana;
grantStacks(ctx.player, 'mana', crownData.params.mana, { originKey: 'setup', originId: 'setup' });
assert.equal(ctx.player.stacks.mana, 0, 'King Crown spends the exact source Mana cost');
assert.equal(piece._crownState, 'Active', 'King Crown enters Active from a qualifying mana signal');
assert.equal(ctx.player.invulnUntil, 3 + crownData.params.dur_invu, 'King Crown uses the source invulnerability duration');
assert.equal(manaBefore, 0);

ctx.player.invulnUntil = 0;
ctx.player.hp = 160;
const beforeCooldown = ctx.events.length;
handler.onCooldownEffect(piece, ctx);
const cooldownEvents = ctx.events.slice(beforeCooldown);
assert.equal(ctx.player.buffProtect, 1, 'King Crown grants one Buff Protect stack');
assert.equal(ctx.player.hp, 170, 'King Crown heals with the named heal parameter and socketed Ruby efficiency');
assert.deepEqual(cooldownEvents.map((event) => event.type), ['buff', 'heal', 'activate']);

const zero = makePiece({ gempower: 0, p1: 0, heal: 0, p2: 0, mana: 0, p3: 0, dur_invu: 0, p4: 0 });
const zeroCtx = makeContext(zero);
handler.onPrepare(zero, zeroCtx);
assert.equal(zero._socketGemPowerBonus, 0, 'King Crown honors explicit zero GemPower');
zeroCtx.bus.emit('character_mana_changed', { actor: zeroCtx.player, t: 1 });
assert.equal(zero._crownState, 'Active', 'King Crown remains zero-safe when source Mana cost is zero');
assert.equal(zeroCtx.player.invulnUntil, 0, 'King Crown honors explicit zero invulnerability duration');
const zeroEvents = zeroCtx.events.filter((event) => event.itemId === 'king_crown');
assert.equal(zeroEvents.at(-1)?.type, 'activate');

console.log('OK King Crown source-backed prepare, Mana invulnerability, GemPower socket modifier, protect/heal/activation order, and zero parameters');
