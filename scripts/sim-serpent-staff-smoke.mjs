import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SerpentStaff.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-onhit.js', 'utf8');
const serpentPort = port.slice(
  port.indexOf('const serpentStaffPort'),
  port.indexOf('export const AP_ONHIT_PORTS', port.indexOf('const serpentStaffPort')),
);

assert.match(source, /extends Weapon/);
assert.match(source, /onready var manaCost = getP\("mana"\)/);
assert.match(source, /onready var permDamBonus = getP\("dam"\)/);
assert.match(source, /onready var poison = getP\("poison"\)/);
assert.match(source, /onready var damageForPoison = int\(getP\("damforpoison"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*manaUseEvents\.clear\(\)[\s\S]*changeResistChance\(Game\.EventType\.Poison/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*tryUseMana\(manaCost\)[\s\S]*addBonusDamage\(permDamBonus\)[\s\S]*manaUseEvents\.push_back/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*damageAcc \+= damageRes\.damage[\s\S]*manaUseEvents\.pop_back/);

assert.match(serpentPort, /onPrepare\(piece, ctx\)/);
assert.match(serpentPort, /_serpManaUseEvents/);
assert.match(serpentPort, /getPName\(piece\.params, 'mana'/);
assert.match(serpentPort, /Math\.trunc\(getPName\(piece\.params, 'damforpoison'/);
assert.doesNotMatch(serpentPort, /_serpMana = false/);
assert.doesNotMatch(serpentPort, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'dam'/);

const player = createActor('player');
const dummy = createActor('dummy');
const piece = {
  itemId: 'serpent_staff',
  placementKey: 'serpent-staff-1',
  name: 'Serpent Staff',
  kind: 'weapon',
  alive: true,
  params: {
    mana: 1.9,
    p1: 9,
    dam: 2.75,
    p2: 9,
    poison: 99,
    p3: 9,
    damforpoison: 4.9,
    p4: 9,
  },
  chance: 0,
  bonusDamage: 0,
  removableBonusDamage: 0,
};
const ctx = {
  t: 3,
  player,
  dummy,
  events: [],
  rng: () => 0.99,
  itemsById: new Map([['serpent_staff', { id: 'serpent_staff', chance: 40 }]]),
};
const handler = getScriptHandler('serpent_staff');
assert.equal(handler?.handlerId, 'serpent_staff');
handler.onPrepare(piece, ctx);
assert.equal(dummy.stackResist.poison, 0, 'an explicit zero chance is not replaced by catalog chance');

player.stacks.mana = 4;
handler.onPreDealDamageEarly(piece, ctx, { hit: false });
handler.onPreDealDamageEarly(piece, ctx, { hit: false });
assert.equal(player.stacks.mana, 0, 'each early damage effect spends the named Mana cost');
assert.equal(piece.bonusDamage, 5.5, 'each Mana use adds the exact named permanent damage');
assert.equal(piece._serpManaUseEvents.length, 2);

handler.onDealtDamage(piece, ctx, { hit: false, damage: 100 });
assert.equal(piece._serpManaUseEvents.length, 2, 'a miss preserves the source Mana-use event queue');
handler.onDealtDamage(piece, ctx, { hit: true, damage: 6 });
assert.equal(dummy.stacks.poison, 1, 'first hit converts whole poison threshold');
assert.equal(piece._serpAcc, 2, 'sub-threshold damage remains banked');
assert.equal(piece._serpManaUseEvents.length, 1);
handler.onDealtDamage(piece, ctx, { hit: true, damage: 2 });
assert.equal(dummy.stacks.poison, 2, 'second queued hit converts the remaining threshold');
assert.equal(piece._serpAcc, 0);
assert.equal(piece._serpManaUseEvents.length, 0);

handler.onDealtDamage(piece, ctx, { hit: true, damage: 100 });
assert.equal(dummy.stacks.poison, 2, 'hits without a matching Mana-use event do not bank poison');

console.log('OK Serpent Staff source and handler regression');
