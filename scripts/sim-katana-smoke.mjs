import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Katana.gd', 'utf8');
const ribSource = fs.readFileSync('tools/game-extract-full/Items/RibSawBlade.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('katana');

assert.equal(inventory.byId.katana?.file, 'Exclusive/Katana.gd');
assert.match(ribSource, /func onPrepare\(\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*\.onPreDealDamage_early\(damageRes\)[\s\S]*damageRes\.hasHit\(\)[\s\S]*getBuffStacks\(\)[\s\S]*removeMostBuffs\(removeBuffs\)/);
assert.equal(getScriptHandler('katana')?.handlerId, 'katana');

function makePiece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.displayName || item?.name || id,
    params: { ...(item?.params || {}) },
    kind: 'weapon',
    side,
    alive: true,
    damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0,
    bonusDamage: 0,
    removableBonusDamage: 0,
    empowerable: true,
    ...overrides,
  };
}

const katana = makePiece('katana', 'katana', 'you');
const opponentSword = makePiece('wooden_sword', 'opponent-sword', 'them', {
  bonusDamage: 3,
  removableBonusDamage: 3,
  _removableBonusDamageInitialized: true,
});
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = events;
dummy._eventLog = events;
const ctx = {
  player,
  dummy,
  bus,
  events,
  t: 4,
  rng: () => 0,
  pieces: [katana],
  allPieces: [katana, opponentSword],
  graph: { pieces: new Map(), filled: new Map() },
  itemsById: byId,
  canAffect: null,
};
const handler = getScriptHandler('katana');

handler.onPrepare(katana, ctx);
assert.deepEqual(katana._ribOppWeapons, [opponentSword], 'Katana snapshots only opponent empowerable weapons');
grantStacks(dummy, 'lucky', 20);
handler.onPreDealDamageEarly(katana, ctx, { hit: true });
assert.equal(opponentSword.bonusDamage, 2, 'Katana inherits Rib Saw damage purge before damage resolves');
assert.equal(katana.bonusDamage, 1, 'Katana inherits Rib Saw permanent bonus damage');
assert.equal(dummy.stacks.lucky, 18, 'Katana strips the exact source number of buffs at threshold');
assert.ok(events.some((event) => event.type === 'info' && event.meta?.handler === 'katana'));

grantStacks(dummy, 'heat', 2);
const beforeMiss = { enemy: opponentSword.bonusDamage, own: katana.bonusDamage, buffs: dummy.stacks.lucky + dummy.stacks.heat };
handler.onPreDealDamageEarly(katana, ctx, { hit: false });
assert.deepEqual(
  { enemy: opponentSword.bonusDamage, own: katana.bonusDamage, buffs: dummy.stacks.lucky + dummy.stacks.heat },
  beforeMiss,
  'Katana does not run inherited or unique effects on a miss',
);

const zero = makePiece('katana', 'zero-katana', 'you', {
  params: { dam: 0, p1: 0, bonusdam: 0, p2: 0, buffst: 0, p3: 0, buffs: 0, p4: 0 },
});
const zeroCtx = { ...ctx, events: [], pieces: [zero], allPieces: [zero, opponentSword], dummy: createActor('dummy') };
zeroCtx.dummy._combatBus = bus;
zeroCtx.dummy._eventLog = zeroCtx.events;
handler.onPrepare(zero, zeroCtx);
handler.onPreDealDamageEarly(zero, zeroCtx, { hit: true });
assert.equal(zero.bonusDamage, 0, 'Katana honors explicit zero bonus damage');
assert.equal(zeroCtx.dummy.stacks.lucky, 0, 'Katana honors explicit zero buff threshold/strip');

console.log('OK Katana source-backed Rib Saw early-hook ordering, opponent weapon snapshot, buff threshold strip, miss handling, and zero parameters');
