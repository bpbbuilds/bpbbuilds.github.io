import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/HawkRune.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func prepareWeapon\(\):[\s\S]*addCritChancePercent\(getP\("critchance"\)\)[\s\S]*addCritSeverity\(getP\("critdam"\) \/ 100\.0\)/);
assert.match(source, /func prepareArmor\(\):[\s\S]*changeResistChance\(Game\.EventType\.Blind,[\s\S]*getGemPower\(\) \* getChance\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictBlind\(1\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.hawk_rune?.file, 'Exclusive/HawkRune.gd');
assert.equal(getScriptHandler('hawk_rune')?.handlerId, 'hawk_rune');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: 'you',
    alive: true,
    kind: /weapon/i.test(item.type || '') ? 'weapon' : /armor/i.test(item.type || '') ? 'armor' : 'gadget',
    damageMin: Number(item.damageMin) || 0,
    damageMax: Number(item.damageMax) || 0,
    critChance: 0,
    critSeverity: 2,
    ...overrides,
  };
}

function context(player, dummy = createActor('dummy', { maxHp: 200 })) {
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    rng: () => 0,
    t: 4,
    events: [],
    pieces: [],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('hawk_rune');
const player = createActor('player', { maxHp: 200 });
const ctx = context(player);
const loose = piece('hawk_rune', 'you:hawk-loose');
const result = handler.onCooldownEffect(loose, ctx);
assert.equal(result, true);
assert.equal(ctx.dummy.stacks.blind, 1, 'Loose Hawk Rune inflicts one Blind');
assert.equal(ctx.events[0]?.type, 'debuff', 'Hawk Rune projects its effect before activation');
assert.equal(ctx.events.at(-1)?.type, 'activate');

const resistedDummy = createActor('dummy', { maxHp: 200 });
resistedDummy.debuffResistStacks = 1;
const resistedCtx = context(createActor('player', { maxHp: 200 }), resistedDummy);
handler.onCooldownEffect(piece('hawk_rune', 'you:hawk-resisted'), resistedCtx);
assert.equal(resistedDummy.stacks.blind, 0, 'Hawk Rune respects Blind resistance');
assert.equal(resistedCtx.events.some((event) => event.type === 'activate'), true);

const weapon = piece('wooden_sword', 'you:weapon', { gemIds: ['hawk_rune'] });
const weaponCtx = context(createActor('player', { maxHp: 200 }));
prepareGemSockets(weapon, weaponCtx);
assert.equal(weapon.critChance, 12, 'Socketed Hawk Rune adds source crit chance');
assert.equal(weapon.critSeverity, 2.15, 'Socketed Hawk Rune adds source crit severity');

const armor = piece('holy_armor', 'you:armor', { gemIds: ['hawk_rune'], kind: 'armor' });
const armorCtx = context(createActor('player', { maxHp: 200 }));
prepareGemSockets(armor, armorCtx);
assert.equal(armorCtx.player.stackResist.blind, 40, 'Socketed Hawk Rune adds GemPower × chance Blind resistance');

const zeroWeapon = piece('wooden_sword', 'you:weapon-zero', {
  gemIds: ['hawk_rune'],
});
const zeroCtx = context(createActor('player', { maxHp: 200 }));
zeroCtx.itemsById = new Map(byId);
zeroCtx.itemsById.set('hawk_rune', {
  ...byId.get('hawk_rune'),
  params: { critchance: 0, p1: 0, critdam: 0, p2: 0 },
});
prepareGemSockets(zeroWeapon, zeroCtx);
assert.equal(zeroWeapon.critChance, 0, 'Hawk Rune honors explicit zero crit chance');
assert.equal(zeroWeapon.critSeverity, 2, 'Hawk Rune honors explicit zero crit severity');

console.log('OK Hawk Rune source-backed loose Blind, resistance handling, socketed crit stats, armor resistance, and zero parameters');
