import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/NullBlade.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-perm.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'null_blade');

assert.ok(sourceItem, 'Null Blade: extracted catalog row');
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)/);
assert.match(source, /useLucky\(luckNeeded\)[\s\S]*damageRes\.damage \+= dam[\s\S]*addBonusDamage\(dam\)/);
assert.match(source, /useRegeneration\(regenNeeded\)[\s\S]*removeRandomBuffs\(buffs\)[\s\S]*opponent\(\)\.getBuffStacks\(\) == 0[\s\S]*addSpeed\(speedBonus\)/);
assert.match(port, /handlerId: 'null_blade'/);
const bladePort = port.match(/const nullBladePort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(bladePort, /useLucky\(ctx\.player, luckNeed/);
assert.match(bladePort, /removeRandomBuffs\([\s\S]*buffs/);
assert.doesNotMatch(bladePort, /Math\.max\(1,\s*Math\.round\(getPName\(piece\.params, 'luckt'/,
  'Null Blade: explicit zero Lucky threshold must remain zero');
assert.doesNotMatch(bladePort, /Math\.max\(1,\s*Math\.round\(getPName\(piece\.params, 'buffs'/,
  'Null Blade: explicit zero buff removal must remain zero');

const handler = getScriptHandler('null_blade');
assert.equal(handler?.handlerId, 'null_blade');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const piece = {
    itemId: 'null_blade',
    placementKey: 'blade',
    name: 'Null Blade',
    params: { ...params },
    side: 'you',
    kind: 'weapon',
    alive: true,
    damageMin: sourceItem.damageMin,
    damageMax: sourceItem.damageMax,
    bonusDamage: 0,
    removableBonusDamage: 0,
    speedScale: 0,
  };
  return {
    t: 1,
    player,
    dummy,
    events: [],
    rng: () => 0,
    pieces: [piece],
    itemsById: new Map([['null_blade', sourceItem]]),
  };
}

const ctx = makeContext();
grantStacks(ctx.player, 'lucky', 1, { originId: 'fixture' });
grantStacks(ctx.player, 'regeneration', 1, { originId: 'fixture' });
grantStacks(ctx.dummy, 'lucky', 1, { originId: 'dummy' });
const res = { hit: true, damage: 10 };
handler.onPreDealDamageEarly(ctx.pieces[0], ctx, res);
assert.equal(res.damage, 12, 'Null Blade: Lucky adds the exact current-hit damage');
assert.equal(ctx.pieces[0].bonusDamage, 2,
  'Null Blade: Lucky adds the exact permanent future damage');
assert.equal(ctx.player.stacks.lucky, 0, 'Null Blade: Lucky threshold is spent exactly');
assert.equal(ctx.player.stacks.regeneration, 0,
  'Null Blade: Regeneration threshold is spent exactly');
assert.equal(ctx.dummy.stacks.lucky, 0,
  'Null Blade: Regeneration strips the requested opponent buff stack');
assert.equal(ctx.pieces[0].speedScale, 0.05,
  'Null Blade: empty opponent buffs grant the exact speed bonus');

const miss = makeContext();
grantStacks(miss.player, 'lucky', 1, { originId: 'fixture' });
const missRes = { hit: false, damage: 10 };
handler.onPreDealDamageEarly(miss.pieces[0], miss, missRes);
assert.equal(missRes.damage, 10, 'Null Blade: a miss receives no source effects');
assert.equal(miss.player.stacks.lucky, 1, 'Null Blade: a miss spends no Lucky');

const zero = makeContext({ luckt: 0, p1: 0, dam: 0, p2: 0, regent: 0, p3: 0, buffs: 0, p4: 0, speed: 0, p5: 0 });
const zeroRes = { hit: true, damage: 10 };
handler.onPreDealDamageEarly(zero.pieces[0], zero, zeroRes);
assert.equal(zeroRes.damage, 10, 'Null Blade: explicit zero damage remains zero');
assert.equal(zero.pieces[0].bonusDamage, 0, 'Null Blade: explicit zero permanent damage remains zero');
assert.equal(zero.pieces[0].speedScale, 0, 'Null Blade: explicit zero speed remains zero');

console.log('Null Blade source/parity smoke passed.');
