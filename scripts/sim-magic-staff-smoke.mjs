import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/MagicStaff.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-mana.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'magic_staff');

assert.ok(sourceItem, 'Magic Staff: extracted catalog row');
assert.match(source, /extends Weapon/);
assert.match(source, /onready var manaCost = getP1\(\)/);
assert.match(source, /onready var tempDamBonus = getP2\(\)/);
assert.match(source, /onready var permDamBonus = getP3\(\)/);
assert.match(source, /var event = tryUseMana\(manaCost\)/);
assert.match(source, /damageRes\.damage \+= tempDamBonus/);
assert.match(source, /addBonusDamage\(permDamBonus\)/);
assert.match(port, /const magicStaffPort[\s\S]*?onPreDealDamageEarly\(res\)/);
assert.match(port, /useMana\(ctx\.player, cost/);
assert.match(port, /res\.damage = \(Number\(res\.damage\) \|\| 0\) \+ \(Number\.isFinite\(temp\) \? temp : 0\)/);

const piece = {
  itemId: 'magic_staff',
  placementKey: 'staff',
  name: 'Magic Staff',
  params: { manat: 3, dam_temp: 99, dam_perm: 99, p1: 0, p2: 6, p3: 2 },
  damageMin: 10,
  damageMax: 10,
  accuracy: 100,
  staminaCost: 0,
  bonusDamage: 0,
  removableBonusDamage: 0,
  cooldown: 1.8,
  baseCooldown: 1.8,
};
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  bus: createCombatBus(),
};
const handler = getScriptHandler('magic_staff');
assert.equal(handler?.handlerId, 'magic_staff');
grantStacks(ctx.player, 'mana', 1, { originId: 'test' });
const beforeHp = ctx.dummy.hp;
handler.onCooldownEffect(piece, ctx);
assert.equal(ctx.player.stacks.mana, 1,
  'Magic Staff: zero Mana cost does not spend a Mana stack');
assert.equal(ctx.dummy.hp, beforeHp - 16,
  'Magic Staff: zero-cost strike still adds exact temporary damage');
assert.equal(piece.bonusDamage, 2,
  'Magic Staff: zero-cost strike adds exact permanent damage');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1,
  'Magic Staff: inherited weapon attack activates once');

const noMana = {
  ...piece,
  placementKey: 'no-mana-staff',
  params: { manat: 0, dam_temp: 99, dam_perm: 99, p1: 3, p2: 6, p3: 2 },
  bonusDamage: 0,
};
const noManaCtx = {
  ...ctx,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
};
const noManaHp = noManaCtx.dummy.hp;
handler.onCooldownEffect(noMana, noManaCtx);
assert.equal(noManaCtx.dummy.hp, noManaHp - 10,
  'Magic Staff: insufficient Mana leaves the base strike unchanged');
assert.equal(noMana.bonusDamage, 0,
  'Magic Staff: insufficient Mana does not add permanent damage');

console.log('Magic Staff source/parity smoke passed.');
