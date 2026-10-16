import assert from 'node:assert/strict';
import fs from 'node:fs';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/EmeraldWhelp.gd', 'utf8');
assert.match(source, /extends Weapon/);
assert.match(source, /func onCombatStart\(\):\s*giveLucky\(getP1\(\)\)\s*activate\(null, false\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):\s*if damageRes\.hasHit\(\):\s*inflictPoison\(getP2\(\)\)/);

const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-start.js', 'utf8');
const whelpBlock = handlerSource.match(/const emeraldWhelpPort = \{[\s\S]*?\n\};/u)?.[0];
assert.ok(whelpBlock, 'Emerald Whelp handler block exists');
assert.doesNotMatch(whelpBlock, /Math\.max\(1, Math\.round\(getP[12]/);
assert.match(whelpBlock, /if \(!res\?\.hit\) return;/);

const sourceItem = inventory.byId.emerald_whelp;
assert.equal(sourceItem.file, 'Exclusive/EmeraldWhelp.gd');
assert.equal(sourceItem.extends, 'Weapon');
assert.deepEqual(sourceItem.overrides.sort(), ['onCombatStart', 'onPreDealDamage_early']);
const handler = getScriptHandler('emerald_whelp');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

function piece(params, overrides = {}) {
  return {
    itemId: 'emerald_whelp',
    placementKey: 'you:emerald-whelp',
    name: 'Emerald Whelp',
    params,
    side: 'you',
    alive: true,
    kind: 'weapon',
    damageMin: 2,
    damageMax: 2,
    accuracy: 100,
    staminaCost: 0,
    ...overrides,
  };
}

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const whelp = piece({ p1: 3, p2: 4 });
const ctx = {
  player,
  dummy,
  events,
  t: 0,
  rng: () => 0,
  notifyPreDealDamageEarly: (item, hookCtx, res) => handler.onPreDealDamageEarly(item, hookCtx, res),
};

handler.onCombatStart(whelp, ctx);
assert.equal(player.stacks.lucky, 3, 'combat start grants source Lucky amount');
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'emerald_whelp').length, 1);

handler.onPreDealDamageEarly(whelp, ctx, { hit: false });
assert.equal(dummy.stacks.poison, 0, 'miss does not apply Poison');
handler.onPreDealDamageEarly(whelp, ctx, { hit: true });
assert.equal(dummy.stacks.poison, 4, 'hit applies source Poison amount');
handler.onPreDealDamageEarly(whelp, ctx, undefined);
assert.equal(dummy.stacks.poison, 4, 'missing damage result does not apply Poison');

const beforeStrikeHp = dummy.hp;
handler.onCooldownEffect(whelp, { ...ctx, t: 4 });
assert.equal(dummy.hp, beforeStrikeHp - 2, 'inherited Weapon cooldown strike deals damage');
assert.equal(dummy.stacks.poison, 8, 'inherited Weapon strike invokes the hit hook');
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'emerald_whelp').length, 2);

const zeroPlayer = createActor('player');
const zeroDummy = createActor('dummy');
const zeroEvents = [];
const zero = piece({ p1: 0, p2: 0 });
const zeroCtx = {
  player: zeroPlayer,
  dummy: zeroDummy,
  events: zeroEvents,
  t: 0,
  rng: () => 0,
  notifyPreDealDamageEarly: (item, hookCtx, res) => handler.onPreDealDamageEarly(item, hookCtx, res),
};
handler.onCombatStart(zero, zeroCtx);
assert.equal(zeroPlayer.stacks.lucky, 0, 'typed zero Lucky stays zero');
handler.onPreDealDamageEarly(zero, zeroCtx, { hit: true });
assert.equal(zeroDummy.stacks.poison, 0, 'typed zero Poison stays zero');
assert.equal(zeroEvents.filter((event) => event.type === 'activate' && event.itemId === 'emerald_whelp').length, 1);

console.log('OK Emerald Whelp source/hooks/strike smoke');
