import assert from 'node:assert/strict';
import fs from 'node:fs';

import rules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = fs.readFileSync('tools/game-extract-full/Items/FancyFencingRapier.gd', 'utf8');
assert.match(source, /onready var luckNeeded: = int\(getP\("luckt"\)\)/);
assert.match(source, /onready var bonusDam: = getP\("dam"\)/);
assert.match(source, /onready var luck: = int\(getP\("luck"\)\)/);
assert.match(source, /if damageRes\.hasHit\(\):[\s\S]*tryUseLucky\(luckNeeded, damageRes\.event\)[\s\S]*addBonusDamage\(bonusDam\)/);
assert.match(source, /else:[\s\S]*giveLucky\(luck, damageRes\.event\)/);

const handler = getScriptHandler('fancy_fencing_rapier');
assert.equal(handler?.handlerId, 'fancy_fencing_rapier');
assert.equal(typeof handler?.onCooldownEffect, 'function');
assert.equal(typeof handler?.onDealtDamage, 'function');

function makeContext(player) {
  player._simT = 2.5;
  return { player, events: [], t: 2.5 };
}

const hitPiece = {
  itemId: 'fancy_fencing_rapier',
  placementKey: 'rapier',
  name: 'Fancy Fencing Rapier',
  params: { luckt: 3, dam: 3, luck: 3, p1: 3, p2: 3, p3: 3 },
  bonusDamage: 0,
};
const hitPlayer = createActor('player', { maxHp: 100 });
hitPlayer.stacks.lucky = 3;
const hitCtx = makeContext(hitPlayer);
handler.onDealtDamage(hitPiece, hitCtx, { hit: true });
assert.equal(hitPlayer.stacks.lucky, 0, 'a hit spends the exact Lucky threshold');
assert.equal(hitPiece.bonusDamage, 3, 'a successful Lucky spend adds source damage');

const missPiece = { ...hitPiece, bonusDamage: 0, placementKey: 'rapier-miss' };
const missPlayer = createActor('player', { maxHp: 100 });
const missCtx = makeContext(missPlayer);
handler.onDealtDamage(missPiece, missCtx, { hit: false });
assert.equal(missPlayer.stacks.lucky, 3, 'a miss grants source Lucky');

const zeroNeedPiece = {
  ...hitPiece,
  placementKey: 'rapier-zero',
  params: { luckt: 0, dam: 5, luck: 0, p1: 0, p2: 5, p3: 0 },
  bonusDamage: 0,
};
const zeroNeedPlayer = createActor('player', { maxHp: 100 });
const zeroNeedCtx = makeContext(zeroNeedPlayer);
handler.onDealtDamage(zeroNeedPiece, zeroNeedCtx, { hit: true });
assert.equal(zeroNeedPiece.bonusDamage, 5, 'zero Lucky threshold still succeeds and adds damage');

const fractionalPiece = {
  ...hitPiece,
  placementKey: 'rapier-fractional',
  params: { luckt: 2.9, dam: 1.5, luck: 2.9, p1: 2.9, p2: 1.5, p3: 2.9 },
  bonusDamage: 0,
};
const fractionalHitPlayer = createActor('player', { maxHp: 100 });
fractionalHitPlayer.stacks.lucky = 2;
const fractionalHitCtx = makeContext(fractionalHitPlayer);
handler.onDealtDamage(fractionalPiece, fractionalHitCtx, { hit: true });
assert.equal(fractionalHitPlayer.stacks.lucky, 0, 'source int() truncates the Lucky threshold');
assert.equal(fractionalPiece.bonusDamage, 1.5, 'damage keeps the source non-integer value');

const fractionalMissPlayer = createActor('player', { maxHp: 100 });
const fractionalMissCtx = makeContext(fractionalMissPlayer);
handler.onDealtDamage(fractionalPiece, fractionalMissCtx, { hit: false });
assert.equal(fractionalMissPlayer.stacks.lucky, 2, 'source int() truncates granted Lucky');

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const rapier = catalog.find((item) => item.id === 'fancy_fencing_rapier');
assert.ok(rapier, 'Fancy Fencing Rapier remains in the simulator catalog');
const run = simulateEngine({
  placements: [{ id: 'fancy_fencing_rapier', key: 'rapier', x: 4, y: 4, r: 0 }],
  itemsById: new Map([['fancy_fencing_rapier', rapier]]),
  canAffect: { rulesById: rules.byId },
  durationSec: 8,
  playerMaxStamina: 20,
  dummyAttacks: false,
  seed: 1,
});
const itemEvents = run.events.filter((event) => event.itemId === 'fancy_fencing_rapier');
assert.equal(itemEvents.filter((event) => event.type === 'damage').length, 2, 'engine preserves two landed rapier attacks');
assert.equal(itemEvents.filter((event) => event.type === 'miss').length, 1, 'engine preserves a missed rapier attack');
assert.ok(itemEvents.some((event) => event.type === 'buff' && event.amount === 3), 'engine grants Lucky after a miss');
assert.ok(itemEvents.some((event) => event.type === 'buff' && event.amount === -3), 'engine spends Lucky after a hit');

console.log('OK Fancy Fencing Rapier source and on-hit regression');
