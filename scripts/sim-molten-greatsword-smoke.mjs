import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { itemTypeMultiplicity } from '../js/pages/sim/engine/scripts/ports-util.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MoltenGreatsword.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-heat.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'molten_greatsword');
assert.ok(sourceItem, 'Molten Greatsword: extracted catalog row');
assert.match(source, /func onPreDealDamage_early\(damageRes[^)]*\):[\s\S]*damageRes\.hasHit\(\)/);
assert.match(source, /character\(\)\.getHeat\(\) >= heatNeeded/);
assert.match(source, /var event = useHeat\(heatNeeded\)[\s\S]*giveEmpower\(empower, event\)/);
assert.match(source, /func getTypeMultiplicity\(type: int\)[\s\S]*fireMultiplicity/);
assert.match(port, /handlerId: 'molten_greatsword'/);
assert.match(port, /return weaponStrike\(piece, ctx, 'molten_greatsword'\)/);
assert.doesNotMatch(port, /moltenGreatswordPort[\s\S]*pushActivate\(piece/,
  'Molten Greatsword activation is owned by inherited Weapon.attack ordering');

const handler = getScriptHandler('molten_greatsword');
assert.equal(handler?.handlerId, 'molten_greatsword');
assert.equal(itemTypeMultiplicity(sourceItem, 'fire'), 10,
  'Molten Greatsword: source fire multiplicity is preserved');

function makePiece(params, staminaCost = 0) {
  return {
    itemId: 'molten_greatsword',
    placementKey: 'molten-greatsword',
    name: 'Molten Greatsword',
    params,
    side: 'you',
    kind: 'weapon',
    alive: true,
    damageMin: 10,
    damageMax: 10,
    accuracy: 100,
    staminaCost,
    cooldown: 1,
    baseCooldown: 1,
    bonusDamage: 0,
  };
}

function makeContext(piece) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  piece._eventLog = events;
  piece._owner = player;
  const ctx = { t: 2, player, dummy, events, rng: () => 0, bus };
  ctx.notifyPreDealDamageEarly = (activePiece, hitCtx, res) =>
    handler.onPreDealDamageEarly(activePiece, hitCtx, res);
  return ctx;
}

const piece = makePiece({ heat: 2, empower: 4, p1: 5, p2: 1.5, p3: 2 });
const ctx = makeContext(piece);
grantStacks(ctx.player, 'heat', 2, { originId: 'fixture' });
bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
const beforeHp = ctx.dummy.hp;
assert.equal(handler.onCooldownEffect(piece, ctx), true,
  'Molten Greatsword: inherited weapon strike completes');
assert.equal(ctx.dummy.hp, beforeHp - 10,
  'Molten Greatsword: Empower granted by the early hook does not boost the current rolled hit');
assert.equal(ctx.player.stacks.heat, 0, 'Molten Greatsword: successful hit spends exact Heat');
assert.equal(ctx.player.stacks.empower, 4, 'Molten Greatsword: successful hit grants exact Empower');
const damageIndex = ctx.events.findIndex((event) => event.type === 'damage' && event.itemId === 'molten_greatsword');
const activationIndex = ctx.events.findIndex((event) => event.type === 'activate' && event.itemId === 'molten_greatsword');
assert.ok(damageIndex >= 0, 'Molten Greatsword: damage is logged');
assert.ok(activationIndex > damageIndex, 'Molten Greatsword: activation follows the inherited weapon damage');

const noHeatPiece = makePiece({ heat: 2, empower: 4 });
const noHeatCtx = makeContext(noHeatPiece);
const noHeatHp = noHeatCtx.dummy.hp;
handler.onCooldownEffect(noHeatPiece, noHeatCtx);
assert.equal(noHeatCtx.dummy.hp, noHeatHp - 10, 'Molten Greatsword: no Heat still performs the base hit');
assert.equal(noHeatCtx.player.stacks.empower, 0, 'Molten Greatsword: no Heat grants no Empower');

const zeroPiece = makePiece({ heat: 0, empower: 0, p1: 0, p2: 0 });
const zeroCtx = makeContext(zeroPiece);
const zeroHp = zeroCtx.dummy.hp;
handler.onCooldownEffect(zeroPiece, zeroCtx);
assert.equal(zeroCtx.dummy.hp, zeroHp - 10, 'Molten Greatsword: explicit zero values preserve the base hit');
assert.equal(zeroCtx.player.stacks.heat, 0, 'Molten Greatsword: explicit zero Heat cost remains zero');
assert.equal(zeroCtx.player.stacks.empower, 0, 'Molten Greatsword: explicit zero Empower remains zero');

const starvedPiece = makePiece({ heat: 0, empower: 4 }, 5);
const starvedCtx = makeContext(starvedPiece);
starvedCtx.player.stamina = 0;
const starvedHp = starvedCtx.dummy.hp;
assert.equal(handler.onCooldownEffect(starvedPiece, starvedCtx), false,
  'Molten Greatsword: insufficient stamina skips the inherited attack');
assert.equal(starvedCtx.dummy.hp, starvedHp, 'Molten Greatsword: starvation deals no damage');
assert.equal(starvedCtx.events.filter((event) => event.type === 'activate').length, 0,
  'Molten Greatsword: starvation does not activate');

unbindBuffCombatLog();
console.log('Molten Greatsword source/parity smoke passed.');
