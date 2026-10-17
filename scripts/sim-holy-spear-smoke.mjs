import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor, isInvulnerable } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { tickTimedSpeeds } from '../js/pages/sim/engine/timed-speed.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/HolySpear.gd', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.holy_spear?.file, 'HolySpear.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getNumEmptyAffectedCells\(\)[\s\S]*getNumAffectedItems\(\)[\s\S]*character_mana_changed[\s\S]*character_invulnerable_end/);
assert.match(source, /func onPreDealDamage_late\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*removeBlock\(blockRemoval\)[\s\S]*cleanseRandomDebuffs\(cleanses\)/);
assert.match(source, /setState\(SpearState\.Active, true\)[\s\S]*getP_m\("dur_invu"\)[\s\S]*makeInvulnerable[\s\S]*useMana\(manaCost/);
assert.equal(getScriptHandler('holy_spear')?.handlerId, 'holy_spear');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.displayName || item?.name || id,
    params: { ...(item?.params || {}) },
    kind: id === 'holy_spear' ? 'weapon' : 'armor',
    side: 'you',
    alive: true,
    damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0,
    ...overrides,
  };
}

const spear = piece('holy_spear', 'spear');
const holyArmor = piece('holy_armor', 'holy-armor');
const woodenSword = piece('wooden_sword', 'sword');
const graph = {
  pieces: new Map([
    ['spear', { key: 'spear', id: 'holy_spear', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
    ] }],
    ['holy-armor', { key: 'holy-armor', id: 'holy_armor', cells: ['1,0'], affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'spear'],
    ['1,0', 'holy-armor'],
    ['2,0', 'sword'],
  ]),
};
const player = createActor('player', { maxHp: 200 });
const dummy = createActor('dummy', { maxHp: 200, block: 30 });
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = events;
dummy._eventLog = [];
const ctx = {
  player,
  dummy,
  bus,
  events,
  t: 5,
  rng: () => 0,
  pieces: [spear, holyArmor, woodenSword],
  graph,
  itemsById: byId,
  canAffect: { rulesById: rules.byId },
};
const handler = getScriptHandler('holy_spear');

assert.equal(handler.onCombatStart, undefined, 'Holy Spear source work is prepare-time');
handler.onPrepare(spear, ctx);
assert.equal(spear._blockStrip, 20, 'Holy Spear counts one empty and one Holy slot');
assert.equal(spear._cleanses, 2, 'Holy Spear cleanses once per counted slot');
assert.equal(spear._spearState, 'Inactive');

grantStacks(player, 'poison', 1);
grantStacks(player, 'blind', 1);
grantStacks(player, 'cold', 1);
handler.onPreDealDamageLate(spear, ctx, { hit: true });
assert.equal(dummy.block, 10, 'Holy Spear strips the exact source Block amount');
assert.equal(
  player.stacks.poison + player.stacks.blind + player.stacks.cold,
  1,
  'Holy Spear cleanses exactly the source number of random debuff stacks',
);

grantStacks(player, 'mana', 10, { originKey: 'setup', originId: 'setup' });
assert.equal(player.stacks.mana, 0, 'Holy Spear spends the exact source Mana cost');
assert.equal(spear._spearState, 'Active');
assert.equal(isInvulnerable(player, 5), true);
assert.equal(player.invulnUntil, 8, 'Holy Spear uses the source duration');
assert.equal(spear.speedScale, 1, 'Holy Spear adds the source speed percentage');

tickTimedSpeeds([spear], 8);
handler.onTick(spear, { ...ctx, t: 8 });
assert.equal(spear._spearState, 'Used', 'Holy Spear changes to Used at the source timer end');
assert.equal(spear.speedScale, 0, 'Holy Spear removes its temporary speed at timer end');

const zero = piece('holy_spear', 'zero-spear', {
  params: { blockremoval: 0, p1: 0, manat: 0, p2: 0, speed: 0, p3: 0, dur_invu: 0, p4: 0 },
});
const zeroCtx = { ...ctx, player: createActor('player'), dummy: createActor('dummy'), events: [], pieces: [zero], t: 0 };
zeroCtx.player._combatBus = bus;
zeroCtx.player._eventLog = zeroCtx.events;
zeroCtx.dummy._eventLog = [];
handler.onPrepare(zero, zeroCtx);
assert.equal(zero._blockStrip, 0, 'Holy Spear honors explicit zero Block removal');
assert.equal(zero._cleanses, 0, 'Holy Spear honors explicit zero cleanse count');

console.log('OK Holy Spear source-backed prepare slot accounting, late-hit strip/cleanse, Mana invulnerability, timed speed/state transition, and zero parameters');
