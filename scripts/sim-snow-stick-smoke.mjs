import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SnowStick.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-onhit.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const snowStickPort'),
  handlerSource.indexOf('/** Boomerang.gd', handlerSource.indexOf('export const snowStickPort') + 1),
);

assert.equal(inventory.byId.snow_stick?.file, 'Exclusive/SnowStick.gd');
assert.deepEqual(inventory.byId.snow_stick?.overrides, ['onPreDealDamage_early']);
assert.match(source, /^extends Weapon/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*inflictCold\(cold\)[\s\S]*giveStacks\(character\(\), Game\.EventType\.Cold, selfCold\)/);
assert.match(portBlock, /onPreDealDamageEarly/);
assert.match(portBlock, /Math\.trunc/);
assert.match(portBlock, /weaponStrike/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(/);

const snowItem = byId.get('snow_stick');
const snow = {
  ...snowItem,
  itemId: 'snow_stick',
  placementKey: 'snow',
  name: 'Snow Stick',
  params: { cold: 2.8, p1: 2.8, cold2: 1.9, p2: 1.9 },
  kind: 'weapon',
};
const player = createActor('player');
const dummy = createActor('dummy');
const ctx = {
  player,
  dummy,
  events: [],
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('snow_stick');

assert.equal(handler?.handlerId, 'snow_stick');
handler.onPreDealDamageEarly(snow, ctx, { hit: true });
assert.equal(dummy.stacks.cold, 2, 'source int(cold) truncates the opponent Cold grant');
assert.equal(player.stacks.cold, 1, 'source int(cold2) truncates the self Cold grant');

handler.onPreDealDamageEarly(snow, ctx, { hit: false });
assert.equal(dummy.stacks.cold, 2, 'a miss does not inflict Cold');
assert.equal(player.stacks.cold, 1, 'a miss does not grant self Cold');

console.log('OK Snow Stick source, inherited Weapon hook, pre-deal timing, integer Cold values, hit gate, and self/opponent effects regression');
