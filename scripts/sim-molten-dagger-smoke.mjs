import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MoltenDagger.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-perm.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'molten_dagger');
assert.ok(sourceItem, 'Molten Dagger: extracted catalog row');
assert.match(source, /func onPreDealDamage_early\(damageRes[^)]*\):[\s\S]*damageRes\.hasHit\(\)/);
assert.match(source, /character\(\)\.getHeat\(\) >= heatNeeded/);
assert.match(source, /addBonusDamage\(bonusDam\)[\s\S]*useHeat\(heatNeeded\)/);
assert.match(port, /handlerId: 'molten_dagger'/);
const daggerPort = port.match(/const moltenDaggerPort[\s\S]*?\n\};/u)?.[0] || '';
assert.doesNotMatch(daggerPort, /res\.damage\s*=/,
  'Molten Dagger source addBonusDamage does not alter the current DamageResult');

const handler = getScriptHandler('molten_dagger');
assert.equal(handler?.handlerId, 'molten_dagger');

function makeContext(piece) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  const ctx = {
    t: 1,
    player,
    dummy,
    events,
    rng: () => 0,
    bus,
  };
  ctx.notifyPreDealDamageEarly = (activePiece, hitCtx, res) =>
    handler.onPreDealDamageEarly(activePiece, hitCtx, res);
  piece._eventLog = events;
  piece._owner = player;
  return ctx;
}

function makePiece(params, accuracy = 100) {
  return {
    itemId: 'molten_dagger',
    placementKey: 'molten-dagger',
    name: 'Molten Dagger',
    params,
    side: 'you',
    kind: 'weapon',
    alive: true,
    damageMin: 10,
    damageMax: 10,
    accuracy,
    staminaCost: 0,
    cooldown: 1,
    baseCooldown: 1,
    bonusDamage: 0,
    removableBonusDamage: 0,
  };
}

const piece = makePiece({ p1: 1, p2: 3 });
const ctx = makeContext(piece);
grantStacks(ctx.player, 'heat', 1, { originId: 'fixture' });
bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
const beforeHp = ctx.dummy.hp;
assert.equal(handler.onCooldownEffect(piece, ctx), true, 'Molten Dagger: inherited weapon strike completes');
assert.equal(ctx.dummy.hp, beforeHp - 10,
  'Molten Dagger: source permanent bonus does not increase the triggering hit');
assert.equal(piece.bonusDamage, 3, 'Molten Dagger: a successful heated hit adds permanent damage');
assert.equal(ctx.player.stacks.heat, 0, 'Molten Dagger: successful heated hit spends exact Heat');
assert.equal(ctx.events.filter((event) => event.type === 'activate' && event.itemId === 'molten_dagger').length, 1,
  'Molten Dagger: the inherited weapon strike activates once');

const missPiece = makePiece({ p1: 1, p2: 3 }, 0);
const missCtx = makeContext(missPiece);
grantStacks(missCtx.player, 'heat', 1, { originId: 'fixture' });
const missHp = missCtx.dummy.hp;
bindBuffCombatLog({ events: missCtx.events, getT: () => missCtx.t, dummy: missCtx.dummy });
handler.onCooldownEffect(missPiece, missCtx);
assert.equal(missCtx.dummy.hp, missHp, 'Molten Dagger: a miss deals no damage');
assert.equal(missPiece.bonusDamage, 0, 'Molten Dagger: a miss does not grant permanent damage');
assert.equal(missCtx.player.stacks.heat, 1, 'Molten Dagger: a miss does not spend Heat');

const noHeatPiece = makePiece({ p1: 2, p2: 3 });
const noHeatCtx = makeContext(noHeatPiece);
handler.onCooldownEffect(noHeatPiece, noHeatCtx);
assert.equal(noHeatPiece.bonusDamage, 0, 'Molten Dagger: insufficient Heat leaves the bonus unchanged');

const zeroPiece = makePiece({ p1: 0, p2: 0 });
const zeroCtx = makeContext(zeroPiece);
const zeroHp = zeroCtx.dummy.hp;
handler.onCooldownEffect(zeroPiece, zeroCtx);
assert.equal(zeroCtx.dummy.hp, zeroHp - 10, 'Molten Dagger: explicit zero parameters preserve the base hit');
assert.equal(zeroPiece.bonusDamage, 0, 'Molten Dagger: explicit zero bonus remains zero');
assert.equal(zeroCtx.player.stacks.heat, 0, 'Molten Dagger: explicit zero Heat cost remains zero');

unbindBuffCombatLog();
console.log('Molten Dagger source/parity smoke passed.');
